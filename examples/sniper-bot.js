/**
 * PumpDev API Example: Sniper Bot
 * 
 * ⚠️ EDUCATIONAL PURPOSES ONLY - Trading bots carry significant financial risk!
 * 
 * This example demonstrates how to:
 * 1. Listen for new token launches via WebSocket
 * 2. Filter tokens based on criteria
 * 3. Automatically execute buy transactions
 * 
 * Documentation: https://pumpdev.io
 */

import dotenv from 'dotenv';
dotenv.config();

import WebSocket from 'ws';
import { VersionedTransaction, Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// Configuration
const API_URL = process.env.PUMPDEV_API_URL || 'https://pumpdev.io';
const WS_URL = process.env.PUMPDEV_WS_URL || 'wss://pumpdev.io/ws';
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Validate environment
if (!PRIVATE_KEY) {
  console.error('❌ PRIVATE_KEY not set in environment variables!');
  console.error('   Copy .env.example to .env and add your private key');
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════
// SNIPER SETTINGS - Customize these for your strategy
// ═══════════════════════════════════════════════════════════════
const SETTINGS = {
  // Trade settings
  buyAmountSol: 0.01,      // Amount to buy in SOL
  slippage: 20,            // Slippage percentage
  priorityFee: 0.001,      // Priority fee for faster inclusion
  
  // Filter criteria
  maxMarketCapSol: 50,     // Only buy if market cap < X SOL
  minInitialBuySol: 0.5,   // Only buy if creator bought at least X SOL
  
  // Optional: Only snipe tokens from specific creators
  watchCreators: [],       // Empty = all creators, or add addresses
  
  // Safety settings
  cooldownMs: 5000,        // Minimum time between buys (ms)
  maxConcurrentBuys: 1,    // Max simultaneous buy attempts
};

// State
let keypair;
let publicKey;
let connection;
let activeBuys = 0;
let lastBuyTime = 0;

async function main() {
  console.log('╔════════════════════════════════════════╗');
  console.log('║      PUMPDEV SNIPER BOT EXAMPLE        ║');
  console.log('╠════════════════════════════════════════╣');
  console.log('║  ⚠️  EDUCATIONAL PURPOSES ONLY         ║');
  console.log('║  ⚠️  USE AT YOUR OWN RISK              ║');
  console.log('╚════════════════════════════════════════╝\n');

  // Initialize wallet
  keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  publicKey = keypair.publicKey.toBase58();
  connection = new Connection(RPC_URL, 'confirmed');

  console.log('📍 Configuration:');
  console.log(`   Wallet: ${publicKey}`);
  console.log(`   Buy Amount: ${SETTINGS.buyAmountSol} SOL`);
  console.log(`   Max Market Cap: ${SETTINGS.maxMarketCapSol} SOL`);
  console.log(`   Min Initial Buy: ${SETTINGS.minInitialBuySol} SOL`);
  console.log(`   Cooldown: ${SETTINGS.cooldownMs}ms`);
  console.log();

  // Connect to WebSocket
  const ws = new WebSocket(WS_URL);

  ws.on('open', () => {
    console.log('✅ Connected to PumpDev WebSocket\n');

    // Subscribe to new token creations
    ws.send(JSON.stringify({
      method: 'subscribeNewToken'
    }));

    console.log('🎯 Watching for new tokens...\n');
    console.log('─'.repeat(50));
  });

  ws.on('message', async (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Only process create events
      if (message.txType === 'create') {
        await handleNewToken(message);
      }
    } catch (err) {
      console.error('Error:', err.message);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });

  ws.on('close', () => {
    console.log('\n🔌 WebSocket disconnected');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down sniper bot...');
    ws.close();
    process.exit(0);
  });
}

/**
 * Handle new token creation event
 */
async function handleNewToken(event) {
  const { mint, name, symbol, traderPublicKey, solAmount, marketCapSol } = event;

  console.log(`\n🆕 NEW: ${name} (${symbol})`);
  console.log(`   Mint: ${mint}`);
  console.log(`   Creator: ${traderPublicKey.slice(0, 8)}...`);
  console.log(`   Initial: ${solAmount} SOL | MCap: ${marketCapSol?.toFixed(2)} SOL`);

  // Check criteria
  const result = checkCriteria(event);
  
  if (!result.pass) {
    console.log(`   ❌ Skip: ${result.reason}`);
    return;
  }

  // Check concurrent buy limit
  if (activeBuys >= SETTINGS.maxConcurrentBuys) {
    console.log('   ⏳ Skip: Max concurrent buys reached');
    return;
  }

  // Check cooldown
  const timeSinceLastBuy = Date.now() - lastBuyTime;
  if (timeSinceLastBuy < SETTINGS.cooldownMs) {
    const remaining = Math.ceil((SETTINGS.cooldownMs - timeSinceLastBuy) / 1000);
    console.log(`   ⏳ Skip: Cooldown (${remaining}s remaining)`);
    return;
  }

  console.log('   ✅ Matches criteria! Executing buy...');
  await executeBuy(mint);
}

/**
 * Check if token matches our criteria
 */
function checkCriteria(event) {
  const { traderPublicKey, solAmount, marketCapSol } = event;

  // Check market cap
  if (marketCapSol && marketCapSol > SETTINGS.maxMarketCapSol) {
    return { pass: false, reason: `Market cap too high (${marketCapSol.toFixed(2)} > ${SETTINGS.maxMarketCapSol})` };
  }

  // Check initial buy amount
  if (solAmount < SETTINGS.minInitialBuySol) {
    return { pass: false, reason: `Initial buy too low (${solAmount} < ${SETTINGS.minInitialBuySol})` };
  }

  // Check creator whitelist (if configured)
  if (SETTINGS.watchCreators.length > 0) {
    if (!SETTINGS.watchCreators.includes(traderPublicKey)) {
      return { pass: false, reason: 'Creator not in whitelist' };
    }
  }

  return { pass: true };
}

/**
 * Execute buy transaction
 */
async function executeBuy(mint) {
  activeBuys++;
  
  try {
    console.log('   📤 Building transaction...');

    // 1. Build buy transaction
    const response = await fetch(`${API_URL}/api/trade-local`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: publicKey,
        action: 'buy',
        mint: mint,
        amount: SETTINGS.buyAmountSol,
        denominatedInSol: 'true',
        slippage: SETTINGS.slippage,
        priorityFee: SETTINGS.priorityFee
      })
    });

    if (response.status !== 200) {
      const error = await response.json();
      console.log(`   ❌ API Error: ${error.error}`);
      return;
    }

    // 2. Deserialize and sign
    const data = await response.arrayBuffer();
    const tx = VersionedTransaction.deserialize(new Uint8Array(data));
    tx.sign([keypair]);

    // 3. Send to Solana
    console.log('   📤 Sending transaction...');

    const signature = await connection.sendTransaction(tx, {
      skipPreflight: true,  // Skip for speed
      maxRetries: 2
    });

    console.log(`   ✅ Sent! ${signature.slice(0, 20)}...`);
    console.log(`   🔗 https://solscan.io/tx/${signature}`);

    // 4. Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');

    if (confirmation.value.err) {
      console.log('   ❌ Transaction failed:', confirmation.value.err);
    } else {
      console.log('   🎉 SUCCESS! Token purchased');
      lastBuyTime = Date.now();
    }
  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
  } finally {
    activeBuys--;
  }
}

main();
