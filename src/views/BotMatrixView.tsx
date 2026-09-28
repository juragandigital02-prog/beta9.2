import { useState } from 'react';
import { BotMode } from '../types';
import { CoinLogo } from '../components/common/CoinLogo';
import { SUPPORTED_COINS } from '../data/mockData';
import {
  Sliders,
  Cpu,
  Zap,
  ShieldCheck,
  Play,
  Sparkles,
  Layers,
  ChevronRight,
  ArrowDownRight,
  Split,
  Maximize2,
  TrendingUp,
  Settings2,
  Coins,
  Check,
  Bot
} from 'lucide-react';

interface BotMatrixViewProps {
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
  onOpenSimulation: () => void;
  onDeployBotToExchange?: (pair: string) => Promise<{ success: boolean; orderId?: string; message?: string; error?: string }>;
  connectedExchangeName?: string;
  isSandbox?: boolean;
  isAccountActive?: boolean;
  onOpenActivationModal?: () => void;
  gasReserve?: number;
  onOpenGas?: () => void;
}

export function BotMatrixView({
  onOpenMatrixModal,
  onOpenSimulation,
  onDeployBotToExchange,
  connectedExchangeName = 'Binance',
  isSandbox = true,
}: BotMatrixViewProps) {
  const [activeModeFilter, setActiveModeFilter] = useState<'all' | BotMode>('all');
  const [deployingPair, setDeployingPair] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // 1. Bot Settings First
  const [customBotName, setCustomBotName] = useState('GAIN Matrix Hybrid Pro #1');
  const [customMode, setCustomMode] = useState<BotMode>('Avarage+Grid');
  const [customLayers, setCustomLayers] = useState<number>(20);

  // 2. Select Paired Coins Second
  const [pairedCoins, setPairedCoins] = useState<string[]>(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleToggleCoin = (pairToToggle: string) => {
    setPairedCoins((prev) => {
      if (prev.includes(pairToToggle)) {
        if (prev.length <= 1) return prev; // keep at least 1
        return prev.filter((p) => p !== pairToToggle);
      } else {
        return [...prev, pairToToggle];
      }
    });
  };

  const handleSelectAllCoins = () => {
    setPairedCoins(SUPPORTED_COINS.map((c) => c.pair));
  };

  const handleSelectTop3 = () => {
    setPairedCoins(['BTC/USDT', 'ETH/USDT', 'SOL/USDT']);
  };

  const handleResetCoins = () => {
    setPairedCoins(['BTC/USDT']);
  };

  const strategies = [
    {
      id: 'martingale_hybrid',
      name: 'Matrix Hybrid Pro v2.4 (120 Layer)',
      botMode: 'Avarage+Grid' as BotMode,
      defaultLayers: 120,
      badge: '20L AVG + 100L GRID',
      badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-[#00F0C8] border-teal-500/30',
      description: 'Dual Engine: 20 Layer Averaging (Rebound Callback & Trailing TP) + 100 Layer Grid (Uptrend & Osilasi TP). Total 120 Layer.',
      dipCoverage: '-85.4% Safety',
      pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
      winRate: '99.6%',
    },
    {
      id: 'avarage_dca',
      name: 'Dynamic DCA Reversal (20 Layer)',
      botMode: 'Avarage Only' as BotMode,
      defaultLayers: 20,
      badge: 'AVERAGER 20L',
      badgeColor: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      description: 'Averager Institusional (1-20 Layer). Filter Uptrend Bullish, Whole TP, Trailing TP Callback, serta Callback Rebound Tiap Layer.',
      dipCoverage: '-78.0% Safety',
      pairs: ['SOL/USDT', 'BNB/USDT', 'ETH/USDT'],
      winRate: '99.1%',
    },
    {
      id: 'grid_scalp',
      name: 'High-Frequency Grid (100 Layer)',
      botMode: 'Grid Only' as BotMode,
      defaultLayers: 100,
      badge: 'GRID 100L',
      badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
      description: 'Grid Scalper hingga 100 Layer. Filter Uptrend aktif dengan Take Profit osilasi mandiri per level tanpa batas.',
      dipCoverage: '-65.0% Safety',
      pairs: ['DOGE/USDT', 'XRP/USDT', 'BTC/USDT'],
      winRate: '98.5%',
    },
    {
      id: 'subgrid_smart',
      name: 'Smart Sub-Grid Averaging (50 Layer)',
      botMode: 'Avarage+Grid' as BotMode,
      defaultLayers: 50,
      badge: 'DUAL ENGINE',
      badgeColor: 'bg-teal-500/10 text-teal-600 dark:text-[#00F0C8] border-teal-500/30',
      description: 'Arsitektur dual-engine. 15 Layer Averaging safety DCA + 35 Layer sub-grid pembagi modal untuk floating drawdown minimal.',
      dipCoverage: '-74.5% Safety',
      pairs: ['BTC/USDT', 'ETH/USDT'],
      winRate: '99.1%',
    },
    {
      id: 'dip_hunter_avg',
      name: 'Black Swan Dip Hunter (20 Layer)',
      botMode: 'Avarage Only' as BotMode,
      defaultLayers: 20,
      badge: 'EXTREME DIP 20L',
      badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30',
      description: 'Menyerap market crash dengan 20 layer safety averaging, konfirmasi rebound callback tiap layer, dan trailing take profit.',
      dipCoverage: '-92.0% Safety',
      pairs: ['BNB/USDT', 'XRP/USDT', 'SUI/USDT'],
      winRate: '99.3%',
    },
    {
      id: 'infinity_grid',
      name: 'Infinity 100-Layer Volatility Grid',
      botMode: 'Grid Only' as BotMode,
      defaultLayers: 100,
      badge: 'INFINITY 100L',
      badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/30',
      description: 'Scalper grid rapat 100 layer dengan filter konfirmasi uptrend dan TP per osilasi 1.2% bertubi-tubi.',
      dipCoverage: '-70.0% Safety',
      pairs: ['HYPE/USDT', 'SOL/USDT'],
      winRate: '98.2%',
    },
  ];

  const filteredStrategies = strategies.filter((s) => {
    if (activeModeFilter === 'all') return true;
    return s.botMode === activeModeFilter;
  });

  return (
    <div className="space-y-4 pb-20">
      {/* View Header */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-100 via-white to-slate-100 dark:from-[#0C172A] dark:via-[#091222] dark:to-[#060B14] border border-slate-200 dark:border-[#162740] shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-teal-600 dark:text-[#00F0C8]" />
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">
                Bot Matrix & Algorithm Studio
              </h2>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
              1 Bot Bisa Banyak Koin • Setting Bot Terlebih Dahulu Baru Pilih Koin Pairing
            </p>
          </div>
          <button
            onClick={onOpenSimulation}
            className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 dark:bg-[#00F0C8] dark:hover:bg-[#00d8b4] text-slate-950 text-xs font-mono font-bold glow-cyan-btn transition flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Play className="w-3.5 h-3.5 fill-current" />
            <span>Stress Test</span>
          </button>
        </div>
      </div>

      {/* Quick Custom Bot Builder Panel: BOT SETTINGS FIRST, THEN COIN PAIRING */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#080F1C] border border-slate-200 dark:border-[#17273F] shadow-sm space-y-4">
        
        {/* Panel Header */}
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-[#132339] pb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-xl bg-teal-500/10 text-teal-600 dark:text-[#00F0C8] flex items-center justify-center">
              <Settings2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-xs font-bold font-mono text-slate-900 dark:text-white uppercase tracking-wider block">
                Konfigurator Bot Multi-Koin
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                Atur formula bot di sini, lalu pilih koin-koin yang akan dipairing
              </span>
            </div>
          </div>
          <span className="text-xs font-mono text-teal-600 dark:text-[#00F0C8] font-bold px-2 py-0.5 rounded-lg bg-teal-500/10 border border-teal-500/20">
            {pairedCoins.length} Koin Terpilih
          </span>
        </div>

        {/* STEP 1: SETTING BOT DULU */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070D18] border border-slate-200 dark:border-[#14233A] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-teal-500 text-slate-950 font-bold text-xs flex items-center justify-center">
                1
              </span>
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Setting Bot Terlebih Dahulu
              </span>
            </div>
            <span className="text-[10px] font-mono text-teal-600 dark:text-[#00F0C8]">
              {customMode} • {customLayers} Layer
            </span>
          </div>

          {/* Bot Name Input */}
          <div>
            <label className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block mb-1">
              Nama Bot Trading:
            </label>
            <input
              type="text"
              value={customBotName}
              onChange={(e) => setCustomBotName(e.target.value)}
              placeholder="Contoh: GAIN Matrix Scalper #1"
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0C1525] border border-slate-300 dark:border-[#1A2E4C] text-slate-900 dark:text-white font-mono text-xs font-bold focus:outline-none focus:border-teal-500"
            />
          </div>

          {/* Bot Mode & Layer Slider */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            {/* Mode Select */}
            <div>
              <label className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400 block mb-1">
                Pilih Mode Bot:
              </label>
              <div className="grid grid-cols-3 gap-1">
                {(['Avarage Only', 'Grid Only', 'Avarage+Grid'] as BotMode[]).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setCustomMode(mode);
                      if (mode === 'Avarage Only' && customLayers > 20) {
                        setCustomLayers(20);
                      } else if (mode === 'Grid Only' && customLayers > 100) {
                        setCustomLayers(100);
                      } else if (mode === 'Avarage+Grid' && customLayers < 20) {
                        setCustomLayers(120);
                      }
                    }}
                    className={`py-1.5 px-1 rounded-lg text-[10px] font-mono font-bold transition text-center cursor-pointer border ${
                      customMode === mode
                        ? mode === 'Avarage Only'
                          ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                          : mode === 'Grid Only'
                          ? 'bg-cyan-500 text-white border-cyan-500 shadow-sm'
                          : 'bg-teal-600 text-white dark:bg-[#00F0C8] dark:text-slate-950 border-teal-600 dark:border-[#00F0C8] shadow-sm'
                        : 'bg-white dark:bg-[#0C1525] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-[#162740] hover:bg-slate-100 dark:hover:bg-[#121E33]'
                    }`}
                  >
                    {mode === 'Avarage Only' ? 'Averager (20L)' : mode === 'Grid Only' ? 'Grid (100L)' : 'Avg+Grid (120L)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Layer Slider */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] uppercase font-mono text-slate-500 dark:text-slate-400">
                  Jumlah Layer:
                </label>
                <span className="text-xs font-mono font-bold text-teal-600 dark:text-[#00F0C8]">
                  {customLayers} Layer
                </span>
              </div>
              <input
                type="range"
                min="1"
                max={customMode === 'Avarage Only' ? 20 : customMode === 'Grid Only' ? 100 : 120}
                step="1"
                value={customLayers}
                onChange={(e) => setCustomLayers(parseInt(e.target.value))}
                className="w-full accent-teal-600 dark:accent-[#00F0C8] cursor-pointer h-2 bg-slate-200 dark:bg-[#14233A] rounded-lg mt-2"
              />
            </div>
          </div>
        </div>

        {/* STEP 2: BARU PILIH KOIN APA SAJA YG MAU DIPAIRING DI BOT TERSEBUT */}
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#070D18] border-2 border-teal-500/30 dark:border-teal-500/20 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-teal-500 text-slate-950 font-bold text-xs flex items-center justify-center">
                2
              </span>
              <div>
                <span className="text-xs font-mono font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
                  Pilih Koin Yang Mau Dipairing di Bot Tersebut
                </span>
                <span className="text-[10px] font-mono text-slate-500">
                  Bot di atas akan diterapkan ke seluruh koin yang Anda centang
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1 text-[10px] font-mono">
              <button
                type="button"
                onClick={handleSelectAllCoins}
                className="px-2 py-1 rounded bg-teal-500/10 text-teal-700 dark:text-[#00F0C8] font-bold border border-teal-500/30 hover:bg-teal-500/20 cursor-pointer"
              >
                Pilih Semua (12)
              </button>
              <button
                type="button"
                onClick={handleSelectTop3}
                className="px-2 py-1 rounded bg-white dark:bg-[#0E1A2D] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#172740] hover:text-white cursor-pointer"
              >
                Top 3
              </button>
              <button
                type="button"
                onClick={handleResetCoins}
                className="px-2 py-1 rounded text-slate-400 hover:text-white cursor-pointer"
              >
                Reset
              </button>
            </div>
          </div>

          {/* 12 Official Coins Visual Checklist */}
          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
            {SUPPORTED_COINS.map((c) => {
              const isChecked = pairedCoins.includes(c.pair);
              return (
                <button
                  key={c.pair}
                  type="button"
                  onClick={() => handleToggleCoin(c.pair)}
                  className={`flex items-center justify-between p-2 rounded-xl border transition-all cursor-pointer text-left ${
                    isChecked
                      ? 'bg-teal-500/15 dark:bg-teal-500/25 border-teal-500 text-slate-900 dark:text-white font-bold shadow-xs'
                      : 'bg-white dark:bg-[#0A1322] border-slate-200 dark:border-[#14243C] text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-[#1C3252]'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <CoinLogo coin={c.coin} size="xs" />
                    <div className="min-w-0">
                      <span className="text-[11px] font-mono leading-none block font-bold truncate">{c.coin}</span>
                      <span className="text-[9px] font-mono text-slate-400 block truncate">
                        ${c.price >= 1000 ? c.price.toLocaleString() : c.price.toFixed(2)}
                      </span>
                    </div>
                  </div>

                  <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border ${
                    isChecked
                      ? 'bg-teal-500 border-teal-500 text-slate-950 font-bold'
                      : 'border-slate-300 dark:border-[#1C3252]'
                  }`}>
                    {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Paired Coins Chips */}
          <div className="flex items-center justify-between flex-wrap gap-1 pt-1 border-t border-slate-200/50 dark:border-[#121E31] text-[11px] font-mono">
            <span className="text-slate-500">Koin Terpairing:</span>
            <div className="flex flex-wrap gap-1">
              {pairedCoins.map((pair) => (
                <span
                  key={pair}
                  className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/10 text-teal-700 dark:text-[#00F0C8] border border-teal-500/20"
                >
                  {pair.replace('/USDT', '')}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* STEP 3: Action Button to Open Matrix with Custom Settings */}
        <div className="pt-1">
          <button
            onClick={() => onOpenMatrixModal(pairedCoins[0] || 'BTC/USDT', customMode, customLayers, null, customBotName, true, null, null, pairedCoins)}
            className="w-full py-3 px-3 rounded-xl bg-teal-500 hover:bg-teal-400 dark:bg-[#00F0C8] dark:hover:bg-[#00d8b4] text-slate-950 font-bold text-xs font-mono glow-cyan-btn transition flex items-center justify-center gap-2 cursor-pointer shadow-md active:scale-98"
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>
              Buka Formula Matrix & Pairing ke {pairedCoins.length} Koin Terpilih →
            </span>
          </button>
        </div>
      </div>

      {/* Mode Filter Tabs for Strategy Cards */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1">
        <span className="text-[11px] font-mono text-slate-700 dark:text-slate-400 font-bold whitespace-nowrap">
          Filter Strategi:
        </span>
        <div className="flex items-center gap-1.5 flex-nowrap bg-slate-100 dark:bg-[#070D18] p-1 rounded-2xl border border-slate-200 dark:border-[#14233A]">
          <button
            onClick={() => setActiveModeFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer ${
              activeModeFilter === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-950 font-bold shadow-sm'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-white/60 dark:hover:bg-[#0E1B2E]'
            }`}
          >
            Semua ({strategies.length})
          </button>
          <button
            onClick={() => setActiveModeFilter('Avarage Only')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer flex items-center gap-1 ${
              activeModeFilter === 'Avarage Only'
                ? 'bg-amber-500 text-white font-bold shadow-sm'
                : 'text-amber-700 dark:text-amber-400 hover:bg-amber-500/10'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5" />
            <span>Avarage Only</span>
          </button>
          <button
            onClick={() => setActiveModeFilter('Grid Only')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer flex items-center gap-1 ${
              activeModeFilter === 'Grid Only'
                ? 'bg-cyan-600 text-white font-bold shadow-sm'
                : 'text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/10'
            }`}
          >
            <Split className="w-3.5 h-3.5" />
            <span>Grid Only</span>
          </button>
          <button
            onClick={() => setActiveModeFilter('Avarage+Grid')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition cursor-pointer flex items-center gap-1 ${
              activeModeFilter === 'Avarage+Grid'
                ? 'bg-teal-600 text-white dark:bg-[#00F0C8] dark:text-slate-950 font-bold shadow-sm'
                : 'text-teal-700 dark:text-[#00F0C8] hover:bg-teal-500/10'
            }`}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Avarage+Grid</span>
          </button>
        </div>
      </div>

      {/* Strategies List */}
      <div className="space-y-3">
        {filteredStrategies.map((strat) => (
          <div
            key={strat.id}
            className="p-4 rounded-2xl bg-white dark:bg-[#08101D] border border-slate-200 dark:border-[#14233A] hover:border-slate-300 dark:hover:border-[#1E3456] shadow-sm transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-sm text-slate-900 dark:text-white font-sans">{strat.name}</h3>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${strat.badgeColor} font-bold`}>
                    {strat.badge}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-100 dark:bg-[#0F1C30] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#182840]">
                    Default: {strat.defaultLayers} Layer
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{strat.description}</p>
              </div>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-[#121E31] text-xs font-mono">
              <div>
                <span className="text-[10px] text-slate-500 uppercase block">Dip Coverage</span>
                <span className="text-teal-600 dark:text-[#00F0C8] font-bold block mt-0.5">{strat.dipCoverage}</span>
              </div>
              <div className="text-center">
                <span className="text-[10px] text-slate-500 uppercase block">Mode Strategi</span>
                <span className="text-slate-800 dark:text-slate-200 font-bold block mt-0.5">{strat.botMode}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-slate-500 uppercase block">Koin Pairing ({strat.pairs.length})</span>
                <div className="flex items-center justify-end gap-1.5 mt-1 flex-wrap">
                  {strat.pairs.map((p) => (
                    <span
                      key={p}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#0E1A2C] border border-slate-200 dark:border-[#172740] text-[10px] text-slate-700 dark:text-slate-300 font-mono"
                    >
                      <CoinLogo coin={p} size="xs" />
                      <span>{p.split('/')[0]}</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch / Config Buttons */}
            <div className="flex items-center justify-between mt-3 pt-2 gap-2 flex-wrap">
              <button
                onClick={() => onOpenMatrixModal(strat.pairs[0], strat.botMode, strat.defaultLayers, null, strat.name, true, null, null, strat.pairs)}
                className="px-3 py-1.5 rounded-lg bg-teal-500/10 border border-teal-500/30 text-teal-700 dark:text-[#00F0C8] hover:bg-teal-500/20 transition text-xs font-mono font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Setting Bot & Pairing Koin ({strat.pairs.length} Koin)</span>
              </button>

              <div className="flex items-center gap-2">
                {onDeployBotToExchange && (
                  <button
                    disabled={deployingPair === strat.pairs[0]}
                    onClick={async () => {
                      const pair = strat.pairs[0];
                      setDeployingPair(pair);
                      showToast(`Menginisialisasi & mengeksekusi ${strat.name} [${strat.botMode}] di ${connectedExchangeName} ${isSandbox ? '(Testnet)' : ''}...`);
                      const res = await onDeployBotToExchange(pair);
                      setDeployingPair(null);
                      if (res.success) {
                        showToast(`✅ Bot Aktif! Order Step 1 Terkirim (${res.orderId || 'SUCCESS'})`);
                      } else {
                        showToast(`❌ Gagal: ${res.error}`);
                      }
                    }}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 dark:bg-[#00F0C8] dark:hover:bg-[#00d8b4] text-slate-950 font-bold text-xs font-mono glow-cyan-btn transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-sm"
                  >
                    <Zap className={`w-3.5 h-3.5 fill-current ${deployingPair === strat.pairs[0] ? 'animate-spin' : ''}`} />
                    <span>
                      {deployingPair === strat.pairs[0] ? 'Deploying...' : `Jalankan di ${connectedExchangeName} ${isSandbox ? 'Testnet' : ''}`}
                    </span>
                  </button>
                )}

                <button
                  onClick={onOpenSimulation}
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-mono flex items-center gap-1 cursor-pointer"
                >
                  <span>Simulasi</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-white dark:bg-[#091526] border border-teal-500/40 shadow-2xl text-xs font-mono text-teal-700 dark:text-[#00F0C8] flex items-center gap-2 max-w-sm text-center">
          <Sparkles className="w-4 h-4 text-teal-600 dark:text-[#00F0C8] shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
