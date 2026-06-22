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
| [`claim-fees.js`](./claim-fees.js) | Check claimable balances, claim creator fees & cashback (supports fee sharing) |
| [`transfer.js`](./transfer.js) | SOL transfer transactions |
| [`lightning.js`](./lightning.js) | Lightning API: server-side wallet, trade, and token creation |
| [`lightning-bundle.js`](./lightning-bundle.js) | Lightning Bundle: Jito-protected atomic bundles (buy/sell/create) |
| [`bundle.js`](./bundle.js) | Local-Sign Bundle: build unsigned txs, sign locally, send to Jito |

### Balance Checks & Claiming

Both creator fees and cashback support **read-only balance checks** before claiming. Same URL, just GET instead of POST:

```bash
# Check claimable creator fees (default — runs checkClaimBalance)
PRIVATE_KEY=YourKey node claim-fees.js

# Check with a specific token mint (enables fee sharing / graduated detection)
PRIVATE_KEY=YourKey MINT=TokenMintAddress node claim-fees.js
```

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/claim-account` | Check claimable creator fee balance |
| `POST` | `/api/claim-account` | Build claim transaction |
| `GET` | `/api/claim-cashback` | Check claimable cashback balance |
| `POST` | `/api/claim-cashback` | Build cashback claim transaction |

### Fee Sharing Support

If you have reward distribution configured on pump.fun (e.g. 50/50 split between addresses), pass the `MINT` env var so the API can detect the sharing config and use the correct instruction:

```bash
PRIVATE_KEY=YourKey MINT=TokenMintAddress node claim-fees.js
```

Without `MINT`, the API uses a standard claim instruction. With `MINT`, it checks on-chain for a fee sharing config and automatically builds the `distribute_creator_fees` instruction that sends rewards to all configured shareholders.

### Cashback Rewards

Pump.fun supports **cashback-enabled tokens** where creator fees are redirected to traders. The `claim-fees.js` example includes `checkCashbackBalance()` and `claimCashback()` functions:

```bash
PRIVATE_KEY=YourKey node claim-fees.js
# Uncomment checkCashbackBalance() or claimCashback() in main()
```

To create cashback-enabled tokens, pass `cashbackEnabled: true` in your `/api/create` request (see `create-token.js`).

## 🔐 Security

- **Never commit your private keys** to version control
- Use environment variables (`.env` file) for sensitive data
- The API uses **client-side signing** — your keys never leave your machine

### What is a Private Key?

Your **private key** is a secret code (base58 string) that controls your Solana wallet. Think of it like a password that lets you send tokens and SOL.

**How to get it:**
- **Phantom**: Settings → Security & Privacy → Export Private Key
- **Solflare**: Settings → Export Private Key
- **CLI wallet**: Check your `~/.config/solana/id.json` file

⚠️ **Never share your private key with anyone!** Anyone with your key can steal all your funds.

## 📖 Documentation

Full API documentation: [pumpdev.io](https://pumpdev.io)

## 💬 Support

- [Telegram](https://t.me/pumpdev_io)
- [Twitter](https://x.com/PumpDevIO)

---

**Copyright © 2026 PumpDev. All rights reserved.**
