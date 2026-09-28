import React, { useState, useEffect } from 'react';
import { MailCheck, Mail, AlertCircle, ArrowRight, LogOut, CheckCircle2 } from 'lucide-react';
import { requestEmailVerificationCode, verifyEmailCode } from '../../services/authService';

interface GmailVerificationModalProps {
  isOpen: boolean;
  userEmail: string;
  userName?: string;
  onVerificationSuccess: () => Promise<void> | void;
  onCancel: () => Promise<void> | void;
}

export function GmailVerificationModal({
  isOpen,
  userEmail,
  userName,
  onVerificationSuccess,
  onCancel,
}: GmailVerificationModalProps) {
  const [code, setCode] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  if (!isOpen) return null;

  const handleResend = async () => {
    if (isSending || countdown > 0) return;
    setErrorMsg('');
    setIsSending(true);
    try {
      await requestEmailVerificationCode();
      setCountdown(60);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mengirim kode verifikasi.');
    } finally {
      setIsSending(false);
    }
  };

  const handleVerify = async () => {
    setErrorMsg('');
    const clean = code.trim();
    if (clean.length !== 6 || !/^\d{6}$/.test(clean)) {
      setErrorMsg('Masukkan 6 digit angka kode verifikasi dari email.');
      return;
    }

    setIsVerifying(true);
    try {
      await verifyEmailCode(clean);
      await onVerificationSuccess();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Verifikasi gagal');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="theme-modal-shell w-full max-w-md bg-[#0F172A] border border-cyan-500/30 rounded-3xl overflow-hidden shadow-2xl">
        <div className="p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <MailCheck className="w-7 h-7" />
          </div>

          <div>
            <h2 className="text-lg font-bold text-white font-mono">Verifikasi Email Anda</h2>
            <p className="text-xs text-slate-400 font-sans mt-1">
              Untuk mengamankan akun GAIN Anda, masukkan kode 6 digit yang dikirimkan ke:
            </p>
            <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-xs">
              <Mail className="w-3.5 h-3.5" />
              <span>{userEmail}</span>
            </div>
          </div>

          <div className="space-y-3 pt-2">
            <input
              type="text"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
              onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
              autoFocus
              className="w-full text-center tracking-[0.5em] text-2xl font-bold py-3 bg-slate-950 border border-slate-700 rounded-2xl text-white focus:outline-hidden focus:border-cyan-400 font-mono"
            />

            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-center gap-2 font-sans">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button
              onClick={handleVerify}
              disabled={isVerifying || code.length !== 6}
              className="w-full py-3 rounded-2xl text-xs font-bold font-mono bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 hover:from-cyan-400 hover:to-teal-400 transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              <span>{isVerifying ? 'Memverifikasi...' : 'Verifikasi & Selesai'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-xs font-mono pt-3 border-t border-slate-800/80">
            <button
              onClick={handleResend}
              disabled={isSending || countdown > 0}
              className="text-slate-400 hover:text-cyan-400 disabled:opacity-50 cursor-pointer transition"
            >
              {isSending ? 'Mengirim kode...' : countdown > 0 ? `Kirim ulang (${countdown}s)` : 'Kirim Kode ke Gmail'}
            </button>

            <button
              onClick={onCancel}
              className="text-rose-400 hover:text-rose-300 flex items-center gap-1 cursor-pointer transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Batal</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
