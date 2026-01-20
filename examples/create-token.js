/**
 * ============================================================================
 * PumpDev API - Create Token on Pump.fun
 * ============================================================================
 * 
 * This example shows how to create tokens on pump.fun using the PumpDev API.
 * 
 * Features:
 * - Create token only (no buy)
 * - Create token + dev buy (Jito bundle)
 * - Create token + multiple buyers (Jito bundle)
 * 
 * Documentation: https://pumpdev.io/create-token
 * Telegram: https://t.me/pumpdev_io
 * Twitter: https://x.com/PumpDevIO
 * 
 * ============================================================================
 */

import dotenv from 'dotenv';
dotenv.config();

import { VersionedTransaction, Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

// ============================================================================
// CONFIGURATION
// ============================================================================

// PumpDev API URL - use https://pumpdev.io for production
const API_URL = process.env.PUMPDEV_API_URL || 'https://pumpdev.io';

// Your Solana RPC endpoint
const RPC_URL = process.env.RPC_URL || 'https://api.mainnet-beta.solana.com';

// Jito block engine endpoints for bundle submission
const JITO_ENDPOINTS = [
  'https://mainnet.block-engine.jito.wtf',
  'https://amsterdam.mainnet.block-engine.jito.wtf',
  'https://frankfurt.mainnet.block-engine.jito.wtf',
  'https://ny.mainnet.block-engine.jito.wtf',
  'https://tokyo.mainnet.block-engine.jito.wtf'
];

// Your wallet private keys (base58 encoded)
// ⚠️ NEVER commit real private keys to git!
const CREATOR_KEY = process.env.CREATOR_KEY || 'YOUR_CREATOR_PRIVATE_KEY_BASE58';
const BUYER1_KEY = process.env.BUYER1_KEY || 'YOUR_BUYER1_PRIVATE_KEY_BASE58';
const BUYER2_KEY = process.env.BUYER2_KEY || 'YOUR_BUYER2_PRIVATE_KEY_BASE58';
const BUYER3_KEY = process.env.BUYER3_KEY || 'YOUR_BUYER3_PRIVATE_KEY_BASE58';

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
  console.log('📤 Uploading metadata to pump.fun...');
  
  const formData = new FormData();
  
  // Option 1: Use pumpdev.io logo (for testing)
  const logoRes = await fetch('https://pumpdev.io/img/logo.jpg');
  const logoBuffer = await logoRes.arrayBuffer();
  formData.append('file', new Blob([logoBuffer], { type: 'image/jpeg' }), 'logo.jpg');
  
  // Option 2: Use your own image file
  // import fs from 'node:fs/promises';
  // import { Blob } from 'node:buffer';
  // const fileBuffer = await fs.readFile('./your-token-image.jpg');
  // formData.append('file', new Blob([fileBuffer], { type: 'image/jpeg' }), 'token.jpg');
  
  // Token metadata - customize these for your token!
  formData.append('name', 'PUMP FUN API');
  formData.append('symbol', 'pumpdev.io');
  formData.append('description', 'The #1 API for Pump.fun Token Creation & Trading - pumpdev.io');
  formData.append('twitter', 'https://x.com/PumpDevIO');
  formData.append('telegram', 'https://t.me/pumpdev_io');
  formData.append('website', 'https://pumpdev.io/');
  formData.append('showName', 'true');

  const res = await fetch('https://pump.fun/api/ipfs', { 
    method: 'POST', 
    body: formData 
  });
  
  const result = await res.json();
  console.log('✅ Metadata uploaded:', result.metadataUri);
  return result.metadataUri;
}

/**
 * Send transactions as a Jito bundle
 * 
 * Jito bundles ensure all transactions land in the same block atomically.
 * This prevents front-running and ensures create + buy happen together.
 * 
 * @param {string[]} signedTxs - Array of base58 encoded signed transactions
 * @returns {Promise<{success: boolean, bundleId?: string, error?: string}>}
 */
