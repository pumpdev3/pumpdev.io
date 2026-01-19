# PumpDev API

### 🚀 The Fastest 3rd-Party API for Pump.fun Trading on Solana

[![Website](https://img.shields.io/badge/Website-pumpdev.io-7CFF6B?style=for-the-badge)](https://pumpdev.io)
[![Docs](https://img.shields.io/badge/Docs-API%20Reference-blue?style=for-the-badge)](https://pumpdev.io/welcome)
[![Telegram](https://img.shields.io/badge/Telegram-Community-2CA5E0?style=for-the-badge&logo=telegram)](https://t.me/pumpdev_io)
[![Twitter](https://img.shields.io/badge/Twitter-@PumpDevIO-1DA1F2?style=for-the-badge&logo=twitter)](https://x.com/PumpDevIO)

---

## What is PumpDev?

**PumpDev** is a comprehensive REST and WebSocket API for building trading bots, snipers, and automated systems on [Pump.fun](https://pump.fun) — Solana's leading memecoin launchpad.

- 🔐 **Client-Side Signing** — Your private keys never leave your machine
- ⚡ **Low Latency** — Sub-second WebSocket data feeds
- 💰 **0.25% Commission** — Lowest fees in the market
- 🛠️ **Developer-First** — Clean REST API with JavaScript/TypeScript examples

---

## Features

| Feature | Description |
|---------|-------------|
| **Trading API** | Generate buy/sell transactions for any Pump.fun token |
| **Token Creation** | Launch new memecoins with custom metadata and optional dev buys |
| **Real-Time WebSocket** | Stream live trades, new token launches, and wallet activity |
| **Fee Claiming** | Automate creator royalty collection |
| **SOL Transfers** | Build transfer transactions for wallet management |

---

## Quick Start

### Installation

```bash
npm install @solana/web3.js bs58
```

### Buy Tokens

```javascript
import { VersionedTransaction, Connection, Keypair } from '@solana/web3.js';
import bs58 from 'bs58';

const API_URL = 'https://pumpdev.io';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

async function buyToken(privateKey, mint, amountSol) {
  const keypair = Keypair.fromSecretKey(bs58.decode(privateKey));
  
  // 1. Get unsigned transaction from API
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

  // 2. Sign locally (your keys never leave your machine)
  const data = await response.arrayBuffer();
  const tx = VersionedTransaction.deserialize(new Uint8Array(data));
  tx.sign([keypair]);

  // 3. Send via your own RPC
  const connection = new Connection(RPC_URL, 'confirmed');
  const signature = await connection.sendTransaction(tx);
  
  console.log('Transaction:', `https://solscan.io/tx/${signature}`);
}
```

### Sell Tokens

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

### Real-Time WebSocket Data

```javascript
import WebSocket from 'ws';

const ws = new WebSocket('wss://pumpdev.io/ws');

ws.on('open', () => {
  // Subscribe to new token launches
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

### Create New Token

```javascript
const response = await fetch(`${API_URL}/api/create`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    publicKey: 'YourPublicKey',
    name: 'My Token',
    symbol: 'MTK',
    uri: 'https://ipfs.io/ipfs/...',  // Upload metadata to pump.fun/api/ipfs first
    priorityFee: 0.001,
    amount: 1,       // Optional: Dev buy 1 SOL worth
    slippage: 30
  })
});

const { transaction, mint, mintSecretKey } = await response.json();

// Sign with BOTH creator wallet AND mint keypair
tx.sign([creatorKeypair, mintKeypair]);
```

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/trade-local` | POST | Generate buy/sell transactions |
| `/api/create` | POST | Create new token transactions |
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
| Buy Tokens | 0.25% |
| Sell Tokens | 0.25% |
| Create Token | **FREE** |
| Create + Dev Buy | 0.25% of dev buy |
| SOL Transfers | **FREE** |
| WebSocket Data | **FREE** |

**Compare:** Most competitors charge 1% per trade.

---

## Why PumpDev?

| Feature | PumpDev | Others |
|---------|---------|--------|
| Commission | **0.25%** | 1% |
| Private Key Security | **Local signing** | Some require managed wallets |
| WebSocket Data | **Free, unlimited** | Often paid or rate-limited |
| Token Creation | **Free** | Sometimes charged |

---

## Use Cases

- 🤖 **Trading Bots** — Automated buy/sell strategies
- 🎯 **Sniper Bots** — Instant buys on new token launches
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
