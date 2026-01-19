/**
 * PumpDev API Example: SOL Transfers
 * 
 * This example demonstrates how to:
 * 1. Transfer a specific amount of SOL
 * 2. Transfer entire wallet balance (drain)
 * 3. Batch transfers to multiple recipients
 * 
 * Documentation: https://pumpdev.io/transfer
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
 * Transfer a specific amount of SOL
 */
async function transferSol(toAddress, amountSol) {
  console.log('=== TRANSFER SOL ===\n');

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const fromPublicKey = keypair.publicKey.toBase58();

  console.log('From:', fromPublicKey);
  console.log('To:', toAddress);
  console.log('Amount:', amountSol, 'SOL');

  // Build transfer transaction
  const response = await fetch(`${API_URL}/api/transfer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromPublicKey: fromPublicKey,
      toPublicKey: toAddress,
      amount: amountSol,
      priorityFee: 0.0001
    })
  });

  if (response.status !== 200) {
    const error = await response.json();
    console.error('API Error:', error);
    return null;
  }

  // Deserialize and sign
  const data = await response.arrayBuffer();
  const tx = VersionedTransaction.deserialize(new Uint8Array(data));
  tx.sign([keypair]);

  // Send to Solana
  const connection = new Connection(RPC_URL, 'confirmed');

  try {
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3
    });

    console.log('\n✅ Transaction sent!');
    console.log('Signature:', signature);
    console.log(`Solscan: https://solscan.io/tx/${signature}`);

    await connection.confirmTransaction(signature, 'confirmed');
    console.log('Transfer complete!');
    
    return signature;
  } catch (err) {
    console.error('Send error:', err.message);
    return null;
  }
}

/**
 * Transfer ALL SOL from wallet (drain)
 */
async function transferAllSol(toAddress) {
  console.log('\n=== TRANSFER ALL SOL ===\n');

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const fromPublicKey = keypair.publicKey.toBase58();
  const connection = new Connection(RPC_URL, 'confirmed');

  // Check current balance
  const balance = await connection.getBalance(new PublicKey(fromPublicKey));
  console.log('From:', fromPublicKey);
  console.log('To:', toAddress);
  console.log('Current balance:', (balance / LAMPORTS_PER_SOL).toFixed(4), 'SOL');

  // Build transfer-all transaction
  const response = await fetch(`${API_URL}/api/transfer-all`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fromPublicKey: fromPublicKey,
      toPublicKey: toAddress,
      priorityFee: 0.0001
    })
  });

  if (response.status !== 200) {
    const error = await response.json();
    console.error('API Error:', error);
    return null;
  }

  const result = await response.json();
  console.log('Estimated transfer:', result.estimatedAmount, 'SOL');
  console.log('Estimated fees:', result.estimatedFees, 'SOL');

  // Deserialize and sign
  const tx = VersionedTransaction.deserialize(bs58.decode(result.transaction));
  tx.sign([keypair]);

  // Send to Solana
  try {
    const signature = await connection.sendTransaction(tx, {
      skipPreflight: false,
      maxRetries: 3
    });

    console.log('\n✅ Transaction sent!');
    console.log('Signature:', signature);
    console.log(`Solscan: https://solscan.io/tx/${signature}`);

    await connection.confirmTransaction(signature, 'confirmed');
    
    // Check final balance
    const finalBalance = await connection.getBalance(new PublicKey(fromPublicKey));
    console.log('Final balance:', (finalBalance / LAMPORTS_PER_SOL).toFixed(4), 'SOL');
    
    return signature;
  } catch (err) {
    console.error('Send error:', err.message);
    return null;
  }
}

/**
 * Batch transfer to multiple recipients
 */
async function batchTransfer(recipients) {
  console.log('\n=== BATCH TRANSFER ===\n');

  const keypair = Keypair.fromSecretKey(bs58.decode(PRIVATE_KEY));
  const fromPublicKey = keypair.publicKey.toBase58();
  const connection = new Connection(RPC_URL, 'confirmed');

  console.log('From:', fromPublicKey);
  console.log('Recipients:', recipients.length);
  console.log();

  let successCount = 0;
  let totalSent = 0;

  for (const recipient of recipients) {
    console.log(`📤 Sending ${recipient.amount} SOL to ${recipient.address.slice(0, 8)}...`);

    try {
      const response = await fetch(`${API_URL}/api/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromPublicKey: fromPublicKey,
          toPublicKey: recipient.address,
          amount: recipient.amount,
          priorityFee: 0.0001
        })
      });

      if (response.status !== 200) {
        const error = await response.json();
        console.log(`   ❌ Error: ${error.error}`);
        continue;
      }

      const data = await response.arrayBuffer();
      const tx = VersionedTransaction.deserialize(new Uint8Array(data));
      tx.sign([keypair]);

      const signature = await connection.sendTransaction(tx, {
        skipPreflight: false,
        maxRetries: 3
      });

      await connection.confirmTransaction(signature, 'confirmed');
      
      console.log(`   ✅ Success: ${signature.slice(0, 20)}...`);
      successCount++;
      totalSent += recipient.amount;
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }

    // Small delay between transfers
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('\n═══════════════════════════════════');
  console.log(`Completed: ${successCount}/${recipients.length} transfers`);
  console.log(`Total sent: ${totalSent} SOL`);
  console.log('═══════════════════════════════════');
}

// Main execution
async function main() {
  try {
    // Replace with actual recipient address
    const RECIPIENT = 'RecipientWalletAddressHere';
    
    // Option 1: Transfer specific amount
    await transferSol(RECIPIENT, 0.1);
    
    // Option 2: Transfer all SOL (uncomment to use)
    // await transferAllSol(RECIPIENT);
    
    // Option 3: Batch transfer (uncomment to use)
    // await batchTransfer([
    //   { address: 'Wallet1Address', amount: 0.1 },
    //   { address: 'Wallet2Address', amount: 0.05 },
    //   { address: 'Wallet3Address', amount: 0.2 },
    // ]);
    
  } catch (err) {
    console.error('Error:', err);
  }
}

main();
