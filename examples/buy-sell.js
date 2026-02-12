/**
 * PumpDev API Example: Buy and Sell Tokens
 *
 * This example demonstrates how to:
 * 1. Build a buy transaction via the API
 * 2. Sign it locally with your wallet
 * 3. Send to Solana network
 * 4. Execute a sell transaction
 * 5. Execute FAST bundle sell (multiple accounts in ONE request)
 *
 * Documentation: https://pumpdev.io/trade-api
 */

import dotenv from "dotenv";
dotenv.config();

import { VersionedTransaction, Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";

// Configuration
const API_URL = process.env.PUMPDEV_API_URL || "https://pumpdev.io";
const RPC_URL = process.env.RPC_URL || "https://api.mainnet-beta.solana.com";
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Validate environment
if (!PRIVATE_KEY) {
  console.error("❌ PRIVATE_KEY not set in environment variables!");
  console.error("   Copy .env.example to .env and add your private key");
  process.exit(1);
}

/**
 * Buy tokens with SOL
 */
async function buyToken(mint, amountSol) {
  console.log("=== BUY TOKEN ===\n");

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const publicKey = keypair.publicKey.toBase58();

  console.log("Wallet:", publicKey);
  console.log("Token:", mint);
  console.log("Amount:", amountSol, "SOL");

  // 1. Build buy transaction from API
  const response = await fetch(`${API_URL}/api/trade-local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: publicKey,
      action: "buy",
      mint: mint,
      amount: amountSol,
      denominatedInSol: "true",
      slippage: 15, // 15% slippage tolerance
      priorityFee: 0.0005, // Priority fee in SOL
    }),
  });

  if (response.status !== 200) {
    const error = await response.json();
    console.error("API Error:", error);
    return null;
  }

  // 2. Deserialize the unsigned transaction
  const data = await response.arrayBuffer();
  const tx = VersionedTransaction.deserialize(new Uint8Array(data));

  console.log("Transaction received, signing locally...");

  // 3. Sign with your wallet (keys never leave your machine)
  tx.sign([keypair]);

  // 4. Send to Solana via your RPC
  const connection = new Connection(RPC_URL, "confirmed");

  try {
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    console.log("\n✅ Transaction sent!");
    console.log("Signature:", signature);
    console.log(`Solscan: https://solscan.io/tx/${signature}`);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(
      signature,
      "confirmed",
    );

    if (confirmation.value.err) {
      console.error("Transaction failed:", confirmation.value.err);
      return null;
    }

    console.log("Transaction confirmed!");
    return signature;
  } catch (err) {
    console.error("Send error:", err.message);
    return null;
  }
}

/**
 * Sell tokens for SOL
 */
async function sellToken(mint, amountPercent = "100%") {
  console.log("\n=== SELL TOKEN ===\n");

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const publicKey = keypair.publicKey.toBase58();

  console.log("Wallet:", publicKey);
  console.log("Token:", mint);
  console.log("Amount:", amountPercent);

  // 1. Build sell transaction
  // Amount options: '100%', '50%', '25%', or exact token amount (number)
  console.log(
    `\n⏱️  Requesting sell transaction from ${API_URL}/api/trade-local...`,
  );
  const apiStartTime = Date.now();
  const response = await fetch(`${API_URL}/api/trade-local`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      publicKey: publicKey,
      action: "sell",
      mint: mint,
      amount: amountPercent,
      denominatedInSol: "false",
      slippage: 15,
      priorityFee: 0.0005,
    }),
  });

  const apiEndTime = Date.now();
  const apiDuration = apiEndTime - apiStartTime;
  console.log(
    `✅ API response received in ${apiDuration}ms (${(apiDuration / 1000).toFixed(2)}s)`,
  );

  if (response.status !== 200) {
    const error = await response.json();
    console.error("API Error:", error);
    return null;
  }

  // 2. Deserialize and sign
  const data = await response.arrayBuffer();
  const tx = VersionedTransaction.deserialize(new Uint8Array(data));
  tx.sign([keypair]);

  // 3. Send to Solana
  const connection = new Connection(RPC_URL, "confirmed");

  try {
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3,
    });

    console.log("\n✅ Sell transaction sent!");
    console.log("Signature:", signature);
    console.log(`Solscan: https://solscan.io/tx/${signature}`);

    return signature;
  } catch (err) {
    console.error("Send error:", err.message);
    return null;
  }
}

