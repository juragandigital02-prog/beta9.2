import { useState } from 'react';
import { TradingPosition, UserWallet, TradeRecord, BotMode } from '../types';
import { CoinDistributionPieChart } from '../components/CoinDistributionPieChart';
import { TradeHistoryTab } from '../components/trading/TradeHistoryTab';
import { TradeDetailModal } from '../components/modals/TradeDetailModal';
import { CoinLogo } from '../components/common/CoinLogo';
import { formatUsdt } from '../utils/formatters';
import {
  TrendingUp,
  Sliders,
  Play,
  Pause,
  AlertCircle,
  AlertTriangle,
  Search,
  Fuel,
  CheckCircle2,
  DollarSign,
  Layers,
  Sparkles,
  PieChart as PieChartIcon,
  History,
  Activity,
  ArrowDownRight,
  Split,
  Maximize2,
  X,
  Plus,
  Trash2,
  Coins,
  Bot,
  Zap,
  HelpCircle,
  Info,
  Pencil,
  ShieldCheck,
  Eye,
  Lock,
  Bell,
} from 'lucide-react';

interface TradingPositionsViewProps {
  positions: TradingPosition[];
  wallet: UserWallet;
  tradeHistory?: TradeRecord[];
  activeApiCreds?: {
    exchange: string;
    apiKey: string;
    secret: string;
    password?: string;
    isSandbox: boolean;
  } | null;
  isDemoOrTestnet?: boolean;
  onSyncExchangeTrades?: () => Promise<void>;
  isSyncingTrades?: boolean;
  hasMoreTrades?: boolean;
  isLoadingMoreTrades?: boolean;
  onLoadMoreTrades?: () => void;
  onOpenApiKeyModal?: () => void;
  onOpenMatrixModal: (
    pair: string,
    mode?: BotMode,
    layers?: number,
    botId?: string | null,
    botName?: string,
    isNewBot?: boolean,
    minPrice?: number | null,
    maxPrice?: number | null,
    pairedCoins?: string[]
  ) => void;
  onDeleteBot?: (posId: string) => void;
  onDeleteAllStandbyBots?: () => void;
  onOpenGasModal: () => void;
  onForceTakeProfit: (posId: string) => Promise<{
    success: boolean;
    orderId?: string;
    isLiveExchange?: boolean;
    netProfit?: number;
    gasDeduction?: number;
    exchangeError?: string;
    error?: string;
  } | void> | void;
  onTogglePause: (posId: string) => void;
  onBatchForceTp: () => void;
  onBatchPauseAll: () => void;
  onOpenActivationModal?: () => void;
  onCloseLayer?: (positionId: string, layerId: string) => Promise<any> | void;
  onExecuteBotOrder?: (
    pair: string,
    side: 'buy' | 'sell',
    amount?: number
  ) => Promise<{ success: boolean; orderId?: string; message?: string; error?: string }>;
  onOpenPriceAlert?: (symbol?: string) => void;
}

