/**
 * PumpDev API Example: Lightning Endpoints
 *
 * Lightning = server-side signing. One HTTP call = trade done.
 * No need to handle transaction building or signing locally.
 *
 * This example demonstrates:
 * 1. Create a Lightning wallet (or import existing)
 * 2. Buy a token via Lightning
 * 3. Sell a token via Lightning
 * 4. Create a token via Lightning
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

  console.log("Wallet created!");
  console.log("  API Key:", data.apiKey);
  console.log("  Public Key:", data.publicKey);
  console.log("  Private Key:", data.privateKey, "(SAVE SECURELY!)");
  console.log(" ", data.warning);
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

  console.log("Wallet imported!");
  console.log("  API Key:", data.apiKey);
  console.log("  Public Key:", data.publicKey);
  console.log(" ", data.warning);
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

  console.log("Buy executed!");
  console.log("  Signature:", data.signature);
  console.log("  Solscan:", data.solscan);
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

  console.log("Sell executed!");
  console.log("  Signature:", data.signature);
  console.log("  Solscan:", data.solscan);
  return data;
}

/**
 * Create a token via Lightning — one call, server handles metadata + signing.
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

  console.log("Token created!");
  console.log("  Mint:", data.mint);
  console.log("  Signature:", data.signature);
  console.log("  Metadata URI:", data.metadataUri);
  return data;
}

// ============================================================================
// MAIN — DEMONSTRATE FULL FLOW
// ============================================================================

async function main() {
  console.log("\n=== PumpDev Lightning API Example ===");
  console.log("https://pumpdev.io/lightning-setup\n");

  const TOKEN_MINT = "5cRp2cAShKESQR17AgawG4KHXogkeRi5mF7Vdkek1ZSC";

  try {
    // 1. Wallet: Create or use existing API key
    let apiKey = API_KEY;

    if (!apiKey) {
      console.log(
        "No LIGHTNING_API_KEY in .env — creating new wallet for demo.\n",
      );
      const created = await createWallet();
      apiKey = created.apiKey;
      console.log("\nAdd to .env: LIGHTNING_API_KEY=" + apiKey);
      console.log("Fund the wallet before running buy/sell!\n");
    } else {
      console.log("Using LIGHTNING_API_KEY from .env\n");
    }

    // 2. Create token — just pass image URL, server stores metadata automatically
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

    // 3. Buy token (commented — spends real SOL!)
    /*k
    await buyToken(apiKey, TOKEN_MINT, 0.001);
    */

    // 4. Sell token (commented — sells real tokens!)
    /*
    await sellToken(apiKey, TOKEN_MINT, "100%");
    */

    // 5. Import existing wallet (commented — for demo only)
    /*
    const privateKey = "YOUR_BASE58_PRIVATE_KEY";
    await importWallet(privateKey);
    */

    console.log("\nLightning API demo complete!");
    console.log("Uncomment buy/sell/create sections to run real trades.\n");
  } catch (err) {
    console.error("\nError:", err.message);
    process.exit(1);
  }
}

main();
