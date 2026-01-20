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

## 🆕 Pump.fun Jito Bundle - Atomic Token Launch

Launch your token and execute multiple buys **in the same block** using Jito bundles. No more front-running!

### Why Use Pump.fun Bundle?

- ✅ **Atomic Execution** — Create + buy happens together or not at all
- ✅ **No Front-Running** — All transactions land in the same block
- ✅ **Multiple Buyers** — Creator + up to 3 additional wallets
- ✅ **Better Launch** — Start with instant buy pressure

### Pump.fun Token Bundle Example

```javascript
import { VersionedTransaction, Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const API_URL = 'https://pumpdev.io';

// Create pump.fun token with Jito bundle
async function createPumpfunToken() {
  const creator = Keypair.fromSecretKey(bs58.decode('YOUR_CREATOR_KEY'));
  const buyer1 = Keypair.fromSecretKey(bs58.decode('YOUR_BUYER1_KEY'));
  const buyer2 = Keypair.fromSecretKey(bs58.decode('YOUR_BUYER2_KEY'));
  
  // 1. Request bundle transactions from API
  const response = await fetch(`${API_URL}/api/create-bundle`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      publicKey: creator.publicKey.toBase58(),
      name: 'PUMP FUN API',
      symbol: 'pumpdev.io',
      uri: 'https://ipfs.io/ipfs/YOUR_METADATA_URI',
      buyAmountSol: 0.5,        // Creator's dev buy
      slippage: 30,
      jitoTip: 0.01,            // Jito tip for bundle priority
      additionalBuyers: [
        { publicKey: buyer1.publicKey.toBase58(), amountSol: 1.0 },
        { publicKey: buyer2.publicKey.toBase58(), amountSol: 0.5 },
      ]
    })
  });

  const result = await response.json();
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));
  
  // 2. Sign all transactions
  const wallets = { creator, buyer1, buyer2 };
  const signedTxs = result.transactions.map((txInfo) => {
    const tx = VersionedTransaction.deserialize(bs58.decode(txInfo.transaction));
    const signers = txInfo.signers.map(s => s === 'mint' ? mintKeypair : wallets[s]);
    tx.sign(signers.filter(Boolean));
    return bs58.encode(tx.serialize());
  });

  // 3. Send Jito bundle
  const bundleResponse = await fetch('https://mainnet.block-engine.jito.wtf/api/v1/bundles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'sendBundle',
      params: [signedTxs]
    })
  });

  console.log(`Token created: https://pump.fun/${result.mint}`);
}
```

---

## Quick Start - Create Token on Pump.fun

### Installation

```bash
npm install @solana/web3.js bs58
```

### Simple Pump.fun Token Creation

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
      uri: 'https://ipfs.io/ipfs/...',  // Upload to pump.fun/api/ipfs first
      buyAmountSol: 0.1,    // Optional dev buy
      slippage: 30,
      jitoTip: 0.01
    })
  });

  const result = await response.json();
  const mintKeypair = Keypair.fromSecretKey(bs58.decode(result.mintSecretKey));
  
  // Sign transactions
  const signedTxs = result.transactions.map((txInfo) => {
    const tx = VersionedTransaction.deserialize(bs58.decode(txInfo.transaction));
    const signers = txInfo.signers.includes('mint') ? [creator, mintKeypair] : [creator];
    tx.sign(signers);
    return bs58.encode(tx.serialize());
  });

  // Send via Jito
  await fetch('https://mainnet.block-engine.jito.wtf/api/v1/bundles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sendBundle', params: [signedTxs] })
  });

  console.log(`✅ Token: https://pump.fun/${result.mint}`);
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
      denominatedInSol: 'true',
      slippage: 15,
      priorityFee: 0.0005
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
    denominatedInSol: 'false',
    slippage: 15
  })
});
```

---

## Real-Time WebSocket Data

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
