import type { UserWallet, TradingPosition, TransactionRecord } from '../types';

// ==========================================
// 12 OFFICIAL SUPPORTED COINS GAIN
// ==========================================
export interface SupportedCoin {
  coin: string;
  pair: string;
  name: string;
  price: number;
  change24h: number;
}

export const SUPPORTED_COINS: SupportedCoin[] = [
  { coin: 'BTC',  pair: 'BTC/USDT',  name: 'Bitcoin',       price: 67250,   change24h: 2.4  },
  { coin: 'ETH',  pair: 'ETH/USDT',  name: 'Ethereum',      price: 3480,    change24h: -0.8 },
  { coin: 'SOL',  pair: 'SOL/USDT',  name: 'Solana',        price: 178.50,  change24h: 4.1  },
  { coin: 'BNB',  pair: 'BNB/USDT',  name: 'BNB',           price: 595.00,  change24h: 1.2  },
  { coin: 'ZEC',  pair: 'ZEC/USDT',  name: 'Zcash',         price: 32.50,   change24h: -1.5 },
  { coin: 'HYPE', pair: 'HYPE/USDT', name: 'Hyperliquid',   price: 24.50,   change24h: 5.3  },
  { coin: 'LINK', pair: 'LINK/USDT', name: 'Chainlink',     price: 13.20,   change24h: 0.9  },
  { coin: 'UNI',  pair: 'UNI/USDT',  name: 'Uniswap',       price: 7.80,    change24h: -2.1 },
  { coin: 'NEAR', pair: 'NEAR/USDT', name: 'NEAR Protocol', price: 4.85,    change24h: 3.6  },
  { coin: 'SUI',  pair: 'SUI/USDT',  name: 'Sui Network',   price: 1.95,    change24h: 6.8  },
  { coin: 'XRP',  pair: 'XRP/USDT',  name: 'Ripple',        price: 0.585,   change24h: 1.0  },
  { coin: 'DOGE', pair: 'DOGE/USDT', name: 'Dogecoin',      price: 0.38,    change24h: -0.3 },
];

// ==========================================
// INITIAL WALLET STATE (Default for new users)
// ==========================================
export const initialWallet: UserWallet = {
  liquidBalance: 0,
  availableCash: 0,
  gasReserve: 0,
  totalInflow: 0,
  totalOutflow: 0,
  gasConsumed: 0,
  referralYield: 0,
  nonCashGasBonus: 0,
  withdrawableTradingYield: 0,
  allocatedAssetUsdt: 0,
  volume24h: 0,
  memberId: 'GN-00000',
  username: 'Member GAIN',
  email: '',
  accountStatus: 'non-active',
  role: 'user',
  activationFeeUsdt: 100,
  licenseTier: 'starter_5',
  licenseType: 'lifetime',
  licenseName: 'Starter Lifetime (5 Bot Aktif)',
  maxActiveBots: 5,
  tradingBonusUsdt: 0,
  depositAddress: '',
  downlineCount: 0,
  winRatePct: 0,
  sponsorId: 'GN-10001',
  sponsorName: 'Master GAIN Foundation',
  directReferralsCount: 0,
  teamTurnoverUsdt: 0,
  totalReferralBonusUsdt: 0,
  twoFactorEnabled: false,
  emailVerified: false,
};

// ==========================================
// INITIAL POSITIONS (Empty by default)
// ==========================================
export const initialPositions: TradingPosition[] = [];

// ==========================================
// INITIAL TRANSACTIONS (Empty by default)
// ==========================================
export const initialTransactions: TransactionRecord[] = [];