export function TradingPositionsView({
  positions,
  wallet,
  tradeHistory = [],
  activeApiCreds,
  isDemoOrTestnet = false,
  onSyncExchangeTrades,
  isSyncingTrades = false,
  hasMoreTrades = false,
  isLoadingMoreTrades = false,
  onLoadMoreTrades,
  onOpenApiKeyModal,
  onOpenMatrixModal,
  onOpenGasModal,
  onForceTakeProfit,
  onTogglePause,
  onBatchForceTp,
  onBatchPauseAll,
  onOpenActivationModal,
  onExecuteBotOrder,
  onDeleteBot,
  onDeleteAllStandbyBots,
  onCloseLayer,
  onOpenPriceAlert,
}: TradingPositionsViewProps) {
  const [mainTab, setMainTab] = useState<'positions' | 'history'>('positions');
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'profit' | 'drawdown' | 'inactive' | 'avg_only' | 'grid_only' | 'hybrid'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'pnl_desc' | 'pnl_asc' | 'layer_desc'>('pnl_desc');
  const [toastMsg, setToastMsg] = useState('');
  const [toastType, setToastType] = useState<'success' | 'warning'>('success');
  const [isConfirmBatchTpOpen, setIsConfirmBatchTpOpen] = useState(false);
  const [isConfirmBatchPauseOpen, setIsConfirmBatchPauseOpen] = useState(false);
  const [selectedSingleTpPos, setSelectedSingleTpPos] = useState<TradingPosition | null>(null);
  const [isExecutingSingleTp, setIsExecutingSingleTp] = useState(false);
  const [selectedDetailPos, setSelectedDetailPos] = useState<TradingPosition | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [botToDelete, setBotToDelete] = useState<TradingPosition | null>(null);
  const [isConfirmDeleteAllStandbyOpen, setIsConfirmDeleteAllStandbyOpen] = useState(false);
  const [executingPosId, setExecutingPosId] = useState<string | null>(null);
  const [showPieChart, setShowPieChart] = useState(true);

  // View Mode: 'simple' for beginners vs 'pro' for quant traders
  const [viewMode, setViewMode] = useState<'simple' | 'pro'>(() => {
    return (localStorage.getItem('gain_trading_view_mode') as 'simple' | 'pro') || 'pro';
  });
  const [showGlossaryModal, setShowGlossaryModal] = useState(false);
  const [quickBoundaryEditPos, setQuickBoundaryEditPos] = useState<TradingPosition | null>(null);
  const [editMinPrice, setEditMinPrice] = useState('');
  const [editMaxPrice, setEditMaxPrice] = useState('');

  const handleToggleViewMode = (mode: 'simple' | 'pro') => {
    setViewMode(mode);
    localStorage.setItem('gain_trading_view_mode', mode);
  };

  const handleOpenQuickBoundary = (pos: TradingPosition) => {
    setQuickBoundaryEditPos(pos);
    setEditMinPrice(pos.minPrice != null && pos.minPrice > 0 ? String(pos.minPrice) : '');
    setEditMaxPrice(pos.maxPrice != null && pos.maxPrice > 0 ? String(pos.maxPrice) : '');
  };

  const handleSaveQuickBoundary = () => {
    if (!quickBoundaryEditPos) return;
    const minP = editMinPrice ? parseFloat(editMinPrice) : null;
    const maxP = editMaxPrice ? parseFloat(editMaxPrice) : null;
    onOpenMatrixModal(
      quickBoundaryEditPos.pair,
      quickBoundaryEditPos.botMode,
      quickBoundaryEditPos.maxStep || 10,
      quickBoundaryEditPos.botId || quickBoundaryEditPos.id,
      quickBoundaryEditPos.botName,
      false,
      minP,
      maxP,
      quickBoundaryEditPos.pairedCoins || [quickBoundaryEditPos.pair]
    );
    setQuickBoundaryEditPos(null);
    showToast(`Batas harga Min/Max untuk ${quickBoundaryEditPos.pair} diperbarui!`, 'success');
  };

  // Active Bots calculation (distinct bot configurations)
  const activeBotIds = new Set(
    positions
      .filter((p) => p.status === 'active' || p.status === 'averaging')
      .map((p) => p.botId || p.id)
  );
  const activeBotsCount = activeBotIds.size;
  const maxActiveBots = isDemoOrTestnet ? 999999 : (wallet.accountStatus === 'active' ? (wallet.maxActiveBots || 6) : 6);
  const isStarterTier = wallet.licenseTier !== 'pro_12' && wallet.licenseTier !== 'pro_10';

  const activeCount = positions.filter((p) => p.status === 'active' || p.status === 'averaging').length;
  const totalFloatingPnl = positions.reduce((acc, p) => acc + p.floatingPnl, 0);
  const profitablePositions = positions.filter((p) => p.floatingPnl > 0);
  const profitCount = profitablePositions.length;
  const totalProfitUsdt = profitablePositions.reduce((acc, p) => acc + p.floatingPnl, 0);
  const drawdownCount = positions.filter((p) => p.floatingPnl < 0 && p.status !== 'inactive').length;
  const inactiveCount = positions.filter((p) => p.status === 'inactive').length;

  const totalCapital = wallet.liquidBalance + wallet.allocatedAssetUsdt;
  const portfolioRoi = wallet.allocatedAssetUsdt > 0
    ? ((totalFloatingPnl / wallet.allocatedAssetUsdt) * 100).toFixed(2)
    : '0.00';
  const poolExposurePct = totalCapital > 0
    ? Math.round((wallet.allocatedAssetUsdt / totalCapital) * 100)
    : 0;
  const gasHealthPct = Math.min(100, Math.round((wallet.gasReserve / 100) * 100));

  const filteredPositions = positions
    .filter((pos) => {
      if (filterTab === 'active' && pos.status === 'inactive') return false;
      if (filterTab === 'profit' && pos.floatingPnl <= 0) return false;
      if (filterTab === 'drawdown' && (pos.floatingPnl >= 0 || pos.status === 'inactive')) return false;
      if (filterTab === 'inactive' && pos.status !== 'inactive') return false;
      if (filterTab === 'avg_only' && pos.botMode !== 'Avarage Only') return false;
      if (filterTab === 'grid_only' && pos.botMode !== 'Grid Only') return false;
      if (filterTab === 'hybrid' && pos.botMode !== 'Avarage+Grid' && pos.botMode !== undefined) return false;

      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        pos.pair.toLowerCase().includes(q) ||
        pos.coin.toLowerCase().includes(q) ||
        (pos.botMode && pos.botMode.toLowerCase().includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'pnl_desc') return b.floatingPnl - a.floatingPnl;
      if (sortBy === 'pnl_asc') return a.floatingPnl - b.floatingPnl;
      if (sortBy === 'layer_desc') return b.stepLayer - a.stepLayer;
      return 0;
    });

  const showToast = (msg: string, type: 'success' | 'warning' = 'success') => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleTriggerBatchTp = () => {
    if (profitCount === 0) {
      showToast('Tidak ada posisi aktif yang sedang dalam profit untuk di-Take Profit.', 'warning');
      return;
    }
    setIsConfirmBatchTpOpen(true);
  };

  const handleConfirmBatchTp = () => {
    setIsConfirmBatchTpOpen(false);
    onBatchForceTp();
    showToast(`Berhasil mengeksekusi Take Profit untuk ${profitCount} posisi profit (+${totalProfitUsdt.toFixed(2)} USDT)!`, 'success');
  };

  const handleTriggerBatchPause = () => {
    setIsConfirmBatchPauseOpen(true);
  };

  const handleConfirmBatchPause = () => {
    setIsConfirmBatchPauseOpen(false);
    onBatchPauseAll();
    showToast(`Perintah Pause berhasil dikirim untuk seluruh (${activeCount}) bot trading!`, 'success');
  };

  const handleOpenSingleTpModal = (pos: TradingPosition) => {
    if (pos.floatingPnl <= 0) {
      showToast(`Posisi ${pos.pair} belum menghasilkan floating profit untuk di-Take Profit.`, 'warning');
      return;
    }
    setSelectedSingleTpPos(pos);
  };

  const handleConfirmSingleTp = async () => {
    if (!selectedSingleTpPos) return;
    setIsExecutingSingleTp(true);
    try {
      const res = await onForceTakeProfit(selectedSingleTpPos.id);
      setIsExecutingSingleTp(false);
      setSelectedSingleTpPos(null);

      if (res && typeof res === 'object' && res.success) {
        if (res.isLiveExchange && res.orderId) {
          showToast(`✅ Take Profit Berhasil! Order Market Sell terisi di ${activeApiCreds?.exchange || 'Exchange'} (ID #${res.orderId}). Net: +${res.netProfit?.toFixed(2)} USDT.`, 'success');
        } else {
          showToast(`✅ Take Profit Berhasil! Net +${res.netProfit?.toFixed(2)} USDT dikreditkan ke Vault (Gas: -${res.gasDeduction?.toFixed(2)} USDT).`, 'success');
        }
      } else {
        showToast(`✅ Force Take Profit dieksekusi untuk ${selectedSingleTpPos.pair}!`, 'success');
      }
    } catch (err: any) {
      setIsExecutingSingleTp(false);
      showToast(`Gagal mengeksekusi Take Profit: ${err.message || 'Kesalahan sistem'}`, 'warning');
    }
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Sandbox/Demo Mode Notification when Account is Not Yet Activated */}
      {wallet.accountStatus !== 'active' && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-500/15 via-amber-950/20 to-transparent border border-amber-500/40 text-amber-200 flex items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 font-bold text-xs flex-wrap">
                <span className="text-white font-bold">Lingkungan Trading: Testnet / Demo Simulator</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30 uppercase">
                  Belum Aktivasi
                </span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans mt-0.5 leading-snug">
                Bot berjalan dalam mode simulasi paper/testnet. Eksekusi order bursa nyata non-aktif hingga lisensi diaktivasi.
              </p>
            </div>
          </div>
          {onOpenActivationModal && (
            <button
              onClick={onOpenActivationModal}
              className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs font-sans shrink-0 transition cursor-pointer shadow-xs flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5 fill-current" />
              <span>Aktivasi Akun</span>
            </button>
          )}
        </div>
      )}

      {/* View Header Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:from-[#0C172A] dark:via-[#091222] dark:to-[#060B14] border border-slate-200 dark:border-[#162740] shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-teal-600 dark:text-[#00F0C8]" />
              <span>Posisi Trading Aktif · Live Bot Positions</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              3 Mode: Averager (20L) • Grid (100L) • Avg+Grid (120L) • Filter Uptrend • Trailing TP • Rebound Callback
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <button
              onClick={() => setShowPieChart((prev) => !prev)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer ${
                showPieChart
                  ? 'bg-teal-500/10 border-teal-500/40 text-teal-700 dark:text-[#00F0C8]'
                  : 'bg-white dark:bg-[#0C1628] border-slate-200 dark:border-[#182B46] text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white'
              }`}
            >
              <PieChartIcon className="w-3.5 h-3.5" />
              <span>{showPieChart ? 'Sembunyikan Bagan' : 'Bagan Distribusi'}</span>
            </button>

            <button
              onClick={() => onOpenMatrixModal('BTC/USDT', 'Avarage+Grid', 20, null, 'GAIN Matrix Multi-Pair Bot', true, null, null, ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'])}
              className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 dark:bg-[#00F0C8] dark:hover:bg-[#00d8b4] text-slate-950 font-bold text-xs font-mono glow-cyan-btn transition flex items-center gap-1.5 cursor-pointer shadow-md"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Buat Bot Baru (Multi-Koin)</span>
            </button>

            <button
              onClick={() => onOpenMatrixModal('BTC/USDT', 'Avarage+Grid', 20, null, 'Formula Matrix Bot', false)}
              className="px-3 py-1.5 rounded-xl bg-teal-500/10 border border-teal-500/30 text-teal-700 dark:text-[#00F0C8] hover:bg-teal-500/20 transition text-xs font-mono font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Matrix Formula</span>
            </button>
          </div>
        </div>
      </div>

      {/* Top Tab Switcher: Positions vs Trade History */}
      <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#101A29] border border-slate-200 dark:border-[#1E2E44] shadow-xs transition-colors">
        <button
          onClick={() => setMainTab('positions')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-sans font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
            mainTab === 'positions'
              ? 'bg-teal-600 text-white dark:bg-[#00F0C8] dark:text-slate-950 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Posisi Berjalan & Standby</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums ${
              mainTab === 'positions'
                ? 'bg-black/20 text-white dark:text-slate-950 font-bold'
                : 'bg-slate-200 dark:bg-[#162338] text-slate-700 dark:text-slate-300'
            }`}
          >
            {positions.length}
          </span>
        </button>

        <button
          onClick={() => setMainTab('history')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-sans font-semibold flex items-center justify-center gap-2 transition cursor-pointer ${
            mainTab === 'history'
              ? 'bg-teal-600 text-white dark:bg-[#00F0C8] dark:text-slate-950 shadow-xs'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Riwayat Trading & Orders</span>
          <span
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono tabular-nums ${
              mainTab === 'history'
                ? 'bg-black/20 text-white dark:text-slate-950 font-bold'
                : 'bg-slate-200 dark:bg-[#162338] text-slate-700 dark:text-slate-300'
            }`}
          >
            {tradeHistory.length}
          </span>
        </button>
      </div>

      {mainTab === 'history' ? (
        <TradeHistoryTab
          trades={tradeHistory}
          wallet={wallet}
          positions={positions}
          activeApiCreds={activeApiCreds || null}
          onSyncExchangeTrades={onSyncExchangeTrades || (async () => {})}
          isSyncing={isSyncingTrades}
          hasMoreTrades={hasMoreTrades}
          isLoadingMoreTrades={isLoadingMoreTrades}
          onLoadMoreTrades={onLoadMoreTrades}
          onOpenApiKeyModal={onOpenApiKeyModal || (() => {})}
          onForceTakeProfit={onForceTakeProfit}
          onOpenMatrixModal={(pair) => onOpenMatrixModal(pair)}
          onCloseLayer={onCloseLayer}
        />
      ) : (
        <>
          {/* Bot Quota & Lifetime License Banner */}
          <div className="p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#101A29] border border-slate-200 dark:border-[#1E2E44] shadow-xs flex items-center justify-between flex-wrap gap-3 transition-colors">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-teal-50 dark:bg-teal-950/40 text-teal-600 dark:text-[#2DD4BF] border border-teal-500/20 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs sm:text-sm font-sans font-bold text-slate-900 dark:text-white">
                    Kuota Bot Aktif: <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">{activeBotsCount}</span> / <span className="font-mono tabular-nums">{isDemoOrTestnet ? '∞ (Tanpa Batas Demo)' : `${maxActiveBots} Bot`}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold border ${isDemoOrTestnet ? 'bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30' : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-[#2DD4BF] border border-teal-500/30'}`}>
                    {isDemoOrTestnet ? 'Mode Demo / Testnet (Bebas Bot & Gas)' : (wallet.licenseName || (wallet.accountStatus === 'active' ? 'Starter Lifetime (6 Bot)' : 'Belum Teraktivasi'))}
                  </span>
                  <span className="text-xs font-sans text-slate-500 dark:text-slate-400">
                    • Draft Setting: <strong className="text-slate-900 dark:text-white">Tanpa Batas</strong>
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                  {isDemoOrTestnet
                    ? 'Mode Demo / Testnet aktif: Kuota bot aktif tidak terbatas. Anda bebas mengaktifkan bot sebanyak mungkin tanpa restriksi.'
                    : (activeBotsCount >= maxActiveBots
                      ? `Batas kuota ${maxActiveBots} bot aktif tercapai. Bot baru akan disimpan sebagai Draft (bisa dibuat tanpa batas).`
                      : `Tersedia sisa kuota ${maxActiveBots - activeBotsCount} bot untuk dijalankan bersamaan. Draft bot dapat dibuat tanpa batas.`)}
                </p>
              </div>
            </div>

            {onOpenActivationModal && (
              <button
                onClick={onOpenActivationModal}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-teal-500/15 to-indigo-500/15 hover:from-teal-500/25 hover:to-indigo-500/25 text-teal-700 dark:text-[#00F0C8] border border-teal-500/40 text-xs font-mono font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Zap className="w-3.5 h-3.5 text-teal-600 dark:text-[#00F0C8]" />
                <span>
                  {wallet.accountStatus === 'active'
                    ? isStarterTier
                      ? 'Upgrade ke 12 Bot ($100 Promo)'
                      : 'Paket Pro Lifetime (12 Bot)'
                    : 'Aktivasi Lisensi ($150 Promo)'}
                </span>
              </button>
            )}
          </div>

          {/* 4 KPI Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="p-3.5 rounded-xl bg-white dark:bg-[#101A29] border border-slate-200 dark:border-[#1E2E44] shadow-xs transition-colors">
              <span className="text-[10.5px] text-slate-500 dark:text-slate-400 uppercase tracking-tight block font-sans font-medium">
                Total Active Positions
              </span>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-1 font-mono tabular-nums">
                {activeCount} <span className="text-xs text-slate-400 font-normal">/ {positions.length}</span>
              </div>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans mt-0.5 block">Alokasi Otomatis</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-[#101A29] border border-slate-200 dark:border-[#1E2E44] shadow-xs transition-colors">
              <span className="text-[10.5px] text-slate-500 dark:text-slate-400 uppercase tracking-tight block font-sans font-medium">
                Total Floating PnL
              </span>
              <div className={`text-base font-bold mt-1 font-mono tabular-nums ${totalFloatingPnl >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {totalFloatingPnl >= 0 ? `+${formatUsdt(totalFloatingPnl)}` : formatUsdt(totalFloatingPnl)} USDT
              </div>
              <span className={`text-[10px] font-mono mt-0.5 block tabular-nums ${Number(portfolioRoi) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                {Number(portfolioRoi) >= 0 ? `+${portfolioRoi}%` : `${portfolioRoi}%`} Portfolio ROI
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-[#101A29] border border-slate-200 dark:border-[#1E2E44] shadow-xs transition-colors">
              <span className="text-[10.5px] text-slate-500 dark:text-slate-400 uppercase tracking-tight block font-sans font-medium">
                Capital Deployed
              </span>
              <div className="text-base font-bold text-slate-900 dark:text-white mt-1 font-mono tabular-nums">
                {formatUsdt(wallet.allocatedAssetUsdt)} USDT
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans mt-0.5 block">{poolExposurePct}% Pool Exposure</span>
            </div>

            <div className="p-3.5 rounded-xl bg-white dark:bg-[#101A29] border border-slate-200 dark:border-[#1E2E44] shadow-xs transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] text-slate-500 dark:text-slate-400 uppercase tracking-tight block font-sans font-medium">
                  Gas Pool Health
                </span>
                <button onClick={onOpenGasModal} className="text-[10px] text-teal-600 dark:text-[#2DD4BF] hover:underline cursor-pointer font-sans font-semibold">
                  Top-Up
                </button>
              </div>
              <div className="text-base font-bold text-teal-600 dark:text-[#2DD4BF] mt-1 font-sans">
                {gasHealthPct}% {wallet.gasReserve >= 10 ? 'Aman' : 'Perlu Top-Up'}
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums mt-0.5 block">
                +{formatUsdt(wallet.gasReserve)} USDT
              </span>
            </div>
          </div>

          {/* Coin Distribution Pie Chart */}
          {showPieChart && (
            <CoinDistributionPieChart positions={positions} wallet={wallet} />
          )}

          {/* Filter Tabs */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#142236] text-xs font-mono">
            <div className="flex overflow-x-auto custom-scrollbar">
              {[
                { id: 'all', label: `Semua (${positions.length})` },
                { id: 'active', label: `Aktif (${activeCount})` },
                { id: 'profit', label: `Profit (${profitCount})` },
                { id: 'drawdown', label: `Drawdown (${drawdownCount})` },
                { id: 'avg_only', label: 'Avarage Only' },
                { id: 'grid_only', label: 'Grid Only' },
                { id: 'hybrid', label: 'Avarage+Grid' },
                { id: 'inactive', label: `Standby (${inactiveCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterTab(tab.id as any)}
                  className={`py-2 px-3 whitespace-nowrap transition-colors border-b-2 font-medium cursor-pointer ${
                    filterTab === tab.id
                      ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {onDeleteAllStandbyBots && inactiveCount > 0 && (
              <button
                type="button"
                onClick={() => setIsConfirmDeleteAllStandbyOpen(true)}
                className="py-1 px-2.5 my-1 ml-2 rounded-lg bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/40 border border-red-500/30 text-red-600 dark:text-red-400 text-[11px] font-sans font-semibold transition flex items-center gap-1.5 cursor-pointer shrink-0 shadow-xs"
                title="Hapus semua bot berstatus Standby"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hapus Semua Standby ({inactiveCount})</span>
              </button>
            )}
          </div>

          {/* Mode Selector & Beginner Glossary Bar */}
          <div className="flex items-center justify-between flex-wrap gap-2 p-2 rounded-2xl bg-white dark:bg-[#0E1726] border border-slate-200 dark:border-[#1A2A42] shadow-xs">
            <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#070D18] border border-slate-200 dark:border-[#142236]">
              <button
                type="button"
                onClick={() => handleToggleViewMode('simple')}
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'simple'
                    ? 'bg-white dark:bg-[#15202E] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <span>Mode Pemula</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleViewMode('pro')}
                className={`px-3 py-1.5 rounded-lg text-xs font-sans font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  viewMode === 'pro'
                    ? 'bg-white dark:bg-[#15202E] text-slate-900 dark:text-white shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                <Zap className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                <span>Mode Pro</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowGlossaryModal(true)}
                className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#15202E] border border-slate-200 dark:border-[#1E2E44] text-slate-700 dark:text-slate-300 text-xs font-sans font-medium hover:text-slate-900 dark:hover:text-white transition flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                <span>Kamus Istilah Trading</span>
              </button>

              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-[#0B1424] border border-slate-200 dark:border-[#162740] text-[11px] font-mono text-slate-500 dark:text-slate-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>Bursa Aktif</span>
              </div>
            </div>
          </div>

          {/* Search & Sort controls */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari aset (cth: BTC, SOL, ETH, Grid)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-[#08101D] border border-slate-300 dark:border-[#142236] text-xs text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-teal-500 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-500 text-[10px]">Urutkan:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#08101D] border border-slate-300 dark:border-[#142236] text-slate-800 dark:text-slate-300 focus:outline-none focus:border-teal-500 shadow-sm"
              >
                <option value="pnl_desc">PnL Tertinggi</option>
                <option value="pnl_asc">PnL Terendah</option>
                <option value="layer_desc">Layer Tertinggi</option>
              </select>
            </div>
          </div>

          {toastMsg && (
            <div
              className={`p-3 rounded-xl border text-xs font-mono flex items-center gap-2 justify-center animate-fadeIn shadow-sm ${
                toastType === 'warning'
                  ? 'bg-amber-500/15 border-amber-500/30 text-amber-700 dark:text-amber-300'
                  : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
              }`}
            >
              {toastType === 'warning' ? (
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-500" />
              ) : (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              )}
              <span>{toastMsg}</span>
            </div>
          )}

          {/* Positions Grid */}
          <div className="space-y-3">
            {filteredPositions.map((pos, idx) => {
              const currentMode: BotMode = pos.botMode || 'Avarage+Grid';
              const maxLayers = pos.maxStep || 10;
              const stepCount = pos.stepLayer || 1;
              const layerProgressPct = Math.min(100, Math.max(6, (stepCount / maxLayers) * 100));
              const isProfit = pos.floatingPnl >= 0;

              if (viewMode === 'simple') {
                return (
                  <div
                    key={`${pos.id || pos.coin}-${idx}`}
                    className="p-4 rounded-2xl bg-white dark:bg-[#101A29] border border-slate-200 dark:border-[#1E2E44] hover:border-teal-500/40 dark:hover:border-teal-500/30 transition shadow-xs space-y-3.5"
                  >
                    {/* Top Header: Coin, Name & Simple Status */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CoinLogo coin={pos.coin || pos.pair} size="md" />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-slate-900 dark:text-white font-sans">{pos.pair}</span>
                            {onOpenPriceAlert && (
                              <button
                                type="button"
                                onClick={() => onOpenPriceAlert(pos.pair)}
                                title={`Pasang Price Alert untuk ${pos.pair}`}
                                className="p-1 rounded-lg text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-950/30 transition cursor-pointer"
                              >
                                <Bell className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <span
                              className="px-2 py-0.5 rounded-full text-[10.5px] font-sans font-medium flex items-center gap-1.5 bg-slate-100 dark:bg-[#15202E] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1E2E44]"
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  pos.status === 'active' || pos.status === 'averaging'
                                    ? 'bg-slate-400 dark:bg-slate-500'
                                    : 'bg-slate-300'
                                }`}
                              />
                              {pos.status === 'active' || pos.status === 'averaging'
                                ? 'Berjalan Otomatis'
                                : 'Sedang Dijeda'}
                            </span>
                          </div>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-sans">
                            {pos.botName || 'GAIN Automated Bot'} · Strategi Jaring Beli Aman
                          </span>
                        </div>
                      </div>

                      <div className="text-right">
                        <span className="text-sm font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                          ${typeof pos.price === 'number' ? pos.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : pos.price}
                        </span>
                        <span
                          className={`text-[11px] font-mono block font-bold tabular-nums ${
                            pos.change24h >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                          }`}
                        >
                          {pos.change24h >= 0 ? `+${pos.change24h}%` : `${pos.change24h}%`} (24j)
                        </span>
                      </div>
                    </div>

                    {/* Prominent Profit Card */}
                    <div
                      className={`p-3.5 rounded-xl border flex items-center justify-between ${
                        isProfit
                          ? 'bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-500/30 text-emerald-900 dark:text-emerald-300'
                          : 'bg-slate-50 dark:bg-[#0B121E] border-slate-200 dark:border-[#1A2C46] text-slate-800 dark:text-slate-300'
                      }`}
                    >
                      <div>
                        <span className="text-[10.5px] uppercase font-bold tracking-tight block text-slate-500 dark:text-slate-400">
                          {isProfit ? 'Keuntungan Berjalan Saat Ini' : 'Nilai Sementara (Floating)'}
                        </span>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span
                            className={`font-mono text-xl font-extrabold tabular-nums ${
                              isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                            }`}
                          >
                            {isProfit ? `+${pos.floatingPnl.toFixed(2)}` : pos.floatingPnl.toFixed(2)} USDT
                          </span>
                          <span
                            className={`text-xs font-mono font-bold tabular-nums ${
                              isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                            }`}
                          >
                            ({isProfit ? `+${pos.roiPct}%` : `${pos.roiPct}%`})
                          </span>
                        </div>
                        <span className="text-[10.5px] text-slate-500 dark:text-slate-400 block mt-0.5 font-sans">
                          {isProfit
                            ? '✅ Siap diambil kapan saja dengan tombol Ambil Untung di bawah'
                            : 'ℹ️ Koreksi wajar, bot otomatis membeli di harga diskon'}
                        </span>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Modal Terpasang</span>
                        <span className="font-mono text-xs font-bold text-slate-900 dark:text-white block mt-0.5 tabular-nums">
                          {pos.allocationUsdt}
                        </span>
                      </div>
                    </div>

                    {/* Simple Layer & Status Progress */}
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#0B1019] border border-slate-200 dark:border-[#162438] space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-600 dark:text-slate-400 font-sans">
                          Tingkat Jaring Beli:{' '}
                          <strong className="text-slate-900 dark:text-white font-mono">
                            Tingkat #{stepCount} dari {maxLayers}
                          </strong>
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-sans font-bold text-[11px]">
                          {stepCount <= 5 ? '🟢 Zona Sangat Aman' : stepCount <= 12 ? '🟡 Zona Wajar' : '🔵 Zona Averaging Dalam'}
                        </span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-[#15202E] overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(6, (stepCount / maxLayers) * 100))}%` }}
                        />
                      </div>
                      <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-tight font-sans">
                        Bot akan otomatis menjual koin saat harga naik mencapai target profit dan trailing rebound.
                      </p>
                    </div>

                    {/* Friendly Ergonomic Buttons */}
                    <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-1 sm:flex-initial">
                        <button
                          onClick={() => {
                            setSelectedDetailPos(pos);
                            setIsDetailModalOpen(true);
                          }}
                          className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl bg-teal-50 dark:bg-teal-950/40 border border-teal-500/30 text-teal-700 dark:text-[#2DD4BF] hover:bg-teal-100 dark:hover:bg-teal-900/50 text-xs font-sans font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Rincian Pembelian ({stepCount} Layer)</span>
                        </button>

                        <button
                          onClick={() => {
                            onTogglePause(pos.id);
                            showToast(`Status bot ${pos.pair} berhasil diubah.`);
                          }}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#162338] border border-slate-200 dark:border-[#20324D] text-slate-700 dark:text-slate-200 text-xs font-sans font-semibold hover:text-slate-950 dark:hover:text-white transition flex items-center gap-1.5 cursor-pointer"
                        >
                          {pos.status === 'active' || pos.status === 'averaging' ? (
                            <>
                              <Pause className="w-3.5 h-3.5 text-amber-500" />
                              <span>Jeda Bot</span>
                            </>
                          ) : (
                            <>
                              <Play className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Lanjutkan Bot</span>
                            </>
                          )}
                        </button>
                      </div>

                      <button
                        onClick={() => handleOpenSingleTpModal(pos)}
                        className={`flex-1 sm:flex-initial px-4 py-2 rounded-xl text-xs font-sans font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-sm ${
                          isProfit
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            : 'bg-slate-200 dark:bg-[#1A283D] text-slate-700 dark:text-slate-300 hover:bg-slate-300'
                        }`}
                      >
                        <DollarSign className="w-4 h-4" />
                        <span>Ambil Untung (Force TP)</span>
                      </button>

                      {onDeleteBot && (
                        <button
                          type="button"
                          onClick={() => setBotToDelete(pos)}
                          className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition cursor-pointer active:scale-95 shrink-0"
                          title={`Hapus bot ${pos.pair}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={`${pos.id || pos.coin}-${idx}`}
                  className="p-4 rounded-2xl bg-white dark:bg-[#111827] border border-slate-200 dark:border-[#1E293B] hover:border-teal-500/40 dark:hover:border-teal-500/30 transition shadow-xs space-y-3"
                >
                  {/* Top row: Symbol, Bot Specs & OKX-Style Live Price */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <CoinLogo
                        coin={pos.coin || pos.pair}
                        size="lg"
                        fallbackSymbol={pos.badgeSymbol}
                        fallbackBg={pos.badgeBg}
                        fallbackColor={pos.badgeColor}
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-base text-slate-900 dark:text-white font-sans">{pos.pair}</span>
                          {pos.botName && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">
                              {pos.botName}
                            </span>
                          )}
                          {pos.pairedCoins && pos.pairedCoins.length > 0 && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-sans font-semibold bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-[#2DD4BF] border border-teal-500/30 flex items-center gap-1">
                              <Coins className="w-3 h-3" />
                              <span>{pos.pairedCoins.length} Koin Dipairing</span>
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold ${
                              pos.status === 'active'
                                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                                : pos.status === 'averaging'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border border-amber-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            {pos.statusLabel}
                          </span>

                          {/* Bot Mode Tag */}
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-sans font-semibold flex items-center gap-1 border ${
                              currentMode === 'Avarage Only'
                                ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-500/30'
                                : currentMode === 'Grid Only'
                                ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border-blue-500/30'
                                : 'bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-[#2DD4BF] border-teal-500/30'
                            }`}
                          >
                            {currentMode === 'Avarage Only' && <ArrowDownRight className="w-3 h-3" />}
                            {currentMode === 'Grid Only' && <Split className="w-3 h-3" />}
                            {currentMode === 'Avarage+Grid' && <Maximize2 className="w-3 h-3" />}
                            <span>{currentMode}</span>
                          </span>

                          <span className="px-2 py-0.5 rounded text-[10px] font-mono tabular-nums bg-slate-100 dark:bg-[#0B121E] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#162338]">
                            {maxLayers} Layer
                          </span>

                          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Uptrend: {pos.uptrendFilter !== false ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-sans mt-0.5">{pos.engine}</p>
                      </div>
                    </div>

                    {/* OKX-Style Price & 24h Ticket */}
                    <div className="text-right shrink-0">
                      <div className="text-base font-bold font-mono text-slate-900 dark:text-white tabular-nums">
                        ${typeof pos.price === 'number' ? pos.price.toLocaleString(undefined, { minimumFractionDigits: 2 }) : pos.price}
                      </div>
                      <div
                        className={`text-xs font-mono font-bold tabular-nums ${
                          pos.change24h >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'
                        }`}
                      >
                        {pos.change24h >= 0 ? `+${pos.change24h}%` : `${pos.change24h}%`}
                      </div>
                    </div>
                  </div>

                  {/* Bybit-Style Micro-Progress Layer Gauge */}
                  <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-[#0B1019] border border-slate-200 dark:border-[#1A2433] space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10.5px] uppercase font-sans font-semibold text-slate-500 dark:text-slate-400">
                          Layer Terisi (Depth Gauge):
                        </span>
                        <span className="font-mono font-bold text-teal-600 dark:text-[#2DD4BF] tabular-nums">
                          #{stepCount} <span className="text-slate-400 font-normal">/ {maxLayers} Layer</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px] tabular-nums">
                        <span className="text-slate-400">Porsi Terpakai:</span>
                        <span className={`font-bold ${layerProgressPct > 70 ? 'text-amber-500' : 'text-slate-800 dark:text-slate-200'}`}>
                          {layerProgressPct.toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    {/* Visual Segmented Progress Bar */}
                    <div className="w-full h-2 rounded-full bg-slate-200 dark:bg-[#15202E] overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${layerProgressPct}%`,
                          background: layerProgressPct > 75 
                            ? 'linear-gradient(90deg, #10B981, #F59E0B, #F43F5E)' 
                            : 'linear-gradient(90deg, #10B981, #06B6D4, #2DD4BF)'
                        }}
                      />
                    </div>
                  </div>

                  {/* OKX-Style 4 Metric Grid with Clean Contrasts */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-[#0B1019] border border-slate-200 dark:border-[#1A2433] text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans font-medium block">
                        Alokasi USDT
                      </span>
                      <span className="text-slate-900 dark:text-white font-mono font-bold block mt-0.5 tabular-nums">
                        {pos.allocationUsdt}
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">{pos.allocationQty}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans font-medium block">
                        Target TP / Exit
                      </span>
                      <span className="text-slate-900 dark:text-white font-mono font-bold block mt-0.5 tabular-nums">
                        {pos.tpTriggerPrice || pos.tpTargetPrice || 'Dynamic'}
                      </span>
                      <span className="text-[10px] text-teal-600 dark:text-[#2DD4BF] font-sans font-medium">
                        {currentMode === 'Grid Only' ? 'Sub-Grid Osilasi' : 'Trailing Take Profit'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-sans font-medium block">
                        Trailing Callback
                      </span>
                      <span className="text-slate-800 dark:text-slate-200 font-mono font-semibold block mt-0.5 tabular-nums">
                        {pos.tpCallbackPct || 0.2}% Rebound
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-sans">
                        Auto Lock Profit
                      </span>
                    </div>

                    {/* Bybit High-Visibility Floating PnL Card */}
                    <div className={`p-2 rounded-lg border flex flex-col justify-center ${
                      isProfit
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-500/30'
                        : 'bg-rose-50 dark:bg-rose-950/40 border-rose-500/30'
                    }`}>
                      <span className="text-[9.5px] uppercase font-sans font-semibold text-slate-500 dark:text-slate-400 block leading-tight">
                        Floating PnL & ROI
                      </span>
                      <div className={`font-mono font-bold text-xs mt-0.5 tabular-nums flex items-center gap-1 ${
                        isProfit ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        <span>{isProfit ? `+${pos.floatingPnl.toFixed(2)}` : pos.floatingPnl.toFixed(2)} USDT</span>
                        <span className="text-[10px] opacity-80">({isProfit ? `+${pos.roiPct}%` : `${pos.roiPct}%`})</span>
                      </div>
                    </div>
                  </div>

                  {/* Pairs Price Range Display (Exact Layout from User Screenshot) */}
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 dark:bg-[#060D18] border border-slate-200 dark:border-[#132034] text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase font-bold text-slate-400">Pairs</span>
                      <span className="font-extrabold text-slate-800 dark:text-white bg-slate-200/70 dark:bg-[#0D1829] px-2.5 py-0.5 rounded-lg border border-slate-300 dark:border-[#1A2E4C] tracking-wide">
                        {pos.pair.replace('/', '')}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Min Price (Floor) with Red Down Arrow & Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenQuickBoundary(pos)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg hover:bg-rose-500/10 border border-transparent hover:border-rose-500/30 transition cursor-pointer"
                        title="Klik untuk Edit Cepat Batas Min Price (Support)"
                      >
                        <ArrowDownRight className="w-4 h-4 text-rose-500 shrink-0 stroke-[2.5]" />
                        <span className="font-bold text-rose-500 dark:text-rose-400">
                          {pos.minPrice != null && pos.minPrice > 0 ? pos.minPrice.toFixed(8) : '0.00000000'}
                        </span>
                        <Pencil className="w-2.5 h-2.5 text-slate-400 opacity-60 ml-0.5" />
                      </button>

                      {/* Max Price (Ceiling) with Green Up Arrow & Edit Button */}
                      <button
                        type="button"
                        onClick={() => handleOpenQuickBoundary(pos)}
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg hover:bg-emerald-500/10 border border-transparent hover:border-emerald-500/30 transition cursor-pointer"
                        title="Klik untuk Edit Cepat Batas Max Price (Resistance)"
                      >
                        <TrendingUp className="w-4 h-4 text-emerald-500 dark:text-[#00F0C8] shrink-0 stroke-[2.5]" />
                        <span className="font-bold text-emerald-600 dark:text-[#00F0C8]">
                          {pos.maxPrice != null && pos.maxPrice > 0 ? pos.maxPrice.toFixed(8) : '0.00000000'}
                        </span>
                        <Pencil className="w-2.5 h-2.5 text-slate-400 opacity-60 ml-0.5" />
                      </button>
                    </div>
                  </div>

                  {/* Real-time Boundary Protection Status Banner */}
                  {pos.maxPrice != null && pos.maxPrice > 0 && pos.price > pos.maxPrice ? (
                    <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300 text-xs font-mono flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center gap-1.5 font-bold text-amber-600 dark:text-amber-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span>Harga (${typeof pos.price === 'number' ? pos.price.toFixed(2) : pos.price}) &gt; Max Price (${pos.maxPrice.toFixed(2)})</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300 text-[10px] font-extrabold border border-amber-500/30">
                        BOT ON • TIDAK BUY
                      </span>
                    </div>
                  ) : pos.minPrice != null && pos.minPrice > 0 && pos.price < pos.minPrice ? (
                    <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-mono flex items-center justify-between flex-wrap gap-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-600 dark:text-rose-400">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-500" />
                        <span>Harga (${typeof pos.price === 'number' ? pos.price.toFixed(2) : pos.price}) &lt; Min Price (${pos.minPrice.toFixed(2)})</span>
                      </div>
                      <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[10px] font-extrabold border border-rose-500/30">
                        BOT ON • TIDAK BUY
                      </span>
                    </div>
                  ) : null}

                  {/* Trailing progress bar */}
                  <div>
                    <div className="flex items-center justify-between text-[11px] font-mono mb-1 text-slate-500 dark:text-slate-400">
                      <span>{pos.trailingInfo || `${currentMode} Multiplier Step`}</span>
                      <span>{pos.trailingProgressPct}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-[#060B14] overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-teal-500 to-cyan-400 rounded-full transition-all"
                        style={{ width: `${pos.trailingProgressPct}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Card Action Buttons (Bybit Ergonomic Action Dock - Responsive Grid/Flex for Mobile, Tablet & Desktop) */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-1 gap-2 border-t border-slate-100 dark:border-[#162338]">
                    {/* Left Actions */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => {
                          setSelectedDetailPos(pos);
                          setIsDetailModalOpen(true);
                        }}
                        className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#15202E] border border-slate-200 dark:border-[#1E2E44] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-[#2A3E5C] text-xs font-sans font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-95"
                        title="Buka rincian detail eksekusi layer (Harga buy, ukuran USD, estimasi TP, Floating PnL)"
                      >
                        <Layers className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
                        <span>Detail Layer ({pos.stepLayer || (pos.coin === 'SUI' ? 8 : pos.coin === 'HYPE' ? 2 : 1)})</span>
                      </button>

                      <button
                        onClick={() => onOpenMatrixModal(pos.pair, currentMode, maxLayers, pos.botId || pos.id, pos.botName, false, pos.minPrice, pos.maxPrice, pos.pairedCoins || [pos.pair])}
                        className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#15202E] border border-slate-200 dark:border-[#1E2E44] text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-[#2A3E5C] text-xs font-sans font-semibold transition flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                        title="Setting konfigurasi bot ini & atur koin apa saja yang dipairing"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                        <span>Setting & Pairing</span>
                      </button>

                      <button
                        onClick={() => onOpenMatrixModal('BTC/USDT', 'Avarage+Grid', 20, undefined, 'GAIN Multi-Pair Bot', true, null, null, ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'])}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-[#15202E] border border-slate-200 dark:border-[#1E2E44] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-xs font-sans font-semibold transition flex items-center justify-center gap-1 cursor-pointer active:scale-95"
                        title="Buat bot baru dengan pairing multi-koin"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Bot</span>
                      </button>
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-1.5 justify-end">
                      {onExecuteBotOrder && (
                        <button
                          disabled={executingPosId === pos.id}
                          onClick={async () => {
                            if (pos.maxPrice != null && pos.maxPrice > 0 && pos.price > pos.maxPrice) {
                              showToast(`⚠️ Batas Max Price: Harga ${pos.pair} (${pos.price}) masih di atas batas Max Price (${pos.maxPrice}). Bot dilarang buy!`);
                              return;
                            }
                            if (pos.minPrice != null && pos.minPrice > 0 && pos.price < pos.minPrice) {
                              showToast(`⚠️ Batas Min Price: Harga ${pos.pair} (${pos.price}) di bawah batas Min Price (${pos.minPrice}). Bot dilarang buy!`);
                              return;
                            }
                            setExecutingPosId(pos.id);
                            showToast(`Mengirim order ${pos.pair} ke Exchange Testnet...`);
                            const res = await onExecuteBotOrder(pos.pair, 'buy');
                            setExecutingPosId(null);
                            if (res.success) {
                              showToast(`✅ Order Terisi! ID: #${res.orderId || 'SUCCESS'}`);
                            } else {
                              showToast(`❌ Gagal: ${res.error}`);
                            }
                          }}
                          className="flex-1 sm:flex-initial px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-950 text-xs font-sans font-bold transition flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-xs active:scale-95"
                          title="Kirim order averaging layer langsung ke Exchange Testnet"
                        >
                          <Sparkles className={`w-3.5 h-3.5 ${executingPosId === pos.id ? 'animate-spin' : ''}`} />
                          <span>{executingPosId === pos.id ? 'Mengirim...' : 'Step Testnet'}</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          onTogglePause(pos.id);
                          showToast(`Status bot ${pos.pair} berhasil diubah.`);
                        }}
                        className="p-2 rounded-xl bg-slate-100 dark:bg-[#15202E] border border-slate-200 dark:border-[#1E2E44] text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition cursor-pointer active:scale-95"
                        title={pos.status === 'active' ? 'Pause Bot' : 'Resume Bot'}
                      >
                        {pos.status === 'active' ? <Pause className="w-4 h-4 text-amber-500" /> : <Play className="w-4 h-4 text-emerald-500" />}
                      </button>

                      <button
                        onClick={() => handleOpenSingleTpModal(pos)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 text-xs font-sans font-semibold transition flex items-center gap-1 cursor-pointer shadow-xs active:scale-95"
                        title="Eksekusi Force Take Profit & Order Jual Pasar"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span>Force TP</span>
                      </button>

                      {onDeleteBot && (
                        <button
                          type="button"
                          onClick={() => setBotToDelete(pos)}
                          className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/20 transition cursor-pointer active:scale-95"
                          title={`Hapus bot ${pos.pair}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Batch Control Footer Bar */}
          <div className="p-4 rounded-2xl bg-slate-100 dark:bg-[#070D17] border border-slate-200 dark:border-[#14233A] space-y-3 shadow-sm">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500 dark:text-slate-400">Batch Global Controls:</span>
              <span className="text-teal-600 dark:text-[#00F0C8] font-bold">
                {positions.length} Bots Connected to {wallet.connectedExchange?.exchange || 'Exchange'} {wallet.connectedExchange?.isSandbox ? '(Testnet)' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                onClick={handleTriggerBatchTp}
                className="py-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-mono font-bold hover:bg-emerald-500/25 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
              >
                <Sparkles className="w-4 h-4" />
                <span>Batch Force TP ({profitCount})</span>
              </button>

              <button
                onClick={handleTriggerBatchPause}
                className="py-2.5 rounded-xl bg-white dark:bg-[#0E1A2D] border border-slate-300 dark:border-[#1E3456] text-slate-800 dark:text-slate-300 text-xs font-mono font-semibold hover:text-slate-950 dark:hover:text-white transition flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98"
              >
                <Pause className="w-4 h-4" />
                <span>Pause All ({activeCount})</span>
              </button>

              {onDeleteAllStandbyBots && (
                <button
                  type="button"
                  onClick={() => setIsConfirmDeleteAllStandbyOpen(true)}
                  disabled={inactiveCount === 0}
                  className="py-2.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-mono font-bold hover:bg-red-500/25 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-98 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Hapus Standby ({inactiveCount})</span>
                </button>
              )}
            </div>
          </div>
        </>
      )}

      {/* Confirmation Modal: Single Coin Force Take Profit */}
      {selectedSingleTpPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white dark:bg-[#0A1220] border border-slate-200 dark:border-[#182B48] rounded-2xl p-5 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#162740] pb-3">
              <div className="flex items-center gap-2.5">
                <CoinLogo
                  coin={selectedSingleTpPos.pair}
                  className="w-9 h-9 rounded-xl border border-slate-200 dark:border-[#1E3558] bg-slate-100 dark:bg-[#0E1B30]"
                />
                <div>
                  <h3 className="text-sm font-bold tracking-wide flex items-center gap-1.5">
                    <span>Force Take Profit {selectedSingleTpPos.pair}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-bold">
                      +{selectedSingleTpPos.roiPct.toFixed(2)}%
                    </span>
                  </h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Eksekusi Order Jual Pasar & Kunci Keuntungan
                  </p>
                </div>
              </div>
              <button
                onClick={() => !isExecutingSingleTp && setSelectedSingleTpPos(null)}
                disabled={isExecutingSingleTp}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#0F1B2D] border border-slate-200 dark:border-[#1A2C46] flex items-center justify-center text-slate-500 hover:text-slate-950 dark:hover:text-white disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Exchange Connection Banner */}
            <div
              className={`p-3 rounded-xl border text-xs font-mono flex items-start gap-2.5 ${
                activeApiCreds && activeApiCreds.apiKey
                  ? 'bg-teal-500/10 border-teal-500/30 text-teal-900 dark:text-teal-200'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200'
              }`}
            >
              <Sparkles
                className={`w-4 h-4 shrink-0 mt-0.5 ${
                  activeApiCreds && activeApiCreds.apiKey
                    ? 'text-teal-600 dark:text-[#00F0C8]'
                    : 'text-amber-500'
                }`}
              />
              <div className="space-y-0.5 text-[11px]">
                {activeApiCreds && activeApiCreds.apiKey ? (
                  <>
                    <p className="font-bold">
                      Order Riil Exchanger Aktif ({activeApiCreds.exchange}{' '}
                      {activeApiCreds.isSandbox ? 'Testnet' : 'Live'})
                    </p>
                    <p className="opacity-90 leading-tight">
                      Sistem akan mengirimkan <strong className="text-emerald-600 dark:text-emerald-400">Market Sell Order</strong> langsung via CCXT ke akun exchanger Anda untuk melikuidasi aset koin ini.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-bold">Mode Simulasi Vault Internal</p>
                    <p className="opacity-90 leading-tight">
                      API Key belum tersambung di sesi ini. Take profit akan diselesaikan langsung ke saldo Vault GAIN.
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Financial Breakdown Card */}
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#152744] space-y-2 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Estimasi Kuantitas Dijual:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {selectedSingleTpPos.allocationQty || `${(parseFloat(selectedSingleTpPos.allocationUsdt.replace(/[^0-9.]/g, '')) / (selectedSingleTpPos.price || 1)).toFixed(4)} ${selectedSingleTpPos.coin}`}
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                <span>Harga Pasar Saat Ini:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  ${selectedSingleTpPos.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="border-t border-slate-200 dark:border-[#14233D] pt-2 flex items-center justify-between">
                <span className="text-slate-700 dark:text-slate-300">Total Floating Gross Profit:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
                  +{selectedSingleTpPos.floatingPnl.toFixed(2)} USDT
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                <span>Alokasi Net Trader (80%):</span>
                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                  +{(selectedSingleTpPos.floatingPnl * 0.8).toFixed(2)} USDT
                </span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[11px]">
                <span>Potongan Gas Tank (20%):</span>
                <span className="font-semibold text-amber-600 dark:text-amber-400">
                  -{(selectedSingleTpPos.floatingPnl * 0.2).toFixed(2)} USDT
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
              Setelah dieksekusi, keuntungan bersih langsung dicairkan ke saldo liquid Anda, kuota gas tank didebet, dan bot {selectedSingleTpPos.pair} akan memulai siklus layer baru.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={isExecutingSingleTp}
                onClick={() => setSelectedSingleTpPos(null)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#0E1A2C] border border-slate-300 dark:border-[#1E3456] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#152540] transition disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isExecutingSingleTp}
                onClick={handleConfirmSingleTp}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono transition shadow-lg flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                <DollarSign className={`w-3.5 h-3.5 ${isExecutingSingleTp ? 'animate-spin' : ''}`} />
                <span>
                  {isExecutingSingleTp ? 'Mengeksekusi Order...' : 'Konfirmasi Force TP'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Batch Force Take Profit */}
      {isConfirmBatchTpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white dark:bg-[#0A1220] border border-slate-200 dark:border-[#182B48] rounded-2xl p-5 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#162740] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Konfirmasi Batch Force TP</h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Eksekusi Take Profit Serentak</p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmBatchTpOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#0F1B2D] border border-slate-200 dark:border-[#1A2C46] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1.5 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span>Posisi Siap Take Profit:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">{profitCount} Pasang Koin</span>
              </div>
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span>Total Floating Profit:</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400">+{totalProfitUsdt.toFixed(2)} USDT</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px]">
                <span>Alokasi Net Trader (80%):</span>
                <span>+{(totalProfitUsdt * 0.8).toFixed(2)} USDT</span>
              </div>
              <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 text-[10px]">
                <span>Deduction Gas Tank (20%):</span>
                <span>-{(totalProfitUsdt * 0.2).toFixed(2)} USDT</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Tindakan ini akan langsung mengunci floating profit dari seluruh posisi yang sedang hijau, mengkreditkan saldo bersih ke vault, dan memulai siklus averaging baru.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setIsConfirmBatchTpOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#0E1A2C] border border-slate-300 dark:border-[#1E3456] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#152540] transition"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmBatchTp}
                className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold font-mono transition shadow-lg flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Eksekusi TP ({profitCount})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Batch Pause All */}
      {isConfirmBatchPauseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white dark:bg-[#0A1220] border border-slate-200 dark:border-[#182B48] rounded-2xl p-5 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#162740] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-500">
                  <Pause className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Konfirmasi Pause Seluruh Bot</h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">Standby Algorithmic Execution</p>
                </div>
              </div>
              <button
                onClick={() => setIsConfirmBatchPauseOpen(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#0F1B2D] border border-slate-200 dark:border-[#1A2C46] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-1 text-xs font-mono">
              <div className="flex items-center justify-between text-slate-700 dark:text-slate-300">
                <span>Bot Aktif yang Ditarget:</span>
                <span className="font-bold text-amber-600 dark:text-amber-400">{activeCount} Bot</span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Order averaging yang sedang menunggu trigger tidak akan dieksekusi selama bot berstatus PAUSED.
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              Apakah Anda yakin ingin menghentikan sementara seluruh bot trading aktif? Anda dapat melanjutkan kembali kapan saja dari tombol Play di kartu posisi masing-masing.
            </p>

            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={() => setIsConfirmBatchPauseOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-100 dark:bg-[#0E1A2C] border border-slate-300 dark:border-[#1E3456] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#152540] transition"
              >
                Batal
              </button>
              <button
                onClick={handleConfirmBatchPause}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold font-mono transition shadow-lg flex items-center justify-center gap-1.5"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pause Seluruh Bot</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Boundary Edit Modal (Pro Feature) */}
      {quickBoundaryEditPos && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white dark:bg-[#0A1220] border border-slate-200 dark:border-[#182B48] rounded-2xl p-5 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#162740] pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-[#00F0C8]">
                  <Sliders className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Edit Batas Harga Support &amp; Resistance</h3>
                  <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {quickBoundaryEditPos.pair} · Harga Live: ${typeof quickBoundaryEditPos.price === 'number' ? quickBoundaryEditPos.price.toFixed(4) : quickBoundaryEditPos.price}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickBoundaryEditPos(null)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#0F1B2D] border border-slate-200 dark:border-[#1A2C46] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-bold">
                  <ArrowDownRight className="w-3.5 h-3.5 text-rose-500 stroke-[2.5]" />
                  <span>Min Price (Batas Bawah Floor):</span>
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00000000 (Kosongkan jika tanpa batas)"
                  value={editMinPrice}
                  onChange={(e) => setEditMinPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#08101D] border border-slate-300 dark:border-[#1A2C46] text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-rose-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Jika harga koin menembus ke bawah angka ini, bot berhenti membeli (Stop Dip Buying).
                </span>
              </div>

              <div>
                <label className="text-[11px] text-slate-600 dark:text-slate-400 flex items-center gap-1.5 mb-1 font-bold">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500 stroke-[2.5]" />
                  <span>Max Price (Batas Atas Ceiling):</span>
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00000000 (Kosongkan jika tanpa batas)"
                  value={editMaxPrice}
                  onChange={(e) => setEditMaxPrice(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#08101D] border border-slate-300 dark:border-[#1A2C46] text-slate-900 dark:text-white font-mono text-xs focus:outline-none focus:border-emerald-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Jika harga koin menembus ke atas angka ini, bot dilarang beli di pucuk (Anti FOMO).
                </span>
              </div>

              {/* Quick Presets for Current Price */}
              {typeof quickBoundaryEditPos.price === 'number' && (
                <div className="flex items-center gap-1.5 pt-1 text-[10px]">
                  <span className="text-slate-500">Preset Cepat:</span>
                  <button
                    type="button"
                    onClick={() => {
                      const p = quickBoundaryEditPos.price as number;
                      setEditMinPrice((p * 0.85).toFixed(4));
                      setEditMaxPrice((p * 1.15).toFixed(4));
                    }}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#121E31] hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1B2F4C] cursor-pointer"
                  >
                    ±15% Range
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const p = quickBoundaryEditPos.price as number;
                      setEditMinPrice((p * 0.70).toFixed(4));
                      setEditMaxPrice((p * 1.30).toFixed(4));
                    }}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-[#121E31] hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#1B2F4C] cursor-pointer"
                  >
                    ±30% Range
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditMinPrice('');
                      setEditMaxPrice('');
                    }}
                    className="px-2 py-0.5 rounded text-rose-500 hover:underline cursor-pointer ml-auto"
                  >
                    Reset
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-[#162740]">
              <button
                type="button"
                onClick={() => setQuickBoundaryEditPos(null)}
                className="flex-1 py-2 rounded-xl bg-slate-100 dark:bg-[#0E1A2C] border border-slate-300 dark:border-[#1E3456] text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-[#152540] transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveQuickBoundary}
                className="flex-1 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 dark:bg-[#00F0C8] dark:hover:bg-[#00d8b4] text-white dark:text-slate-950 text-xs font-bold font-mono transition shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Simpan Batas</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Kamus Istilah Trading Pemula (Beginner Glossary Modal) */}
      {showGlossaryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-white dark:bg-[#0B1321] border border-slate-200 dark:border-[#1A2C46] rounded-2xl p-5 shadow-2xl space-y-4 text-slate-900 dark:text-white max-h-[90vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#162740] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-teal-500/15 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-[#00F0C8]">
                  <HelpCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">Kamus Istilah Trading Pemula</h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">Pahami konsep dasar GAIN tanpa rasa bingung</p>
                </div>
              </div>
              <button
                onClick={() => setShowGlossaryModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-[#0F1B2D] border border-slate-200 dark:border-[#1A2C46] flex items-center justify-center text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3.5 text-xs font-sans">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#14233A] space-y-1">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <span className="text-base">📈</span>
                  <span className="text-[12.5px]">Floating PnL (Keuntungan/Kerugian Berjalan)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
                  Nilai estimasi keuntungan yang <strong>belum direalisasikan</strong>. Jika warna merah saat pasar turun, jangan panik—itu adalah proses wajar di mana bot bersiap membeli di harga diskon agar saat harga naik sedikit saja, portofolio Anda langsung berubah hijau profit.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#14233A] space-y-1">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <span className="text-base">🕸️</span>
                  <span className="text-[12.5px]">Jaring Beli Bertahap (Layer Averaging)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
                  Alih-alih membeli seluruh modal sekaligus di satu harga, bot membagi modal menjadi tingkatan (layer). Setiap kali harga pasar turun beberapa persen, bot otomatis membelikan porsi kecil. Hasilnya: harga modal rata-rata (*Average Price*) Anda menjadi jauh lebih murah.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#14233A] space-y-1">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <span className="text-base">🎯</span>
                  <span className="text-[12.5px]">Trailing Take Profit (TP Callback)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
                  Sistem pengunci laba pintar. Ketika koin melonjak naik menembus target, bot <strong>tidak langsung menjual</strong> melainkan terus membiarkan keuntungan mengalir setinggi mungkin. Begitu harga mulai berbalik arah (misal turun 0.2%), bot langsung mengeksekusi jual untuk mengunci puncak keuntungan.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#14233A] space-y-1">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <span className="text-base">🛡️</span>
                  <span className="text-[12.5px]">Pagar Pengaman (Min &amp; Max Price)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
                  Pagar pembatas agar Anda tidak terjebak. <strong>Max Price</strong> melarang bot membeli saat koin berada di pucuk harga tertinggi (*Anti-FOMO*). <strong>Min Price</strong> melarang bot membeli jika koin anjlok menembus support kritis, menjaga modal tetap aman.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#14233A] space-y-1">
                <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
                  <span className="text-base">⛽</span>
                  <span className="text-[12.5px]">Dual Saldo &amp; Gas Fee GAIN (Bagi Hasil 20%)</span>
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
                  100% modal trading USDT dan koin Anda berada di akun exchange resmi Anda (Binance/Bybit) dan tidak bisa ditarik oleh siapapun. Saldo di aplikasi GAIN adalah <strong>Gas Fee</strong> (bahan bakar bagi hasil 20%). Saldo gas hanya berkurang jika Anda <strong>benar-benar menghasilkan profit</strong>. Jika belum untung, tidak ada potongan sepeser pun.
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 dark:border-[#162740]">
              <button
                type="button"
                onClick={() => setShowGlossaryModal(false)}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 dark:bg-[#00F0C8] dark:hover:bg-[#00d8b4] text-white dark:text-slate-950 font-bold text-xs transition cursor-pointer"
              >
                Saya Mengerti, Tutup Kamus
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete Single Bot */}
      {botToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white dark:bg-[#0A1220] border border-slate-200 dark:border-[#182B48] rounded-2xl p-5 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#162740] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">
                    Hapus Bot Trading
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    {botToDelete.pair} · {botToDelete.botName || (botToDelete.status === 'inactive' ? 'Standby' : 'Aktif')}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBotToDelete(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#132034] text-xs font-sans space-y-2">
              <p className="text-slate-700 dark:text-slate-300">
                Apakah Anda yakin ingin menghapus bot <strong className="text-slate-900 dark:text-white">{botToDelete.pair}</strong> ({botToDelete.botName || 'Bot Trading'})?
              </p>
              {botToDelete.status === 'inactive' ? (
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] font-mono">
                  ✓ Bot ini berstatus <strong>STANDBY</strong> (0 layer aktif). Menghapus bot ini aman dan tidak mempengaruhi modal floating.
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[11px] font-mono">
                  ⚠️ Perhatian: Bot ini sedang berstatus <strong>{botToDelete.statusLabel || 'AKTIF'}</strong>. Pastikan Anda telah mempertimbangkan posisi terbuka sebelum menghapus.
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#162740]">
              <button
                type="button"
                onClick={() => setBotToDelete(null)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#1E3456] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#121F35] text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteBot) {
                    onDeleteBot(botToDelete.id);
                    setToastMsg(`Bot ${botToDelete.pair} berhasil dihapus.`);
                    setToastType('success');
                    setTimeout(() => setToastMsg(''), 4000);
                  }
                  setBotToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Bot</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal: Delete All Standby Bots */}
      {isConfirmDeleteAllStandbyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-white dark:bg-[#0A1220] border border-slate-200 dark:border-[#182B48] rounded-2xl p-5 shadow-2xl space-y-4 text-slate-900 dark:text-white">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[#162740] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-500">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold tracking-wide">
                    Hapus Semua Bot Standby
                  </h3>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                    Total {inactiveCount} bot standby akan dibersihkan
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmDeleteAllStandbyOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#080E18] border border-slate-200 dark:border-[#132034] text-xs font-sans space-y-2">
              <p className="text-slate-700 dark:text-slate-300">
                Apakah Anda yakin ingin menghapus semua <strong className="text-red-500 dark:text-red-400 font-mono">{inactiveCount} bot</strong> yang sedang dalam status <strong className="text-slate-900 dark:text-white">STANDBY</strong>?
              </p>
              <p className="text-slate-500 dark:text-slate-400 text-[11px]">
                Bot yang aktif / sedang berjalan tidak akan terpengaruh. Bot standby akan dihapus sepenuhnya dari portofolio Anda.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#162740]">
              <button
                type="button"
                onClick={() => setIsConfirmDeleteAllStandbyOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-300 dark:border-[#1E3456] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#121F35] text-xs font-semibold transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteAllStandbyBots) {
                    onDeleteAllStandbyBots();
                    setToastMsg(`Seluruh ${inactiveCount} bot standby berhasil dihapus.`);
                    setToastType('success');
                    setTimeout(() => setToastMsg(''), 4000);
                  }
                  setIsConfirmDeleteAllStandbyOpen(false);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Ya, Hapus Semua ({inactiveCount})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Trade Detail Modal (Image 1 Feature) */}
      <TradeDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        position={selectedDetailPos}
        onForceTakeProfit={onForceTakeProfit}
        onCloseLayer={onCloseLayer}
      />
    </div>
  );
}

