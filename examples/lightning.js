/**
 * PumpDev API Example: Lightning Endpoints
 *
 * Lightning = server-side signing. One HTTP call = trade done.
 * No need to handle transaction building or signing locally.
 *
 * This example demonstrates:
 * 1. Create a Lightning wallet (or import existing)
 * 2. Check wallet info
 * 3. Buy a token via Lightning
 * 4. Sell a token via Lightning
 * 5. Create a token via Lightning (with server-side metadata)
 * 6. Upload metadata separately
 *
 * Documentation: https://pumpdev.io/lightning-setup
 */

import dotenv from "dotenv";
dotenv.config();

// ============================================================================
// CONFIGURATION
// ============================================================================

const API_URL = process.env.PUMPDEV_API_URL || "https://pumpdev.io";
const API_KEY = process.env.LIGHTNING_API_KEY;

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Create a new Lightning wallet.
 * Returns { apiKey, publicKey, privateKey } — SAVE THESE SECURELY!
 */
async function createWallet() {
  console.log("=== CREATE WALLET ===\n");

  const res = await fetch(`${API_URL}/api/wallet/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });

  const data = await res.json();
  if (res.status !== 200) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  console.log("✅ Wallet created!");
  console.log("   📌 API Key:", data.apiKey);
  console.log("   📌 Public Key:", data.publicKey);
  console.log("   ⚠️  Private Key:", data.privateKey, "(SAVE SECURELY!)");
  console.log("   ⚠️ ", data.warning);
  return data;
}

/**
 * Import an existing wallet by private key.
 * Returns { apiKey, publicKey } — no private key in response.
 */
async function importWallet(privateKey) {
  console.log("=== IMPORT WALLET ===\n");

  const res = await fetch(`${API_URL}/api/wallet/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ privateKey }),
  });

  const data = await res.json();
  if (res.status !== 200) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  console.log("✅ Wallet imported!");
  console.log("   📌 API Key:", data.apiKey);
  console.log("   📌 Public Key:", data.publicKey);
  console.log("   ⚠️ ", data.warning);
  return data;
}

/**
 * Get wallet info (no private key returned).
 */
async function getWalletInfo(apiKey) {
  console.log("=== WALLET INFO ===\n");

  const url = `${API_URL}/api/wallet/info?api-key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, { method: "GET" });

  const data = await res.json();
  if (res.status !== 200) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  console.log("✅ Wallet info:");
  console.log("   📌 Public Key:", data.publicKey);
  console.log("   📅 Created:", data.createdAt);
  console.log("   📅 Last Used:", data.lastUsedAt || "never");
  if (data.label) console.log("   🏷️  Label:", data.label);
  return data;
}

/**
 * Buy tokens via Lightning (server signs and sends).
 */
async function buyToken(apiKey, mint, amountSol) {
  console.log("=== BUY TOKEN (Lightning) ===\n");

  const url = `${API_URL}/api/trade-lightning?api-key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "buy",
      mint,
      amount: amountSol,
      denominatedInSol: "true",
      slippage: 15,
      priorityFee: 0.0005,
    }),
  });

  const data = await res.json();
  if (res.status !== 200) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  console.log("✅ Buy executed!");
  console.log("   📌 Signature:", data.signature);
  console.log("   🔗 Solscan:", data.solscan);
  return data;
}

/**
 * Sell tokens via Lightning (server signs and sends).
 */
async function sellToken(apiKey, mint, amountPercent) {
  console.log("=== SELL TOKEN (Lightning) ===\n");

  const url = `${API_URL}/api/trade-lightning?api-key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "sell",
      mint,
      amount: amountPercent,
      denominatedInSol: "false",
      slippage: 99,
      priorityFee: 0.0005,
    }),
  });

  const data = await res.json();
  if (res.status !== 200) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  console.log("✅ Sell executed!");
  console.log("   📌 Signature:", data.signature);
  console.log("   🔗 Solscan:", data.solscan);
  return data;
}

/**
 * Create a token via Lightning (server stores metadata, builds, signs, sends).
 */
async function createToken(apiKey, params) {
  console.log("=== CREATE TOKEN (Lightning) ===\n");

  const url = `${API_URL}/api/create-lightning?api-key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });

  const data = await res.json();
  if (res.status !== 200) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  console.log("✅ Token created!");
  console.log("   📌 Mint:", data.mint);
  console.log("   📌 Signature:", data.signature);
  console.log("   📌 Metadata URI:", data.metadataUri);
  return data;
}

/**
 * Upload metadata separately (returns URI for use in create).
 */
