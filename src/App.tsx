import { lazy, Suspense, useState, useEffect, useRef, useMemo, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ShieldCheck } from 'lucide-react';
import {
  NavigationRoute,
  ExchangeName,
  TradingPosition,
  TransactionRecord,
  TradeRecord,
  ExecutedLayerDetail,
  UserWallet,
  ConnectedExchangeConfig,
  BotMode,
  AveragingStep,
  PriceAlert,
} from './types';
import { initialPositions, initialTransactions, initialWallet, SUPPORTED_COINS } from './data/mockData';
import { HeaderBar } from './components/HeaderBar';
import { BottomDock } from './components/BottomDock';
import { generateDefaultLayersForPosition } from './utils/tradingPositionUtils';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { RoleRoute } from './components/routing/ProtectedRoute';
import { AppErrorBoundary } from './components/common/AppErrorBoundary';
import {
  loadExchangePortfolio as fetchExchangePortfolio,
  loadExchangeTrades as fetchExchangeTrades,
  executeExchangeOrder as placeExchangeOrder,
  loadTickerBatch,
  LIVE_TICKER_SYMBOLS,
} from './services/exchangeService';
import { removeBotRunner as deleteBackgroundBot, registerBotRunner as registerBackgroundBot } from './services/botService';
import { activateWalletAccount as processWalletActivation } from './services/walletService';
import { queryClient } from './queryClient';
import { useUiStore } from './stores/uiStore';
import { reportClientEvent } from './services/observabilityService';
import { formatUsdt } from './utils/formatters';
import { assertProductionSafeMode, isDemoMode } from './config/appMode';
import { validateFinancialAction } from './utils/serverValidation';

import {
  subscribeToUserWallet,
  subscribeToUserPositions,
  subscribeToUserTransactions,
  subscribeToUserTradeHistory,
  fetchOlderUserTransactions,
  fetchOlderUserTrades,
  updateUserWallet,
  addTransactionToFirestore,
  addTradeRecordToFirestore,
  syncTradesFromExchangeToFirestore,
  updatePositionInFirestore,
  deletePositionFromFirestore,
  saveConnectedExchangeToFirestore,
  setActiveExchangeInFirestore,
  disconnectSingleExchangeFromFirestore,
  syncRealPortfolioAssetsToFirestore,
  disconnectExchangeFromFirestore,
} from './repositories/userRepository';
import type { FirestorePageCursor } from './repositories/userRepository';

import { subscribeToPriceAlerts, checkPriceAlerts } from './services/priceAlertService';
import {
  NotificationToastContainer,
  AppNotification,
} from './components/common/NotificationToastContainer';
import {
  notifyLayerExecution,
  notifyTakeProfit,
  notifyPriceAlert,
  sendBrowserNotification,
  getNotificationPermission,
  requestNotificationPermission,
  NotificationPermissionState,
} from './services/notificationService';

const HomeView = lazy(() => import('./views/HomeView').then((module) => ({ default: module.HomeView })));
const WalletView = lazy(() => import('./views/WalletView').then((module) => ({ default: module.WalletView })));
const TradingPositionsView = lazy(() => import('./views/TradingPositionsView').then((module) => ({ default: module.TradingPositionsView })));
const BotMatrixView = lazy(() => import('./views/BotMatrixView').then((module) => ({ default: module.BotMatrixView })));
const AccountView = lazy(() => import('./views/AccountView').then((module) => ({ default: module.AccountView })));
const AdminUserManagementModal = lazy(() => import('./components/admin/AdminUserManagementModal').then((module) => ({ default: module.AdminUserManagementModal })));
const AveragingMatrixModal = lazy(() => import('./components/modals/AveragingMatrixModal').then((module) => ({ default: module.AveragingMatrixModal })));
const DepositModal = lazy(() => import('./components/modals/DepositModal').then((module) => ({ default: module.DepositModal })));
const WithdrawModal = lazy(() => import('./components/modals/WithdrawModal').then((module) => ({ default: module.WithdrawModal })));
const TransferMemberModal = lazy(() => import('./components/modals/TransferMemberModal').then((module) => ({ default: module.TransferMemberModal })));
const GasFeeModal = lazy(() => import('./components/modals/GasFeeModal').then((module) => ({ default: module.GasFeeModal })));
const ProfitShareModal = lazy(() => import('./components/modals/ProfitShareModal').then((module) => ({ default: module.ProfitShareModal })));
const ApiKeyModal = lazy(() => import('./components/modals/ApiKeyModal').then((module) => ({ default: module.ApiKeyModal })));
const SimulationModal = lazy(() => import('./components/modals/SimulationModal').then((module) => ({ default: module.SimulationModal })));
const ExchangeCoinsCheckerModal = lazy(() => import('./components/modals/ExchangeCoinsCheckerModal').then((module) => ({ default: module.ExchangeCoinsCheckerModal })));
const ActivationFeeModal = lazy(() => import('./components/modals/ActivationFeeModal').then((module) => ({ default: module.ActivationFeeModal })));
const Google2faModal = lazy(() => import('./components/modals/Google2faModal').then((module) => ({ default: module.Google2faModal })));
const LoginVerificationModal = lazy(() => import('./components/modals/LoginVerificationModal').then((module) => ({ default: module.LoginVerificationModal })));
const GmailVerificationModal = lazy(() => import('./components/modals/GmailVerificationModal').then((module) => ({ default: module.GmailVerificationModal })));
const AuthModal = lazy(() => import('./components/modals/AuthModal').then((module) => ({ default: module.AuthModal })));
const PriceAlertModal = lazy(() => import('./components/modals/PriceAlertModal').then((module) => ({ default: module.PriceAlertModal })));

function LazyMount({ isOpen, children }: { isOpen: boolean; children: ReactNode }) {
  const [hasOpened, setHasOpened] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setHasOpened(true);
  }, [isOpen]);

  return hasOpened ? children : null;
}

const ROUTE_BY_PATH: Record<string, NavigationRoute> = {
  '/': 'home',
  '/wallet': 'wallet',
  '/bot': 'bot',
  '/trading': 'trading',
  '/akun': 'akun',
};

function pathForRoute(route: NavigationRoute): string {
  return route === 'home' ? '/' : `/${route}`;
}

function resolveQueryUpdate<T>(
  current: T | undefined,
  updater: T | ((current: T) => T),
  fallback: T
): T {
  return typeof updater === 'function'
    ? (updater as (current: T) => T)(current ?? fallback)
    : updater;
}

