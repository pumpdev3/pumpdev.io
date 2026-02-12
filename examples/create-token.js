/**
 * ============================================================================
 * PumpDev API - Create Token on Pump.fun
 * ============================================================================
 *
 * This example shows how to create tokens on pump.fun using the PumpDev API.
 *
 * Features:
 * - Create token only (no buy)
 * - Create token + dev buy (single transaction, no Jito needed!)
 * - Create token + dev buy via Jito (for faster landing)
 * - Create token + multiple buyers (Jito bundle)
 *
 * IMPORTANT: jitoTip should ONLY be provided if you plan to send via Jito.
 * It adds a Jito tip instruction to the transaction. Without it, the tx
 * can be sent via any standard RPC.
 *
 * Documentation: https://pumpdev.io/create-token
 * Telegram: https://t.me/pumpdev_io
 * Twitter: https://x.com/PumpDevIO
 *
 * ============================================================================
 */

import dotenv from "dotenv";
dotenv.config();

import { VersionedTransaction, Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

// ============================================================================
// CONFIGURATION
// ============================================================================

// PumpDev API URL - use https://pumpdev.io for production
const API_URL = process.env.PUMPDEV_API_URL || "https://pumpdev.io";

// Your Solana RPC endpoint
const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";

// Jito block engine endpoints for bundle submission
const JITO_ENDPOINTS = [
  "https://mainnet.block-engine.jito.wtf",
  "https://amsterdam.mainnet.block-engine.jito.wtf",
  "https://frankfurt.mainnet.block-engine.jito.wtf",
  "https://ny.mainnet.block-engine.jito.wtf",
  "https://tokyo.mainnet.block-engine.jito.wtf",
];

// Your wallet private keys (base58 encoded)
// ⚠️ NEVER commit real private keys to git!
const CREATOR_KEY =
  process.env.CREATOR_KEY || "YOUR_CREATOR_PRIVATE_KEY_BASE58";
const BUYER1_KEY = process.env.BUYER1_KEY || "YOUR_BUYER1_PRIVATE_KEY_BASE58";
const BUYER2_KEY = process.env.BUYER2_KEY || "YOUR_BUYER2_PRIVATE_KEY_BASE58";
const BUYER3_KEY = process.env.BUYER3_KEY || "YOUR_BUYER3_PRIVATE_KEY_BASE58";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Upload token metadata to pump.fun IPFS
 *
 * This creates the token image and metadata that will be displayed on pump.fun.
 * You can customize the name, symbol, description, and social links.
 *
 * @returns {Promise<string>} The metadata URI (ipfs://...)
 */
async function uploadMetadata() {
  console.log("📤 Uploading metadata to pump.fun...");

  const formData = new FormData();

  // Option 1: Use pumpdev.io logo (for testing)
  const logoRes = await fetch("https://pumpdev.io/img/logo.jpg");
  const logoBuffer = await logoRes.arrayBuffer();
  formData.append(
    "file",
    new Blob([logoBuffer], { type: "image/jpeg" }),
    "logo.jpg",
  );

  // Option 2: Use your own image file
  // import fs from 'node:fs/promises';
  // import { Blob } from 'node:buffer';
  // const fileBuffer = await fs.readFile('./your-token-image.jpg');
  // formData.append('file', new Blob([fileBuffer], { type: 'image/jpeg' }), 'token.jpg');

  // Token metadata - customize these for your token!
  formData.append("name", "PUMP FUN API");
  formData.append("symbol", "pumpdev.io");
  formData.append(
    "description",
    "The #1 API for Pump.fun Token Creation & Trading - pumpdev.io",
  );
  formData.append("twitter", "https://x.com/PumpDevIO");
  formData.append("telegram", "https://t.me/pumpdev_io");
  formData.append("website", "https://pumpdev.io/");
  formData.append("showName", "true");

  const res = await fetch("https://pump.fun/api/ipfs", {
    method: "POST",
    body: formData,
  });

  const result = await res.json();
  console.log("✅ Metadata uploaded:", result.metadataUri);
  return result.metadataUri;
}

/**
 * Send transactions as a Jito bundle
 *
 * Jito bundles ensure all transactions land in the same block atomically.
 * This prevents front-running and ensures create + buy happen together.
 *
 * NOTE: Only use Jito when your transaction includes a jitoTip.
 * The jitoTip adds a tip instruction to the transaction that pays Jito validators.
 *
 * @param {string[]} signedTxs - Array of base58 encoded signed transactions
 * @returns {Promise<{success: boolean, bundleId?: string, error?: string}>}
 */
async function sendJitoBundle(signedTxs) {
  console.log("🚀 Sending Jito bundle...");

  // Try each endpoint until one succeeds
  for (const endpoint of JITO_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}/api/v1/bundles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "sendBundle",
          params: [signedTxs],
        }),
      });

      const data = await res.json();

      if (data.result) {
        console.log(`✅ Bundle sent successfully!`);
        console.log(`   Bundle ID: ${data.result}`);
        console.log(
          `   Explorer: https://explorer.jito.wtf/bundle/${data.result}`,
        );
        return { success: true, bundleId: data.result };
      }

      if (data.error) {
        console.log(
          `⚠️ ${endpoint.split("//")[1].split(".")[0]}: ${data.error.message}`,
        );
      }
    } catch (err) {
      continue; // Try next endpoint
    }
  }

  return { success: false, error: "All Jito endpoints failed" };
}

