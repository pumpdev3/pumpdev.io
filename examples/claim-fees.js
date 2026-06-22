/**
 * PumpDev API Example: Claim Creator Fees
 * 
 * Token creators on Pump.fun earn a percentage of all trading volume.
 * This example demonstrates how to claim accumulated fees.
 * 
 * Five modes:
 *   1. Check balance    — read-only check of claimable creator fees (GET /api/claim-account)
 *   2. Standard claim   — no fee sharing, just pass publicKey (POST /api/claim-account)
 *   3. Fee sharing claim — rewards split to multiple addresses, pass mint too
 *   4. Check cashback   — read-only check of claimable cashback (GET /api/claim-cashback)
 *   5. Cashback claim   — claim accumulated cashback rewards from trading (POST /api/claim-cashback)
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
// Check claimable creator fee balance (read-only, no transaction built)
// ---------------------------------------------------------------------------

/**
 * Check how much creator fees are claimable before building a transaction.
 * Uses GET /api/claim-account — same URL as the claim endpoint, just GET instead of POST.
 */
async function checkClaimBalance() {
  console.log('=== CHECK CLAIMABLE CREATOR FEES ===\n');

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const publicKey = keypair.publicKey.toBase58();

  console.log('Creator wallet:', publicKey);
  if (MINT) console.log('Token mint:', MINT);

  const params = new URLSearchParams({ publicKey });
  if (MINT) params.set('mint', MINT);

  const response = await fetch(`${API_URL}/api/claim-account?${params}`);
  const data = await response.json();

  if (response.status !== 200) {
    console.error('API Error:', data);
    return data;
  }

  console.log(`\nPump balance:     ${data.pumpBalance}`);
  console.log(`PumpSwap balance: ${data.pumpSwapBalance}`);
  console.log(`Total claimable:  ${data.totalClaimable} ${data.isNativeQuote ? 'SOL' : data.quoteMint}`);
  console.log(`Graduated:        ${data.graduated}`);
  console.log(`Fee sharing:      ${data.hasFeeSharing}`);

  if (data.hasFeeSharing && data.shareholders.length > 0) {
    console.log('\nShareholders:');
    for (const sh of data.shareholders) {
      console.log(`  ${sh.address} -> ${sh.sharePercent}%`);
    }
  }

  return data;
}

// ---------------------------------------------------------------------------
// Claim creator fees (auto-detects fee sharing when mint is provided)
// ---------------------------------------------------------------------------

/**
 * Claim creator fees for a wallet.
 * If MINT is set, the API auto-detects fee sharing and uses the correct instruction.
 * Checks claimable balance first, then builds and sends the claim transaction.
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

  // 1. Check claimable balance first (read-only)
  const balanceParams = new URLSearchParams({ publicKey });
  if (MINT) balanceParams.set('mint', MINT);

  const balanceRes = await fetch(`${API_URL}/api/claim-account?${balanceParams}`);
  const balanceData = await balanceRes.json();

  if (balanceRes.status === 200) {
    console.log(`\nClaimable: ${balanceData.totalClaimable} ${balanceData.isNativeQuote ? 'SOL' : balanceData.quoteMint}`);
    if (balanceData.totalClaimable <= 0) {
      console.log('No fees to claim right now.');
      return;
    }
  }

  // 2. Check SOL balance before claiming
  const solBefore = await connection.getBalance(new PublicKey(publicKey));
  console.log('SOL balance before:', (solBefore / LAMPORTS_PER_SOL).toFixed(4), 'SOL');

  // 3. Build claim transaction
  console.log('\nBuilding claim transaction...');

  const body = { publicKey };
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

    // Wait for confirmation
    await connection.confirmTransaction(signature, 'confirmed');

    // Check new balance
    const solAfter = await connection.getBalance(new PublicKey(publicKey));
    const feesReceived = (solAfter - solBefore) / LAMPORTS_PER_SOL;

    console.log('\n===================================');
    console.log('Balance after:', (solAfter / LAMPORTS_PER_SOL).toFixed(4), 'SOL');
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
      mints
    })
  });

  const result = await response.json();
  console.log(`Transactions built: ${result.count}, errors: ${result.errors}\n`);

  for (const txResult of result.transactions) {
    if (txResult.error) {
      console.log(`  ${txResult.mint}: error - ${txResult.error}`);
      continue;
    }

    const graduatedLabel = txResult.graduated ? ' (graduated)' : '';
    console.log(`  ${txResult.mint}: claimable${graduatedLabel}`);

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
      mint
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

    await connection.confirmTransaction(signature, 'confirmed');
  } catch (err) {
    console.error('Send error:', err.message);
  }
}

// ---------------------------------------------------------------------------
// Check claimable cashback balance (read-only, no transaction built)
// ---------------------------------------------------------------------------

/**
 * Check how much cashback is claimable before building a transaction.
 * Uses GET /api/claim-cashback — same URL as the claim endpoint, just GET instead of POST.
 *
 * @param {string} program - Which program to check: 'both' | 'pump' | 'pumpswap'
 */
