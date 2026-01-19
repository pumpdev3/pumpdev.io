# PumpDev API Examples

Working code examples for the [PumpDev API](https://pumpdev.io) — the fastest 3rd-party API for Pump.fun trading on Solana.

## 📋 Prerequisites

```bash
npm install @solana/web3.js bs58 ws dotenv
```

## 🚀 Quick Start

1. Clone this repository
2. Copy `.env.example` to `.env` and add your private key
3. Run any example:

```bash
node buy-sell.js
node websocket.js
node create-token.js
```

## 📁 Examples

| File | Description |
|------|-------------|
| [`buy-sell.js`](./buy-sell.js) | Buy and sell tokens on Pump.fun |
| [`websocket.js`](./websocket.js) | Real-time trade data and new token alerts |
| [`create-token.js`](./create-token.js) | Launch new tokens with optional dev buy |
| [`sniper-bot.js`](./sniper-bot.js) | Automated new token sniper (educational) |
| [`claim-fees.js`](./claim-fees.js) | Claim creator fees from your tokens |
| [`transfer.js`](./transfer.js) | SOL transfer transactions |

## 🔐 Security

- **Never commit your private keys** to version control
- Use environment variables (`.env` file) for sensitive data
- The API uses **client-side signing** — your keys never leave your machine

## 📖 Documentation

Full API documentation: [pumpdev.io](https://pumpdev.io)

## 💬 Support

- [Telegram](https://t.me/pumpdev_io)
- [Twitter](https://x.com/PumpDevIO)

---

**Copyright © 2026 PumpDev. All rights reserved.**
