import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyBuyFill,
  applyRecoveredFill,
  applySellFill,
  botRegistryKey,
  buildClientOrderId,
  classifyBotExecutionError,
  deriveBotRunnerId,
  getRunnerFailureState,
  isFreshPrice,
  retryBotExchangeAction,
  selectOwnedBotEntries,
  shouldExecuteTakeProfit,
  validateMarketOrderLimits,
} from './botEngineCore';

test('UID ownership filters prevent one user from controlling another user bot', () => {
  const entries = [
    ['uid-a:bot-1', { uid: 'uid-a' }],
    ['uid-b:bot-2', { uid: 'uid-b' }],
  ] as Array<[string, { uid: string }]>;

  assert.deepEqual(selectOwnedBotEntries(entries, 'uid-a').map(([key]) => key), ['uid-a:bot-1']);
  assert.equal(botRegistryKey('uid-a', 'bot-1'), 'uid-a:bot-1');
});

test('multi-coin runner IDs are deterministic under the parent bot ID', () => {
  assert.equal(deriveBotRunnerId('matrix-42', 'BTC/USDT', true), 'matrix-42_btcusdt');
  assert.equal(deriveBotRunnerId('matrix-42', 'ETH/USDT', true), 'matrix-42_ethusdt');
  assert.equal(deriveBotRunnerId('single-1', 'BTC/USDT', false), 'single-1');
});

test('client order IDs are deterministic and distinct by side and sequence', () => {
  const buyId = buildClientOrderId('uid-a', 'bot-1', 'bot-1_btcusdt', 'buy', 2);
  assert.equal(buyId, buildClientOrderId('uid-a', 'bot-1', 'bot-1_btcusdt', 'buy', 2));
  assert.notEqual(buyId, buildClientOrderId('uid-a', 'bot-1', 'bot-1_btcusdt', 'sell', 2));
  assert.notEqual(buyId, buildClientOrderId('uid-a', 'bot-1', 'bot-1_btcusdt', 'buy', 3));
});

test('stale or future ticker timestamps are rejected', () => {
  assert.equal(isFreshPrice(9_500, 10_000, 1_000), true);
  assert.equal(isFreshPrice(8_000, 10_000, 1_000), false);
  assert.equal(isFreshPrice(10_001, 10_000, 1_000), false);
});

test('market order amount and notional limits are enforced', () => {
  const limits = { amount: { min: 0.01, max: 10 }, cost: { min: 20, max: 500 } };
  assert.equal(validateMarketOrderLimits(0.001, 100, limits), 'ORDER_AMOUNT_BELOW_EXCHANGE_MINIMUM');
  assert.equal(validateMarketOrderLimits(1, 10, limits), 'ORDER_NOTIONAL_BELOW_EXCHANGE_MINIMUM');
  assert.equal(validateMarketOrderLimits(6, 100, limits), 'ORDER_NOTIONAL_ABOVE_EXCHANGE_MAXIMUM');
  assert.equal(validateMarketOrderLimits(1, 100, limits), null);
});

test('take profit requires a position and respects callback rules', () => {
  const base = { gainPct: 2, targetPct: 1.5, peakPrice: 102, currentPrice: 101.5, callbackPct: 0.2, useCallback: true };
  assert.equal(shouldExecuteTakeProfit({ ...base, quantity: 0 }), false);
  assert.equal(shouldExecuteTakeProfit({ ...base, quantity: 1 }), true);
  assert.equal(shouldExecuteTakeProfit({ ...base, gainPct: 1.4, quantity: 1 }), false);
  assert.equal(shouldExecuteTakeProfit({ ...base, gainPct: 1.5, useCallback: false, quantity: 1 }), true);
});

test('weighted buy and sell fills update quantity and realized PnL', () => {
  const firstBuy = applyBuyFill({ quantity: 0, averageEntryPrice: 0, realizedPnl: 0 }, 2, 100);
  const secondBuy = applyBuyFill(firstBuy, 1, 130);
  assert.equal(secondBuy.quantity, 3);
  assert.equal(secondBuy.averageEntryPrice, 110);

  const partialSell = applySellFill(secondBuy, 1, 125);
  assert.equal(partialSell.quantity, 2);
  assert.equal(partialSell.averageEntryPrice, 110);
  assert.equal(partialSell.realizedPnl, 15);
});

