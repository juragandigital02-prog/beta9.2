import { postJson } from './httpClient';

export const LIVE_TICKER_SYMBOLS = [
  'BTC/USDT',
  'ETH/USDT',
  'BNB/USDT',
  'SOL/USDT',
  'HYPE/USDT',
  'LINK/USDT',
  'AVAX/USDT',
  'NEAR/USDT',
  'XRP/USDT',
  'SUI/USDT',
  'ZEC/USDT',
  'DOGE/USDT',
  'XAUT/USDT',
  'TAO/USDT',
] as const;

export interface ExchangeTicker {
  last: number;
  percentage: number;
  timestamp: number;
  source?: string;
  quoteCurrency?: string;
}

export interface BatchTickerResponse {
  success: true;
  exchange: string;
  source?: string;
  tickers: Record<string, ExchangeTicker>;
}

export function fetchBatchTickers(exchange: string, symbols: readonly string[], signal?: AbortSignal) {
  return postJson<BatchTickerResponse>('/api/exchange/fetch-tickers-batch', { exchange, symbols }, signal);
}

export function fetchExchangePortfolio(payload: Record<string, unknown>) {
  return postJson<Record<string, any>>('/api/exchange/fetch-portfolio', payload);
}

export function fetchExchangeTrades(payload: Record<string, unknown>) {
  return postJson<Record<string, any>>('/api/exchange/fetch-trades', payload);
}

export function placeExchangeOrder(payload: Record<string, unknown>) {
  return postJson<Record<string, any>>('/api/exchange/place-order', payload);
}

export function testExchangeConnection(payload: Record<string, unknown>, signal?: AbortSignal) {
  return postJson<Record<string, any>>('/api/exchange/test-connection', payload, signal);
}

export function testAllCoinsExecution(payload: Record<string, unknown>) {
  return postJson<{
    success: boolean;
    totalVerified: number;
    summary: string;
    results: Array<{
      symbol: string;
      coin: string;
      name: string;
      executable: boolean;
      orderId: string;
      price: number;
      amount: number;
      costUsdt: number;
      latencyMs: number;
      note: string;
    }>;
  }>('/api/exchange/test-all-coins-execution', payload);
}

export function fetchExchangeMarkets(payload: Record<string, unknown>) {
  return postJson<Record<string, any>>('/api/exchange/markets', payload);
}
