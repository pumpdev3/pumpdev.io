# PumpDev API

### 🚀 The #1 API for Pump.fun Token Creation, Trading & Jito Bundles

[![Website](https://img.shields.io/badge/Website-pumpdev.io-7CFF6B?style=for-the-badge)](https://pumpdev.io)
[![Docs](https://img.shields.io/badge/Docs-API%20Reference-blue?style=for-the-badge)](https://pumpdev.io/welcome)
[![Telegram](https://img.shields.io/badge/Telegram-Community-2CA5E0?style=for-the-badge&logo=telegram)](https://t.me/pumpdev_io)
[![Twitter](https://img.shields.io/badge/Twitter-@PumpDevIO-1DA1F2?style=for-the-badge&logo=twitter)](https://x.com/PumpDevIO)

---

## What is PumpDev?

**PumpDev** is the fastest way to **create tokens on pump.fun** and execute **Jito bundles** for atomic token launches. Build trading bots, snipers, and automated token launchers on Solana's leading memecoin platform.

- 🔐 **Client-Side Signing** — Your private keys never leave your machine
- ⚡ **Jito Bundle Support** — Atomic pump.fun token creation + multiple buys in one block
- 💰 **0.25% Commission** — Lowest fees in the market
- 🛠️ **Developer-First** — Clean REST API with JavaScript/TypeScript examples

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Pump.fun Token Creation** | Create token on pump.fun with custom metadata and socials |
| **Pump.fun Jito Bundle** | Launch token + dev buy + multiple buyers atomically |
| **Trading API** | Generate buy/sell transactions for any pump.fun token |
| **Real-Time WebSocket** | Stream live trades, new token launches, and wallet activity |
| **Fee Claiming** | Automate creator royalty collection |
| **SOL Transfers** | Build transfer transactions for wallet management |

---

## Quick Start

### Installation

```bash
npm install @solana/web3.js bs58
```

### Step 1: Upload Metadata to Pump.fun IPFS

```javascript
async function uploadMetadata() {
  const formData = new FormData();
  
  // Add token image
  const imageResponse = await fetch('https://example.com/your-logo.jpg');
  const imageBuffer = await imageResponse.arrayBuffer();
  formData.append('file', new Blob([imageBuffer], { type: 'image/jpeg' }), 'logo.jpg');
  
  // Add token info
  formData.append('name', 'PUMP FUN API');
  formData.append('symbol', 'pumpdev.io');
  formData.append('description', 'Your token description');
  formData.append('twitter', 'https://x.com/YourTwitter');
  formData.append('telegram', 'https://t.me/YourTelegram');
  formData.append('website', 'https://yourwebsite.com');
  formData.append('showName', 'true');

  const res = await fetch('https://pump.fun/api/ipfs', { method: 'POST', body: formData });
  const { metadataUri } = await res.json();
  
  console.log('Metadata URI:', metadataUri);
  return metadataUri;
}
```

### Step 2: Create Token (No Dev Buy)

```javascript
import { VersionedTransaction, Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const API_URL = 'https://pumpdev.io';

async function createToken() {
  const creator = Keypair.fromSecretKey(bs58.decode('YOUR_PRIVATE_KEY'));
  
  const response = await fetch(`${API_URL}/api/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: creator.publicKey.toBase58(),
      name: 'PUMP FUN API',
      symbol: 'pumpdev.io',
      uri: metadataUri  // From Step 1
    })
  });

  const result = await response.json();
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));
  
  // Sign transaction
  const tx = VersionedTransaction.deserialize(bs58.decode(result.transactions[0].transaction));
  tx.sign([creator, mintKeypair]);

  // Send transaction
  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const signature = await connection.sendTransaction(tx);

  console.log(`✅ Token: https://pump.fun/${result.mint}`);
  console.log(`Transaction: https://solscan.io/tx/${signature}`);
}
```

---

## Buy Tokens on Pump.fun

```javascript
async function buyToken(privateKey, mint, amountSol) {
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  
  const response = await fetch(`${API_URL}/api/trade-local`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: keypair.publicKey.toBase58(),
      action: 'buy',
      mint: mint,
      amount: amountSol,
      slippage: 99,
    })
  });

  const data = await response.arrayBuffer();
  const tx = VersionedTransaction.deserialize(new Uint8Array(data));
  tx.sign([keypair]);

  const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
  const signature = await connection.sendTransaction(tx);
  
  console.log('Transaction:', `https://solscan.io/tx/${signature}`);
}
```

---

## Sell Tokens on Pump.fun

```javascript
// Sell 100% of tokens
const response = await fetch(`${API_URL}/api/trade-local`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    publicKey: 'YourPublicKey',
    action: 'sell',
    mint: 'TokenMintAddress',
    amount: '100%',           // Supports: '100%', '50%', or exact amount
    slippage: 99
  })
});