test('permanent exchange errors pause while transient errors are retryable', () => {
  assert.equal(classifyBotExecutionError({ status: 429, message: 'rate limit' }).retryable, true);
  assert.equal(classifyBotExecutionError({ name: 'NetworkError' }).retryable, true);
  assert.equal(classifyBotExecutionError({ status: 401, message: 'invalid key' }).reasonCode, 'EXCHANGE_AUTH_OR_PERMISSION');
  assert.equal(classifyBotExecutionError({ name: 'InsufficientFunds' }).reasonCode, 'INSUFFICIENT_BALANCE');
  assert.equal(classifyBotExecutionError({ message: 'invalid symbol' }).reasonCode, 'INVALID_SYMBOL');
  assert.deepEqual(getRunnerFailureState({ status: 429 }, 0, 3), {
    status: 'active',
    failureStreak: 1,
    reasonCode: 'EXCHANGE_TRANSIENT_FAILURE',
  });
  assert.equal(getRunnerFailureState({ status: 429 }, 2, 3).status, 'paused');
  assert.equal(getRunnerFailureState({ status: 401 }, 0, 3).status, 'error');
});

test('transient retries reuse one clientOrderId and do not duplicate a mock order', async () => {
  const clientOrderId = buildClientOrderId('uid-a', 'bot-1', 'bot-1_btcusdt', 'buy', 1);
  const exchangeOrders = new Map<string, { id: string; status: string }>();
  let attempts = 0;
  const confirmedOrder = await retryBotExchangeAction(async () => {
    attempts += 1;
    let order = exchangeOrders.get(clientOrderId);
    if (!order) {
      order = { id: 'mock-order-1', status: 'closed' };
      exchangeOrders.set(clientOrderId, order);
    }
    if (attempts === 1) throw Object.assign(new Error('request timeout'), { name: 'NetworkError' });
    return order;
  }, 3, async () => {});

  assert.equal(attempts, 2);
  assert.equal(exchangeOrders.size, 1);
  assert.equal(confirmedOrder.id, 'mock-order-1');
});

test('mock paper execution buys then sells the tracked position at take profit', () => {
  const buyFill = { filledQty: 2, fillPrice: 100 };
  const position = applyBuyFill({ quantity: 0, averageEntryPrice: 0, realizedPnl: 0 }, buyFill.filledQty, buyFill.fillPrice);
  const gainPct = ((110 - position.averageEntryPrice) / position.averageEntryPrice) * 100;
  const shouldSell = shouldExecuteTakeProfit({
    quantity: position.quantity,
    gainPct,
    targetPct: 5,
    peakPrice: 110,
    currentPrice: 110,
    callbackPct: 0.2,
    useCallback: false,
  });
  assert.equal(shouldSell, true);

  const sellFill = { filledQty: position.quantity, fillPrice: 110 };
  const closed = applySellFill(position, sellFill.filledQty, sellFill.fillPrice);
  assert.equal(closed.quantity, 0);
  assert.equal(closed.averageEntryPrice, 0);
  assert.equal(closed.realizedPnl, 20);
});

test('stale price gate prevents an exchange order callback', () => {
  let orderCalls = 0;
  const timestamp = 1_000;
  if (isFreshPrice(timestamp, 12_000, 10_000)) orderCalls += 1;
  assert.equal(orderCalls, 0);
});

test('a recovered filled order updates state from actual fill values', () => {
  const recoveredBuy = applyRecoveredFill(
    { quantity: 0, averageEntryPrice: 0, realizedPnl: 0 },
    { side: 'buy', filledQty: 0.5, fillPrice: 200 }
  );
  const recoveredSell = applyRecoveredFill(recoveredBuy, { side: 'sell', filledQty: 0.25, fillPrice: 220 });
  assert.equal(recoveredSell.quantity, 0.25);
  assert.equal(recoveredSell.averageEntryPrice, 200);
  assert.equal(recoveredSell.realizedPnl, 5);
});