/**
 * 🚀 FAST Bundle Sell - Multiple accounts in ONE API call
 * 
 * This is 3-4x FASTER than making separate API calls for each account!
 * Use this when you need to sell from multiple wallets simultaneously.
 */
async function sellBundleFast(mint, accounts, creatorPublicKey) {
  console.log("\n=== FAST BUNDLE SELL ===\n");
  console.log("Token:", mint);
  console.log("Accounts:", accounts.length);

  const startTime = Date.now();

  // 1. Build ALL transactions in ONE API call (FAST!)
  console.log(`\n⏱️  Building ${accounts.length} transactions in ONE request...`);
  
  const response = await fetch(`${API_URL}/api/trade-bundle`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accounts: accounts.map(acc => ({
        publicKey: acc.keypair.publicKey.toBase58(),
        name: acc.name,
      })),
      action: "sell",
      mint: mint,
      amount: "100%",
      denominatedInSol: "false",
      slippage: 99,
      priorityFee: 0.005,
      creator: creatorPublicKey, // SPEED: skip bonding curve lookup
    }),
  });

  if (response.status !== 200) {
    const error = await response.json();
    console.error("API Error:", error);
    return null;
  }

  const result = await response.json();
  const apiDuration = Date.now() - startTime;
  
  console.log(`✅ API response in ${apiDuration}ms`);
  console.log(`   Built: ${result.stats.success}/${result.stats.total}`);
  console.log(`   Server time: ${result.stats.durationMs}ms`);

  // 2. Sign and send all transactions
  const connection = new Connection(RPC_URL, "confirmed");
  const signatures = [];

  for (const txInfo of result.transactions) {
    if (!txInfo.transaction) {
      console.error(`❌ ${txInfo.name}: ${txInfo.error}`);
      continue;
    }

    // Find matching account
    const account = accounts.find(a => a.name === txInfo.name);
    if (!account) continue;

    try {
      // Deserialize and sign
      const tx = VersionedTransaction.deserialize(bs58.decode(txInfo.transaction));
      tx.sign([account.keypair]);

      // Send (skipPreflight for speed)
      const signature = await connection.sendTransaction(tx, {
        skipPreflight: true,
        maxRetries: 2,
      });

      console.log(`✅ ${txInfo.name} sent: ${signature.slice(0, 20)}...`);
      signatures.push({ name: txInfo.name, signature });
    } catch (err) {
      console.error(`❌ ${txInfo.name} send error: ${err.message}`);
    }
  }

  const totalDuration = Date.now() - startTime;
  console.log(`\n🚀 Total time: ${totalDuration}ms`);
  console.log(`   Successful sends: ${signatures.length}/${accounts.length}`);

  return signatures;
}

// Main execution
async function main() {
  try {
    // Replace with actual token mint address
    const TOKEN_MINT = "YourTokenMintAddressHere";

    // Buy 0.01 SOL worth of tokens
    await buyToken(TOKEN_MINT, 0.01);

    setTimeout(async () => {
      await sellToken(TOKEN_MINT, "100%");
    }, 2 * 1000);

    // Sell 50% of tokens
    // await sellToken(TOKEN_MINT, '50%');

    // === FAST BUNDLE SELL EXAMPLE ===
    // Uncomment below to test bundle sell with multiple accounts
    /*
    const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
    const accounts = [
      { name: "creator", keypair: keypair },
      // Add more accounts here:
      // { name: "bundle1", keypair: Keypair.fromSecretKey(bs58.decode("...")) },
      // { name: "bundle2", keypair: Keypair.fromSecretKey(bs58.decode("...")) },
    ];
    
    await sellBundleFast(
      TOKEN_MINT,
      accounts,
      keypair.publicKey.toBase58() // creator for speed optimization
    );
    */
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
