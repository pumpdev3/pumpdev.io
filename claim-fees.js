/**
 * PumpDev API Example: Claim Creator Fees
 * 
 * Token creators on Pump.fun earn a percentage of all trading volume.
 * This example demonstrates how to claim accumulated fees.
 * 
 * Two modes:
 *   1. Standard claim   — no fee sharing, just pass publicKey
 *   2. Fee sharing claim — rewards split to multiple addresses, pass mint too
 * 
 * If you configured fee sharing on pump.fun (rewards split to 2+ addresses),
 * you MUST pass the mint so the API can detect it and use the correct instruction.
 * Without mint, it uses the standard collect_creator_fee which won't work
 * when fee sharing is enabled.
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

// Token mint address — REQUIRED when fee sharing is configured (rewards split to multiple addresses)
// Set this to your token's mint address if you have reward distribution enabled
const MINT = process.env.MINT || null;

// Validate environment
if (!PRIVATE_KEY) {
  console.error('PRIVATE_KEY not set in environment variables!');
  console.error('  PRIVATE_KEY=YourBase58Key node claim-fees.js');
  console.error('  PRIVATE_KEY=YourKey MINT=TokenMint node claim-fees.js  (for fee sharing)');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Claim creator fees (auto-detects fee sharing when mint is provided)
// ---------------------------------------------------------------------------

/**
 * Claim creator fees for a wallet.
 * If MINT is set, the API auto-detects fee sharing and uses the correct instruction.
 */
async function claimFees() {
  console.log('=== CLAIM CREATOR FEES ===\n');

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const publicKey = keypair.publicKey.toBase58();
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('Creator wallet:', publicKey);
  if (MINT) {
    console.log('Token mint:', MINT, '(fee sharing will be auto-detected)');
  } else {
    console.log('No mint provided (standard claim, no fee sharing detection)');
  }

  // Check balance before claiming
  const balanceBefore = await connection.getBalance(new PublicKey(publicKey));
  console.log('Balance before:', (balanceBefore / LAMPORTS_PER_SOL).toFixed(4), 'SOL');

  // Build claim transaction
  // When mint is provided, the API checks for fee sharing config on-chain.
  // If fee sharing is active, it builds a distribute_creator_fees instruction
  // that sends rewards to all configured shareholders.
  console.log('\nBuilding claim transaction...');
  
  const body = { publicKey, priorityFee: 0.0001 };
  if (MINT) body.mint = MINT;

  const response = await fetch(`${API_URL}/api/claim-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (response.status !== 200) {
    const error = await response.json();
    
    if (error.error?.includes('No claimable fees')) {
      console.log('\nNo fees to claim right now.');
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

    console.log('\nTransaction sent!');
    console.log('Signature:', signature);
    console.log(`Solscan: https://solscan.io/tx/${signature}`);

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    // Check new balance
    const balanceAfter = await connection.getBalance(new PublicKey(publicKey));
    const feesReceived = (balanceAfter - balanceBefore) / LAMPORTS_PER_SOL;

    console.log('\n===================================');
    console.log('Balance after:', (balanceAfter / LAMPORTS_PER_SOL).toFixed(4), 'SOL');
    console.log('Fees claimed:', feesReceived.toFixed(4), 'SOL');
    console.log('===================================');
  } catch (err) {
    console.error('Send error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Claim from multiple tokens (auto-detects fee sharing per token)
// ---------------------------------------------------------------------------

/**
 * Claim fees from multiple tokens at once.
 * Each token is checked for fee sharing individually.
 * 
 * @param {string[]} mints - Array of token mint addresses
 */
async function claimMultipleMints(mints) {
  console.log('=== CLAIM FEES FROM MULTIPLE TOKENS ===\n');

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const publicKey = keypair.publicKey.toBase58();
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('Creator wallet:', publicKey);
  console.log(`Tokens: ${mints.length}\n`);

  const response = await fetch(`${API_URL}/api/claim-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey,
      mints,
      priorityFee: 0.0001
    })
  });

  const result = await response.json();
  console.log(`Transactions built: ${result.count}, errors: ${result.errors}\n`);

  for (const txResult of result.transactions) {
    if (txResult.error) {
      console.log(`  ${txResult.mint}: error - ${txResult.error}`);
      continue;
    }

    const feeSharingLabel = txResult.feeSharing ? ' (fee sharing)' : '';
    console.log(`  ${txResult.mint}: ${txResult.vaultBalance} SOL${feeSharingLabel}`);

    try {
      const tx = VersionedTransaction.deserialize(bs58.decode(txResult.transaction));
      tx.sign([keypair]);

      const signature = await connection.sendTransaction(tx, {
        skipPreflight: false,
        maxRetries: 3
      });

      console.log(`    -> tx: ${signature}`);
      await connection.confirmTransaction(signature, 'confirmed');
    } catch (err) {
      console.error(`    -> send error: ${err.message}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Distribute creator fees (fee sharing — rewards split to multiple addresses)
// ---------------------------------------------------------------------------

/**
 * Distribute creator fees to all shareholders.
 * Use this when fee sharing is configured (e.g. 50/50 split).
 * Permissionless — any wallet can trigger it.
 * 
 * @param {string} mint - Token mint address (REQUIRED)
 */
async function distributeFees(mint) {
  console.log('=== DISTRIBUTE CREATOR FEES (fee sharing) ===\n');

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const publicKey = keypair.publicKey.toBase58();
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('Payer wallet:', publicKey);
  console.log('Token mint:', mint);

  console.log('\nBuilding distribute transaction...');

  const response = await fetch(`${API_URL}/api/claim-distribute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey,
      mint,
      priorityFee: 0.0001
    })
  });

  if (response.status !== 200) {
    const error = await response.json();
    console.error('API Error:', error);
    return;
  }

  const data = await response.arrayBuffer();
  const tx = VersionedTransaction.deserialize(new Uint8Array(data));
  tx.sign([keypair]);

  console.log('Sending transaction...');

  try {
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3
    });

    console.log('\nFees distributed to all shareholders!');
    console.log('Signature:', signature);
    console.log(`Solscan: https://solscan.io/tx/${signature}`);

    await connection.confirmTransaction(signature, 'confirmed');
  } catch (err) {
    console.error('Send error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Automated claiming (runs every X hours)
// ---------------------------------------------------------------------------

async function automatedClaiming(intervalHours = 24) {
  console.log(`=== AUTOMATED FEE CLAIMING ===`);
  console.log(`Running every ${intervalHours} hours\n`);

  await claimFees();

  setInterval(async () => {
    console.log('\n' + '-'.repeat(40));
    console.log(`[${new Date().toISOString()}] Running scheduled claim...`);
    await claimFees();
  }, intervalHours * 60 * 60 * 1000);

  console.log(`\nScheduler running. Press Ctrl+C to stop.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  try {
    // Standard claim (no fee sharing):
    await claimFees();
    
    // Distribute fees (fee sharing — 50/50 split etc.):
    // await distributeFees('YourTokenMintAddress');

    // Multiple tokens (uncomment and add your mints):
    // await claimMultipleMints(['mint1...', 'mint2...']);
    
    // Automated claiming (uncomment to use):
    // await automatedClaiming(24);
    
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
