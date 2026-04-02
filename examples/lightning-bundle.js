/**
 * PumpDev API Example: Lightning Bundle
 *
 * Lightning Bundle = server-side signing + Jito bundles.
 * One HTTP call = up to 4 transactions sent atomically via Jito.
 * No query-level API key needed — each account entry carries its own apiKey.
 *
 * This example demonstrates:
 * 1. Single-wallet buy via Jito bundle
 * 2. Multi-wallet buy bundle
 * 3. Sell 100% via Jito bundle
 * 4. Create token + dev buy atomically
 * 5. Create token + multiple buyers
 * 6. Local-Sign (/api/bundle) — get unsigned txs, sign locally, send to Jito
 *
 * Documentation: https://pumpdev.io/lightning-bundle
 */

import dotenv from "dotenv";
dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URL = process.env.PUMPDEV_API_URL || "https://pumpdev.io";

// API keys from Lightning wallet setup (see lightning.js example)
const WALLET1_KEY = process.env.LIGHTNING_API_KEY;
const WALLET2_KEY = process.env.LIGHTNING_API_KEY_2;

const TOKEN_MINT = process.env.TOKEN_MINT || "TokenMintAddress";

// ============================================================================
// HELPER
// ============================================================================

async function callBundle(body) {
  const res = await fetch(`${API_URL}/api/bundle-lightning`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (res.status !== 200) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data;
}

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * Example 1: Single-wallet buy via Jito bundle.
 * MEV-protected — validators can't front-run your trade.
 */
async function singleBuy(apiKey, mint) {
  console.log("=== SINGLE BUY (Jito Bundle) ===\n");

  const data = await callBundle({
    accounts: [
      { apiKey, type: "buy", amount: 0.01, denominatedInSol: "true" },
    ],
    mint,
    jitoTip: 0.01,
  });

  console.log("Buy executed via Jito!");
  console.log("  Signature:", data.results[0].signature);
  console.log("  Mint:", data.mint);
  return data;
}

/**
 * Example 2: Multi-wallet buy — two wallets buy the same token atomically.
 */
async function multiWalletBuy(apiKey1, apiKey2, mint) {
  console.log("=== MULTI-WALLET BUY (Jito Bundle) ===\n");

  const data = await callBundle({
    accounts: [
      { apiKey: apiKey1, type: "buy", amount: 0.01, denominatedInSol: "true" },
      { apiKey: apiKey2, type: "buy", amount: 0.02, denominatedInSol: "true" },
    ],
    mint,
    jitoTip: 0.01,
  });

  const ok = data.results.filter((r) => r.signature).length;
  console.log(`${ok}/${data.results.length} buys succeeded`);
  data.results.forEach((r, i) => {
    console.log(`  [${i}] ${r.type}: ${r.signature || r.error}`);
  });
  return data;
}

/**
 * Example 3: Sell 100% of a token via Jito bundle.
 */
async function sellAll(apiKey, mint) {
  console.log("=== SELL 100% (Jito Bundle) ===\n");

  const data = await callBundle({
    accounts: [{ apiKey, type: "sell", amount: "100%" }],
    mint,
    slippage: 99,
    jitoTip: 0.01,
  });

  console.log("Sell executed via Jito!");
  console.log("  Signature:", data.results[0].signature);
  return data;
}

/**
 * Example 4: Create a new token + dev buy atomically in one Jito bundle.
 * The create and buy land in the same block — no one can front-run.
 */
async function createAndBuy(apiKey) {
  console.log("=== CREATE TOKEN + DEV BUY (Jito Bundle) ===\n");

  const data = await callBundle({
    accounts: [
      {
        apiKey,
        type: "create",
        name: "My Token",
        symbol: "MTK",
        image: "https://pumpdev.io/img/logo.jpg",
        description: "Created via PumpDev Lightning Bundle",
      },
      { apiKey, type: "buy", amount: 0.5, denominatedInSol: "true" },
    ],
    jitoTip: 0.02,
  });

  console.log("Token launched via Jito!");
  console.log("  Mint:", data.mint);
  console.log("  Create sig:", data.results[0].signature);
  console.log("  Buy sig:", data.results[1].signature);
  console.log(`  https://pump.fun/${data.mint}`);
  return data;
}

/**
 * Example 5: Create token + multiple buyers atomically.
 * Creator launches, dev buys, and snipers buy — all in one block.
 */
async function createWithMultipleBuyers(creatorKey, sniperKey) {
  console.log("=== CREATE + MULTIPLE BUYERS (Jito Bundle) ===\n");

  const data = await callBundle({
    accounts: [
      {
        apiKey: creatorKey,
        type: "create",
        name: "Bundle Launch",
        symbol: "BDL",
        image: "https://pumpdev.io/img/logo.jpg",
      },
      {
        apiKey: creatorKey,
        type: "buy",
        amount: 0.5,
        denominatedInSol: "true",
      },
      {
        apiKey: sniperKey,
        type: "buy",
        amount: 1.0,
        denominatedInSol: "true",
      },
    ],
    jitoTip: 0.02,
  });

  const ok = data.results.filter((r) => r.signature).length;
  console.log(`Token launched! ${ok}/${data.results.length} txs succeeded`);
  console.log(`  https://pump.fun/${data.mint}`);
  return data;
}

/**
 * Example 6: Local-Sign (/api/bundle) — get unsigned txs, sign locally, send to Jito.
 * Uses publicKey (not apiKey) — you sign with your private key on your machine.
 */
async function localSignAndSend(publicKey, privateKey, mint) {
  console.log("=== LOCAL SIGN + MANUAL JITO SEND ===\n");

  // NOTE: Requires @solana/web3.js and bs58 — npm install @solana/web3.js bs58
  const { VersionedTransaction, Keypair } = await import("@solana/web3.js");
  const bs58 = (await import("bs58")).default;
  const wallet = Keypair.fromSecretKey(bs58.decode(privateKey));

  const JITO_URL = "https://mainnet.block-engine.jito.wtf";

  // 1. Build unsigned bundle via PumpDev
  const res = await fetch(`${API_URL}/api/bundle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accounts: [
        {
          publicKey,
          type: "buy",
          amount: 0.01,
          denominatedInSol: "true",
        },
      ],
      mint,
      jitoTip: 0.01,
    }),
  });

  const data = await res.json();
  if (res.status !== 200) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  console.log(`Built ${data.transactions.length} unsigned tx(s)`);
  console.log("  Mint:", data.mint);

  // 2. Sign each transaction locally
  const signedTxs = data.transactions.map((entry) => {
    const tx = VersionedTransaction.deserialize(bs58.decode(entry.transaction));
    tx.sign([wallet]);
    return bs58.encode(tx.serialize());
  });

  console.log(`  Signed ${signedTxs.length} tx(s) locally`);

  // 3. Send to Jito yourself
  const bundleRes = await fetch(`${JITO_URL}/api/v1/bundles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendBundle",
      params: [signedTxs],
    }),
  });

  const bundleResult = await bundleRes.json();
  console.log("  Bundle ID:", bundleResult.result);
  return data;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("\n=== PumpDev Lightning Bundle Example ===");
  console.log("https://pumpdev.io/lightning-bundle\n");

  if (!WALLET1_KEY) {
    console.log("Set LIGHTNING_API_KEY in .env to run examples.");
    console.log("See lightning.js for wallet creation.\n");
    process.exit(0);
  }

  try {
    // --- Uncomment the example you want to run ---

    // 1. Single buy
    // await singleBuy(WALLET1_KEY, TOKEN_MINT);

    // 2. Multi-wallet buy (needs two wallets)
    // await multiWalletBuy(WALLET1_KEY, WALLET2_KEY, TOKEN_MINT);

    // 3. Sell 100%
    // await sellAll(WALLET1_KEY, TOKEN_MINT);

    // 4. Create token + dev buy
    // await createAndBuy(WALLET1_KEY);

    // 5. Create + multiple buyers (needs two wallets)
    // await createWithMultipleBuyers(WALLET1_KEY, WALLET2_KEY);

    // 6. Local sign — get unsigned txs, sign locally, send to Jito
    // Requires WALLET_PRIVATE_KEY and WALLET_PUBLIC_KEY env vars
    // await localSignAndSend(process.env.WALLET_PUBLIC_KEY, process.env.WALLET_PRIVATE_KEY, TOKEN_MINT);

    console.log("Uncomment an example in main() to run it.\n");
  } catch (err) {
    console.error("\nError:", err.message);
    process.exit(1);
  }
}

main();
