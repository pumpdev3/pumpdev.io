/**
 * PumpDev API Example: WebSocket Real-Time Data
 * 
 * This example demonstrates how to:
 * 1. Connect to the WebSocket server
 * 2. Subscribe to new token launches
 * 3. Subscribe to specific token trades
 * 4. Track wallet activity
 * 
 * Documentation: https://pumpdev.io/data-api
 */

import WebSocket from 'ws';

// Configuration
const WS_URL = process.env.PUMPDEV_WS_URL || 'wss://pumpdev.io/ws';

// Tokens to monitor (add your token mint addresses)
const TOKEN_MINTS = [
  // 'YourTokenMintAddress1',
  // 'YourTokenMintAddress2',
];

// Wallets to track (whale watching, competitor analysis, etc.)
const WATCH_WALLETS = [
  // 'WalletAddress1',
  // 'WalletAddress2',
];

async function main() {
  console.log('=== PUMPDEV WEBSOCKET EXAMPLE ===\n');
  console.log('Connecting to:', WS_URL);

  const ws = new WebSocket(WS_URL);

  // Connection opened
  ws.on('open', () => {
    console.log('✅ Connected to WebSocket\n');

    // Subscribe to NEW TOKEN launches (most active feed)
    console.log('📡 Subscribing to new token launches...');
    ws.send(JSON.stringify({
      method: 'subscribeNewToken'
    }));

    // Subscribe to specific token trades (if configured)
    if (TOKEN_MINTS.length > 0) {
      console.log('📡 Subscribing to token trades...');
      ws.send(JSON.stringify({
        method: 'subscribeTokenTrade',
        keys: TOKEN_MINTS
      }));
    }

    // Subscribe to wallet activity (if configured)
    if (WATCH_WALLETS.length > 0) {
      console.log('📡 Subscribing to wallet activity...');
      ws.send(JSON.stringify({
        method: 'subscribeAccountTrade',
        keys: WATCH_WALLETS
      }));
    }

    console.log('\n🎯 Waiting for events...\n');
  });

  // Handle incoming messages
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());

      // Handle system messages
      switch (message.type) {
        case 'connected':
          console.log('📡 Connection confirmed:', message.message);
          return;

        case 'subscribed':
          console.log(`✅ Subscribed to ${message.method}:`, message.keys || 'all');
          return;

        case 'unsubscribed':
          console.log(`🔕 Unsubscribed from ${message.method}`);
          return;

        case 'error':
          console.error('❌ Error:', message.message);
          return;
      }

      // Handle trade events
      handleTradeEvent(message);
    } catch (err) {
      console.error('Parse error:', err.message);
    }
  });

  // Handle errors
  ws.on('error', (err) => {
    console.error('WebSocket error:', err.message);
  });

  // Handle close
  ws.on('close', () => {
    console.log('\n🔌 WebSocket disconnected');
  });

  // Graceful shutdown (Ctrl+C)
  process.on('SIGINT', () => {
    console.log('\nClosing connection...');
    
    // Unsubscribe before closing
    ws.send(JSON.stringify({ method: 'unsubscribeNewToken' }));
    
    if (TOKEN_MINTS.length > 0) {
      ws.send(JSON.stringify({ 
        method: 'unsubscribeTokenTrade', 
        keys: TOKEN_MINTS 
      }));
    }
    
    if (WATCH_WALLETS.length > 0) {
      ws.send(JSON.stringify({ 
        method: 'unsubscribeAccountTrade', 
        keys: WATCH_WALLETS 
      }));
    }

    setTimeout(() => {
      ws.close();
      process.exit(0);
    }, 500);
  });
}

/**
 * Handle trade/create events
 */
function handleTradeEvent(event) {
  const timestamp = new Date().toISOString();

  if (event.txType === 'create') {
    // 🆕 New token created
    console.log(`\n🆕 [${timestamp}] NEW TOKEN`);
    console.log(`   Name: ${event.name} (${event.symbol})`);
    console.log(`   Mint: ${event.mint}`);
    console.log(`   Creator: ${event.traderPublicKey}`);
    console.log(`   Initial Buy: ${event.solAmount} SOL`);
    console.log(`   Market Cap: ${event.marketCapSol?.toFixed(2)} SOL`);
    console.log(`   🔗 https://pump.fun/${event.mint}`);
  } 
  else if (event.txType === 'buy') {
    // 💚 Buy event
    console.log(`\n💚 [${timestamp}] BUY`);
    console.log(`   Token: ${event.mint}`);
    console.log(`   Trader: ${event.traderPublicKey}`);
    console.log(`   Amount: +${event.solAmount} SOL`);
    console.log(`   Tokens: ${event.tokenAmount?.toLocaleString()}`);
    console.log(`   Market Cap: ${event.marketCapSol?.toFixed(2)} SOL`);
  } 
  else if (event.txType === 'sell') {
    // 🔴 Sell event
    console.log(`\n🔴 [${timestamp}] SELL`);
    console.log(`   Token: ${event.mint}`);
    console.log(`   Trader: ${event.traderPublicKey}`);
    console.log(`   Amount: -${event.solAmount} SOL`);
    console.log(`   Tokens: ${event.tokenAmount?.toLocaleString()}`);
    console.log(`   Market Cap: ${event.marketCapSol?.toFixed(2)} SOL`);
  }
}

main();
