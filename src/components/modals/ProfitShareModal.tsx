import { X } from 'lucide-react';

interface ProfitShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  [key: string]: any;
}

export function ProfitShareModal({ isOpen, onClose }: ProfitShareModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0E1A2D] rounded-2xl p-6 w-full max-w-md mx-4 border border-slate-200 dark:border-[#172740]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Profit Share</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Fitur Profit Share akan segera hadir. Bagi hasil trading otomatis dari jaringan referral Anda.
        </p>
      </div>
    </div>
  );
}