// Cryptographically safe or entropy-rich unique ID generator to prevent key collision across synchronous loops
const generateUniqueId = (prefix: string = 'id'): string => {
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${Date.now()}-${randomPart}`;
};

function AppContent() {
  assertProductionSafeMode();

  if (isDemoMode) {
    console.warn('[GAIN] Running in demo mode. This build should not be used for public production traffic.');
  }

  const navigate = useNavigate();
  const location = useLocation();
  const currentRoute = ROUTE_BY_PATH[location.pathname] || 'home';
  const handleRouteChange = (route: NavigationRoute) => navigate(pathForRoute(route));
  const [currentExchange, setCurrentExchange] = useState<ExchangeName>('Bitget');
  const queryClientInstance = useQueryClient();
  const uiModals = useUiStore((state) => state.modals);
  const setUiModalOpen = useUiStore((state) => state.setModalOpen);

  const {
    currentUser,
    openLogin,
    is2faVerified,
    verify2faSession,
    logout,
    isAuthModalOpen,
    setIsAuthModalOpen,
    authModalMode,
    pendingSponsorId,
    isAdmin,
    sessionExpiredNotice,
    clearSessionExpiredNotice,
  } = useAuth();

  const isAuthenticatedUser = Boolean(currentUser && currentUser.uid !== 'gain-usr-demo');
  const protectAction = <T extends (...args: any[]) => any>(action: T): T => ((...args: Parameters<T>) => {
    if (!isAuthenticatedUser) {
      openLogin();
      return undefined;
    }
    return action(...args);
  }) as T;

  const userDataKey = currentUser?.uid || 'anonymous';
  const walletQueryKey = useMemo(() => ['user-data', userDataKey, 'wallet'] as const, [userDataKey]);
  const positionsQueryKey = useMemo(() => ['user-data', userDataKey, 'positions'] as const, [userDataKey]);
  const transactionsQueryKey = useMemo(() => ['user-data', userDataKey, 'transactions'] as const, [userDataKey]);
  const tradesQueryKey = useMemo(() => ['user-data', userDataKey, 'trades'] as const, [userDataKey]);
  const alertsQueryKey = useMemo(() => ['user-data', userDataKey, 'price-alerts'] as const, [userDataKey]);
  const previousUserDataKeyRef = useRef(userDataKey);

  useEffect(() => {
    const previousUserDataKey = previousUserDataKeyRef.current;
    if (previousUserDataKey !== userDataKey) {
      queryClientInstance.removeQueries({ queryKey: ['user-data', previousUserDataKey] });
      previousUserDataKeyRef.current = userDataKey;
    }
  }, [queryClientInstance, userDataKey]);

  const wallet = useQuery({ queryKey: walletQueryKey, queryFn: async () => initialWallet, initialData: initialWallet, enabled: false }).data;
  const positions = useQuery({ queryKey: positionsQueryKey, queryFn: async () => initialPositions, initialData: initialPositions, enabled: false }).data;
  const transactions = useQuery({ queryKey: transactionsQueryKey, queryFn: async () => initialTransactions, initialData: initialTransactions, enabled: false }).data;
  const tradeHistory = useQuery({ queryKey: tradesQueryKey, queryFn: async () => [] as TradeRecord[], initialData: [] as TradeRecord[], enabled: false }).data;
  const priceAlerts = useQuery({ queryKey: alertsQueryKey, queryFn: async () => [] as PriceAlert[], initialData: [] as PriceAlert[], enabled: false }).data;
  const transactionCursorRef = useRef<FirestorePageCursor | null>(null);
  const tradeCursorRef = useRef<FirestorePageCursor | null>(null);
  const hasLoadedOlderTransactionsRef = useRef(false);
  const hasLoadedOlderTradesRef = useRef(false);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);
  const [hasMoreTrades, setHasMoreTrades] = useState(false);
  const [isLoadingTrades, setIsLoadingTrades] = useState(false);

  const setWallet = (updater: UserWallet | ((current: UserWallet) => UserWallet)) => {
    queryClientInstance.setQueryData<UserWallet>(walletQueryKey, (current) => resolveQueryUpdate(current, updater, initialWallet));
  };
  const setPositions = (updater: TradingPosition[] | ((current: TradingPosition[]) => TradingPosition[])) => {
    queryClientInstance.setQueryData<TradingPosition[]>(positionsQueryKey, (current) => resolveQueryUpdate(current, updater, initialPositions));
  };
  const setTransactions = (updater: TransactionRecord[] | ((current: TransactionRecord[]) => TransactionRecord[])) => {
    queryClientInstance.setQueryData<TransactionRecord[]>(transactionsQueryKey, (current) => resolveQueryUpdate(current, updater, initialTransactions));
  };
  const setTradeHistory = (updater: TradeRecord[] | ((current: TradeRecord[]) => TradeRecord[])) => {
    queryClientInstance.setQueryData<TradeRecord[]>(tradesQueryKey, (current) => resolveQueryUpdate(current, updater, []));
  };
  const setPriceAlerts = (updater: PriceAlert[] | ((current: PriceAlert[]) => PriceAlert[])) => {
    queryClientInstance.setQueryData<PriceAlert[]>(alertsQueryKey, (current) => resolveQueryUpdate(current, updater, []));
  };

  const tickerQuery = useQuery({
    queryKey: ['exchange-tickers', currentExchange],
    queryFn: ({ signal }) => loadTickerBatch(currentExchange.toLowerCase(), LIVE_TICKER_SYMBOLS, signal),
    refetchInterval: 12000,
    refetchIntervalInBackground: false,
  });

  // Per-exchange position cache: stores positions independently per exchange so switching doesn't lose data
  const [positionsByExchange, setPositionsByExchange] = useState<Map<string, TradingPosition[]>>(new Map());

  // Source-of-truth is Firestore. Local storage is no longer used as primary application state.
  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser?.uid) return;
    if (wallet && wallet.memberId) {
      localStorage.setItem(`gain_wallet_${currentUser.uid}`, JSON.stringify(wallet));
    }
  }, [wallet, currentUser]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser?.uid) return;
    if (positions) {
      localStorage.setItem(`gain_positions_${currentUser.uid}`, JSON.stringify(positions));
    }
  }, [positions, currentUser]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser?.uid) return;
    if (transactions) {
      localStorage.setItem(`gain_transactions_${currentUser.uid}`, JSON.stringify(transactions));
    }
  }, [transactions, currentUser]);

  useEffect(() => {
    if (typeof window === 'undefined' || !currentUser?.uid) return;
    if (tradeHistory) {
      localStorage.setItem(`gain_trades_${currentUser.uid}`, JSON.stringify(tradeHistory));
    }
  }, [tradeHistory, currentUser]);

  // Sync Google user profile immediately to wallet state
  useEffect(() => {
    if (currentUser) {
      const googleName = currentUser.displayName || currentUser.email?.split('@')[0] || 'Member GAIN';
      const googleEmail = currentUser.email || 'user@gainkoin.io';
      setWallet((prev) => ({
        ...prev,
        username: googleName,
        email: googleEmail,
      }));
    }
  }, [currentUser]);

  // Price Alerts State & Real-time Subscription
  const isPriceAlertModalOpen = uiModals.priceAlert;
  const setIsPriceAlertModalOpen = (isOpen: boolean) => setUiModalOpen('priceAlert', isOpen);
  const [priceAlertSymbol, setPriceAlertSymbol] = useState<string>('BTC/USDT');
  const priceAlertsRef = useRef<PriceAlert[]>([]);

  useEffect(() => {
    priceAlertsRef.current = priceAlerts;
  }, [priceAlerts]);

  useEffect(() => {
    const unsubAlerts = subscribeToPriceAlerts(currentUser?.uid, (remoteAlerts) => {
      setPriceAlerts(remoteAlerts);
    });
    return () => unsubAlerts();
  }, [currentUser]);

  // In-app notifications & browser permission state
  const [inAppNotifications, setInAppNotifications] = useState<AppNotification[]>([]);
  const [browserNotifPerm, setBrowserNotifPerm] = useState<NotificationPermissionState>('default');
  const triggeredTpMapRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setBrowserNotifPerm(getNotificationPermission());
  }, []);

  const handleRequestBrowserPermission = async () => {
    const perm = await requestNotificationPermission();
    setBrowserNotifPerm(perm);
    if (perm === 'granted') {
      sendBrowserNotification('🔔 Notifikasi Browser GAIN Aktif!', {
        body: 'Anda akan menerima notifikasi otomatis saat harga koin mencapai target, layer averaging terisi, dan terkena Take Profit.',
      });
      addInAppNotification({
        type: 'info',
        title: 'Notifikasi Browser Diaktifkan',
        message: 'GAIN siap mengirimkan notifikasi target harga, order layer, dan take profit.',
      });
    }
  };

  const addInAppNotification = (notif: Omit<AppNotification, 'id' | 'timestamp'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: `notif-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: Date.now(),
    };
    setInAppNotifications((prev) => [newNotif, ...prev.filter((n) => n.id !== newNotif.id)].slice(0, 6));
    setTimeout(() => {
      setInAppNotifications((prev) => prev.filter((n) => n.id !== newNotif.id));
    }, 7000);
  };

  const handleDismissNotification = (id: string) => {
    setInAppNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const showToast = (message: string, type: 'success' | 'info' | 'error' = 'info') => {
    addInAppNotification({
      type: type === 'success' ? 'take_profit' : 'info',
      title: type === 'success' ? 'Notifikasi GAIN' : 'Pemberitahuan Sistem',
      message,
    });
  };

  const handleOpenPriceAlert = (symbol?: string) => {
    if (symbol) setPriceAlertSymbol(symbol);
    setIsPriceAlertModalOpen(true);
  };

  const currentPricesMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of positions) {
      if (typeof p.price === 'number') map[p.pair] = p.price;
    }
    SUPPORTED_COINS.forEach((c) => {
      if (!map[c.pair]) map[c.pair] = c.price;
    });
    return map;
  }, [positions]);

  // User Segmentation:
  // Kategori 1: User yang sudah mempunyai akun dan sudah membayar aktivasi (wallet.accountStatus === 'active')
  // Kategori 2: User yang sudah punya akun tapi belum membayar aktivasi (wallet.accountStatus !== 'active')
  const isUser1Paid = wallet.accountStatus === 'active';
  const user1EmailKey = (wallet.email || currentUser?.email || '').toLowerCase();
  const user1SessionStorageKey = `gain_user1_verified_${user1EmailKey}`;

  const [user1SessionVerified, setUser1SessionVerified] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !user1EmailKey) return false;
    const storedAt = localStorage.getItem(user1SessionStorageKey);
    if (!storedAt) return false;
    const elapsed = Date.now() - parseInt(storedAt, 10);
    return elapsed < 24 * 60 * 60 * 1000;
  });

  useEffect(() => {
    if (!user1EmailKey) {
      setUser1SessionVerified(false);
      return;
    }
    const storedAt = localStorage.getItem(user1SessionStorageKey);
    if (storedAt) {
      const elapsed = Date.now() - parseInt(storedAt, 10);
      setUser1SessionVerified(elapsed < 24 * 60 * 60 * 1000);
    } else {
      setUser1SessionVerified(false);
    }
  }, [user1EmailKey, user1SessionStorageKey]);

  // Firestore Real-time Subscriptions
  useEffect(() => {
    if (!currentUser) return;

    transactionCursorRef.current = null;
    tradeCursorRef.current = null;
    hasLoadedOlderTransactionsRef.current = false;
    hasLoadedOlderTradesRef.current = false;
    setHasMoreTransactions(false);
    setHasMoreTrades(false);

    const unsubWallet = subscribeToUserWallet(currentUser.uid, (remoteWallet) => {
      queryClientInstance.setQueryData(walletQueryKey, remoteWallet);
      if (remoteWallet.connectedExchange?.exchange) {
        setCurrentExchange(remoteWallet.connectedExchange.exchange);
      }
    });

    const unsubPositions = subscribeToUserPositions(currentUser.uid, (remotePositions) => {
      if (remotePositions.length > 0) {
        queryClientInstance.setQueryData(positionsQueryKey, remotePositions);
        localStorage.setItem(`gain_positions_${currentUser.uid}`, JSON.stringify(remotePositions));
      } else {
        const cached = localStorage.getItem(`gain_positions_${currentUser.uid}`);
        if (cached) {
          try {
            queryClientInstance.setQueryData(positionsQueryKey, JSON.parse(cached) as TradingPosition[]);
          } catch {
            queryClientInstance.setQueryData(positionsQueryKey, initialPositions);
          }
        } else {
          queryClientInstance.setQueryData(positionsQueryKey, initialPositions);
        }
      }
    });

    const unsubTransactions = subscribeToUserTransactions(
      currentUser.uid,
      (remoteTransactions) => {
        queryClientInstance.setQueryData<TransactionRecord[]>(transactionsQueryKey, (previous) => {
          if (!hasLoadedOlderTransactionsRef.current || !previous) return remoteTransactions;
          const records = new Map(previous.map((transaction) => [transaction.id, transaction]));
          remoteTransactions.forEach((transaction) => records.set(transaction.id, transaction));
          return Array.from(records.values()).sort((a, b) =>
            Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')
          );
        });
      },
      (cursor, hasMore) => {
        if (hasLoadedOlderTransactionsRef.current) return;
        transactionCursorRef.current = cursor;
        setHasMoreTransactions(hasMore);
      }
    );

    const unsubTrades = subscribeToUserTradeHistory(
      currentUser.uid,
      (remoteTrades) => {
        queryClientInstance.setQueryData<TradeRecord[]>(tradesQueryKey, (previous) => {
          if (!hasLoadedOlderTradesRef.current || !previous) return remoteTrades;
          const records = new Map(previous.map((trade) => [trade.id, trade]));
          remoteTrades.forEach((trade) => records.set(trade.id, trade));
          return Array.from(records.values()).sort((a, b) => b.timestamp - a.timestamp);
        });
      },
      (cursor, hasMore) => {
        if (hasLoadedOlderTradesRef.current) return;
        tradeCursorRef.current = cursor;
        setHasMoreTrades(hasMore);
      }
    );

    return () => {
      unsubWallet();
      unsubPositions();
      unsubTransactions();
      unsubTrades();
    };
  }, [currentUser, queryClientInstance, walletQueryKey, positionsQueryKey, transactionsQueryKey, tradesQueryKey]);

  // Real-time live ticker stream via WebSocket with automatic CCXT batch-poll fallback
  useEffect(() => {
    let isMounted = true;
    let ws: WebSocket | null = null;

    // Connect to public WebSocket stream for sub-second Binance updates.
    const connectWs = () => {
      try {
        ws = new WebSocket('wss://stream.binance.com:9443/ws/!miniTicker@arr');

        ws.onmessage = (event) => {
          if (!isMounted) return;
          try {
            const tickers = JSON.parse(event.data);
            if (Array.isArray(tickers)) {
              const tickerMap = new Map<string, { last: number; percentage: number }>();
              for (const t of tickers) {
                if (typeof t.s === 'string' && t.s.endsWith('USDT')) {
                  const base = t.s.slice(0, -4);
                  const standardPair = `${base}/USDT`;
                  const closePrice = parseFloat(t.c);
                  const openPrice = parseFloat(t.o);
                  const pct = openPrice > 0 ? ((closePrice - openPrice) / openPrice) * 100 : 0;
                  if (closePrice > 0) {
                    tickerMap.set(standardPair, {
                      last: closePrice,
                      percentage: parseFloat(pct.toFixed(2)),
                    });
                  }
                }
              }

              if (tickerMap.size > 0) {
                setPositions((prev) =>
                  prev.map((pos) => {
                    const match = tickerMap.get(pos.pair);
                    if (match) {
                      const currentPrice = match.last;
                      let floatingPnl = pos.floatingPnl;
                      let roiPct = pos.roiPct;
                      const allocQty = parseFloat(pos.allocationQty?.replace(/[^0-9.]/g, '') || '0');
                      const allocUsdt = parseFloat(pos.allocationUsdt?.replace(/[^0-9.]/g, '') || '0');

                      if (allocQty > 0 && allocUsdt > 0) {
                        const currentValue = allocQty * currentPrice;
                        floatingPnl = Number((currentValue - allocUsdt).toFixed(2));
                        roiPct = Number(((floatingPnl / allocUsdt) * 100).toFixed(2));
                      }

                      // Check real-time automated Take Profit (+1.5% target or higher)
                      if ((pos.status === 'active' || pos.status === 'averaging') && roiPct >= 1.50 && floatingPnl > 0) {
                        const lastNotified = triggeredTpMapRef.current.get(pos.id) || 0;
                        if (Date.now() - lastNotified > 60000) {
                          triggeredTpMapRef.current.set(pos.id, Date.now());
                          notifyTakeProfit({
                            pair: pos.pair,
                            coin: pos.coin,
                            profitUsdt: floatingPnl,
                            roiPct: roiPct,
                            exitPrice: currentPrice,
                          });
                          addInAppNotification({
                            type: 'take_profit',
                            title: `Take Profit Tercapai: ${pos.pair}`,
                            message: `Target Take Profit ${pos.pair} tercapai dengan estimasi profit +$${floatingPnl.toFixed(2)} USDT (+${roiPct.toFixed(2)}%). Likuidasi siap dieksekusi!`,
                            pair: pos.pair,
                            coin: pos.coin,
                            profitUsdt: floatingPnl,
                            roiPct: roiPct,
                            price: currentPrice,
                          });
                        }
                      }

                      return {
                        ...pos,
                        price: currentPrice,
                        change24h: match.percentage,
                        floatingPnl,
                        roiPct,
                      };
                    }
                    return pos;
                  })
                );

                // Real-time sub-second Price Alerts Check
                const wsPricesMap: Record<string, number> = {};
                tickerMap.forEach((v, k) => {
                  wsPricesMap[k] = v.last;
                });
                checkPriceAlerts(priceAlertsRef.current, wsPricesMap, currentUser?.uid, (triggeredAlert, price) => {
                  const conditionWord = triggeredAlert.condition === 'above' ? 'naik melampaui' : 'turun menembus';
                  addInAppNotification({
                    type: 'price_alert',
                    title: `Target Harga: ${triggeredAlert.symbol}`,
                    message: `Harga ${triggeredAlert.symbol} telah ${conditionWord} target $${formatUsdt(triggeredAlert.targetPrice)} (Saat ini: $${formatUsdt(price)}).`,
                    pair: triggeredAlert.symbol,
                    coin: triggeredAlert.symbol.split('/')[0],
                    price,
                  });
                });
              }
            }
          } catch {
            // Ignore malformed WS frames
          }
        };

        ws.onerror = () => {
          // Fall back gracefully to HTTP polling
        };

        ws.onclose = () => {
          // Closed gracefully
        };
      } catch {
        // WebSocket not available, fallback to HTTP
      }
    };

    if (currentExchange.toLowerCase() === 'binance') {
      connectWs();
    }

    return () => {
      isMounted = false;
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) {
            ws.close();
          } else if (ws.readyState === WebSocket.CONNECTING) {
            ws.onopen = () => {
              try {
                ws?.close();
              } catch {}
            };
          }
        } catch {}
      }
    };
  }, [currentExchange]);

  useEffect(() => {
    const tickers = tickerQuery.data?.tickers;
    if (!tickers) return;

    setPositions((prev) => prev.map((position) => {
      const ticker = tickers[position.pair];
      if (!ticker?.last) return position;
      return {
        ...position,
        price: ticker.last,
        change24h: ticker.percentage ?? position.change24h,
      };
    }));

    const prices: Record<string, number> = {};
    for (const [symbol, ticker] of Object.entries(tickers)) {
      if (ticker.last) prices[symbol] = ticker.last;
    }

    checkPriceAlerts(priceAlertsRef.current, prices, currentUser?.uid, (triggeredAlert, price) => {
      showToast(
        `Price Alert: ${triggeredAlert.symbol} mencapai target $${formatUsdt(price)}!`,
        'success'
      );
    });
  }, [tickerQuery.dataUpdatedAt, currentUser?.uid]);

  // Exchange credentials stay in memory only and must be re-entered after a page reload.
  const [activeApiCreds, setActiveApiCreds] = useState<{
    exchange: ExchangeName;
    apiKey: string;
    secret: string;
    password?: string;
    isSandbox: boolean;
  } | null>(null);

  // Connected credentials for this runtime only; persisted exchange metadata remains masked.
  const [activeApiCredsMap, setActiveApiCredsMap] = useState<
    Map<
      ExchangeName,
      {
        exchange: ExchangeName;
        apiKey: string;
        secret: string;
        password?: string;
        isSandbox: boolean;
      }
    >
  >(new Map());

  // Remove credentials written by older app versions; secrets are never persisted client-side.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem('gain_active_api_creds');
    localStorage.removeItem('gain_active_api_creds_map');
    sessionStorage.removeItem('gain_active_api_creds');
  }, []);

  // Evaluate if current user session is in Demo / Testnet mode
  const isDemoOrTestnet = Boolean(
    activeApiCreds?.isSandbox ||
    wallet.connectedExchange?.isSandbox ||
    wallet.accountStatus !== 'active' ||
    !wallet.connectedExchange?.isConnected ||
    activeApiCreds?.apiKey?.toLowerCase().includes('demo') ||
    activeApiCreds?.apiKey?.toLowerCase().includes('dummy') ||
    wallet.isDemoSimulation
  );

  // Handle Exchange API Connect Success (supports connecting multiple exchangers to 1 Google account)
  const handleConnectExchangeSuccess = async (
    exchange: ExchangeName,
    balance: number,
    isSandbox: boolean,
    apiKey: string,
    secret?: string,
    passphrase?: string,
    portfolioAssets?: Array<{
      coin: string;
      pair: string;
      total: number;
      price: number;
      change24h: number;
      valueUsdt: number;
    }>,
    totalPortfolioUsdt?: number
  ) => {
    setCurrentExchange(exchange);

    if (apiKey && secret) {
      const creds = {
        exchange,
        apiKey,
        secret,
        password: passphrase,
        isSandbox,
      };
      setActiveApiCreds(creds);
      setActiveApiCredsMap((prev) => new Map(prev).set(exchange, creds));
    }

    const maskedKey = apiKey ? `${apiKey.slice(0, 4)}...${apiKey.slice(-4)}` : 'API_CONNECTED';
    const exchangeConfig: ConnectedExchangeConfig = {
      exchange,
      isConnected: true,
      isSandbox,
      apiKeyMasked: maskedKey,
      usdtBalance: balance,
      lastSynced: new Date().toLocaleTimeString(),
      isActive: true,
      totalPortfolioUsdt,
      portfolioAssets,
    };

    const totalAllocated = portfolioAssets
      ? Number(portfolioAssets.reduce((sum, a) => sum + (a.valueUsdt || 0), 0).toFixed(2))
      : 0;

    const existingList =
      wallet.connectedExchanges && wallet.connectedExchanges.length > 0
        ? wallet.connectedExchanges
        : wallet.connectedExchange?.isConnected
        ? [wallet.connectedExchange]
        : [];

    const updatedList = [
      ...existingList
        .filter((e) => e.exchange !== exchange)
        .map((e) => ({ ...e, isActive: false })),
      exchangeConfig,
    ];

    setWallet((prev) => ({
      ...prev,
      allocatedAssetUsdt: totalAllocated,
      connectedExchange: exchangeConfig,
      connectedExchanges: updatedList,
      activeExchange: exchange,
    }));

    if (portfolioAssets && portfolioAssets.length > 0) {
      const activeCoinMap = new Map(portfolioAssets.map((a) => [a.coin.toUpperCase(), a]));

      // Save current positions for the previously active exchange before overwriting
      setPositionsByExchange((prev) => {
        const next = new Map(prev);
        const prevExchange = wallet.activeExchange || currentExchange;
        if (prevExchange && prevExchange !== exchange) {
          // Only save if switching to a different exchange
          next.set(prevExchange, positions);
        }
        return next;
      });

      setPositions((prev) => {
        // Start from cached positions for this exchange if available, otherwise use current
        const basePositions = positionsByExchange.get(exchange) || prev;
        const updated = basePositions.map((pos) => {
          const matched = activeCoinMap.get(pos.coin.toUpperCase());
          if (matched) {
            return {
              ...pos,
              allocationQty: `${matched.total} ${matched.coin}`,
              allocationUsdt: `~${matched.valueUsdt.toFixed(2)} USDT`,
              price: matched.price,
              change24h: matched.change24h,
              status: 'active' as const,
              statusLabel: 'HOLDING / ACTIVE',
              engine: `${exchange} Spot ${isSandbox ? '(Testnet)' : ''} · Saldo Riil`,
            };
          }
          return {
            ...pos,
            allocationQty: `0 ${pos.coin}`,
            allocationUsdt: '0.00 USDT',
            status: 'inactive' as const,
            statusLabel: 'STANDBY',
            engine: `${exchange} Spot ${isSandbox ? '(Testnet)' : ''} · Standby`,
          };
        });
        // Save updated positions for this exchange in cache
        setPositionsByExchange((prevMap) => {
          const nextMap = new Map(prevMap);
          nextMap.set(exchange, updated);
          return nextMap;
        });
        return updated;
      });
    } else {
      setPositions((prev) => {
        const updated = prev.map((pos) => ({
          ...pos,
          engine: `${exchange} Spot ${isSandbox ? '(Testnet)' : ''} · Standby Ready`,
        }));
        setPositionsByExchange((prevMap) => {
          const nextMap = new Map(prevMap);
          nextMap.set(exchange, updated);
          return nextMap;
        });
        return updated;
      });
    }

    if (currentUser) {
      await saveConnectedExchangeToFirestore(currentUser.uid, exchangeConfig, existingList);
      if (portfolioAssets && portfolioAssets.length > 0) {
        await syncRealPortfolioAssetsToFirestore(
          currentUser.uid,
          exchange,
          isSandbox,
          balance,
          portfolioAssets
        );
      }
    }

    // Automatically fetch real trade history from exchange right upon connection
    if (apiKey && secret) {
      fetchExchangeTrades({
          exchange: exchange.toLowerCase(),
          apiKey,
          secret,
          password: passphrase,
          isSandbox,
          limit: 50,
      })
        .then(async (data) => {
          if (data.success && Array.isArray(data.trades)) {
            const mappedTrades: TradeRecord[] = data.trades.map((t: any) => ({
              id: t.id || `trade-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              orderId: t.orderId || t.id,
              exchange: t.exchange || exchange,
              symbol: t.symbol,
              side: t.side,
              type: t.type || 'market',
              price: Number(t.price) || 0,
              amount: Number(t.amount) || 0,
              costUsdt: Number(t.costUsdt) || (Number(t.price) || 0) * (Number(t.amount) || 0),
              fee: t.fee,
              timestamp: t.timestamp || Date.now(),
              datetime: t.datetime || new Date().toISOString(),
              status: t.status || 'filled',
              isSandbox: Boolean(t.isSandbox),
            }));
            setTradeHistory(mappedTrades);
            if (currentUser) {
              await syncTradesFromExchangeToFirestore(currentUser.uid, mappedTrades);
            }
          }
        })
        .catch((err) => console.warn('Auto fetch trades error upon API connection:', err));
    }
  };

  // Switch Active Exchange among connected exchanges
  const handleSelectActiveExchange = async (targetExchange: ExchangeName) => {
    setCurrentExchange(targetExchange);
    const creds = activeApiCredsMap.get(targetExchange);
    if (creds) {
      setActiveApiCreds(creds);
    }

    const existingList =
      wallet.connectedExchanges && wallet.connectedExchanges.length > 0
        ? wallet.connectedExchanges
        : wallet.connectedExchange?.isConnected
        ? [wallet.connectedExchange]
        : [];

    const targetConfig = existingList.find((c) => c.exchange === targetExchange);

    if (targetConfig) {
      const updatedList = existingList.map((c) => ({
        ...c,
        isActive: c.exchange === targetExchange,
      }));

      setWallet((prev) => ({
        ...prev,
        connectedExchange: { ...targetConfig, isActive: true },
        connectedExchanges: updatedList,
        activeExchange: targetExchange,
      }));

      if (currentUser) {
        await setActiveExchangeInFirestore(currentUser.uid, targetExchange, existingList);
      }
    }
  };

  // Disconnect a specific exchange API or active exchange
  const handleDisconnectSingleExchange = async (targetExchange?: ExchangeName) => {
    const exToDisconnect = targetExchange || wallet.connectedExchange?.exchange || currentExchange;

    setActiveApiCredsMap((prev) => {
      const nextMap = new Map(prev);
      nextMap.delete(exToDisconnect);
      return nextMap;
    });

    const existingList =
      wallet.connectedExchanges && wallet.connectedExchanges.length > 0
        ? wallet.connectedExchanges
        : wallet.connectedExchange?.isConnected
        ? [wallet.connectedExchange]
        : [];

    const remainingList = existingList.filter((c) => c.exchange !== exToDisconnect);
    let nextActive = remainingList.find((c) => c.isActive) || remainingList[0];

    if (nextActive) {
      nextActive = { ...nextActive, isActive: true };
      setCurrentExchange(nextActive.exchange);
      const nextCreds = activeApiCredsMap.get(nextActive.exchange) || null;
      setActiveApiCreds(nextCreds);

      setWallet((prev) => ({
        ...prev,
        connectedExchange: nextActive,
        connectedExchanges: remainingList.map((c) => ({
          ...c,
          isActive: c.exchange === nextActive.exchange,
        })),
        activeExchange: nextActive.exchange,
      }));
    } else {
      setActiveApiCreds(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('gain_active_api_creds');
      }
      setWallet((prev) => ({
        ...prev,
        connectedExchange: {
          isConnected: false,
          exchange: currentExchange,
          isSandbox: false,
          apiKeyMasked: '',
          usdtBalance: 0,
          lastSynced: new Date().toLocaleTimeString(),
        },
        connectedExchanges: [],
        activeExchange: undefined,
      }));

      setPositions((prev) =>
        prev.map((pos) => ({
          ...pos,
          engine: 'Simulasi Spot · Ready',
          status: 'inactive',
          statusLabel: 'STANDBY',
          allocationQty: `0 ${pos.coin}`,
          allocationUsdt: '0.00 USDT',
        }))
      );
    }

    const disconnectTx: TransactionRecord = {
      id: generateUniqueId('tx-disc'),
      title: `Disconnect API ${exToDisconnect}`,
      type: 'outflow',
      status: 'Success',
      statusColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      timestamp: 'Just now',
      counterparty: 'API Revoked',
      counterpartyLabel: 'Koneksi: ',
      amount: 0,
      amountFormatted: 'Diputuskan',
      feeInfo: 'Manual Disconnect',
    };
    setTransactions((prev) => {
      const map = new Map<string, TransactionRecord>();
      [disconnectTx, ...prev].forEach((item) => {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    if (currentUser) {
      await disconnectSingleExchangeFromFirestore(currentUser.uid, exToDisconnect, existingList);
    }
  };

  // Disconnect exchange API, clear memory credentials and reset positions
  const handleDisconnectExchange = async () => {
    await handleDisconnectSingleExchange();
  };

  // Dedicated function to refresh real portfolio from active exchange credentials
  const [isRefreshingExchange, setIsRefreshingExchange] = useState(false);
  const handleRefreshExchangePortfolio = async () => {
    if (!activeApiCreds) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsRefreshingExchange(true);
    try {
      const data = await fetchExchangePortfolio({
          exchange: activeApiCreds.exchange.toLowerCase(),
          apiKey: activeApiCreds.apiKey,
          secret: activeApiCreds.secret,
          password: activeApiCreds.password,
          isSandbox: activeApiCreds.isSandbox,
      });

      if (data.success) {
        handleConnectExchangeSuccess(
          activeApiCreds.exchange,
          data.usdtBalance ?? 0,
          activeApiCreds.isSandbox,
          activeApiCreds.apiKey,
          activeApiCreds.secret,
          activeApiCreds.password,
          data.portfolioAssets,
          data.totalPortfolioUsdt
        );
      }
    } catch {
      // Ignore network errors on auto-refresh
    } finally {
      setIsRefreshingExchange(false);
    }
  };

  // Medium Priority #2: Automatic 60-second background polling for exchange portfolio & balances
  useEffect(() => {
    if (!activeApiCreds?.apiKey || !activeApiCreds?.secret) return;

    const interval = setInterval(() => {
      fetchExchangePortfolio({
          exchange: activeApiCreds.exchange.toLowerCase(),
          apiKey: activeApiCreds.apiKey,
          secret: activeApiCreds.secret,
          password: activeApiCreds.password,
          isSandbox: activeApiCreds.isSandbox,
      })
        .then((data) => {
          if (data.success) {
            handleConnectExchangeSuccess(
              activeApiCreds.exchange,
              data.usdtBalance ?? 0,
              activeApiCreds.isSandbox,
              activeApiCreds.apiKey,
              activeApiCreds.secret,
              activeApiCreds.password,
              data.portfolioAssets,
              data.totalPortfolioUsdt
            );
          }
        })
        .catch(() => {});
    }, 60000);

    return () => clearInterval(interval);
  }, [activeApiCreds]);

  const [isSyncingTrades, setIsSyncingTrades] = useState(false);

  const handleSyncExchangeTrades = async () => {
    if (!activeApiCreds) {
      setIsApiKeyModalOpen(true);
      return;
    }

    setIsSyncingTrades(true);
    try {
      const data = await fetchExchangeTrades({
          exchange: activeApiCreds.exchange.toLowerCase(),
          apiKey: activeApiCreds.apiKey,
          secret: activeApiCreds.secret,
          password: activeApiCreds.password,
          isSandbox: activeApiCreds.isSandbox,
          limit: 50,
      });

      if (data.success && Array.isArray(data.trades)) {
        const mappedTrades: TradeRecord[] = data.trades.map((t: any) => ({
          id: t.id || `trade-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          orderId: t.orderId || t.id,
          exchange: t.exchange || activeApiCreds.exchange,
          symbol: t.symbol,
          side: t.side,
          type: t.type || 'market',
          price: Number(t.price) || 0,
          amount: Number(t.amount) || 0,
          costUsdt: Number(t.costUsdt) || (Number(t.price) || 0) * (Number(t.amount) || 0),
          fee: t.fee,
          timestamp: t.timestamp || Date.now(),
          datetime: t.datetime || new Date().toISOString(),
          status: t.status || 'filled',
          isSandbox: t.isSandbox ?? activeApiCreds.isSandbox,
        }));

        setTradeHistory((prev) => {
          const map = new Map<string, TradeRecord>();
          prev.forEach((item) => map.set(item.id, item));
          mappedTrades.forEach((item) => map.set(item.id, item));
          return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
        });

        if (currentUser) {
          await syncTradesFromExchangeToFirestore(currentUser.uid, mappedTrades);
        }
      }
    } catch (err) {
      console.warn('Failed to sync exchange trades:', err);
    } finally {
      setIsSyncingTrades(false);
    }
  };

  // Automatically sync trades when API credentials become available
  useEffect(() => {
    if (activeApiCreds?.apiKey && activeApiCreds?.secret && tradeHistory.length === 0) {
      handleSyncExchangeTrades();
    }
  }, [activeApiCreds]);

  const handleLoadMoreTransactions = async () => {
    if (!currentUser || !transactionCursorRef.current || isLoadingTransactions) return;
    setIsLoadingTransactions(true);
    try {
      const page = await fetchOlderUserTransactions(currentUser.uid, transactionCursorRef.current);
      transactionCursorRef.current = page.cursor;
      hasLoadedOlderTransactionsRef.current = true;
      setHasMoreTransactions(page.hasMore);
      setTransactions((previous) => {
        const records = new Map(previous.map((transaction) => [transaction.id, transaction]));
        page.items.forEach((transaction) => records.set(transaction.id, transaction));
        return Array.from(records.values()).sort((a, b) =>
          Date.parse(b.createdAt || '') - Date.parse(a.createdAt || '')
        );
      });
    } catch (error) {
      console.warn('[Firestore] Failed to load older transactions:', error);
    } finally {
      setIsLoadingTransactions(false);
    }
  };

  const handleLoadMoreTrades = async () => {
    if (!currentUser || !tradeCursorRef.current || isLoadingTrades) return;
    setIsLoadingTrades(true);
    try {
      const page = await fetchOlderUserTrades(currentUser.uid, tradeCursorRef.current);
      tradeCursorRef.current = page.cursor;
      hasLoadedOlderTradesRef.current = true;
      setHasMoreTrades(page.hasMore);
      setTradeHistory((previous) => {
        const records = new Map(previous.map((trade) => [trade.id, trade]));
        page.items.forEach((trade) => records.set(trade.id, trade));
        return Array.from(records.values()).sort((a, b) => b.timestamp - a.timestamp);
      });
    } catch (error) {
      console.warn('[Firestore] Failed to load older trades:', error);
    } finally {
      setIsLoadingTrades(false);
    }
  };

  // Execute bot order on Exchange Testnet / Live
  const handleExecuteLiveBotOrder = async (
    pair: string = 'BTC/USDT',
    side: 'buy' | 'sell' = 'buy',
    amount?: number
  ) => {
    if (!activeApiCreds) {
      setIsApiKeyModalOpen(true);
      return {
        success: false,
        error: 'API Key belum tersambung di sesi aktif ini. Silakan buka modal API Key dan simpan koneksi.',
      };
    }

    // Gate: Real order execution requires active license
    if (!activeApiCreds.isSandbox && wallet.accountStatus !== 'active') {
      setIsActivationModalOpen(true);
      return {
        success: false,
        error: 'Eksekusi order ke Bursa Riil terkunci. Akun Anda belum teraktivasi. Silakan bayar biaya aktivasi lisensi untuk trading live di pasar riil.',
      };
    }

    const targetCoin = pair.split('/')[0] || 'BTC';
    const coinRef = positions.find((p) => p.pair === pair);
    const coinPrice = coinRef?.price || (targetCoin === 'BTC' ? 67250 : targetCoin === 'ETH' ? 3480 : targetCoin === 'SOL' ? 178 : targetCoin === 'TAO' ? 485 : targetCoin === 'XAUT' ? 3042.5 : targetCoin === 'ZEC' ? 32.5 : 10);

    const orderAmount =
      amount ||
      (targetCoin === 'BTC'
        ? 0.001
        : targetCoin === 'ETH'
        ? 0.01
        : targetCoin === 'SOL'
        ? 0.1
        : targetCoin === 'BNB'
        ? 0.05
        : targetCoin === 'TAO'
        ? 0.05
        : targetCoin === 'XAUT'
        ? 0.01
        : targetCoin === 'ZEC'
        ? 0.5
        : targetCoin === 'HYPE'
        ? 1.0
        : targetCoin === 'LINK'
        ? 1.5
        : targetCoin === 'AVAX'
        ? 1.0
        : targetCoin === 'NEAR'
        ? 5.0
        : targetCoin === 'SUI'
        ? 10.0
        : targetCoin === 'XRP'
        ? 25.0
        : targetCoin === 'DOGE'
        ? 100.0
        : Number((25 / coinPrice).toFixed(3)));

    try {
      const data = await placeExchangeOrder({
          exchange: activeApiCreds.exchange.toLowerCase(),
          apiKey: activeApiCreds.apiKey,
          secret: activeApiCreds.secret,
          password: activeApiCreds.password,
          symbol: pair,
          side,
          type: 'market',
          amount: orderAmount,
          isSandbox: activeApiCreds.isSandbox,
          accountStatus: wallet.accountStatus,
      });

      if (data.success) {
        // Create Transaction audit
        const newTx: TransactionRecord = {
          id: generateUniqueId('tx-bot'),
          title: `Bot Order ${side.toUpperCase()} ${pair} [${activeApiCreds.isSandbox ? 'Testnet' : 'Live'}]`,
          type: side === 'buy' ? 'outflow' : 'inflow',
          status: 'Completed',
          statusColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
          timestamp: 'Just now',
          counterparty: `${activeApiCreds.exchange} ${activeApiCreds.isSandbox ? 'Testnet' : 'Spot'}`,
          counterpartyLabel: 'Engine: ',
          amount: data.filled ? Number((data.filled * (data.price || 1)).toFixed(2)) : 35,
          amountFormatted: `${data.amount} ${pair.split('/')[0]}`,
          feeInfo: `Order #${data.orderId}`,
          txHash: `0x${data.orderId}`,
          network: `${activeApiCreds.exchange} API`,
        };

        setTransactions((prev) => {
          const map = new Map<string, TransactionRecord>();
          [newTx, ...prev].forEach((item) => {
            if (item?.id && !map.has(item.id)) map.set(item.id, item);
          });
          return Array.from(map.values());
        });

        // Calculate layer execution metrics: Buy price, USD size, estimated TP, floating PnL
        const filledPrice = Number(data.price) || coinPrice;
        const filledAmount = Number(data.filled) || orderAmount;
        const filledCost = Number((filledAmount * filledPrice).toFixed(4));
        const tpPct = 1.5;
        const estimatedTpPrice = Number((filledPrice * (1 + tpPct / 100)).toFixed(4));
        const estimatedTpUsdt = Number((filledCost * (tpPct / 100)).toFixed(4));
        const floatingPnlUsdt = Number(((coinPrice - filledPrice) * filledAmount).toFixed(4));
        const floatingPnlPct = Number((((coinPrice - filledPrice) / filledPrice) * 100).toFixed(2));
        const coinName = pair.split('/')[0];
        const nextStep = Math.min((coinRef?.maxStep || 20), (coinRef?.stepLayer || 0) + 1);

        const newExecutedLayer: ExecutedLayerDetail = {
          id: generateUniqueId('layer'),
          orderId: data.orderId || generateUniqueId('ord'),
          symbol: pair,
          coin: coinName,
          side,
          layerStep: nextStep,
          layerType: nextStep === 1 ? 'average' : 'grid',
          label: `${side.toUpperCase()} -> ${filledAmount} ${coinName}`,
          amount: filledAmount,
          costUsdt: filledCost,
          buyPrice: filledPrice,
          currentPrice: coinPrice,
          estimatedTpPrice,
          estimatedTpPct: tpPct,
          estimatedTpUsdt,
          floatingPnlUsdt,
          floatingPnlPct,
          fee: 0,
          feeAsset: coinName,
          date: new Date().toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
          }),
          timestamp: Date.now(),
        };

        const newTradeRecord: TradeRecord = {
          id: data.orderId ? `order-${data.orderId}` : generateUniqueId('trade'),
          orderId: data.orderId,
          exchange: activeApiCreds.exchange,
          symbol: pair,
          side,
          type: 'market',
          price: filledPrice,
          amount: filledAmount,
          costUsdt: filledCost,
          timestamp: Date.now(),
          datetime: new Date().toISOString(),
          status: 'filled',
          strategyName: 'GAIN Layer Averaging Engine',
          layerStep: nextStep,
          isSandbox: activeApiCreds.isSandbox,
          estimatedTpPrice,
          estimatedTpPct: tpPct,
          estimatedTpUsdt,
          currentPrice: coinPrice,
          floatingPnl: floatingPnlUsdt,
          floatingPnlPercent: floatingPnlPct,
        };

        setTradeHistory((prev) => {
          const map = new Map<string, TradeRecord>();
          [newTradeRecord, ...prev].forEach((item) => {
            if (item?.id && !map.has(item.id)) map.set(item.id, item);
          });
          return Array.from(map.values());
        });

        // Update target position status to active with new executed layer
        setPositions((prev) =>
          prev.map((pos) =>
            pos.pair === pair
              ? {
                  ...pos,
                  status: 'active',
                  statusLabel: 'RUNNING',
                  stepLayer: nextStep,
                  executedLayers: [newExecutedLayer, ...(pos.executedLayers || [])],
                  allocationUsdt: `${(parseFloat(pos.allocationUsdt) + filledCost).toFixed(2)} USDT`,
                  allocationQty: `${(parseFloat(pos.allocationQty) + filledAmount).toFixed(4)} ${coinName}`,
                }
              : pos
          )
        );

        // Send browser notification & play mechanical audio cue
        notifyLayerExecution({
          pair,
          coin: coinName,
          layerStep: nextStep,
          maxStep: coinRef?.maxStep || 20,
          side,
          price: filledPrice,
          amount: filledAmount,
          costUsdt: filledCost,
          layerType: nextStep === 1 ? 'average' : 'grid',
        });

        // Add to floating in-app notification tray
        addInAppNotification({
          type: 'layer_executed',
          title: `Layer ${nextStep} Tereksekusi: ${pair}`,
          message: `Order ${side.toUpperCase()} ${filledAmount} ${coinName} @ $${formatUsdt(filledPrice)} berhasil diisi (Biaya: $${filledCost.toFixed(2)} USDT).`,
          pair,
          coin: coinName,
          price: filledPrice,
          amount: filledAmount,
          costUsdt: filledCost,
          layerStep: nextStep,
          maxStep: coinRef?.maxStep || 20,
        });

        if (currentUser) {
          await addTransactionToFirestore(currentUser.uid, newTx);
        }

        return {
          success: true,
          orderId: data.orderId,
          message: data.message,
        };
      } else {
        return {
          success: false,
          error: data.error,
        };
      }
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Gagal menghubungi server.',
      };
    }
  };

  // Modals
  const isMatrixModalOpen = uiModals.matrix;
  const setIsMatrixModalOpen = (isOpen: boolean) => setUiModalOpen('matrix', isOpen);
  const [selectedPairForMatrix, setSelectedPairForMatrix] = useState('BTC/USDT');
  const [selectedPairsForMatrix, setSelectedPairsForMatrix] = useState<string[]>(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);
  const [selectedModeForMatrix, setSelectedModeForMatrix] = useState<BotMode>('Avarage+Grid');
  const [selectedLayersForMatrix, setSelectedLayersForMatrix] = useState<number>(10);
  const [selectedBotIdForMatrix, setSelectedBotIdForMatrix] = useState<string | null>(null);
  const [selectedBotNameForMatrix, setSelectedBotNameForMatrix] = useState<string>('');
  const [selectedMinPriceForMatrix, setSelectedMinPriceForMatrix] = useState<number | null>(null);
  const [selectedMaxPriceForMatrix, setSelectedMaxPriceForMatrix] = useState<number | null>(null);
  const [isNewBotModeForMatrix, setIsNewBotModeForMatrix] = useState<boolean>(true);

  const isDepositModalOpen = uiModals.deposit;
  const setIsDepositModalOpen = (isOpen: boolean) => setUiModalOpen('deposit', isOpen);
  const isWithdrawModalOpen = uiModals.withdraw;
  const setIsWithdrawModalOpen = (isOpen: boolean) => setUiModalOpen('withdraw', isOpen);
  const isTransferModalOpen = uiModals.transfer;
  const setIsTransferModalOpen = (isOpen: boolean) => setUiModalOpen('transfer', isOpen);
  const isGasModalOpen = uiModals.gas;
  const setIsGasModalOpen = (isOpen: boolean) => setUiModalOpen('gas', isOpen);
  const isProfitShareModalOpen = uiModals.profitShare;
  const setIsProfitShareModalOpen = (isOpen: boolean) => setUiModalOpen('profitShare', isOpen);
  const isApiKeyModalOpen = uiModals.apiKey;
  const setIsApiKeyModalOpen = (isOpen: boolean) => setUiModalOpen('apiKey', isOpen);
  const isSimulationModalOpen = uiModals.simulation;
  const setIsSimulationModalOpen = (isOpen: boolean) => setUiModalOpen('simulation', isOpen);
  const isCoinsCheckerModalOpen = uiModals.coinsChecker;
  const setIsCoinsCheckerModalOpen = (isOpen: boolean) => setUiModalOpen('coinsChecker', isOpen);
  const isActivationModalOpen = uiModals.activation;
  const setIsActivationModalOpen = (isOpen: boolean) => setUiModalOpen('activation', isOpen);
  const is2faModalOpen = uiModals.twoFactor;
  const setIs2faModalOpen = (isOpen: boolean) => setUiModalOpen('twoFactor', isOpen);

  const handleSave2fa = async (enabled: boolean, secret: string) => {
    setWallet((prev) => ({
      ...prev,
      twoFactorEnabled: enabled,
      twoFactorSecret: secret,
    }));

    if (currentUser) {
      await updateUserWallet(currentUser.uid, {
        twoFactorEnabled: enabled,
        twoFactorSecret: secret,
      });
    }
    reportClientEvent('auth.permission.changed', { enabled });
  };

  const handleEmailVerificationSuccess = async () => {
    setWallet((prev) => ({
      ...prev,
      emailVerified: true,
    }));

    if (currentUser) {
      await updateUserWallet(currentUser.uid, {
        emailVerified: true,
      });
    }
  };

  // Secure Account Activation with Backend License Verification
  const handleProcessActivation = async (
    tier: 'starter_6' | 'pro_12' | 'starter_5' | 'pro_10' = 'starter_6',
    isUpgrade: boolean = false
  ) => {
    const isPro = tier === 'pro_12' || tier === 'pro_10';
    const currentIsStarter = wallet.licenseTier === 'starter_6' || wallet.licenseTier === 'starter_5' || (wallet.accountStatus === 'active' && wallet.licenseTier !== 'pro_12' && wallet.licenseTier !== 'pro_10');
    const isUp = isUpgrade || (wallet.accountStatus === 'active' && currentIsStarter && isPro);

    // Diskon 50% untuk semua paket lisensi lifetime:
    // Starter: $300 -> $150
    // Pro: $500 -> $250
    // Upgrade: $250 - $150 = $100
    let requiredFee = 150;
    if (isPro) {
      requiredFee = isUp ? 100 : 250;
    } else {
      requiredFee = 150;
    }

    if (wallet.liquidBalance < requiredFee) {
      throw new Error(
        `Saldo GAIN tidak mencukupi (Tersedia: ${wallet.liquidBalance.toFixed(2)} USDT, Diperlukan: ${requiredFee.toFixed(2)} USDT). Silakan lakukan deposit saldo terlebih dahulu.`
      );
    }

    const data = await processWalletActivation({
        userId: currentUser?.uid || wallet.memberId,
        memberId: wallet.memberId,
        liquidBalance: wallet.liquidBalance,
        tier,
        isUpgrade: isUp,
    });

    if (!data.success) {
      throw new Error(data.error || 'Gagal memproses aktivasi lisensi.');
    }

    const newLiquidBalance = data.newLiquidBalance ?? Math.max(0, wallet.liquidBalance - requiredFee);
    const tradingBonus = data.tradingBonusGranted ?? (isPro ? (isUp ? 40 : 100) : 60);
    const newGasReserve = wallet.gasReserve + tradingBonus;
    const newOutflow = wallet.totalOutflow + requiredFee;
    const newInflow = wallet.totalInflow + tradingBonus;
    const maxBots = data.maxActiveBots ?? (isPro ? 12 : 6);
    const licenseName = data.licenseName ?? (isPro ? 'Pro Lifetime (12 Bot Aktif)' : 'Starter Lifetime (6 Bot Aktif)');

    setWallet((prev) => ({
      ...prev,
      liquidBalance: newLiquidBalance,
      gasReserve: newGasReserve,
      totalOutflow: newOutflow,
      totalInflow: newInflow,
      accountStatus: 'active',
      licenseTier: isPro ? 'pro_12' : 'starter_6',
      licenseType: 'lifetime',
      licenseName,
      maxActiveBots: maxBots,
      tradingBonusUsdt: (prev.tradingBonusUsdt || 0) + tradingBonus,
      activationFeeUsdt: (prev.activationFeeUsdt || 0) + requiredFee,
    }));

    const txId = data.activationReceipt?.txId || generateUniqueId('tx-act');
    const txHash = data.activationReceipt?.txHash || `0x${Date.now().toString(16)}`;

    const newTx: TransactionRecord = {
      id: txId,
      title: isUp ? 'Upgrade ke Pro Lifetime (12 Bot)' : `Aktivasi Lisensi ${licenseName}`,
      type: 'outflow',
      status: 'Success',
      statusColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      timestamp: 'Just now',
      counterparty: 'GAIN Foundation Licensing Node',
      counterpartyLabel: 'License: ',
      amount: -requiredFee,
      amountFormatted: `-${requiredFee.toFixed(2)} USDT`,
      feeInfo: 'Lifetime License (Bukan Sewa Tahunan)',
      txHash,
      network: 'BEP-20 (Internal)',
    };

    const bonusTx: TransactionRecord = {
      id: generateUniqueId('tx-bonus'),
      title: `Bonus Gas Fee (+${tradingBonus} USDT)`,
      type: 'inflow',
      status: 'Gas Tank',
      statusColor: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
      timestamp: 'Just now',
      counterparty: 'GAIN Promo Pool',
      counterpartyLabel: 'Promo: ',
      amount: tradingBonus,
      amountFormatted: `+${tradingBonus.toFixed(2)} USDT`,
      feeInfo: 'Otomatis Masuk ke Gas Fee Tank',
      txHash: `0xbonus${Date.now().toString(16)}`,
      network: 'Gas Tank',
    };

    setTransactions((prev) => {
      const map = new Map<string, TransactionRecord>();
      [bonusTx, newTx, ...prev].forEach((item) => {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    if (currentUser) {
      await updateUserWallet(currentUser.uid, {
        liquidBalance: newLiquidBalance,
        gasReserve: newGasReserve,
        totalOutflow: newOutflow,
        totalInflow: newInflow,
        accountStatus: 'active',
        licenseTier: tier,
        licenseType: 'lifetime',
        licenseName,
        maxActiveBots: maxBots,
        tradingBonusUsdt: (wallet.tradingBonusUsdt || 0) + tradingBonus,
        activationFeeUsdt: (wallet.activationFeeUsdt || 0) + requiredFee,
      });
      await addTransactionToFirestore(currentUser.uid, newTx);
      await addTransactionToFirestore(currentUser.uid, bonusTx);
    }
  };

  const handleDepositSuccess = async (amount: number, target: 'gas' | 'vault', txHash: string) => {
    reportClientEvent('wallet.deposit.verified', { target, network: 'BEP-20' });
    const validation = validateFinancialAction('deposit', {
      amount,
      userId: currentUser?.uid || wallet.memberId,
      email: wallet.email,
    });
    if (!validation.ok) {
      throw new Error(validation.reason || 'Validasi deposit gagal');
    }

    if (target === 'gas') {
      const newGasReserve = wallet.gasReserve + amount;
      const newInflow = wallet.totalInflow + amount;
      setWallet((prev) => ({
        ...prev,
        gasReserve: newGasReserve,
        totalInflow: newInflow,
      }));

      const newTx: TransactionRecord = {
        id: generateUniqueId('tx-dep'),
        title: 'Deposit Gas Fee Tank',
        type: 'inflow',
        status: 'Success',
        statusColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        timestamp: 'Just now',
        counterparty: `${txHash.slice(0, 8)}...${txHash.slice(-6)}`,
        counterpartyLabel: 'TxID: ',
        amount: amount,
        amountFormatted: `+${amount.toFixed(2)} USDT`,
        feeInfo: 'Network: BEP-20',
        txHash,
        network: 'BEP-20',
      };
      setTransactions((prev) => {
        const map = new Map<string, TransactionRecord>();
        [newTx, ...prev].forEach((item) => {
          if (item?.id && !map.has(item.id)) map.set(item.id, item);
        });
        return Array.from(map.values());
      });

      if (currentUser) {
        await updateUserWallet(currentUser.uid, {
          gasReserve: newGasReserve,
          totalInflow: newInflow,
        });
        await addTransactionToFirestore(currentUser.uid, newTx);
      }
    } else {
      const newLiquid = wallet.liquidBalance + amount;
      const newInflow = wallet.totalInflow + amount;
      setWallet((prev) => ({
        ...prev,
        liquidBalance: newLiquid,
        availableCash: newLiquid,
        totalInflow: newInflow,
      }));

      const newTx: TransactionRecord = {
        id: generateUniqueId('tx-dep'),
        title: 'Deposit Vault Liquidity',
        type: 'inflow',
        status: 'Success',
        statusColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        timestamp: 'Just now',
        counterparty: `${txHash.slice(0, 8)}...${txHash.slice(-6)}`,
        counterpartyLabel: 'TxID: ',
        amount: amount,
        amountFormatted: `+${amount.toFixed(2)} USDT`,
        feeInfo: 'Network: BEP-20',
        txHash,
        network: 'BEP-20',
      };
      setTransactions((prev) => {
        const map = new Map<string, TransactionRecord>();
        [newTx, ...prev].forEach((item) => {
          if (item?.id && !map.has(item.id)) map.set(item.id, item);
        });
        return Array.from(map.values());
      });

      if (currentUser) {
        await updateUserWallet(currentUser.uid, {
          liquidBalance: newLiquid,
          availableCash: newLiquid,
          totalInflow: newInflow,
        });
        await addTransactionToFirestore(currentUser.uid, newTx);
      }
    }
  };

  const handleUpdateGainBalance = async (newLiquidBalance: number) => {
    setWallet((prev) => ({
      ...prev,
      liquidBalance: newLiquidBalance,
      availableCash: newLiquidBalance,
    }));
    if (currentUser) {
      await updateUserWallet(currentUser.uid, {
        liquidBalance: newLiquidBalance,
        availableCash: newLiquidBalance,
      });
    }
  };

  const handleWithdrawSuccess = async (amount: number, address: string) => {
    reportClientEvent('wallet.withdraw.submitted', { network: 'BEP-20' });
    const validation = validateFinancialAction('withdraw', {
      amount,
      userId: currentUser?.uid || wallet.memberId,
      email: wallet.email,
      liquidBalance: wallet.liquidBalance,
    });
    if (!validation.ok) {
      throw new Error(validation.reason || 'Validasi withdrawal gagal');
    }

    const newLiquid = Math.max(0, wallet.liquidBalance - amount);
    const newOutflow = wallet.totalOutflow + amount;

    setWallet((prev) => ({
      ...prev,
      liquidBalance: newLiquid,
      availableCash: newLiquid,
      totalOutflow: newOutflow,
    }));

    const newTx: TransactionRecord = {
      id: generateUniqueId('tx-wth'),
      title: 'Withdrawal BEP-20',
      type: 'outflow',
      status: 'Success',
      statusColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      timestamp: 'Just now',
      counterparty: `${address.slice(0, 6)}...${address.slice(-4)}`,
      counterpartyLabel: 'TxID: ',
      amount: -amount,
      amountFormatted: `-${amount.toFixed(6)} USDT`,
      feeInfo: 'Fee: 2.00 USDT',
    };
    setTransactions((prev) => {
      const map = new Map<string, TransactionRecord>();
      [newTx, ...prev].forEach((item) => {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    if (currentUser) {
      await updateUserWallet(currentUser.uid, {
        liquidBalance: newLiquid,
        availableCash: newLiquid,
        totalOutflow: newOutflow,
      });
      await addTransactionToFirestore(currentUser.uid, newTx);
    }
  };

  const handleTransferSuccess = async (recipientId: string, recipientName: string, amount: number) => {
    reportClientEvent('wallet.transfer.completed');
    const validation = validateFinancialAction('transfer', {
      amount,
      userId: currentUser?.uid || wallet.memberId,
      email: wallet.email,
      liquidBalance: wallet.liquidBalance,
      recipientId,
    });
    if (!validation.ok) {
      throw new Error(validation.reason || 'Validasi transfer gagal');
    }

    const newLiquid = Math.max(0, wallet.liquidBalance - amount);
    const newOutflow = wallet.totalOutflow + amount;

    setWallet((prev) => ({
      ...prev,
      liquidBalance: newLiquid,
      availableCash: newLiquid,
      totalOutflow: newOutflow,
    }));

    const newTx: TransactionRecord = {
      id: generateUniqueId('tx-trf'),
      title: 'Transfer ke Member',
      type: 'outflow',
      status: 'Completed',
      statusColor: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      timestamp: 'Just now',
      counterparty: `${recipientName} (${recipientId})`,
      counterpartyLabel: 'To: ',
      amount: -amount,
      amountFormatted: `-${amount.toFixed(6)} USDT`,
      feeInfo: 'Fee: 0 USDT (P2P)',
    };
    setTransactions((prev) => {
      const map = new Map<string, TransactionRecord>();
      [newTx, ...prev].forEach((item) => {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    if (currentUser) {
      await updateUserWallet(currentUser.uid, {
        liquidBalance: newLiquid,
        totalOutflow: newOutflow,
      });
      await addTransactionToFirestore(currentUser.uid, newTx);
    }
  };

  const handleTopUpGasSuccess = async (amount: number, bonusAmount: number = 0, isDemoRefill: boolean = false) => {
    const newLiquid = isDemoRefill ? wallet.liquidBalance : Math.max(0, wallet.liquidBalance - amount);
    const totalGasCredit = Number((amount + bonusAmount).toFixed(4));
    const newGasReserve = Number((wallet.gasReserve + totalGasCredit).toFixed(4));
    const newNonCashGas = (wallet.nonCashGasBonus || 0) + bonusAmount;

    setWallet((prev) => ({
      ...prev,
      liquidBalance: newLiquid,
      gasReserve: newGasReserve,
      nonCashGasBonus: newNonCashGas,
    }));

    const newTx: TransactionRecord = {
      id: generateUniqueId('tx-gas'),
      title: isDemoRefill
        ? `Top-Up Instant Gas Fee Demo (+${amount} USDT Gratis)`
        : (bonusAmount > 0
          ? `Top-Up Gas (+${amount} USDT) + Bonus Promo Member (+${bonusAmount} USDT)`
          : 'Top-Up Gas Fee Pool'),
      type: 'gas',
      status: 'Gas Tank',
      statusColor: isDemoRefill
        ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      timestamp: 'Baru saja',
      counterparty: isDemoRefill ? 'Demo / Testnet Reserve' : 'Smart Gas Reserve Vault',
      counterpartyLabel: 'Pool: ',
      amount: totalGasCredit,
      amountFormatted: `+${totalGasCredit.toFixed(2)} USDT`,
      feeInfo: isDemoRefill
        ? `Top-Up Instant Gas Fee Mode Demo/Testnet (+${amount.toFixed(2)} USDT Gratis)`
        : (bonusAmount > 0
          ? `Topup Pokok ${amount.toFixed(2)} USDT (Dipotong dari Saldo GAIN) + Bonus Promo Member ${bonusAmount.toFixed(2)} USDT (Non-Cash). Total Masuk Gas Tank.`
          : 'Alokasi Gas Internal ke Smart Gas Tank'),
    };
    setTransactions((prev) => {
      const map = new Map<string, TransactionRecord>();
      [newTx, ...prev].forEach((item) => {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    if (currentUser) {
      await updateUserWallet(currentUser.uid, {
        liquidBalance: newLiquid,
        gasReserve: newGasReserve,
        nonCashGasBonus: newNonCashGas,
      });
      await addTransactionToFirestore(currentUser.uid, newTx);
    }
  };

  // Handler: Simulasi Downline Aktivasi Lisensi (Upline dapat 20% CASH -> Bisa di-Withdrawal)
  const handleSimulateDownlineActivation = async (
    memberId: string,
    memberName: string,
    tier: 'starter_6' | 'pro_12' = 'starter_6'
  ) => {
    const isPro = tier === 'pro_12';
    const actCost = isPro ? 250 : 150;
    const cashShare = isPro ? 50 : 30; // 20% CASH dari $250 atau $150
    const newLiquid = wallet.liquidBalance + cashShare;
    const newCash = wallet.availableCash + cashShare;
    const newReferralYield = wallet.referralYield + cashShare;
    const newWithdrawable = (wallet.withdrawableTradingYield || 0) + cashShare;

    setWallet((prev) => ({
      ...prev,
      liquidBalance: newLiquid,
      availableCash: newCash,
      referralYield: newReferralYield,
      withdrawableTradingYield: newWithdrawable,
    }));

    const tx: TransactionRecord = {
      id: generateUniqueId('tx-act-ref'),
      title: `Bonus Referral Aktivasi (${memberName})`,
      type: 'inflow',
      status: 'Success',
      statusColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      timestamp: 'Just now',
      counterparty: `${memberName} (${memberId})`,
      counterpartyLabel: 'Mitra: ',
      amount: cashShare,
      amountFormatted: `+${cashShare.toFixed(2)} USDT`,
      feeInfo: `Bonus Referral Langsung 20% CASH dari Aktivasi Downline ${isPro ? 'Pro Lifetime ($250)' : 'Starter Lifetime ($150)'}. 100% Bebas di-Withdrawal!`,
    };
    setTransactions((prev) => {
      const map = new Map<string, TransactionRecord>();
      [tx, ...prev].forEach((item) => {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    if (currentUser) {
      await updateUserWallet(currentUser.uid, {
        liquidBalance: newLiquid,
        availableCash: newCash,
        referralYield: newReferralYield,
        withdrawableTradingYield: newWithdrawable,
      });
      await addTransactionToFirestore(currentUser.uid, tx);
    }

    setTimeout(() => {
      alert(
        `🎉 BONUS REFERRAL AKTIVASI DITERIMA (20% CASH)!\n\n` +
        `Mitra downline Anda: ${memberName} (${memberId}) telah mengaktifkan lisensi ${isPro ? 'Pro Lifetime ($250)' : 'Starter Lifetime ($150)'}.\n\n` +
        `• Anda mendapatkan Bonus Referral 20% CASH: +${cashShare.toFixed(2)} USDT.\n` +
        `• Sifat Komisi: 100% CASH & BISA DI-WITHDRAWAL ke dompet BEP-20 Anda kapan saja!\n` +
        `• Saldo Cash Anda saat ini: ${newCash.toFixed(2)} USDT.`
      );
    }, 250);
  };

  // Handler: Simulasi Downline Topup Fee Trading (Upline dapat 10% Non-Cash -> masuk Gas Tank)
  const handleSimulateDownlineTopup = async (memberId: string, memberName: string, topupAmount: number) => {
    const bonusNonCash = Number((topupAmount * 0.10).toFixed(2));
    const newGasReserve = wallet.gasReserve + bonusNonCash;
    const newNonCashGas = (wallet.nonCashGasBonus || 0) + bonusNonCash;

    setWallet((prev) => ({
      ...prev,
      gasReserve: newGasReserve,
      nonCashGasBonus: newNonCashGas,
    }));

    const tx: TransactionRecord = {
      id: generateUniqueId('tx-gas-ref'),
      title: `Bonus Top-Up Fee Downline (${memberName})`,
      type: 'gas',
      status: 'Gas Tank',
      statusColor: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      timestamp: 'Just now',
      counterparty: `${memberName} (${memberId})`,
      counterpartyLabel: 'Mitra: ',
      amount: bonusNonCash,
      amountFormatted: `+${bonusNonCash.toFixed(2)} USDT`,
      feeInfo: `10% Non-Cash dari Top-Up Fee Downline (${topupAmount} USDT). Otomatis masuk ke Gas Fee Tank Anda (Tidak bisa di-withdraw).`,
    };
    setTransactions((prev) => {
      const map = new Map<string, TransactionRecord>();
      [tx, ...prev].forEach((item) => {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    if (currentUser) {
      await updateUserWallet(currentUser.uid, {
        gasReserve: newGasReserve,
        nonCashGasBonus: newNonCashGas,
      });
      await addTransactionToFirestore(currentUser.uid, tx);
    }

    setTimeout(() => {
      alert(
        `⚡ BONUS TOP-UP FEE DOWNLINE DITERIMA!\n\n` +
        `Mitra downline Anda: ${memberName} (${memberId}) melakukan top-up Fee Trading sebesar ${topupAmount} USDT.\n\n` +
        `• Anda mendapatkan bonus 10% Non-Cash: +${bonusNonCash.toFixed(2)} USDT.\n` +
        `• Sifat Komisi: NON-CASH (Tidak bisa di-withdrawal).\n` +
        `• Alokasi: Langsung ditambahkan ke Gas Fee Tank Anda untuk bahan bakar trading bot.\n` +
        `• Saldo Gas Tank Anda saat ini: ${newGasReserve.toFixed(2)} USDT.`
      );
    }, 250);
  };

  // Handler: Simulasi Downline Take Profit (Upline dapat 20% CASH dari 20% Fee Manajemen)
  const handleSimulateDownlineTakeProfit = async (memberId: string, memberName: string, profitAmount: number) => {
    const feeManagement = profitAmount * 0.20; // 20% Fee Manajemen
    const cashShare = Number((feeManagement * 0.20).toFixed(2)); // 20% CASH dari Fee Manajemen

    const newLiquid = wallet.liquidBalance + cashShare;
    const newCash = wallet.availableCash + cashShare;
    const newReferralYield = wallet.referralYield + cashShare;
    const newWithdrawable = (wallet.withdrawableTradingYield || 0) + cashShare;

    setWallet((prev) => ({
      ...prev,
      liquidBalance: newLiquid,
      availableCash: newCash,
      referralYield: newReferralYield,
      withdrawableTradingYield: newWithdrawable,
    }));

    const tx: TransactionRecord = {
      id: generateUniqueId('tx-tp-share'),
      title: `Bagi Hasil Trading Downline (${memberName})`,
      type: 'inflow',
      status: 'Success',
      statusColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      timestamp: 'Just now',
      counterparty: `${memberName} (${memberId})`,
      counterpartyLabel: 'Mitra: ',
      amount: cashShare,
      amountFormatted: `+${cashShare.toFixed(2)} USDT`,
      feeInfo: `20% CASH dari 20% Fee Trading Manajemen (Gross Profit Downline: ${profitAmount} USDT). 100% Bebas di-Withdrawal!`,
    };
    setTransactions((prev) => {
      const map = new Map<string, TransactionRecord>();
      [tx, ...prev].forEach((item) => {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    if (currentUser) {
      await updateUserWallet(currentUser.uid, {
        liquidBalance: newLiquid,
        availableCash: newCash,
        referralYield: newReferralYield,
        withdrawableTradingYield: newWithdrawable,
      });
      await addTransactionToFirestore(currentUser.uid, tx);
    }

    setTimeout(() => {
      alert(
        `💰 BAGI HASIL TRADING DOWNLINE DITERIMA (CASH)!\n\n` +
        `Mitra downline Anda: ${memberName} (${memberId}) membukukan Profit sebesar ${profitAmount} USDT.\n\n` +
        `• Potongan Fee Trading Manajemen 20%: ${feeManagement.toFixed(2)} USDT.\n` +
        `• Porsi Bagi Hasil Upline (20% Cash dari Fee Manajemen): +${cashShare.toFixed(2)} USDT.\n` +
        `• Sifat Komisi: 100% CASH & BISA DI-WITHDRAWAL ke dompet BEP-20 Anda kapan saja!\n` +
        `• Saldo Cash Anda saat ini: ${newCash.toFixed(2)} USDT.`
      );
    }, 250);
  };

  const handleForceTakeProfit = async (posId: string) => {
    const target = positions.find((p) => p.id === posId);
    if (!target) return { success: false, error: 'Posisi tidak ditemukan.' };

    const isProfit = target.floatingPnl > 0;
    const grossProfit = isProfit ? target.floatingPnl : 0;
    const netProfitTrader = isProfit ? grossProfit * 0.8 : 0;
    const gasDeduction = isProfit ? grossProfit * 0.2 : 0;
    const foundationKas = gasDeduction * 0.80; // 80% Fee Manajemen GAIN Foundation
    const referralBonus = gasDeduction * 0.20; // 20% Bagi Hasil Cash untuk Referral / Upline Langsung (Bisa di-Withdrawal)

    // Calculate real sell quantity based on allocation or unit price
    let sellAmount = 0.001;
    if (target.allocationQty) {
      const parsed = parseFloat(target.allocationQty.replace(/[^0-9.]/g, ''));
      if (!isNaN(parsed) && parsed > 0) {
        sellAmount = parsed;
      }
    }
    if (sellAmount <= 0.00001 && target.price > 0) {
      const usdtVal = parseFloat(target.allocationUsdt.replace(/[^0-9.]/g, '')) || 25;
      sellAmount = Number((usdtVal / target.price).toFixed(5));
    }

    let exchangeOrderId: string | undefined;
    let exchangeOrderSuccess = false;
    let exchangeErrorMessage = '';

    // If active Exchange API credentials exist, send real CCXT Market Sell Order to Exchanger!
    if (activeApiCreds && activeApiCreds.apiKey) {
      try {
        const data = await placeExchangeOrder({
            exchange: activeApiCreds.exchange.toLowerCase(),
            apiKey: activeApiCreds.apiKey,
            secret: activeApiCreds.secret,
            password: activeApiCreds.password,
            symbol: target.pair,
            side: 'sell',
            type: 'market',
            amount: sellAmount,
            isSandbox: activeApiCreds.isSandbox,
        });
        if (data.success) {
          exchangeOrderId = data.orderId;
          exchangeOrderSuccess = true;
        } else {
          exchangeErrorMessage = data.error || 'Gagal mengirim order ke exchange';
        }
      } catch (err: any) {
        exchangeErrorMessage = err.message || 'Koneksi ke backend exchange terputus';
      }
    }

    // Capital recovery calculation
    const rawAllocUsdt = parseFloat(target.allocationUsdt.replace(/[^0-9.]/g, '')) || (sellAmount * (target.price || 0));
    const marketValueUsdt = (sellAmount * (target.price || 0)) > 0 ? (sellAmount * (target.price || 0)) : Math.max(0, rawAllocUsdt + target.floatingPnl);
    const recoveredUsdt = isProfit ? netProfitTrader : marketValueUsdt;

    const newLiquid = wallet.liquidBalance + recoveredUsdt;
    const newGasReserve = Math.max(0, wallet.gasReserve - gasDeduction);
    const newGasConsumed = wallet.gasConsumed + gasDeduction;
    const newVolume = wallet.volume24h + (isProfit ? grossProfit : marketValueUsdt);

    setWallet((prev) => ({
      ...prev,
      liquidBalance: newLiquid,
      availableCash: newLiquid,
      gasReserve: newGasReserve,
      gasConsumed: newGasConsumed,
      volume24h: newVolume,
    }));

    // Reset position back to Standby
    const updatedPos: TradingPosition = {
      ...target,
      stepLayer: 1,
      allocationQty: '0',
      allocationUsdt: '0.00 USDT',
      floatingPnl: 0,
      roiPct: 0,
      status: 'inactive',
      statusLabel: 'STANDBY',
      trailingProgressPct: 0,
      trailingInfo: exchangeOrderSuccess
        ? `Manual Sell Executed (${activeApiCreds?.exchange} #${exchangeOrderId})`
        : (isProfit ? 'Take Profit Selesai' : 'Manual Sell Selesai'),
    };

    setPositions((prev) =>
      prev.map((p) => (p.id === posId ? updatedPos : p))
    );

    // Send Take Profit notification & play triumphant major arpeggio chime
    if (isProfit) {
      notifyTakeProfit({
        pair: target.pair,
        coin: target.coin,
        profitUsdt: recoveredUsdt,
        roiPct: target.roiPct,
        exitPrice: target.price,
      });

      addInAppNotification({
        type: 'take_profit',
        title: `Take Profit: ${target.pair}`,
        message: `Posisi ${target.pair} berhasil dilikuidasi dengan profit bersih +$${recoveredUsdt.toFixed(2)} USDT (+${target.roiPct.toFixed(2)}%). Saldo kas bertambah!`,
        pair: target.pair,
        coin: target.coin,
        profitUsdt: recoveredUsdt,
        roiPct: target.roiPct,
        price: target.price,
      });
    }

    // Add transaction record to ledger
    const profitTx: TransactionRecord = {
      id: generateUniqueId('tx-sell'),
      title: isProfit
        ? `Take Profit ${target.pair}${exchangeOrderId ? ` [${activeApiCreds?.exchange} #${exchangeOrderId}]` : ''}`
        : `Manual Sell ${target.pair}${exchangeOrderId ? ` [${activeApiCreds?.exchange} #${exchangeOrderId}]` : ''}`,
      type: 'inflow',
      status: 'Success',
      statusColor: isProfit ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      timestamp: 'Baru saja',
      counterparty: exchangeOrderId
        ? `${activeApiCreds?.exchange} Spot (Order #${exchangeOrderId})`
        : `${target.engine}`,
      counterpartyLabel: 'Engine: ',
      amount: recoveredUsdt,
      amountFormatted: `+${recoveredUsdt.toFixed(2)} USDT`,
      feeInfo: isProfit
        ? `Net 80% (Gas 20%: -${gasDeduction.toFixed(2)} USDT [Manajemen 80%: ${foundationKas.toFixed(2)} | Referral Upline 20% Cash: ${referralBonus.toFixed(2)} USDT])${exchangeOrderId ? ' • Market Sell Executed' : ''}`
        : `Manual Market Exit (PnL: ${target.floatingPnl.toFixed(2)} USDT)${exchangeOrderId ? ' • Market Sell Executed' : ''}`,
      txHash: exchangeOrderId ? `0x${exchangeOrderId}` : undefined,
      network: activeApiCreds ? `${activeApiCreds.exchange} ${activeApiCreds.isSandbox ? 'Testnet' : 'Live'}` : 'GAIN Vault',
    };
    setTransactions((prev) => {
      const map = new Map<string, TransactionRecord>();
      [profitTx, ...prev].forEach((item) => {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    // Record trade execution in trade history
    const tradeRec: TradeRecord = {
      id: exchangeOrderId ? `order-${exchangeOrderId}` : generateUniqueId('trade-sell'),
      orderId: exchangeOrderId,
      exchange: activeApiCreds ? activeApiCreds.exchange : 'GAIN Vault',
      symbol: target.pair,
      side: 'sell',
      type: 'market',
      status: 'closed',
      strategyName: target.engine,
      layerStep: target.stepLayer,
      isSandbox: activeApiCreds?.isSandbox ?? true,
      price: target.price || 100,
      amount: sellAmount,
      costUsdt: Number((sellAmount * (target.price || 1)).toFixed(2)),
      fee: {
        cost: gasDeduction,
        currency: 'USDT',
      },
      realizedPnl: target.floatingPnl,
      pnlPercent: target.roiPct,
      timestamp: Date.now(),
      datetime: new Date().toLocaleString(),
    };
    setTradeHistory((prev) => {
      const map = new Map<string, TradeRecord>();
      [tradeRec, ...prev].forEach((item) => {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    if (currentUser) {
      await updateUserWallet(currentUser.uid, {
        liquidBalance: newLiquid,
        gasReserve: newGasReserve,
        gasConsumed: newGasConsumed,
        volume24h: newVolume,
      });
      await updatePositionInFirestore(currentUser.uid, updatedPos);
      await addTransactionToFirestore(currentUser.uid, profitTx);
      await addTradeRecordToFirestore(currentUser.uid, tradeRec);
    }

    return {
      success: true,
      orderId: exchangeOrderId,
      isLiveExchange: exchangeOrderSuccess,
      netProfit: netProfitTrader,
      gasDeduction,
      exchangeError: exchangeErrorMessage,
    };
  };

  const handleTogglePause = async (posId: string) => {
    const targetPos = positions.find((p) => p.id === posId);
    if (!targetPos) return;

    const willActivate = targetPos.status !== 'active';

    if (willActivate) {
      // Calculate active bots count (unique bot configurations)
      const targetBotId = targetPos.botId || targetPos.id;
      const activeBotIds = new Set(
        positions
          .filter((p) => (p.status === 'active' || p.status === 'averaging') && (p.botId || p.id) !== targetBotId)
          .map((p) => p.botId || p.id)
      );

      const maxAllowed = isDemoOrTestnet ? 999999 : (wallet.accountStatus === 'active' ? (wallet.maxActiveBots || 6) : 6);

      if (activeBotIds.size >= maxAllowed) {
        alert(
          `⚠️ Batas Kuota Bot Aktif Tercapai!\n\n` +
          `Saat ini Anda telah menjalankan ${activeBotIds.size} dari maksimal ${maxAllowed} bot aktif (${wallet.licenseName || 'Starter Lifetime (6 Bot)'}).\n\n` +
          `• Anda bebas menyimpan DRAFT bot tanpa batas.\n` +
          `• Untuk mengaktifkan bot ini secara bersamaan, silakan upgrade ke Paket Pro Lifetime (12 Bot Aktif - $250 Promo Diskon 50%) atau jeda bot lain yang sedang aktif.`
        );
        setIsActivationModalOpen(true);
        return;
      }
    }

    let updatedTarget: TradingPosition | null = null;
    setPositions((prev) =>
      prev.map((p) => {
        if (p.id !== posId) return p;
        const newStatus = p.status === 'active' ? 'inactive' : 'active';
        updatedTarget = {
          ...p,
          status: newStatus,
          statusLabel: newStatus === 'active' ? 'AKTIF RUNNING' : 'DRAFT / PAUSED',
        };
        return updatedTarget;
      })
    );

    if (currentUser && updatedTarget) {
      await updatePositionInFirestore(currentUser.uid, updatedTarget);
    }
  };

  const handleBatchForceTp = async () => {
    const profitPositions = positions.filter((pos) => pos.floatingPnl > 0);
    for (const pos of profitPositions) {
      await handleForceTakeProfit(pos.id);
    }
  };

  const handleBatchPauseAll = async () => {
    const updated = positions.map((p) => ({
      ...p,
      status: 'inactive' as const,
      statusLabel: 'PAUSED',
    }));
    setPositions(updated);

    if (currentUser) {
      for (const pos of updated) {
        await updatePositionInFirestore(currentUser.uid, pos);
      }
    }
  };

  const handleOpenCustomBot = (
    pair: string = 'BTC/USDT',
    mode?: BotMode,
    layers?: number,
    botId?: string | null,
    botName?: string,
    isNewBot?: boolean,
    minPrice?: number | null,
    maxPrice?: number | null,
    pairedCoins?: string[]
  ) => {
    setSelectedPairForMatrix(pair);
    if (pairedCoins && pairedCoins.length > 0) {
      setSelectedPairsForMatrix(pairedCoins);
    } else {
      const existingPos = positions.find((p) => p.id === botId || p.pair === pair);
      if (existingPos?.pairedCoins && existingPos.pairedCoins.length > 0) {
        setSelectedPairsForMatrix(existingPos.pairedCoins);
      } else {
        setSelectedPairsForMatrix([pair]);
      }
    }
    if (mode) setSelectedModeForMatrix(mode);
    if (layers) setSelectedLayersForMatrix(layers);
    setSelectedBotIdForMatrix(botId || null);
    setSelectedBotNameForMatrix(botName || '');
    setIsNewBotModeForMatrix(isNewBot ?? (!botId));
    setSelectedMinPriceForMatrix(minPrice !== undefined ? minPrice : null);
    setSelectedMaxPriceForMatrix(maxPrice !== undefined ? maxPrice : null);
    setIsMatrixModalOpen(true);
  };

  const handleDeleteBotPosition = async (posId: string) => {
    setPositions((prev) => prev.filter((p) => p.id !== posId));
    if (currentUser) {
      await deletePositionFromFirestore(currentUser.uid, posId);
    }
    try {
      deleteBackgroundBot(posId).catch(() => {});
    } catch {}
  };

  const handleDeleteAllStandbyBots = async () => {
    const standbyBots = positions.filter((p) => p.status === 'inactive');
    if (standbyBots.length === 0) return;

    setPositions((prev) => prev.filter((p) => p.status !== 'inactive'));

    if (currentUser) {
      for (const bot of standbyBots) {
        try {
          await deletePositionFromFirestore(currentUser.uid, bot.id);
        } catch {}
      }
    }

    try {
      for (const bot of standbyBots) {
        deleteBackgroundBot(bot.id).catch(() => {});
      }
    } catch {}
  };

  const handleCloseLayerManual = async (positionId: string, layerId: string) => {
    const targetPos = positions.find((p) => p.id === positionId);
    if (!targetPos) return;

    // Find layer to close
    const existingLayers = (targetPos.executedLayers && targetPos.executedLayers.length > 0)
      ? targetPos.executedLayers
      : generateDefaultLayersForPosition(targetPos);

    const layerToClose = existingLayers.find((l) => l.id === layerId);
    if (!layerToClose) return;

    const currentCoinPrice = targetPos.price || layerToClose.buyPrice || 100;
    const sellQty = layerToClose.amount;
    const grossUsdt = sellQty * currentCoinPrice;
    const rawProfitUsdt = (currentCoinPrice - layerToClose.buyPrice) * sellQty;

    // 20% gas fee on positive profit
    let gasDeduction = 0;
    let netProfit = rawProfitUsdt;
    if (rawProfitUsdt > 0) {
      gasDeduction = rawProfitUsdt * 0.20;
      netProfit = rawProfitUsdt - gasDeduction;
    }

    const returnToWalletUsdt = layerToClose.costUsdt + netProfit;

    // Update wallet
    const newLiquid = wallet.liquidBalance + Math.max(0, returnToWalletUsdt);
    const newGasReserve = Math.max(0, wallet.gasReserve - gasDeduction);
    const newGasConsumed = wallet.gasConsumed + gasDeduction;

    setWallet((prev) => ({
      ...prev,
      liquidBalance: newLiquid,
      gasReserve: newGasReserve,
      gasConsumed: newGasConsumed,
    }));

    // Update position: remove the closed layer and adjust totals
    const remainingLayers = existingLayers.filter((l) => l.id !== layerId);
    const remainingQty = remainingLayers.reduce((sum, l) => sum + l.amount, 0);
    const remainingCost = remainingLayers.reduce((sum, l) => sum + l.costUsdt, 0);
    const remainingFloatingPnl = remainingLayers.reduce((sum, l) => {
      const pnl = (currentCoinPrice - l.buyPrice) * l.amount;
      return sum + pnl;
    }, 0);

    const updatedPos: TradingPosition = {
      ...targetPos,
      executedLayers: remainingLayers,
      stepLayer: Math.max(1, remainingLayers.length),
      totalCoinQty: remainingQty,
      totalCostUsdt: remainingCost,
      allocationQty: `${remainingQty.toFixed(remainingQty > 10 ? 2 : 4)} ${targetPos.coin}`,
      allocationUsdt: `${remainingCost.toFixed(2)} USDT`,
      floatingPnl: Number(remainingFloatingPnl.toFixed(2)),
      roiPct: remainingCost > 0 ? Number(((remainingFloatingPnl / remainingCost) * 100).toFixed(2)) : 0,
      trailingInfo: `Manual Closed Layer #${layerToClose.layerStep} (${netProfit >= 0 ? '+' : ''}$${netProfit.toFixed(2)})`,
    };

    setPositions((prev) => prev.map((p) => (p.id === positionId ? updatedPos : p)));

    // Add transaction record
    const closeTx: TransactionRecord = {
      id: generateUniqueId('tx-close'),
      title: `Manual Close Layer #${layerToClose.layerStep} ${targetPos.pair}`,
      type: 'inflow',
      status: 'Success',
      statusColor: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      timestamp: 'Just now',
      counterparty: 'Manual Layer Execution',
      counterpartyLabel: 'Action: ',
      amount: returnToWalletUsdt,
      amountFormatted: `+${returnToWalletUsdt.toFixed(2)} USDT`,
      feeInfo: rawProfitUsdt > 0 ? `Gas 20%: -${gasDeduction.toFixed(2)} USDT` : 'No Gas Fee',
      network: 'GAIN Vault',
    };
    setTransactions((prev) => {
      const map = new Map<string, TransactionRecord>();
      [closeTx, ...prev].forEach((item) => {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    // Add trade record
    const tradeRec: TradeRecord = {
      id: generateUniqueId('trade-close-layer'),
      exchange: 'GAIN Vault',
      symbol: targetPos.pair,
      side: 'sell',
      type: 'market',
      status: 'closed',
      strategyName: `Layer #${layerToClose.layerStep} Manual Close`,
      layerStep: layerToClose.layerStep,
      price: currentCoinPrice,
      amount: sellQty,
      costUsdt: Number(grossUsdt.toFixed(2)),
      fee: {
        cost: gasDeduction,
        currency: 'USDT',
      },
      realizedPnl: netProfit,
      pnlPercent: layerToClose.costUsdt > 0 ? Number(((rawProfitUsdt / layerToClose.costUsdt) * 100).toFixed(2)) : 0,
      timestamp: Date.now(),
      datetime: new Date().toISOString(),
    };
    setTradeHistory((prev) => {
      const map = new Map<string, TradeRecord>();
      [tradeRec, ...prev].forEach((item) => {
        if (item?.id && !map.has(item.id)) map.set(item.id, item);
      });
      return Array.from(map.values());
    });

    if (currentUser) {
      await updateUserWallet(currentUser.uid, {
        liquidBalance: newLiquid,
        gasReserve: newGasReserve,
        gasConsumed: newGasConsumed,
      });
      await updatePositionInFirestore(currentUser.uid, updatedPos);
      await addTransactionToFirestore(currentUser.uid, closeTx);
      await addTradeRecordToFirestore(currentUser.uid, tradeRec);
    }
  };

  const handleDeployBotConfiguration = async (config: {
    botId?: string;
    botName?: string;
    isNewBot?: boolean;
    pair: string;
    pairedCoins?: string[];
    botMode: BotMode;
    layerCount: number;
    initialEntryAmount?: number;
    timeframe?: string;
    baseAmount: number;
    baseTp: number;
    useMoneyManagement?: boolean;
    averageDownPct?: number;
    averagingLayers?: number;
    gridLayers?: number;
    uptrendFilter?: boolean;
    tpCallbackPct?: number;
    layerCallbackPct?: number;
    gridTp?: number;
    minPrice?: number;
    maxPrice?: number;
    steps?: AveragingStep[];
  }) => {
    const coinsToDeploy = Array.isArray(config.pairedCoins) && config.pairedCoins.length > 0
      ? config.pairedCoins
      : [config.pair];

    const primaryBotId = config.botId && !config.isNewBot
      ? config.botId
      : `bot-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const finalBotName = config.botName?.trim() || `GAIN Matrix Bot (${coinsToDeploy.length} Koin Terpairing)`;

    const avgL = config.averagingLayers ?? (config.botMode === 'Grid Only' ? 0 : config.botMode === 'Avarage+Grid' ? 20 : config.layerCount);
    const gridL = config.gridLayers ?? (config.botMode === 'Avarage Only' ? 0 : config.botMode === 'Avarage+Grid' ? 100 : config.layerCount);

    // Calculate active bots count excluding current primaryBotId
    const activeBotIds = new Set(
      positions
        .filter((p) => (p.status === 'active' || p.status === 'averaging') && (p.botId || p.id) !== primaryBotId)
        .map((p) => p.botId || p.id)
    );

    const maxAllowed = isDemoOrTestnet ? 999999 : (wallet.accountStatus === 'active' ? (wallet.maxActiveBots || 6) : 6);
    const isOverQuota = activeBotIds.size >= maxAllowed;

    // Circuit Breaker Rule (Zona Kritis: Gas Fee Tank <= 5 USDT)
    // Bot baru dilarang membuka averaging layer, otomatis disimpan sebagai DRAFT / AUTO-STANDBY
    const isGasCritical = wallet.gasReserve <= 5.0;

    let initialStatus: 'active' | 'inactive' = 'active';
    let initialStatusLabel = 'AKTIF RUNNING';

    if (isGasCritical) {
      initialStatus = 'inactive';
      initialStatusLabel = 'AUTO-STANDBY (GAS KRITIS ≤ 5)';
      alert(
        `🚨 ZONA KRITIS AKTIF: Saldo Gas Fee Tank Menipis (${wallet.gasReserve.toFixed(2)} USDT ≤ 5 USDT)!\n\n` +
        `Sesuai aturan keamanan & circuit breaker GAIN:\n` +
        `• Bot baru "${finalBotName}" otomatis disimpan sebagai STANDBY (tidak diizinkan membuka layer averaging baru).\n` +
        `• Posisi floating yang sudah berjalan diberikan masa tenggang (Grace Period) 24 jam untuk menutup siklusnya secara aman.\n` +
        `• Silakan lakukan Top-Up Gas Fee Tank Anda untuk mengaktifkan bot ini kembali.`
      );
      setIsGasModalOpen(true);
    } else if (isOverQuota) {
      initialStatus = 'inactive';
      initialStatusLabel = 'DRAFT (KUOTA PENUH)';
      alert(
        `ℹ️ Bot Disimpan Sebagai DRAFT (Tanpa Batas Kuota Draft)!\n\n` +
        `Saat ini Anda telah menjalankan ${activeBotIds.size}/${maxAllowed} bot aktif (${wallet.licenseName || 'Starter Lifetime (6 Bot)'}).\n\n` +
        `Bot "${finalBotName}" berhasil dibuat dan disimpan ke daftar Bot Anda sebagai DRAFT.\n\n` +
        `• Anda bebas membuat & mengatur DRAFT bot sebanyak mungkin tanpa batas!\n` +
        `• Untuk mengaktifkan bot ini secara bersamaan, silakan upgrade ke Paket Pro Lifetime (12 Bot Aktif - $250 Promo Diskon 50%) atau jeda bot lain yang sedang aktif.`
      );
    }

    const updatedOrNewPositions: TradingPosition[] = [];
    const initEntryAmt = config.initialEntryAmount ? Math.max(10, config.initialEntryAmount) : 10;
    const selectedTf = config.timeframe || '5m';

    for (const coinPair of coinsToDeploy) {
      const coin = coinPair.split('/')[0] || 'CRYPTO';
      const existingForBotAndCoin = positions.find((p) => p.botId === primaryBotId && p.pair === coinPair) ||
                                    positions.find((p) => p.id === primaryBotId && p.pair === coinPair) ||
                                    (!config.isNewBot ? positions.find((p) => p.pair === coinPair) : null);

      const coinPriceMap: Record<string, number> = {
        BTC: 67250,
        ETH: 3480,
        SOL: 178,
        BNB: 595,
        ZEC: 32.50,
        HYPE: 24.50,
        LINK: 13.20,
        AVAX: 26.50,
        NEAR: 4.85,
        SUI: 1.95,
        XRP: 0.58,
        DOGE: 0.38,
        XAUT: 3042.50,
        TAO: 485.00,
      };
      const currentPrice = existingForBotAndCoin?.price || coinPriceMap[coin] || 100;
      const minPriceVal = typeof config.minPrice === 'number' ? config.minPrice : (existingForBotAndCoin?.minPrice ?? 0);
      const maxPriceVal = typeof config.maxPrice === 'number' ? config.maxPrice : (existingForBotAndCoin?.maxPrice ?? (coin === 'SOL' ? 115 : 0));
      const isAbove = maxPriceVal > 0 && currentPrice > maxPriceVal;
      const isBelow = minPriceVal > 0 && currentPrice < minPriceVal;
      const boundaryStatus = isAbove ? 'ABOVE_MAX' : isBelow ? 'BELOW_MIN' : 'IN_RANGE';

      if (existingForBotAndCoin) {
        const updated: TradingPosition = {
          ...existingForBotAndCoin,
          botId: primaryBotId,
          botName: finalBotName,
          pairedCoins: coinsToDeploy,
          botMode: config.botMode,
          maxStep: config.layerCount,
          layerQuota: `1 s/d ${config.layerCount} Layer (${config.botMode})`,
          initialEntryAmount: initEntryAmt,
          initialEntryPrice: existingForBotAndCoin.initialEntryPrice || currentPrice,
          timeframe: selectedTf,
          allocationUsdt: `${(initEntryAmt + config.baseAmount).toFixed(2)} USDT`,
          status: initialStatus,
          statusLabel: initialStatusLabel,
          engine: `${config.botMode} (${avgL > 0 ? `${avgL}L Avg` : ''}${avgL > 0 && gridL > 0 ? ' + ' : ''}${gridL > 0 ? `${gridL}L Grid` : ''}) · 1 Bot ${coinsToDeploy.length} Koin · TF ${selectedTf}`,
          uptrendFilter: config.uptrendFilter ?? true,
          tpCallbackPct: config.tpCallbackPct ?? 0.2,
          layerCallbackPct: config.layerCallbackPct ?? 0.2,
          gridTp: config.gridTp ?? 1.2,
          minPrice: minPriceVal,
          maxPrice: maxPriceVal,
          priceBoundaryStatus: boundaryStatus,
        };
        updatedOrNewPositions.push(updated);
        if (currentUser) {
          await updatePositionInFirestore(currentUser.uid, updated);
        }
      } else {
        const uniqueId = `pos-${coinPair.replace('/', '').toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const newPos: TradingPosition = {
          id: uniqueId,
          botId: primaryBotId,
          botName: finalBotName,
          pairedCoins: coinsToDeploy,
          pair: coinPair,
          coin,
          status: initialStatus,
          statusLabel: initialStatusLabel,
          price: currentPrice,
          change24h: 1.2,
          engine: `${config.botMode} (${avgL > 0 ? `${avgL}L Avg` : ''}${avgL > 0 && gridL > 0 ? ' + ' : ''}${gridL > 0 ? `${gridL}L Grid` : ''}) · 1 Bot ${coinsToDeploy.length} Koin · TF ${selectedTf}`,
          initialEntryAmount: initEntryAmt,
          initialEntryPrice: currentPrice,
          timeframe: selectedTf,
          allocationUsdt: `${initEntryAmt.toFixed(2)} USDT`,
          allocationQty: `${(initEntryAmt / currentPrice).toFixed(4)} ${coin}`,
          floatingPnl: 0.0,
          roiPct: 0.0,
          stepLayer: 1,
          maxStep: config.layerCount,
          layerQuota: `1 s/d ${config.layerCount} Layer`,
          tpTargetPrice: `+${config.baseTp}% Trailing`,
          tpTriggerPrice: `+${config.baseTp}%`,
          nextAveragingTrigger: `-${config.averageDownPct || 2.0}%`,
          trailingProgressPct: 10,
          trailingInfo: `${config.botMode} (${avgL}L Avg + ${gridL}L Grid) Ready · Baseline Marker $${initEntryAmt}`,
          badgeSymbol: coin.slice(0, 3).toUpperCase(),
          logoUrl: `/coins/${coin.toLowerCase()}.svg`,
          badgeBg: 'bg-teal-500/20',
          badgeColor: 'text-teal-400',
          botMode: config.botMode,
          uptrendFilter: config.uptrendFilter ?? true,
          tpCallbackPct: config.tpCallbackPct ?? 0.2,
          layerCallbackPct: config.layerCallbackPct ?? 0.2,
          gridTp: config.gridTp ?? 1.2,
          minPrice: minPriceVal,
          maxPrice: maxPriceVal,
          priceBoundaryStatus: boundaryStatus,
        };
        updatedOrNewPositions.push(newPos);
        if (currentUser) {
          await updatePositionInFirestore(currentUser.uid, newPos);
        }
      }
    }

    // Update local positions state
    setPositions((prev) => {
      const updatedIds = new Set(updatedOrNewPositions.map((p) => p.id));
      const remaining = prev.filter((p) => !updatedIds.has(p.id));
      return [...updatedOrNewPositions, ...remaining];
    });

    // Sync with 24/7 backend background bot runner only if active
    if (initialStatus === 'active') {
      try {
        registerBackgroundBot({
            botId: primaryBotId,
            botName: finalBotName,
            pair: coinsToDeploy[0],
            pairedCoins: coinsToDeploy,
            botMode: config.botMode,
            baseAmount: config.baseAmount,
            baseTp: config.baseTp,
            averagingLayers: avgL,
            gridLayers: gridL,
            uptrendFilter: config.uptrendFilter ?? true,
            tpCallbackPct: config.tpCallbackPct ?? 0.2,
            layerCallbackPct: config.layerCallbackPct ?? 0.2,
            gridTp: config.gridTp ?? 1.2,
            averageDownPct: config.averageDownPct ?? 2.0,
            minPrice: config.minPrice || 0,
            maxPrice: config.maxPrice || 0,
            steps: config.steps,
            exchange: currentExchange,
            isSandbox: wallet.connectedExchange?.isSandbox || false,
            apiKey: activeApiCreds?.apiKey,
            secret: activeApiCreds?.secret,
            password: activeApiCreds?.password,
        }).catch(() => {});
      } catch {}
    }

    setIsMatrixModalOpen(false);
    handleRouteChange('trading');
  };

  return (
    <div className="min-h-screen bg-[var(--app-background)] text-[var(--app-foreground)] font-sans selection:bg-teal-500 selection:text-white flex flex-col justify-between transition-colors duration-200">
      {/* Top Header */}
      <HeaderBar
        currentExchange={currentExchange}
        onSelectExchange={protectAction(handleSelectActiveExchange)}
        connectedExchange={wallet.connectedExchange}
        connectedExchanges={wallet.connectedExchanges}
        twoFactorEnabled={wallet.twoFactorEnabled !== false}
        onOpenApiKey={protectAction(() => setIsApiKeyModalOpen(true))}
        onDisconnectApi={protectAction(handleDisconnectExchange)}
        onOpenProfitShare={() => setIsProfitShareModalOpen(true)}
        onOpen2faModal={protectAction(() => setIs2faModalOpen(true))}
        onOpenAdmin={() => {
          reportClientEvent('admin.action.attempted', { action: 'open_management' });
          navigate('/admin', { state: { from: location.pathname } });
        }}
        onOpenPriceAlert={protectAction(() => handleOpenPriceAlert())}
        activeAlertsCount={priceAlerts.filter((a) => a.status === 'active').length}
      />

      {/* Main Content Area: Optimized for Mobile (w-full), Tablet (md:max-w-2xl), Laptop (lg:max-w-4xl), and Desktop (xl:max-w-5xl) */}
      <main className="w-full max-w-xl md:max-w-2xl lg:max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-5 md:px-6 py-3.5 sm:py-5 flex-1 transition-all duration-200">
        <Suspense fallback={<div className="min-h-[40vh] flex items-center justify-center text-sm text-slate-500" role="status">Memuat halaman...</div>}>
          <Routes>
              <Route path="/" element={
                <HomeView
                  wallet={wallet}
                  positions={positions}
                  onOpenDeposit={protectAction(() => setIsDepositModalOpen(true))}
                  onOpenWithdraw={protectAction(() => setIsWithdrawModalOpen(true))}
                  onOpenCustomBot={handleOpenCustomBot}
                  onOpenApiKey={protectAction(() => setIsApiKeyModalOpen(true))}
                  onNavigateTrading={() => navigate('/trading')}
                  onOpenProfitShare={() => setIsProfitShareModalOpen(true)}
                  onOpenTransfer={protectAction(() => setIsTransferModalOpen(true))}
                  onOpenPriceAlert={protectAction(handleOpenPriceAlert)}
                />
              } />
              <Route path="/wallet" element={
                <WalletView
                  wallet={wallet}
                  transactions={transactions}
                  hasMoreTransactions={hasMoreTransactions}
                  isLoadingTransactions={isLoadingTransactions}
                  onLoadMoreTransactions={handleLoadMoreTransactions}
                  positions={positions}
                  onOpenDeposit={protectAction(() => setIsDepositModalOpen(true))}
                  onOpenWithdraw={protectAction(() => setIsWithdrawModalOpen(true))}
                  onOpenTransfer={protectAction(() => setIsTransferModalOpen(true))}
                  onOpenGas={protectAction(() => setIsGasModalOpen(true))}
                  onOpenProfitShare={() => setIsProfitShareModalOpen(true)}
                  onOpenApiKey={protectAction(() => setIsApiKeyModalOpen(true))}
                  onOpenActivationModal={protectAction(() => setIsActivationModalOpen(true))}
                  onOpenCoinsChecker={protectAction(() => setIsCoinsCheckerModalOpen(true))}
                  onSelectActiveExchange={protectAction(handleSelectActiveExchange)}
                  onUpdateGainBalance={protectAction(handleUpdateGainBalance)}
                />
              } />
              <Route path="/trading" element={
                <TradingPositionsView
                  positions={positions}
                  wallet={wallet}
                  tradeHistory={tradeHistory}
                  activeApiCreds={activeApiCreds}
                  isDemoOrTestnet={isDemoOrTestnet}
                  onOpenMatrixModal={handleOpenCustomBot}
                  onDeleteBot={protectAction(handleDeleteBotPosition)}
                  onDeleteAllStandbyBots={protectAction(handleDeleteAllStandbyBots)}
                  onOpenGasModal={protectAction(() => setIsGasModalOpen(true))}
                  onOpenActivationModal={protectAction(() => setIsActivationModalOpen(true))}
                  onForceTakeProfit={protectAction(handleForceTakeProfit)}
                  onTogglePause={protectAction(handleTogglePause)}
                  onBatchForceTp={protectAction(handleBatchForceTp)}
                  onBatchPauseAll={protectAction(handleBatchPauseAll)}
                  onExecuteBotOrder={protectAction(handleExecuteLiveBotOrder)}
                  onCloseLayer={protectAction(handleCloseLayerManual)}
                  onSyncExchangeTrades={protectAction(handleSyncExchangeTrades)}
                  isSyncingTrades={isSyncingTrades}
                  hasMoreTrades={hasMoreTrades}
                  isLoadingMoreTrades={isLoadingTrades}
                  onLoadMoreTrades={handleLoadMoreTrades}
                  onOpenApiKeyModal={protectAction(() => setIsApiKeyModalOpen(true))}
                  onOpenPriceAlert={protectAction(handleOpenPriceAlert)}
                />
              } />
              <Route path="/bot" element={
                <BotMatrixView
                  onOpenMatrixModal={handleOpenCustomBot}
                  onOpenSimulation={() => setIsSimulationModalOpen(true)}
                  onDeployBotToExchange={protectAction(handleExecuteLiveBotOrder)}
                  connectedExchangeName={wallet.connectedExchange?.exchange || currentExchange}
                  isSandbox={wallet.connectedExchange?.isSandbox ?? true}
                  isAccountActive={wallet.accountStatus === 'active'}
                  onOpenActivationModal={protectAction(() => setIsActivationModalOpen(true))}
                  gasReserve={wallet.gasReserve}
                  onOpenGas={protectAction(() => setIsGasModalOpen(true))}
                />
              } />
              <Route path="/akun" element={
                <AccountView
                  wallet={wallet}
                  currentExchange={currentExchange}
                  onOpenApiKey={protectAction(() => setIsApiKeyModalOpen(true))}
                  onDisconnectApi={protectAction(handleDisconnectExchange)}
                  onOpenProfitShare={() => setIsProfitShareModalOpen(true)}
                  onOpenGasModal={protectAction(() => setIsGasModalOpen(true))}
                  onOpenTransfer={protectAction(() => setIsTransferModalOpen(true))}
                  onOpenActivationModal={protectAction(() => setIsActivationModalOpen(true))}
                  onOpen2faModal={protectAction(() => setIs2faModalOpen(true))}
                  onOpenAdmin={() => {
                    reportClientEvent('admin.action.attempted', { action: 'open_management' });
                    navigate('/admin', { state: { from: location.pathname } });
                  }}
                  onSimulateDownlineTopup={protectAction(handleSimulateDownlineTopup)}
                  onSimulateDownlineTp={protectAction(handleSimulateDownlineTakeProfit)}
                  onSimulateDownlineActivation={protectAction(handleSimulateDownlineActivation)}
                  onSelectActiveExchange={protectAction(handleSelectActiveExchange)}
                  onDisconnectSingleExchange={protectAction(handleDisconnectSingleExchange)}
                />
              } />
              <Route path="/admin" element={
                <RoleRoute>
                  <AdminUserManagementModal
                    isOpen
                    onClose={() => navigate((location.state as { from?: string } | null)?.from || '/akun', { replace: true })}
                  />
                </RoleRoute>
              } />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </main>

      {/* Footer Transparency & Legal Compliance Strip */}
      <footer className="w-full max-w-7xl mx-auto px-4 pb-24 pt-4 text-center">
        <div className="p-3 sm:p-3.5 rounded-2xl bg-[#060D18]/90 border border-[#142338] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px] text-left">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>GAIN (Niaga Koin)</strong> adalah Penyedia Perangkat Lunak Algoritma Trading Otomatis (Trading Software Tool). Bukan pengelola investasi titip dana &amp; Tanpa Bunga/ROI Tetap (No Fixed ROI). Bagi hasil 80:20 murni saat profit riil.
            </span>
          </div>
          <button
            onClick={() => setIsProfitShareModalOpen(true)}
            className="shrink-0 px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 hover:text-white hover:bg-emerald-500/25 text-[11px] font-mono font-bold transition cursor-pointer flex items-center gap-1.5"
          >
            <span>Transparansi 80:20</span>
            <span className="text-[10px]">→</span>
          </button>
        </div>
      </footer>

      {/* Sticky Bottom Dock */}
      <BottomDock
        currentRoute={currentRoute}
        onRouteChange={handleRouteChange}
        activePositionsCount={positions.filter((p) => p.status === 'active').length}
      />

      {/* All Application Modals */}
      <Suspense fallback={null}>
      <LazyMount isOpen={isMatrixModalOpen}>
      <AveragingMatrixModal
        isOpen={isMatrixModalOpen}
        onClose={() => setIsMatrixModalOpen(false)}
        selectedPair={selectedPairForMatrix}
        selectedPairs={selectedPairsForMatrix}
        initialMode={selectedModeForMatrix}
        initialLayers={selectedLayersForMatrix}
        initialBotId={selectedBotIdForMatrix}
        initialBotName={selectedBotNameForMatrix}
        isNewBot={isNewBotModeForMatrix}
        initialMinPrice={selectedMinPriceForMatrix}
        initialMaxPrice={selectedMaxPriceForMatrix}
        initialInitialEntryAmount={
          positions.find((p) => p.id === selectedBotIdForMatrix)?.initialEntryAmount ?? 10
        }
        initialTimeframe={
          positions.find((p) => p.id === selectedBotIdForMatrix)?.timeframe ?? '5m'
        }
        currentMarketPrice={
          positions.find((p) => p.id === selectedBotIdForMatrix)?.price ??
          positions.find((p) => p.pair === selectedPairForMatrix || p.coin === selectedPairForMatrix.split('/')[0])?.price
        }
        existingBotsForCoin={positions.filter(
          (p) => p.pair === selectedPairForMatrix || p.coin === selectedPairForMatrix.split('/')[0]
        )}
        availableBalance={
          wallet.connectedExchange?.isConnected
            ? (wallet.connectedExchange.usdtBalance ?? 70)
            : (wallet.liquidBalance || 70)
        }
        onOpenSimulation={() => {
          setIsMatrixModalOpen(false);
          setIsSimulationModalOpen(true);
        }}
        onDeployBot={protectAction(handleDeployBotConfiguration)}
      />
      </LazyMount>

      <LazyMount isOpen={isDepositModalOpen}>
      <DepositModal
        isOpen={isDepositModalOpen}
        onClose={() => setIsDepositModalOpen(false)}
        onViewLedger={() => handleRouteChange('wallet')}
        onDepositSuccess={protectAction(handleDepositSuccess)}
        memberId={wallet.memberId}
        userEmail={wallet.email || currentUser?.email || ''}
        customDepositAddress={wallet.depositAddress}
      />
      </LazyMount>

      <LazyMount isOpen={isWithdrawModalOpen}>
      <WithdrawModal
        isOpen={isWithdrawModalOpen}
        onClose={() => setIsWithdrawModalOpen(false)}
        availableBalance={wallet.liquidBalance}
        userSecret={wallet.twoFactorSecret}
        userEmail={wallet.email || currentUser?.email || ''}
        memberId={wallet.memberId}
        onWithdrawSuccess={protectAction(handleWithdrawSuccess)}
      />
      </LazyMount>

      <LazyMount isOpen={isTransferModalOpen}>
      <TransferMemberModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        availableBalance={wallet.liquidBalance}
        userSecret={wallet.twoFactorSecret}
        senderMemberId={wallet.memberId}
        userEmail={wallet.email || currentUser?.email || ''}
        onTransferSuccess={protectAction(handleTransferSuccess)}
      />
      </LazyMount>

      <LazyMount isOpen={is2faModalOpen}>
      <Google2faModal
        isOpen={is2faModalOpen}
        onClose={() => setIs2faModalOpen(false)}
        userEmail={wallet.email}
        username={wallet.username}
        twoFactorEnabled={wallet.twoFactorEnabled !== false}
        twoFactorSecret={wallet.twoFactorSecret}
        onSave2fa={protectAction(handleSave2fa)}
      />
      </LazyMount>

      <LazyMount isOpen={isGasModalOpen}>
      <GasFeeModal
        isOpen={isGasModalOpen}
        onClose={() => setIsGasModalOpen(false)}
        availableBalance={wallet.liquidBalance}
        currentGasReserve={wallet.gasReserve}
        userSecret={wallet.twoFactorSecret}
        memberId={wallet.memberId}
        onTopUpSuccess={protectAction(handleTopUpGasSuccess)}
        onOpenProfitShare={() => {
          setIsGasModalOpen(false);
          setIsProfitShareModalOpen(true);
        }}
        isDemoOrTestnet={isDemoOrTestnet}
      />
      </LazyMount>

      <LazyMount isOpen={isProfitShareModalOpen}>
      <ProfitShareModal
        isOpen={isProfitShareModalOpen}
        onClose={() => setIsProfitShareModalOpen(false)}
        onOpenGasModal={protectAction(() => {
          setIsProfitShareModalOpen(false);
          setIsGasModalOpen(true);
        })}
      />
      </LazyMount>

      <LazyMount isOpen={isApiKeyModalOpen}>
      <ApiKeyModal
        isOpen={isApiKeyModalOpen}
        onClose={() => setIsApiKeyModalOpen(false)}
        currentExchange={currentExchange}
        connectedExchange={wallet.connectedExchange}
        connectedExchanges={wallet.connectedExchanges}
        isAccountActive={wallet.accountStatus === 'active'}
        onOpenActivationModal={protectAction(() => {
          setIsApiKeyModalOpen(false);
          setIsActivationModalOpen(true);
        })}
        onSelectActiveExchange={protectAction(handleSelectActiveExchange)}
        onDisconnectApi={protectAction(handleDisconnectSingleExchange)}
        onConnectSuccess={protectAction(handleConnectExchangeSuccess)}
      />
      </LazyMount>

      <LazyMount isOpen={isSimulationModalOpen}>
      <SimulationModal
        isOpen={isSimulationModalOpen}
        onClose={() => setIsSimulationModalOpen(false)}
      />
      </LazyMount>

      <LazyMount isOpen={isCoinsCheckerModalOpen}>
      <ExchangeCoinsCheckerModal
        isOpen={isCoinsCheckerModalOpen}
        onClose={() => setIsCoinsCheckerModalOpen(false)}
        currentExchange={currentExchange}
        activeApiCreds={activeApiCreds}
        onSelectExchange={setCurrentExchange}
      />
      </LazyMount>

      <LazyMount isOpen={isActivationModalOpen}>
      <ActivationFeeModal
        isOpen={isActivationModalOpen}
        onClose={() => setIsActivationModalOpen(false)}
        wallet={wallet}
        onProcessActivation={protectAction(handleProcessActivation)}
        onOpenDepositModal={protectAction(() => setIsDepositModalOpen(true))}
        activeBotsCount={
          new Set(
            positions
              .filter((p) => p.status === 'active' || p.status === 'averaging')
              .map((p) => p.botId || p.id)
          ).size
        }
      />
      </LazyMount>

      {/* 24-Hour Auto-Logout Banner Notification */}
      {sessionExpiredNotice && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] max-w-xl w-[92%] p-3.5 rounded-2xl bg-amber-500/20 border border-amber-500/50 text-amber-200 text-xs font-mono shadow-2xl backdrop-blur-md flex items-center justify-between gap-3 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span>
            <span>{sessionExpiredNotice}</span>
          </div>
          <button
            onClick={clearSessionExpiredNotice}
            className="px-2.5 py-1 rounded-lg bg-amber-500/30 hover:bg-amber-500/50 text-white text-[10px] font-bold cursor-pointer shrink-0 transition"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Authentication & Registration Modal (Masuk / Registrasi Akun Baru) */}
      <LazyMount isOpen={isAuthModalOpen}>
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        defaultMode={authModalMode}
        initialSponsorId={pendingSponsorId}
      />
      </LazyMount>

      {/* 
        Mandatory 6-Digit Verification Gate before Dashboard:
        - User 1: Akun Aktif (Sudah Membayar Aktivasi):
          Wajib kode verifikasi 6 digit sebelum masuk dashboard.
          Google 2FA Authenticator app TIDAK PERLU ketika login, cukup kode verifikasi 6 digit.
          Setelah verifikasi berhasil, sesi valid 24 jam sehingga TIDAK PERLU memasukkan kode lagi saat login kembali.
        - User 2: Akun Belum Membayar Aktivasi:
          TIDAK PERLU kode aktivasi & TIDAK PERLU kode verifikasi ketika login.
      */}
      {isAuthenticatedUser && isUser1Paid && !user1SessionVerified && !is2faVerified && (
        <LazyMount isOpen>
        <LoginVerificationModal
          isOpen={true}
          userEmail={wallet.email || currentUser?.email || ''}
          userName={wallet.username || currentUser?.displayName || ''}
          onVerifySuccess={() => {
            if (typeof window !== 'undefined' && user1EmailKey) {
              localStorage.setItem(user1SessionStorageKey, Date.now().toString());
            }
            setUser1SessionVerified(true);
            verify2faSession();
          }}
          onCancel={async () => {
            await logout();
          }}
        />
        </LazyMount>
      )}

      {/* Mandatory Registration Gate: Kode Verifikasi Gmail saat registrasi akun baru */}
      {isAuthenticatedUser && (wallet.emailVerified === false) && (isUser1Paid ? (user1SessionVerified || is2faVerified) : true) && (
        <LazyMount isOpen>
        <GmailVerificationModal
          isOpen={true}
          userEmail={wallet.email || currentUser?.email || ''}
          userName={wallet.username || currentUser?.displayName || ''}
          onVerificationSuccess={handleEmailVerificationSuccess}
          onCancel={async () => {
            await logout();
          }}
        />
        </LazyMount>
      )}

      {/* Price Alert & Browser Notification System Modal */}
      <LazyMount isOpen={isPriceAlertModalOpen}>
      <PriceAlertModal
        isOpen={isPriceAlertModalOpen}
        onClose={() => setIsPriceAlertModalOpen(false)}
        userId={currentUser?.uid}
        alerts={priceAlerts}
        currentPrices={currentPricesMap}
        initialSymbol={priceAlertSymbol}
      />
      </LazyMount>
      </Suspense>

      {/* Floating In-App & Browser Notification Toasts Container */}
      <NotificationToastContainer
        notifications={inAppNotifications}
        onDismiss={handleDismissNotification}
        onOpenPriceAlertModal={handleOpenPriceAlert}
        browserPermission={browserNotifPerm}
        onRequestPermission={handleRequestBrowserPermission}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <AppErrorBoundary>
              <AppContent />
            </AppErrorBoundary>
          </BrowserRouter>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