async function checkCashbackBalance(program = 'both') {
  console.log('=== CHECK CLAIMABLE CASHBACK ===\n');

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const publicKey = keypair.publicKey.toBase58();

  console.log('Wallet:', publicKey);
  console.log('Program:', program);

  const params = new URLSearchParams({ publicKey, program });

  const response = await fetch(`${API_URL}/api/claim-cashback?${params}`);
  const data = await response.json();

  if (response.status !== 200) {
    console.error('API Error:', data);
    return data;
  }

  console.log(`\nPump cashback:     ${data.pumpCashback}`);
  console.log(`PumpSwap cashback: ${data.pumpSwapCashback}`);
  console.log(`Total cashback:    ${data.totalCashback} ${data.isNativeQuote ? 'SOL' : data.quoteMint}`);

  return data;
}

// ---------------------------------------------------------------------------
// Claim cashback rewards (pump.fun cashback feature)
// ---------------------------------------------------------------------------

/**
 * Claim accumulated cashback rewards from trading cashback-enabled tokens.
 * Checks claimable balance first, then builds and sends the claim transaction.
 *
 * @param {string} program - Which program to claim from: 'both' | 'pump' | 'pumpswap'
 */
async function claimCashback(program = 'both') {
  console.log('=== CLAIM CASHBACK REWARDS ===\n');

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const publicKey = keypair.publicKey.toBase58();
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('Wallet:', publicKey);
  console.log('Program:', program);

  // 1. Check claimable cashback first (read-only)
  const balanceRes = await fetch(
    `${API_URL}/api/claim-cashback?${new URLSearchParams({ publicKey, program })}`
  );
  const balanceData = await balanceRes.json();

  if (balanceRes.status === 200) {
    console.log(`\nClaimable cashback: ${balanceData.totalCashback} ${balanceData.isNativeQuote ? 'SOL' : balanceData.quoteMint}`);
    console.log(`  Pump:     ${balanceData.pumpCashback}`);
    console.log(`  PumpSwap: ${balanceData.pumpSwapCashback}`);
    if (balanceData.totalCashback <= 0) {
      console.log('\nNo cashback to claim right now.');
      return;
    }
  }

  // 2. Check SOL balance before claiming
  const solBefore = await connection.getBalance(new PublicKey(publicKey));
  console.log('\nSOL balance before:', (solBefore / LAMPORTS_PER_SOL).toFixed(4), 'SOL');

  // 3. Build cashback claim transaction
  console.log('Building cashback claim transaction...');

  const response = await fetch(`${API_URL}/api/claim-cashback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey,
      program
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

    console.log('\nTransaction sent!');
    console.log('Signature:', signature);

    await connection.confirmTransaction(signature, 'confirmed');

    const solAfter = await connection.getBalance(new PublicKey(publicKey));
    const cashbackReceived = (solAfter - solBefore) / LAMPORTS_PER_SOL;

    console.log('\n===================================');
    console.log('Balance after:', (solAfter / LAMPORTS_PER_SOL).toFixed(4), 'SOL');
    console.log('Cashback claimed:', cashbackReceived.toFixed(4), 'SOL');
    console.log('===================================');
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
    // Check claimable balance (read-only, no transaction):
    await checkClaimBalance();

    // Check claimable cashback (read-only, no transaction):
    // await checkCashbackBalance('both');

    // Standard claim (checks balance first, then claims):
    // await claimFees();

    // Claim cashback rewards from trading cashback-enabled tokens:
    // await claimCashback('both');      // Both programs
    // await claimCashback('pump');      // Bonding curve only
    // await claimCashback('pumpswap');  // PumpSwap AMM only

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
