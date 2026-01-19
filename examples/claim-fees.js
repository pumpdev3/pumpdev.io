/**
 * PumpDev API Example: Claim Creator Fees
 * 
 * Token creators on Pump.fun earn 1% of all trading volume.
 * This example demonstrates how to claim accumulated fees.
 * 
 * Note: Creator fees are per-creator (not per-token), so you can
 * claim ALL fees from ALL your tokens in ONE transaction!
 * 
 * Documentation: https://pumpdev.io/claim-fees
 */

import dotenv from 'dotenv';
dotenv.config();

import { VersionedTransaction, Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

// Configuration
const API_URL = process.env.PUMPDEV_API_URL || 'https://pumpdev.io';
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Validate environment
if (!PRIVATE_KEY) {
  console.error('❌ PRIVATE_KEY not set in environment variables!');
  console.error('   Copy .env.example to .env and add your private key');
  process.exit(1);
}

/**
 * Claim all creator fees in one transaction
 */
async function claimFees() {
  console.log('=== CLAIM CREATOR FEES ===\n');

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const publicKey = keypair.publicKey.toBase58();
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('Creator wallet:', publicKey);

  // Check balance before claiming
  const balanceBefore = await connection.getBalance(new PublicKey(publicKey));
  console.log('Balance before:', (balanceBefore / LAMPORTS_PER_SOL).toFixed(4), 'SOL');

  // Build claim transaction
  console.log('\nBuilding claim transaction...');
  
  const response = await fetch(`${API_URL}/api/claim-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: publicKey,
      priorityFee: 0.0001
    })
  });

  if (response.status !== 200) {
    const error = await response.json();
    
    if (error.error?.includes('No claimable fees')) {
      console.log('\n📭 No fees to claim right now.');
      return;
    }
    
    console.error('API Error:', error);
    return;
  }

  // Deserialize and sign
  const data = await response.arrayBuffer();
  const tx = VersionedTransaction.deserialize(new Uint8Array(data));
  tx.sign([keypair]);

  // Send transaction
  console.log('Sending transaction...');

  try {
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3
    });

    console.log('\n✅ Transaction sent!');
    console.log('Signature:', signature);
    console.log(`Solscan: https://solscan.io/tx/${signature}`);

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    // Check new balance
    const balanceAfter = await connection.getBalance(new PublicKey(publicKey));
    const feesReceived = (balanceAfter - balanceBefore) / LAMPORTS_PER_SOL;

    console.log('\n═══════════════════════════════════');
    console.log('Balance after:', (balanceAfter / LAMPORTS_PER_SOL).toFixed(4), 'SOL');
    console.log('Fees claimed:', feesReceived.toFixed(4), 'SOL');
    console.log('═══════════════════════════════════');
  } catch (err) {
    console.error('Send error:', err.message);
  }
}

/**
 * Set up automated fee claiming (runs every X hours)
 */
async function automatedClaiming(intervalHours = 24) {
  console.log(`=== AUTOMATED FEE CLAIMING ===`);
  console.log(`Running every ${intervalHours} hours\n`);

  // Run immediately
  await claimFees();

  // Then run on interval
  setInterval(async () => {
    console.log('\n─'.repeat(40));
    console.log(`[${new Date().toISOString()}] Running scheduled claim...`);
    await claimFees();
  }, intervalHours * 60 * 60 * 1000);

  console.log(`\nScheduler running. Press Ctrl+C to stop.`);
}

// Main execution
async function main() {
  try {
    // Option 1: Single claim
    await claimFees();
    
    // Option 2: Automated claiming (uncomment to use)
    // await automatedClaiming(24); // Every 24 hours
    
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