const data = await response.arrayBuffer();
const tx = VersionedTransaction.deserialize(new Uint8Array(data));
tx.sign([keypair]);

const connection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
const signature = await connection.sendTransaction(tx);

console.log('Transaction:', `https://solscan.io/tx/${signature}`);
```

---

## ⚡ Jito Bundles - Advanced

Jito bundles execute multiple transactions **atomically in the same block**. Use bundles for:
- Token creation with dev buy
- Multi-wallet coordinated launches
- Fast batch sell operations

### Why Use Jito Bundles?

- ✅ **Atomic Execution** — All transactions succeed or fail together
- ✅ **No Front-Running** — Everything lands in the same block
- ✅ **Multiple Wallets** — Creator + up to 3 additional buyers
- ✅ **Speed** — Single API call for multiple transactions

---

### Create Token with Dev Buy (Bundle)

```javascript
import { VersionedTransaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const API_URL = 'https://pumpdev.io';

async function createTokenWithDevBuy() {
  const creator = Keypair.fromSecretKey(bs58.decode('YOUR_PRIVATE_KEY'));

  const response = await fetch(`${API_URL}/api/create`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: creator.publicKey.toBase58(),
      name: 'PUMP FUN API',
      symbol: 'pumpdev.io',
      uri: 'https://ipfs.io/ipfs/...',
      buyAmountSol: 0.5,      // Dev buy amount
      slippage: 30,
      jitoTip: 0.01
    })
  });

  const result = await response.json();
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));

  // Sign all transactions (create + dev buy)
  const signedTxs = result.transactions.map((txInfo) => {
    const tx = VersionedTransaction.deserialize(bs58.decode(txInfo.transaction));
    const signers = txInfo.signers.includes('mint') ? [creator, mintKeypair] : [creator];
    tx.sign(signers);
    return bs58.encode(tx.serialize());
  });

  // Send via Jito bundle
  await fetch('https://mainnet.block-engine.jito.wtf/api/v1/bundles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendBundle', params: [signedTxs] })
  });

  console.log(`✅ Token: https://pump.fun/${result.mint}`);
}
```

---

### Multi-Buyer Bundle Launch

Create token + multiple wallets buy atomically:

```javascript
async function createMultiBuyerBundle() {
  const creator = Keypair.fromSecretKey(bs58.decode('CREATOR_KEY'));
  const buyer1 = Keypair.fromSecretKey(bs58.decode('BUYER1_KEY'));
  const buyer2 = Keypair.fromSecretKey(bs58.decode('BUYER2_KEY'));

  const response = await fetch(`${API_URL}/api/create-bundle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: creator.publicKey.toBase58(),
      name: 'PUMP FUN API',
      symbol: 'pumpdev.io',
      uri: 'https://ipfs.io/ipfs/...',
      buyAmountSol: 0.5,          // Creator dev buy
      slippage: 30,
      jitoTip: 0.01,
      additionalBuyers: [
        { publicKey: buyer1.publicKey.toBase58(), amountSol: 1.0 },
        { publicKey: buyer2.publicKey.toBase58(), amountSol: 0.5 }
      ]
    })
  });

  const result = await response.json();
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));
  const wallets = { creator, buyer1, buyer2 };

  // Sign each transaction with appropriate signers
  const signedTxs = result.transactions.map((txInfo) => {
    const tx = VersionedTransaction.deserialize(bs58.decode(txInfo.transaction));
    const signers = txInfo.signers.map(s => s === 'mint' ? mintKeypair : wallets[s]).filter(Boolean);
    tx.sign(signers);
    return bs58.encode(tx.serialize());
  });

  // Send Jito bundle
  await fetch('https://mainnet.block-engine.jito.wtf/api/v1/bundles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendBundle', params: [signedTxs] })
  });

  console.log(`✅ Token: https://pump.fun/${result.mint}`);
}
```

---

## 🚀 FAST Bundle Sell - Multiple Accounts in ONE Request

Build sell transactions for **multiple wallets in a single API call**. This is **3-4x faster** than making individual `/api/trade-local` calls!

### Why Use Bundle Sell?

| Individual Calls | Bundle Call |
|-----------------|-------------|
| N HTTP round-trips | **1 HTTP round-trip** |
| N blockhash fetches | **1 shared blockhash** |
| N bonding curve lookups | **1 shared lookup** |
| ~400-800ms for 4 accounts | **~100-200ms for 4 accounts** |

### Bundle Sell Example

```javascript
import { VersionedTransaction, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const API_URL = 'https://pumpdev.io';

async function sellBundleFast(mint, accounts, creatorPublicKey) {
  // 1. Build ALL transactions in ONE API call
  const response = await fetch(`${API_URL}/api/trade-bundle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accounts: accounts.map(acc => ({
        publicKey: acc.keypair.publicKey.toBase58(),
        name: acc.name,
      })),
      action: 'sell',
      mint: mint,
      amount: '100%',
      slippage: 99,
      priorityFee: 0.005,
      creator: creatorPublicKey, // SPEED: skip bonding curve lookup
    }),
  });

  const result = await response.json();
  console.log(`Built ${result.stats.success}/${result.stats.total} in ${result.stats.durationMs}ms`);

  // 2. Sign and send each transaction
  for (const txInfo of result.transactions) {
    if (!txInfo.transaction) continue;
    
    const account = accounts.find(a => a.name === txInfo.name);
    const tx = VersionedTransaction.deserialize(bs58.decode(txInfo.transaction));
    tx.sign([account.keypair]);
    
    const signature = await connection.sendTransaction(tx, { skipPreflight: true });
    console.log(`${txInfo.name} sent: ${signature}`);
  }
}

// Usage
const accounts = [
  { name: 'creator', keypair: Keypair.fromSecretKey(bs58.decode('...')) },
  { name: 'bundle1', keypair: Keypair.fromSecretKey(bs58.decode('...')) },
  { name: 'bundle2', keypair: Keypair.fromSecretKey(bs58.decode('...')) },
];

await sellBundleFast('TokenMint', accounts, accounts[0].keypair.publicKey.toBase58());
```

### Bundle Sell Response

```javascript
{
  transactions: [
    { name: 'creator', transaction: 'base58_encoded_tx', error: null },
    { name: 'bundle1', transaction: 'base58_encoded_tx', error: null },
    { name: 'bundle2', transaction: null, error: 'No token balance found' },
  ],
  stats: {
    total: 3,
    success: 2,
    failed: 1,
    durationMs: 150
  }
}
```

---

## Real-Time WebSocket Pump.fun Data (No pumpswap migration token data available at the moment)

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('wss://pumpdev.io/ws');

ws.on('open', () => {
  // Subscribe to new pump.fun token launches
  ws.send(JSON.stringify({ method: 'subscribeNewToken' }));
  
  // Subscribe to specific token trades
  ws.send(JSON.stringify({
    method: 'subscribeTokenTrade',
    keys: ['TokenMint1', 'TokenMint2']
  }));
  
  // Track whale wallets
  ws.send(JSON.stringify({
    method: 'subscribeAccountTrade',
    keys: ['WhaleWallet1', 'WhaleWallet2']
  }));
});

ws.on('message', (data) => {
  const event = JSON.parse(data.toString());
  
  if (event.txType === 'create') {
    console.log(`🆕 New Token: ${event.name} (${event.symbol})`);
    console.log(`   Mint: ${event.mint}`);
    console.log(`   Market Cap: ${event.marketCapSol} SOL`);
  }
  
  if (event.txType === 'buy' || event.txType === 'sell') {
    console.log(`📊 ${event.txType.toUpperCase()}: ${event.solAmount} SOL`);
  }
});
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/create` | POST | Create token on pump.fun (with optional dev buy) |
| `/api/create-bundle` | POST | **Pump.fun Jito bundle** - create + multiple buyers |
| `/api/trade-local` | POST | Generate buy/sell transactions |
| `/api/trade-bundle` | POST | **🚀 FAST** - Build multiple sell txs in ONE request |
| `/api/claim-account` | POST | Claim creator fees |
| `/api/transfer` | POST | Transfer specific SOL amount |
| `/api/transfer-all` | POST | Transfer entire wallet balance |
| `/ws` | WebSocket | Real-time market data streaming |

---

## WebSocket Subscriptions

| Method | Description |
|--------|-------------|
| `subscribeNewToken` | New token launches |
| `subscribeTokenTrade` | Trades for specific tokens |
| `subscribeAccountTrade` | Trades from specific wallets |
| `unsubscribeNewToken` | Unsubscribe from new tokens |
| `unsubscribeTokenTrade` | Unsubscribe from token trades |
| `unsubscribeAccountTrade` | Unsubscribe from wallet trades |

---

## Pricing

| Operation | Fee |
|-----------|-----|
| Create Token on Pump.fun | **FREE** |
| Pump.fun Token Launch Bundle | 0.25% of buys |
| Buy Tokens | 0.25% |
| Sell Tokens | 0.25% |
| Create Token | **FREE** |
| Create + Dev Buy | 0.25% of dev buy |
| SOL Transfers | **FREE** |
| WebSocket Data | **FREE** |

**Compare:** Most competitors charge 1% per trade.

---

## Why PumpDev for Pump.fun Token Creation?

| Feature | PumpDev | Others |
|---------|---------|--------|
| Jito Bundle Support | **Yes** | Limited |
| Commission | **0.25%** | 1% |
| Private Key Security | **Local signing** | Some require managed wallets |
| Multiple Buyers Bundle | **Up to 4 wallets** | Often just 1 |
| WebSocket Data | **Free, unlimited** | Often paid |

---

## Use Cases

- 🚀 **Pump.fun Token Creator** — Launch memecoins with dev buys
- 🎯 **Sniper Bots** — Instant buys on new token launches  
- 📦 **Jito Bundle Launchers** — Atomic multi-wallet token launches
- 🤖 **Trading Bots** — Automated buy/sell strategies
- 📊 **Analytics Dashboards** — Real-time market monitoring
- 🐋 **Whale Trackers** — Follow smart money movements
- 🚀 **Token Launchers** — Automated token deployment systems
- 💼 **Portfolio Managers** — Multi-wallet trading operations

---

## Examples

Working code examples in the [`/examples`](./examples) folder:

| File | Description |
|------|-------------|
| [`buy-sell.js`](./examples/buy-sell.js) | Buy and sell tokens on Pump.fun |
| [`websocket.js`](./examples/websocket.js) | Real-time trade data and new token alerts |
| [`create-token.js`](./examples/create-token.js) | Launch new tokens with optional dev buy |
| [`sniper-bot.js`](./examples/sniper-bot.js) | Automated new token sniper (educational) |
| [`claim-fees.js`](./examples/claim-fees.js) | Claim creator fees from your tokens |
| [`transfer.js`](./examples/transfer.js) | SOL transfer transactions |

```bash
# Run any example
cd examples
npm install @solana/web3.js bs58 ws dotenv
node buy-sell.js
```

---

## Documentation

Full documentation with detailed examples:

- [Getting Started](https://pumpdev.io/welcome)
- [Create Token on Pump.fun](https://pumpdev.io/create-token)
- [Pump.fun Jito Bundle Guide](https://pumpdev.io/jito-bundle)
- [Trading API](https://pumpdev.io/trade-api)
- [Token Creation](https://pumpdev.io/create-token)
- [Real-Time Data](https://pumpdev.io/data-api)
- [Claim Fees](https://pumpdev.io/claim-fees)
- [SOL Transfers](https://pumpdev.io/transfer)
- [Pricing](https://pumpdev.io/fees)

---

## Community & Support

- 💬 **Telegram**: [t.me/pumpdev_io](https://t.me/pumpdev_io)
- 🐦 **Twitter**: [@PumpDevIO](https://x.com/PumpDevIO)
- 📚 **Docs**: [pumpdev.io](https://pumpdev.io)

---

## Keywords

`pump.fun` `pump.fun api` `pump.fun trading bot` `solana trading api` `solana memecoin` `pump.fun sniper` `pump.fun sdk` `solana dex api` `memecoin api` `pump.fun automation` `solana websocket` `pump.fun developer` `solana token trading` `bonding curve` `pump.fun integration`

---

<p align="center">
  <b>Copyright © 2026 PumpDev. All rights reserved.</b>
  <br>
  <a href="https://pumpdev.io">pumpdev.io</a>
</p>
