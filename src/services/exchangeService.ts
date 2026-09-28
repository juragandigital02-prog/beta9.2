import {
  fetchBatchTickers,
  fetchExchangePortfolio,
  fetchExchangeTrades,
  placeExchangeOrder,
  testExchangeConnection,
  testAllCoinsExecution,
  fetchExchangeMarkets,
} from '../api/exchangeApi';

export { LIVE_TICKER_SYMBOLS } from '../api/exchangeApi';

export const loadTickerBatch = fetchBatchTickers;
export const loadExchangePortfolio = fetchExchangePortfolio;
export const loadExchangeTrades = fetchExchangeTrades;
export const executeExchangeOrder = placeExchangeOrder;
export const verifyExchangeConnection = testExchangeConnection;
export const verifyCoinExecution = testAllCoinsExecution;
export const loadExchangeMarkets = fetchExchangeMarkets;
