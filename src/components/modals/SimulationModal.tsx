import { X } from 'lucide-react';

interface SimulationModalProps {
  isOpen: boolean;
  onClose: () => void;
  [key: string]: any;
}

export function SimulationModal({ isOpen, onClose }: SimulationModalProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white dark:bg-[#0E1A2D] rounded-2xl p-6 w-full max-w-md mx-4 border border-slate-200 dark:border-[#172740]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Simulasi Trading</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Fitur Simulasi Trading akan segera hadir. Uji strategi averaging & grid bot tanpa risiko modal.
        </p>
      </div>
    </div>
  );
}