async function uploadMetadata({
  name,
  symbol,
  image,
  description,
  twitter,
  telegram,
  website,
}) {
  console.log("=== UPLOAD METADATA ===\n");

  const res = await fetch(`${API_URL}/api/metadata/upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      symbol,
      image: image || "https://pumpdev.io/img/logo.jpg",
      description: description || "Launched on pumpdev.io — the fastest Pump.fun API",
      twitter: twitter || "",
      telegram: telegram || "",
      website: website || "",
      showName: true,
    }),
  });

  const data = await res.json();
  if (res.status !== 200) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  console.log("✅ Metadata uploaded!");
  console.log("   📌 UUID:", data.uuid);
  console.log("   📌 URI:", data.uri);
  return data;
}

// ============================================================================
// MAIN — DEMONSTRATE FULL FLOW
// ============================================================================

async function main() {
  console.log(
    "\n╔════════════════════════════════════════════════════════════╗",
  );
  console.log(
    "║   PumpDev Lightning API Example                             ║",
  );
  console.log(
    "║   https://pumpdev.io/lightning-setup                        ║",
  );
  console.log(
    "╚════════════════════════════════════════════════════════════╝\n",
  );

  const TOKEN_MINT = "5cRp2cAShKESQR17AgawG4KHXogkeRi5mF7Vdkek1ZSC";

  try {
    // -----------------------------------------------------------------------
    // 1. Wallet: Create or use existing API key
    // -----------------------------------------------------------------------
    let apiKey = API_KEY;

    if (!apiKey) {
      console.log(
        "📌 No LIGHTNING_API_KEY in .env — creating new wallet for demo.\n",
      );
      const created = await createWallet();
      apiKey = created.apiKey;
      console.log("\n⚠️  Add to .env: LIGHTNING_API_KEY=" + apiKey);
      console.log("   Fund the wallet before running buy/sell!\n");
    } else {
      console.log("📌 Using LIGHTNING_API_KEY from .env\n");
    }

    // -----------------------------------------------------------------------
    // 2. Wallet info
    // -----------------------------------------------------------------------
    await getWalletInfo(apiKey);

    // -----------------------------------------------------------------------
    // 3. Upload metadata (standalone)
    // -----------------------------------------------------------------------
    const meta = await uploadMetadata({
      name: "Lightning Demo",
      symbol: "LGT",
      image: "https://pumpdev.io/img/logo.jpg",
    });

    // -----------------------------------------------------------------------
    // 4. Create token via Lightning (commented — creates real token!)
    // -----------------------------------------------------------------------
    /*
    const created = await createToken(apiKey, {
      name: "Lightning Demo",
      symbol: "LGT",
      image: "https://pumpdev.io/img/logo.jpg",
      buyAmountSol: 0.01,
      slippage: 30,
      priorityFee: 0.005,
    });
    */

    // -----------------------------------------------------------------------
    // 4b. Create token with vanity mint address (commented — creates real token!)
    //     Use a pre-generated keypair so your token mint ends with "pump".
    //     Generate one with: solana-keygen grind --ends-with pump:1
    // -----------------------------------------------------------------------
    /*
    const created = await createToken(apiKey, {
      name: "Lightning Demo",
      symbol: "LGT",
      image: "https://pumpdev.io/img/logo.jpg",
      mintKeypair: "YOUR_VANITY_MINT_SECRET_KEY_BASE58", // base58 secret key
      buyAmountSol: 0.01,
      slippage: 30,
      priorityFee: 0.005,
    });
    console.log("Vanity mint address:", created.mint); // e.g. "...pump"
    */

    // -----------------------------------------------------------------------
    // 5. Buy token via Lightning (commented — spends real SOL!)
    // -----------------------------------------------------------------------
    /*
    await buyToken(apiKey, TOKEN_MINT, 0.001);
    */

    // -----------------------------------------------------------------------
    // 6. Sell token via Lightning (commented — sells real tokens!)
    // -----------------------------------------------------------------------
    /*
    await sellToken(apiKey, TOKEN_MINT, "100%");
    */

    // -----------------------------------------------------------------------
    // 7. Import existing wallet (commented — for demo only)
    // -----------------------------------------------------------------------
    /*
    const privateKey = "YOUR_BASE58_PRIVATE_KEY";
    await importWallet(privateKey);
    */

    console.log("========================================");
    console.log("✅ Lightning API demo complete!");
    console.log("   Uncomment buy/sell/create sections to run real trades.");
    console.log("========================================\n");
  } catch (err) {
    console.error("\n❌ Error:", err.message);
    process.exit(1);
  }
}

main();