/**
 * Wait for token to appear on-chain
 *
 * @param {Connection} connection - Solana connection
 * @param {PublicKey} mintPubkey - Token mint public key
 * @param {number} maxWaitSec - Maximum seconds to wait
 * @returns {Promise<boolean>} True if token found
 */
async function waitForToken(connection, mintPubkey, maxWaitSec = 30) {
  console.log("⏳ Waiting for confirmation...");

  for (let i = 0; i < maxWaitSec / 2; i++) {
    await wait(2000);
    const info = await connection.getAccountInfo(mintPubkey);
    if (info) {
      console.log("✅ Token confirmed on-chain!");
      return true;
    }
    process.stdout.write(".");
  }

  console.log("\n⚠️ Token not confirmed in time (may still be processing)");
  return false;
}

// ============================================================================
// EXAMPLE 1: Create Token Only (No Buy)
// ============================================================================

/**
 * Create a token on pump.fun without any initial purchase.
 *
 * This is the simplest way to launch a token. The token will be created
 * and anyone can buy it immediately after.
 *
 * Sends via Jito — jitoTip is provided so the tx includes a Jito tip instruction.
 */
async function createTokenOnly() {
  console.log("\n========================================");
  console.log("EXAMPLE 1: Create Token Only");
  console.log("========================================\n");

  // Load creator wallet
  const creator = Keypair.fromSecretKey(bs58.decode(CREATOR_KEY));
  console.log("👤 Creator:", creator.publicKey.toBase58());

  // Step 1: Upload metadata
  const uri = await uploadMetadata();

  // Step 2: Request create transaction from PumpDev API
  console.log("\n📝 Building create transaction...");
  const res = await fetch(`${API_URL}/api/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: creator.publicKey.toBase58(),
      name: "PUMP FUN API",
      symbol: "pumpdev.io",
      uri,
      // jitoTip only needed because we're sending via Jito below
      // Omit jitoTip if sending via standard RPC
      jitoTip: 0.01,
    }),
  });

  const result = await res.json();
  if (res.status !== 200) {
    throw new Error(result.error || "API request failed");
  }

  console.log("📍 Mint address:", result.mint);

  // Step 3: Sign transaction
  // Token creation requires TWO signatures: creator + mint keypair
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));
  const tx = VersionedTransaction.deserialize(bs58.decode(result.transaction));
  tx.sign([creator, mintKeypair]);

  // Step 4: Send via Jito (jitoTip was included in the request)
  const bundleRes = await sendJitoBundle([bs58.encode(tx.serialize())]);

  // Done!
  console.log("\n========================================");
  console.log("🎉 Token created!");
  console.log(`🔗 https://pump.fun/${result.mint}`);
  console.log("========================================\n");
}

// ============================================================================
// EXAMPLE 2: Create Token + Dev Buy (Single TX, No Jito Needed!)
// ============================================================================

/**
 * Create a token AND buy tokens in a SINGLE transaction.
 *
 * This is the recommended approach for simple token launches.
 * The API merges create + buy into ONE atomic transaction.
 * No Jito bundle needed — just sign and send via any standard RPC!
 *
 * KEY: No jitoTip is set here — we're sending via standard RPC.
 */
async function createTokenWithDevBuy() {
  console.log("\n========================================");
  console.log("EXAMPLE 2: Create + Dev Buy (No Jito)");
  console.log("========================================\n");

  const connection = new Connection(RPC_URL, "confirmed");
  const creator = Keypair.fromSecretKey(bs58.decode(CREATOR_KEY));
  console.log("👤 Creator:", creator.publicKey.toBase58());

  // Step 1: Upload metadata
  const uri = await uploadMetadata();

  // Step 2: Request create + buy as single transaction
  // No jitoTip — not needed when sending via standard RPC
  console.log("\n📝 Building create + buy transaction...");
  const res = await fetch(`${API_URL}/api/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: creator.publicKey.toBase58(),
      name: "PUMP FUN API",
      symbol: "pumpdev.io",
      uri,
      buyAmountSol: 0.1, // Dev buy: 0.1 SOL worth of tokens
      slippage: 30, // 30% slippage for new token
      priorityFee: 0.0005, // Solana priority fee
      // NO jitoTip — sending via standard RPC, not Jito
      // Only provide jitoTip if you plan to send via Jito (see Example 2b)
    }),
  });

  const result = await res.json();
  if (res.status !== 200) {
    throw new Error(result.error || "API request failed");
  }

  console.log("📍 Mint address:", result.mint);

  // Step 3: Sign the single transaction with creator + mint keypair
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));
  const tx = VersionedTransaction.deserialize(bs58.decode(result.transaction));
  tx.sign([creator, mintKeypair]);

  // Step 4: Send via standard RPC (no Jito needed!)
  console.log("📤 Sending via standard RPC...");
  const sig = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
    maxRetries: 3,
  });
  console.log(`📤 Sent: ${sig}`);

  // Step 5: Confirm transaction
  console.log("⏳ Confirming transaction...");
  const confirmation = await connection.confirmTransaction(sig, "confirmed");
  if (confirmation.value.err) {
    // Fetch transaction logs for debugging
    try {
      const txDetails = await connection.getTransaction(sig, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (txDetails?.meta?.logMessages) {
        console.error("📋 Transaction logs:");
        txDetails.meta.logMessages.forEach((log) => console.error("  ", log));
      }
    } catch (e) {
      /* logs may not be available yet */
    }
    throw new Error(
      `Transaction failed: ${JSON.stringify(confirmation.value.err)}`,
    );
  }

  // Done!
  console.log("\n========================================");
  console.log("🎉 Token created with dev buy!");
  console.log(`🔗 https://pump.fun/${result.mint}`);
  console.log(`🔍 https://solscan.io/tx/${sig}`);
  console.log("========================================\n");
}

// ============================================================================
// EXAMPLE 2b: Create Token + Dev Buy (via Jito for Faster Landing)
// ============================================================================

/**
 * Same as Example 2 but sends via Jito for faster transaction landing.
 *
 * With jitoTip + buyAmountSol, the API returns SEPARATE transactions
 * (create TX + buy TX) because all instructions won't fit in one tx.
 * Sign each and send as a Jito bundle.
 *
 * KEY: jitoTip is ONLY provided because we're sending via Jito.
 * Do NOT set jitoTip if you're sending via standard RPC.
 */
async function createTokenWithDevBuyJito() {
  console.log("\n========================================");
  console.log("EXAMPLE 2b: Create + Dev Buy (via Jito)");
  console.log("========================================\n");

  const connection = new Connection(RPC_URL, "confirmed");
  const creator = Keypair.fromSecretKey(bs58.decode(CREATOR_KEY));
  console.log("👤 Creator:", creator.publicKey.toBase58());

  // Step 1: Upload metadata
  const uri = await uploadMetadata();

  // Step 2: Request create + buy — WITH jitoTip because sending via Jito
  console.log("\n📝 Building create + buy transaction (with Jito tip)...");
  const res = await fetch(`${API_URL}/api/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: creator.publicKey.toBase58(),
      name: "PUMP FUN API",
      symbol: "pumpdev.io",
      uri,
      buyAmountSol: 0.1, // Dev buy: 0.1 SOL worth of tokens
      slippage: 30, // 30% slippage for new token
      priorityFee: 0.0005, // Solana priority fee
      jitoTip: 0.01, // Only provide when sending via Jito — adds tip instruction
    }),
  });

  const result = await res.json();
  if (res.status !== 200) {
    throw new Error(result.error || "API request failed");
  }

  console.log("📍 Mint address:", result.mint);

  // Step 3: Sign transactions
  // With jitoTip + buyAmountSol, the API returns 2 transactions (Jito bundle)
  // because create + buy + tip + commission exceeds single tx size limit.
  // TX 1 (create): sign with creator + mint keypair
  // TX 2 (buy):    sign with creator only
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));
  console.log(`📦 Transactions: ${result.transactions.length}`);

  const signedTxs = result.transactions.map((txInfo) => {
    const tx = VersionedTransaction.deserialize(
      bs58.decode(txInfo.transaction),
    );
    const signers = txInfo.signers.includes("mint")
      ? [creator, mintKeypair]
      : [creator];
    tx.sign(signers);
    console.log(`✅ Signed: ${txInfo.description}`);
    return bs58.encode(tx.serialize());
  });

  // Step 4: Send as Jito bundle
  const bundleRes = await sendJitoBundle(signedTxs);

  if (bundleRes.success) {
    await waitForToken(connection, mintKeypair.publicKey);
  }

  // Done!
  console.log("\n========================================");
  console.log("🎉 Token created with dev buy (via Jito)!");
  console.log(`🔗 https://pump.fun/${result.mint}`);
  console.log("========================================\n");
}

// ============================================================================
// EXAMPLE 3: Create Token + Multiple Buyers (Jito Bundle)
// ============================================================================

/**
 * Create a token with multiple wallets buying atomically.
 *
 * This is perfect for coordinated launches where you want multiple
 * wallets to buy in the same block as the token creation. All transactions
 * are bundled via Jito, so they either all succeed or all fail together.
 *
 * Use case: Launch token with dev buy + 3 additional buyers for instant volume.
 *
 * NOTE: This uses /api/create-bundle which returns MULTIPLE transactions.
 * jitoTip is required here since bundles are always sent via Jito.
 */
async function createTokenWithMultipleBuyers() {
  console.log("\n========================================");
  console.log("EXAMPLE 3: Create Token + Multiple Buyers");
  console.log("========================================\n");

  const connection = new Connection(RPC_URL, "confirmed");

  // Load all wallets
  const creator = Keypair.fromSecretKey(bs58.decode(CREATOR_KEY));
  const buyer1 = Keypair.fromSecretKey(bs58.decode(BUYER1_KEY));
  const buyer2 = Keypair.fromSecretKey(bs58.decode(BUYER2_KEY));
  const buyer3 = Keypair.fromSecretKey(bs58.decode(BUYER3_KEY));
  const wallets = { creator, buyer1, buyer2, buyer3 };

  console.log("👤 Creator:", creator.publicKey.toBase58());
  console.log("👤 Buyer 1:", buyer1.publicKey.toBase58());
  console.log("👤 Buyer 2:", buyer2.publicKey.toBase58());
  console.log("👤 Buyer 3:", buyer3.publicKey.toBase58());

  // Step 1: Upload metadata
  const uri = await uploadMetadata();

  // Step 2: Request create + multi-buy bundle
  // jitoTip is required for bundles — always sent via Jito
  console.log("\n📝 Building multi-buyer bundle...");
  const res = await fetch(`${API_URL}/api/create-bundle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: creator.publicKey.toBase58(),
      name: "PUMP FUN API",
      symbol: "pumpdev.io",
      uri,
      buyAmountSol: 0.1, // Creator buys 0.1 SOL
      slippage: 30,
      jitoTip: 0.02, // Jito tip — required for bundle, sent via Jito
      additionalBuyers: [
        // Up to 3 additional buyers
        { publicKey: buyer1.publicKey.toBase58(), amountSol: 0.2 },
        { publicKey: buyer2.publicKey.toBase58(), amountSol: 0.3 },
        { publicKey: buyer3.publicKey.toBase58(), amountSol: 0.1 },
      ],
    }),
  });

  const result = await res.json();
  if (res.status !== 200) {
    throw new Error(result.error || "API request failed");
  }

  console.log("📍 Mint address:", result.mint);
  console.log(`📦 Transactions: ${result.transactions.length}`);

  // Step 3: Sign all transactions with appropriate signers
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));

  const signedTxs = result.transactions.map((txInfo) => {
    const tx = VersionedTransaction.deserialize(
      bs58.decode(txInfo.transaction),
    );

    // Map signer names to actual keypairs
    const signers = txInfo.signers
      .map((s) => (s === "mint" ? mintKeypair : wallets[s]))
      .filter(Boolean);

    tx.sign(signers);
    console.log(`✅ Signed: ${txInfo.description}`);
    return bs58.encode(tx.serialize());
  });

  // Step 4: Send as Jito bundle
  const bundleRes = await sendJitoBundle(signedTxs);

  if (bundleRes.success) {
    await waitForToken(connection, mintKeypair.publicKey);
  }

  // Done!
  console.log("\n========================================");
  console.log("🎉 Token created with multiple buyers!");
  console.log(`🔗 https://pump.fun/${result.mint}`);
  console.log("========================================\n");
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log("");
  console.log("╔════════════════════════════════════════╗");
  console.log("║   PumpDev API - Token Creation Demo    ║");
  console.log("║   https://pumpdev.io                   ║");
  console.log("╚════════════════════════════════════════╝");

  // Choose which example to run:

  // await createTokenOnly();              // Just create token (via Jito)
  // await createTokenWithDevBuy();           // Create + dev buy via RPC (RECOMMENDED, no Jito needed!)
  await createTokenWithDevBuyJito(); // Create + dev buy via Jito (for faster landing)
  // await createTokenWithMultipleBuyers(); // Create + multiple buyers (Jito bundle)
}

main().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
