/**
 * PumpDev API Example: Local-Sign Bundle
 *
 * Local-Sign Bundle = client-side signing + Jito bundles.
 * API builds unsigned transactions, you sign with your private key, you send to Jito.
 * Uses publicKey per account (no API key / wallet import needed).
 *
 * This example demonstrates:
 * 1. Single-wallet buy (build + sign + send)
 * 2. Multi-wallet buy bundle
 * 3. Sell 100%
 * 4. Create token + dev buy
 * 5. Create token + multiple buyers
 *
 * Documentation: https://pumpdev.io/lightning-bundle#local-sign-apibundle
 */

import { VersionedTransaction, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import dotenv from "dotenv";
dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URL = process.env.PUMPDEV_API_URL || "https://pumpdev.io";
const JITO_URL = "https://mainnet.block-engine.jito.wtf";

// Load wallets from private keys
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const PRIVATE_KEY_2 = process.env.PRIVATE_KEY_2;

const wallet1 = PRIVATE_KEY
  ? Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY))
  : null;
const wallet2 = PRIVATE_KEY_2
  ? Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY_2))
  : null;

const TOKEN_MINT = process.env.TOKEN_MINT || "TokenMintAddress";

// ============================================================================
// HELPERS
// ============================================================================

/** Call /api/bundle and return the response data. */
async function callBundle(body) {
  const res = await fetch(`${API_URL}/api/bundle`, {
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

/**
 * Sign all transactions in the bundle response.
 * For create txs, signs with both wallet and mint keypair.
 * For buy/sell txs, signs with wallet only.
 */
function signTransactions(data, walletMap) {
  const mintKeypair = data.mintSecretKey
    ? Keypair.fromSecretKey(bs58.decode(data.mintSecretKey))
    : null;

  return data.transactions.map((entry) => {
    const tx = VersionedTransaction.deserialize(
      bs58.decode(entry.transaction),
    );

    // Determine signers for this tx
    const signers = [];
    const walletPubkey = entry.publicKey;
    const wallet = walletMap[walletPubkey];
    if (wallet) signers.push(wallet);

    // Create txs also need the mint keypair
    if (entry.type === "create" && mintKeypair) {
      signers.push(mintKeypair);
    }

    tx.sign(signers);
    return bs58.encode(tx.serialize());
  });
}

/** Send signed transactions to Jito as a bundle. */
async function sendToJito(signedTxs) {
  const res = await fetch(`${JITO_URL}/api/v1/bundles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "sendBundle",
      params: [signedTxs],
    }),
  });

  const result = await res.json();
  if (result.error) {
    throw new Error(`Jito error: ${JSON.stringify(result.error)}`);
  }
  return result.result;
}

// ============================================================================
// EXAMPLES
// ============================================================================

/**
 * Example 1: Single-wallet buy — build, sign locally, send to Jito.
 */
async function singleBuy(wallet, mint) {
  console.log("=== SINGLE BUY (Local Sign + Jito) ===\n");

  // 1. Build unsigned transactions
  const data = await callBundle({
    accounts: [
      {
        publicKey: wallet.publicKey.toBase58(),
        type: "buy",
        amount: 0.01,
        denominatedInSol: "true",
      },
    ],
    mint,
    jitoTip: 0.01,
  });

  console.log(`Built ${data.transactions.length} unsigned tx(s)`);
  console.log("  Type:", data.transactions[0].type);
  console.log("  Signers:", data.transactions[0].signers);

  // 2. Sign locally
  const walletMap = { [wallet.publicKey.toBase58()]: wallet };
  const signedTxs = signTransactions(data, walletMap);

  // 3. Send to Jito
  const bundleId = await sendToJito(signedTxs);
  console.log("  Bundle ID:", bundleId);
  return data;
}

/**
 * Example 2: Multi-wallet buy — two wallets buy atomically.
 */
async function multiWalletBuy(w1, w2, mint) {
  console.log("=== MULTI-WALLET BUY (Local Sign + Jito) ===\n");

  const data = await callBundle({
    accounts: [
      {
        publicKey: w1.publicKey.toBase58(),
        type: "buy",
        amount: 0.01,
        denominatedInSol: "true",
      },
      {
        publicKey: w2.publicKey.toBase58(),
        type: "buy",
        amount: 0.02,
        denominatedInSol: "true",
      },
    ],
    mint,
    jitoTip: 0.01,
  });

  console.log(`Built ${data.transactions.length} unsigned tx(s)`);

  const walletMap = {
    [w1.publicKey.toBase58()]: w1,
    [w2.publicKey.toBase58()]: w2,
  };
  const signedTxs = signTransactions(data, walletMap);
  const bundleId = await sendToJito(signedTxs);

  console.log("  Bundle ID:", bundleId);
  return data;
}

/**
 * Example 3: Sell 100% of a token.
 */
async function sellAll(wallet, mint) {
  console.log("=== SELL 100% (Local Sign + Jito) ===\n");

  const data = await callBundle({
    accounts: [
      { publicKey: wallet.publicKey.toBase58(), type: "sell", amount: "100%" },
    ],
    mint,
    slippage: 99,
    jitoTip: 0.01,
  });

  console.log(`Built ${data.transactions.length} unsigned tx(s)`);

  const walletMap = { [wallet.publicKey.toBase58()]: wallet };
  const signedTxs = signTransactions(data, walletMap);
  const bundleId = await sendToJito(signedTxs);

  console.log("  Bundle ID:", bundleId);
  return data;
}

/**
 * Example 4: Create token + dev buy atomically.
 * Note: mintSecretKey is returned — needed to sign the create transaction.
 */
async function createAndBuy(wallet) {
  console.log("=== CREATE TOKEN + DEV BUY (Local Sign + Jito) ===\n");

  const data = await callBundle({
    accounts: [
      {
        publicKey: wallet.publicKey.toBase58(),
        type: "create",
        name: "My Token",
        symbol: "MTK",
        image: "https://pumpdev.io/img/logo.jpg",
        description: "Created via PumpDev Local-Sign Bundle",
      },
      {
        publicKey: wallet.publicKey.toBase58(),
        type: "buy",
        amount: 0.5,
        denominatedInSol: "true",
      },
    ],
    jitoTip: 0.02,
  });

  console.log(`Built ${data.transactions.length} unsigned tx(s)`);
  console.log("  Mint:", data.mint);
  console.log("  Create signers:", data.transactions[0].signers);
  console.log("  Buy signers:", data.transactions[1].signers);
  console.log("  mintSecretKey provided:", !!data.mintSecretKey);

  const walletMap = { [wallet.publicKey.toBase58()]: wallet };
  const signedTxs = signTransactions(data, walletMap);
  const bundleId = await sendToJito(signedTxs);

  console.log("  Bundle ID:", bundleId);
  console.log(`  https://pump.fun/${data.mint}`);
  return data;
}

/**
 * Example 5: Create token + multiple buyers atomically.
 */
async function createWithMultipleBuyers(creator, sniper) {
  console.log("=== CREATE + MULTIPLE BUYERS (Local Sign + Jito) ===\n");

  const data = await callBundle({
    accounts: [
      {
        publicKey: creator.publicKey.toBase58(),
        type: "create",
        name: "Bundle Launch",
        symbol: "BDL",
        image: "https://pumpdev.io/img/logo.jpg",
      },
      {
        publicKey: creator.publicKey.toBase58(),
        type: "buy",
        amount: 0.5,
        denominatedInSol: "true",
      },
      {
        publicKey: sniper.publicKey.toBase58(),
        type: "buy",
        amount: 1.0,
        denominatedInSol: "true",
      },
    ],
    jitoTip: 0.02,
  });

  console.log(`Built ${data.transactions.length} unsigned tx(s)`);

  const walletMap = {
    [creator.publicKey.toBase58()]: creator,
    [sniper.publicKey.toBase58()]: sniper,
  };
  const signedTxs = signTransactions(data, walletMap);
  const bundleId = await sendToJito(signedTxs);

  console.log("  Bundle ID:", bundleId);
  console.log(`  https://pump.fun/${data.mint}`);
  return data;
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("\n=== PumpDev Local-Sign Bundle Example ===");
  console.log("https://pumpdev.io/lightning-bundle#local-sign-apibundle\n");

  if (!wallet1) {
    console.log("Set PRIVATE_KEY in .env to run examples.");
    console.log("Example: PRIVATE_KEY=YourBase58PrivateKey\n");
    process.exit(0);
  }

  try {
    // --- Uncomment the example you want to run ---

    // 1. Single buy
    // await singleBuy(wallet1, TOKEN_MINT);

    // 2. Multi-wallet buy (needs PRIVATE_KEY_2)
    // await multiWalletBuy(wallet1, wallet2, TOKEN_MINT);

    // 3. Sell 100%
    // await sellAll(wallet1, TOKEN_MINT);

    // 4. Create token + dev buy
    // await createAndBuy(wallet1);

    // 5. Create + multiple buyers (needs PRIVATE_KEY_2)
    // await createWithMultipleBuyers(wallet1, wallet2);

    console.log("Uncomment an example in main() to run it.\n");
  } catch (err) {
    console.error("\nError:", err.message);
    process.exit(1);
  }
}

main();