async function sendJitoBundle(signedTxs) {
  console.log('🚀 Sending Jito bundle...');
  
  // Try each endpoint until one succeeds
  for (const endpoint of JITO_ENDPOINTS) {
    try {
      const res = await fetch(`${endpoint}/api/v1/bundles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'sendBundle',
          params: [signedTxs]
        })
      });
      
      const data = await res.json();
      
      if (data.result) {
        console.log(`✅ Bundle sent successfully!`);
        console.log(`   Bundle ID: ${data.result}`);
        console.log(`   Explorer: https://explorer.jito.wtf/bundle/${data.result}`);
        return { success: true, bundleId: data.result };
      }
      
      if (data.error) {
        console.log(`⚠️ ${endpoint.split('//')[1].split('.')[0]}: ${data.error.message}`);
      }
    } catch (err) {
      continue; // Try next endpoint
    }
  }
  
  return { success: false, error: 'All Jito endpoints failed' };
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
  console.log('⏳ Waiting for confirmation...');
  
  for (let i = 0; i < maxWaitSec / 2; i++) {
    await wait(2000);
    const info = await connection.getAccountInfo(mintPubkey);
    if (info) {
      console.log('✅ Token confirmed on-chain!');
      return true;
    }
    process.stdout.write('.');
  }
  
  console.log('\n⚠️ Token not confirmed in time (may still be processing)');
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
 */
async function createTokenOnly() {
  console.log('\n========================================');
  console.log('EXAMPLE 1: Create Token Only');
  console.log('========================================\n');
  
  // Load creator wallet
  const creator = Keypair.fromSecretKey(bs58.decode(CREATOR_KEY));
  console.log('👤 Creator:', creator.publicKey.toBase58());
  
  // Step 1: Upload metadata
  const uri = await uploadMetadata();
  
  // Step 2: Request create transaction from PumpDev API
  console.log('\n📝 Building create transaction...');
  const res = await fetch(`${API_URL}/api/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: creator.publicKey.toBase58(),
      name: 'PUMP FUN API',
      symbol: 'pumpdev.io',
      uri,
      jitoTip: 0.01  // Jito tip for faster landing
    })
  });
  
  const result = await res.json();
  if (res.status !== 200) {
    throw new Error(result.error || 'API request failed');
  }
  
  console.log('📍 Mint address:', result.mint);
  
  // Step 3: Sign transaction
  // Token creation requires TWO signatures: creator + mint keypair
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));
  const tx = VersionedTransaction.deserialize(bs58.decode(result.transactions[0].transaction));
  tx.sign([creator, mintKeypair]);
  
  // Step 4: Send via Jito bundle
  const bundleRes = await sendJitoBundle([bs58.encode(tx.serialize())]);
  
  // Done!
  console.log('\n========================================');
  console.log('🎉 Token created!');
  console.log(`🔗 https://pump.fun/${result.mint}`);
  console.log('========================================\n');
}

// ============================================================================
// EXAMPLE 2: Create Token + Dev Buy (Jito Bundle)
// ============================================================================

/**
 * Create a token AND buy some tokens in the same block.
 * 
 * This is the recommended approach for token launches. The create and buy
 * transactions are bundled together via Jito, ensuring they execute
 * atomically in the same block. No one can front-run your dev buy!
 * 
 * The API returns multiple transactions that need to be signed and sent
 * as a Jito bundle.
 */
async function createTokenWithDevBuy() {
  console.log('\n========================================');
  console.log('EXAMPLE 2: Create Token + Dev Buy');
  console.log('========================================\n');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  const creator = Keypair.fromSecretKey(bs58.decode(CREATOR_KEY));
  console.log('👤 Creator:', creator.publicKey.toBase58());
  
  // Step 1: Upload metadata
  const uri = await uploadMetadata();
  
  // Step 2: Request create + buy transactions
  console.log('\n📝 Building create + buy transactions...');
  const res = await fetch(`${API_URL}/api/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: creator.publicKey.toBase58(),
      name: 'PUMP FUN API',
      symbol: 'pumpdev.io',
      uri,
      buyAmountSol: 0.1,     // Dev buy: 0.1 SOL worth of tokens
      slippage: 30,           // 30% slippage for new token
      jitoTip: 0.01,          // Jito tip for bundle priority
      priorityFee: 0.0005     // Solana priority fee
    })
  });
  
  const result = await res.json();
  if (res.status !== 200) {
    throw new Error(result.error || 'API request failed');
  }
  
  console.log('📍 Mint address:', result.mint);
  console.log(`📦 Transactions: ${result.transactions.length}`);
  
  // Step 3: Sign all transactions
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));
  
  const signedTxs = result.transactions.map((txInfo) => {
    const tx = VersionedTransaction.deserialize(bs58.decode(txInfo.transaction));
    
    // Create tx needs creator + mint signatures
    // Buy tx only needs creator signature
    const signers = txInfo.signers.includes('mint') 
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
  console.log('\n========================================');
  console.log('🎉 Token created with dev buy!');
  console.log(`🔗 https://pump.fun/${result.mint}`);
  console.log('========================================\n');
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
 */
async function createTokenWithMultipleBuyers() {
  console.log('\n========================================');
  console.log('EXAMPLE 3: Create Token + Multiple Buyers');
  console.log('========================================\n');
  
  const connection = new Connection(RPC_URL, 'confirmed');
  
  // Load all wallets
  const creator = Keypair.fromSecretKey(bs58.decode(CREATOR_KEY));
  const buyer1 = Keypair.fromSecretKey(bs58.decode(BUYER1_KEY));
  const buyer2 = Keypair.fromSecretKey(bs58.decode(BUYER2_KEY));
  const buyer3 = Keypair.fromSecretKey(bs58.decode(BUYER3_KEY));
  const wallets = { creator, buyer1, buyer2, buyer3 };
  
  console.log('👤 Creator:', creator.publicKey.toBase58());
  console.log('👤 Buyer 1:', buyer1.publicKey.toBase58());
  console.log('👤 Buyer 2:', buyer2.publicKey.toBase58());
  console.log('👤 Buyer 3:', buyer3.publicKey.toBase58());
  
  // Step 1: Upload metadata
  const uri = await uploadMetadata();
  
  // Step 2: Request create + multi-buy bundle
  console.log('\n📝 Building multi-buyer bundle...');
  const res = await fetch(`${API_URL}/api/create-bundle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: creator.publicKey.toBase58(),
      name: 'PUMP FUN API',
      symbol: 'pumpdev.io',
      uri,
      buyAmountSol: 0.1,       // Creator buys 0.1 SOL
      slippage: 30,
      jitoTip: 0.02,           // Higher tip for larger bundle
      additionalBuyers: [       // Up to 3 additional buyers
        { publicKey: buyer1.publicKey.toBase58(), amountSol: 0.2 },
        { publicKey: buyer2.publicKey.toBase58(), amountSol: 0.3 },
        { publicKey: buyer3.publicKey.toBase58(), amountSol: 0.1 }
      ]
    })
  });
  
  const result = await res.json();
  if (res.status !== 200) {
    throw new Error(result.error || 'API request failed');
  }
  
  console.log('📍 Mint address:', result.mint);
  console.log(`📦 Transactions: ${result.transactions.length}`);
  
  // Step 3: Sign all transactions with appropriate signers
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));
  
  const signedTxs = result.transactions.map((txInfo) => {
    const tx = VersionedTransaction.deserialize(bs58.decode(txInfo.transaction));
    
    // Map signer names to actual keypairs
    const signers = txInfo.signers
      .map((s) => (s === 'mint' ? mintKeypair : wallets[s]))
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
  console.log('\n========================================');
  console.log('🎉 Token created with multiple buyers!');
  console.log(`🔗 https://pump.fun/${result.mint}`);
  console.log('========================================\n');
}

// ============================================================================
// MAIN
// ============================================================================

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║   PumpDev API - Token Creation Demo    ║');
  console.log('║   https://pumpdev.io                   ║');
  console.log('╚════════════════════════════════════════╝');
  
  // Choose which example to run:
  
  // await createTokenOnly();              // Just create token
  await createTokenWithDevBuy();           // Create + dev buy (RECOMMENDED)
  // await createTokenWithMultipleBuyers(); // Create + multiple buyers
}

main().catch((err) => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
