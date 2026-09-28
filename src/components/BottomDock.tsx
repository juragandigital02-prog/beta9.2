import { NavigationRoute } from '../types';
import { Home, Wallet, Bot, LineChart, User } from 'lucide-react';

interface BottomDockProps {
  currentRoute: NavigationRoute;
  onRouteChange: (route: NavigationRoute) => void;
  activePositionsCount?: number;
}

export function BottomDock({ currentRoute, onRouteChange, activePositionsCount = 6 }: BottomDockProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#070C15]/95 border-t border-slate-200 dark:border-[#121E31] backdrop-blur-lg px-2 sm:px-6 py-2 shadow-[0_-4px_16px_rgba(15,23,42,0.06)] dark:shadow-none">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {/* Home */}
        <button
          onClick={() => onRouteChange('home')}
          className={`flex-1 flex flex-col items-center py-1 transition-all ${
            currentRoute === 'home' ? 'text-teal-600 dark:text-[#00F0C8] font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Home className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-medium tracking-wide">Home</span>
          {currentRoute === 'home' && <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-[#00F0C8] mt-0.5"></span>}
        </button>

        {/* Wallet */}
        <button
          onClick={() => onRouteChange('wallet')}
          className={`flex-1 flex flex-col items-center py-1 transition-all relative ${
            currentRoute === 'wallet' ? 'text-teal-600 dark:text-[#00F0C8] font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <Wallet className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-medium tracking-wide">Wallet</span>
          {currentRoute === 'wallet' && <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-[#00F0C8] mt-0.5"></span>}
        </button>

        {/* Center: Bot Matrix */}
        <div className="flex-1 flex flex-col items-center">
          <button
            onClick={() => onRouteChange('bot')}
            className={`w-12 h-12 -mt-5 rounded-2xl flex items-center justify-center transition-transform active:scale-95 shadow-xl cursor-pointer ${
              currentRoute === 'bot'
                ? 'bg-[#00F0C8] text-slate-950 shadow-[0_0_25px_rgba(0,240,200,0.6)] font-bold'
                : 'bg-white dark:bg-[#0E1A2D] text-teal-600 dark:text-[#00F0C8] border border-teal-500/40 dark:border-[#00F0C8]/40 hover:border-teal-500 shadow-md'
            }`}
            title="Bot Matrix Strategy"
          >
            <Bot className="w-6 h-6" />
          </button>
          <span className={`text-[10px] font-semibold mt-1 ${currentRoute === 'bot' ? 'text-teal-600 dark:text-[#00F0C8]' : 'text-slate-500 dark:text-slate-400'}`}>
            Bot Matrix
          </span>
        </div>

        {/* Trading (Posisi Trading Aktif) */}
        <button
          onClick={() => onRouteChange('trading')}
          className={`flex-1 flex flex-col items-center py-1 transition-all relative ${
            currentRoute === 'trading' ? 'text-teal-600 dark:text-[#00F0C8] font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <div className="relative">
            <LineChart className="w-5 h-5 mb-1" />
            {activePositionsCount > 0 && (
              <span className="absolute -top-1 -right-2 px-1.5 py-0.2 bg-[#00F0C8] text-slate-950 font-bold text-[9px] rounded-full">
                {activePositionsCount}
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium tracking-wide">Trading</span>
          {currentRoute === 'trading' && <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-[#00F0C8] mt-0.5"></span>}
        </button>

        {/* Akun */}
        <button
          onClick={() => onRouteChange('akun')}
          className={`flex-1 flex flex-col items-center py-1 transition-all ${
            currentRoute === 'akun' ? 'text-teal-600 dark:text-[#00F0C8] font-bold' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
          }`}
        >
          <User className="w-5 h-5 mb-1" />
          <span className="text-[11px] font-medium tracking-wide">Akun</span>
          {currentRoute === 'akun' && <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-[#00F0C8] mt-0.5"></span>}
        </button>
      </div>
    </nav>
  );
}
