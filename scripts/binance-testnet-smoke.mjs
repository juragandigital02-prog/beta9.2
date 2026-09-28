import ccxt from 'ccxt';

const apiKey = process.env.BINANCE_TESTNET_API_KEY;
const secret = process.env.BINANCE_TESTNET_SECRET;

if (!apiKey || !secret) {
  console.error('Missing hidden Binance testnet credentials.');
  process.exit(2);
}

const exchange = new ccxt.binance({
  apiKey,
  secret,
  enableRateLimit: true,
  options: { defaultType: 'spot' },
});
exchange.setSandboxMode(true);

function summarizeOrder(order) {
  return {
    id: order.id,
    status: order.status,
    filled: Number(order.filled) || 0,
    average: Number(order.average || order.price) || 0,
  };
}

async function confirmedOrder(initialOrder, symbol) {
  let order = initialOrder;
  if (order.id && (!Number(order.filled) || !['closed', 'filled', 'canceled', 'cancelled'].includes(String(order.status).toLowerCase()))) {
    order = await exchange.fetchOrder(order.id, symbol);
  }
  if (order.id && !['closed', 'filled', 'canceled', 'cancelled'].includes(String(order.status).toLowerCase())) {
    await exchange.cancelOrder(order.id, symbol);
    order = await exchange.fetchOrder(order.id, symbol);
  }
  return order;
}

let buyOrder;
let sellOrder;
try {
  await exchange.loadMarkets();
  const symbol = 'BTC/USDT';
  const market = exchange.market(symbol);
  const [balance, ticker] = await Promise.all([
    exchange.fetchBalance(),
    exchange.fetchTicker(symbol),
  ]);
  const last = Number(ticker.last);
  if (!Number.isFinite(last) || last <= 0) throw new Error('TESTNET_TICKER_INVALID');

  const budgetUsdt = 10;
  const buyAmount = Number(exchange.amountToPrecision(symbol, budgetUsdt / last));
  const notional = buyAmount * last;
  const minimumCost = Number(market.limits?.cost?.min || 0);
  if (!Number.isFinite(buyAmount) || buyAmount <= 0 || notional < minimumCost) {
    throw new Error('TESTNET_ORDER_BELOW_MARKET_MINIMUM');
  }

  console.log(JSON.stringify({
    step: 'connected',
    sandbox: true,
    symbol,
    last,
    usdtBalance: Number(balance.free?.USDT || 0),
    btcBalance: Number(balance.total?.BTC || 0),
    requestedNotionalUsdt: Number(notional.toFixed(2)),
  }));

  buyOrder = await exchange.createOrder(symbol, 'market', 'buy', buyAmount);
  buyOrder = await confirmedOrder(buyOrder, symbol);
  const buy = summarizeOrder(buyOrder);
  console.log(JSON.stringify({ step: 'buy', sandbox: true, ...buy }));
  if (!buy.id || buy.filled <= 0 || buy.average <= 0 || !['closed', 'filled', 'canceled', 'cancelled'].includes(String(buy.status).toLowerCase())) {
    throw new Error('TESTNET_BUY_FILL_UNCONFIRMED');
  }

  const sellAmount = Number(exchange.amountToPrecision(symbol, buy.filled));
  sellOrder = await exchange.createOrder(symbol, 'market', 'sell', sellAmount);
  sellOrder = await confirmedOrder(sellOrder, symbol);
  const sell = summarizeOrder(sellOrder);
  console.log(JSON.stringify({ step: 'sell', sandbox: true, ...sell }));
  if (!sell.id || sell.filled < buy.filled * 0.999 || sell.average <= 0 || !['closed', 'filled', 'canceled', 'cancelled'].includes(String(sell.status).toLowerCase())) {
    console.error('TESTNET_SELL_NOT_CONFIRMED: inspect the testnet account open orders; no live funds are involved.');
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify({ step: 'round_trip_complete', sandbox: true, bought: buy.filled, sold: sell.filled }));
  }
} catch (error) {
  const name = typeof error?.name === 'string' ? error.name : 'TestnetSmokeError';
  const code = typeof error?.code === 'string' ? error.code : undefined;
  console.error(JSON.stringify({ step: 'failed', sandbox: true, error: name, code }));
  if (buyOrder?.id && Number(buyOrder.filled) > 0) {
    console.error(JSON.stringify({ step: 'manual_testnet_check_required', buyOrderId: buyOrder.id, filled: Number(buyOrder.filled) }));
  }
  if (sellOrder?.id) {
    console.error(JSON.stringify({ step: 'sell_order_check_required', sellOrderId: sellOrder.id, filled: Number(sellOrder.filled) || 0 }));
  }
  process.exitCode = 1;
} finally {
  exchange.apiKey = '';
  exchange.secret = '';
}