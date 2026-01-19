/**
 * PumpDev API Example: Create New Token
 * 
 * This example demonstrates how to:
 * 1. Upload metadata to Pump.fun IPFS
 * 2. Create a new token (with or without dev buy)
 * 3. Sign with both creator and mint keypairs
 * 
 * Documentation: https://pumpdev.io/create-token
 */

import dotenv from 'dotenv';
dotenv.config();

import { VersionedTransaction, Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'node:fs/promises';
import { Blob } from 'node:buffer';

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
 * Step 1: Upload metadata to Pump.fun IPFS
 * This creates the token image and metadata URI
 */
async function uploadMetadata(imagePath, tokenInfo) {
  console.log('=== UPLOADING METADATA ===\n');

  const formData = new FormData();

  // Add image file
  const fileBuffer = await fs.readFile(imagePath);
  const blob = new Blob([fileBuffer], { type: 'image/jpeg' });
  formData.append('file', blob, 'token-image.jpg');
  
  // Add token metadata
  formData.append('name', tokenInfo.name);
  formData.append('symbol', tokenInfo.symbol);
  formData.append('description', tokenInfo.description);
  formData.append('twitter', tokenInfo.twitter || '');
  formData.append('telegram', tokenInfo.telegram || '');
  formData.append('website', tokenInfo.website || '');
  formData.append('showName', 'true');

  // Upload to Pump.fun IPFS
  const response = await fetch('https://pump.fun/api/ipfs', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload metadata');
  }

  const result = await response.json();
  console.log('✅ Metadata uploaded!');
  console.log('URI:', result.metadataUri);
  
  return result.metadataUri;
}

/**
 * Step 2a: Create token WITHOUT dev buy
 */
async function createToken(metadataUri, tokenInfo) {
  console.log('\n=== CREATING TOKEN ===\n');

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const publicKey = keypair.publicKey.toBase58();

  console.log('Creator:', publicKey);
  console.log('Name:', tokenInfo.name);
  console.log('Symbol:', tokenInfo.symbol);

  // Build create transaction
  const response = await fetch(`${API_URL}/api/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: publicKey,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      uri: metadataUri,
      priorityFee: 0.001
    })
  });

  if (response.status !== 200) {
    const error = await response.json();
    console.error('API Error:', error);
    return null;
  }

  const result = await response.json();

  console.log('\nNew token mint:', result.mint);
  console.log('Mint secret key:', result.mintSecretKey);

  // Deserialize transaction
  const tx = VersionedTransaction.deserialize(bs58.decode(result.transaction));

  // Sign with BOTH keypairs (creator + mint)
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));

  console.log('\nSigning with:');
  console.log('  - Creator:', publicKey);
  console.log('  - Mint:', mintKeypair.publicKey.toBase58());

  tx.sign([keypair, mintKeypair]);

  // Send to Solana
  const connection = new Connection(RPC_URL, 'confirmed');

  try {
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3
    });

    console.log('\n✅ Transaction sent!');
    console.log('Signature:', signature);
    console.log(`\nView token: https://pump.fun/${result.mint}`);
    console.log(`Solscan: https://solscan.io/tx/${signature}`);

    // Wait for confirmation
    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
      return null;
    }
    
    console.log('\n🎉 Token created successfully!');
    return result.mint;
  } catch (err) {
    console.error('Send error:', err.message);
    return null;
  }
}

/**
 * Step 2b: Create token WITH dev buy (instant buy on creation)
 */
async function createTokenWithDevBuy(metadataUri, tokenInfo, devBuyAmountSol) {
  console.log('\n=== CREATING TOKEN + DEV BUY ===\n');

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const publicKey = keypair.publicKey.toBase58();

  console.log('Creator:', publicKey);
  console.log('Name:', tokenInfo.name);
  console.log('Symbol:', tokenInfo.symbol);
  console.log('Dev Buy:', devBuyAmountSol, 'SOL');

  // Build create + dev buy transaction
  const response = await fetch(`${API_URL}/api/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: publicKey,
      name: tokenInfo.name,
      symbol: tokenInfo.symbol,
      uri: metadataUri,
      priorityFee: 0.001,
      amount: devBuyAmountSol,  // Dev buy amount in SOL
      slippage: 30             // Slippage for dev buy
    })
  });

  if (response.status !== 200) {
    const error = await response.json();
    console.error('API Error:', error);
    return null;
  }

  const result = await response.json();

  console.log('\nNew token mint:', result.mint);
  console.log('Dev buy:', result.devBuy);

  // Deserialize transaction
  const tx = VersionedTransaction.deserialize(bs58.decode(result.transaction));

  // Sign with BOTH keypairs
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));
  tx.sign([keypair, mintKeypair]);

  // Send to Solana
  const connection = new Connection(RPC_URL, 'confirmed');

  try {
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3
    });

    console.log('\n✅ Transaction sent!');
    console.log('Signature:', signature);
    console.log(`\nView token: https://pump.fun/${result.mint}`);
    console.log(`Solscan: https://solscan.io/tx/${signature}`);

    const confirmation = await connection.confirmTransaction(signature, 'confirmed');
    
    if (confirmation.value.err) {
      console.error('Transaction failed:', confirmation.value.err);
      return null;
    }
    
    console.log('\n🎉 Token created with dev buy successfully!');
    return result.mint;
  } catch (err) {
    console.error('Send error:', err.message);
    return null;
  }
}

// Main execution
async function main() {
  try {
    // Token configuration
    const tokenInfo = {
      name: 'My Awesome Token',
      symbol: 'MAT',
      description: 'The most awesome token on Pump.fun!',
      twitter: 'https://twitter.com/mytoken',
      telegram: 'https://t.me/mytoken',
      website: 'https://mytoken.com'
    };

    // Step 1: Upload metadata (update image path)
    const metadataUri = await uploadMetadata('./token-image.jpg', tokenInfo);

    if (!metadataUri) {
      console.error('Failed to upload metadata');
      return;
    }

    // Step 2: Choose one option:

    // Option A: Create token only (no dev buy)
    // await createToken(metadataUri, tokenInfo);

    // Option B: Create token + dev buy (1 SOL)
    await createTokenWithDevBuy(metadataUri, tokenInfo, 1);

  } catch (err) {
    console.error('Error:', err);
  }
}

main();
