import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { auth, signInWithGoogle, signOutUser, testFirestoreConnection } from '../firebase';
import { initUserProfile } from '../repositories/userRepository';
import { resolveCurrentUserRole } from '../utils/roles';
import { reportClientEvent } from '../services/observabilityService';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  loginWithGoogle: (registrationData?: { sponsorId?: string; sponsorName?: string; desiredUsername?: string }) => Promise<void>;
  loginDirectly: (email: string, registrationData?: { sponsorId?: string; sponsorName?: string; desiredUsername?: string }) => Promise<void>;
  logout: () => Promise<void>;
  isFirebaseConnected: boolean;
  isLoggingIn: boolean;
  isAdmin: boolean;
  isAuthModalOpen: boolean;
  setIsAuthModalOpen: (open: boolean) => void;
  authModalMode: 'login' | 'register';
  setAuthModalMode: (mode: 'login' | 'register') => void;
  pendingSponsorId: string;
  setPendingSponsorId: (id: string) => void;
  openLogin: () => void;
  openRegister: (sponsorId?: string) => void;
  is2faVerified: boolean;
  verify2faSession: () => void;
  sessionExpiredNotice: string | null;
  clearSessionExpiredNotice: () => void;
  sessionRemainingMs: number | null;
  authError: { code?: string; message: string } | null;
  clearAuthError: () => void;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  loading: true,
  loginWithGoogle: async () => {},
  loginDirectly: async () => {},
  logout: async () => {},
  isFirebaseConnected: false,
  isLoggingIn: false,
  isAdmin: false,
  isAuthModalOpen: false,
  setIsAuthModalOpen: () => {},
  authModalMode: 'login',
  setAuthModalMode: () => {},
  pendingSponsorId: '',
  setPendingSponsorId: () => {},
  openLogin: () => {},
  openRegister: () => {},
  is2faVerified: false,
  verify2faSession: () => {},
  sessionExpiredNotice: null,
  clearSessionExpiredNotice: () => {},
  sessionRemainingMs: null,
  authError: null,
  clearAuthError: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [pendingSponsorId, setPendingSponsorId] = useState('');
  const [is2faVerified, setIs2faVerified] = useState(false);
  const [sessionExpiredNotice, setSessionExpiredNotice] = useState<string | null>(null);
  const [authError, setAuthError] = useState<{ code?: string; message: string } | null>(null);
  const [sessionRemainingMs, setSessionRemainingMs] = useState<number | null>(SESSION_TTL_MS);

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      setIs2faVerified(false);
      setSessionExpiredNotice(null);
      setSessionRemainingMs(null);
      return;
    }

    const savedSessionAt = Number(localStorage.getItem('gain_session_timestamp') || '0');
    const elapsed = Date.now() - savedSessionAt;
    const remaining = Math.max(0, SESSION_TTL_MS - elapsed);

    setSessionRemainingMs(remaining);

    if (savedSessionAt > 0 && elapsed >= SESSION_TTL_MS) {
      setIs2faVerified(false);
      setSessionExpiredNotice('Sesi login Anda telah kedaluwarsa karena tidak aktif dalam 24 jam. Silakan login ulang.');
    } else if (savedSessionAt > 0) {
      setSessionExpiredNotice(null);
    }
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;

    const updateAdminStatus = async () => {
      if (!currentUser) {
        setIsAdmin(false);
        return;
      }

      try {
        const role = await resolveCurrentUserRole();
        if (!cancelled) {
          setIsAdmin(role === 'admin' || role === 'super_admin');
        }
      } catch {
        if (!cancelled) {
          setIsAdmin(false);
        }
      }
    };

    updateAdminStatus();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    // Restore a saved user session without treating the guest preview as an account.
    let activeUser: any = null;
    if (typeof window !== 'undefined') {
      const savedUserRaw = localStorage.getItem('gain_saved_user');
      if (savedUserRaw) {
        try {
          const parsed = JSON.parse(savedUserRaw);
          if (parsed?.uid) {
            activeUser = parsed;
          }
        } catch {}
      }
      if (activeUser?.uid === 'gain-usr-demo') {
        activeUser = null;
        localStorage.removeItem('gain_saved_user');
      }
      setCurrentUser(activeUser);
      if (activeUser) initUserProfile(activeUser).catch(() => {});
    }

    testFirestoreConnection()
      .then(() => setIsFirebaseConnected(true))
      .catch(() => setIsFirebaseConnected(false));

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userObj = {
          uid: user.uid,
          displayName: user.displayName,
        } as any;
        setCurrentUser(userObj);
        if (typeof window !== 'undefined') {
          localStorage.setItem('gain_saved_user', JSON.stringify(userObj));
          localStorage.setItem('gain_session_timestamp', String(Date.now()));
        }
        try {
          await initUserProfile(userObj);
        } catch (err) {
          console.error('Failed to initialize user in Firestore:', err);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async (registrationData?: { sponsorId?: string; sponsorName?: string; desiredUsername?: string }) => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const res = await signInWithGoogle();
      if (res.user) {
        const userObj = {
          uid: res.user.uid,
          displayName: res.user.displayName,
        } as any;
        setCurrentUser(userObj);
        if (typeof window !== 'undefined') {
          localStorage.setItem('gain_saved_user', JSON.stringify(userObj));
          localStorage.setItem('gain_session_timestamp', String(Date.now()));
        }
        await initUserProfile(res.user, registrationData);
        reportClientEvent('auth.login.success', { provider: 'google' });
      }
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : 'auth/error';
      console.error('[AUTH_LOGIN_FAILED]', { code });
      reportClientEvent('auth.login.failed', { provider: 'google', errorCode: code });
      setAuthError({ code, message: err?.message || 'Login Google gagal' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const loginDirectly = async (email: string, registrationData?: { sponsorId?: string; sponsorName?: string; desiredUsername?: string }) => {
    setIsLoggingIn(true);
    setAuthError(null);
    try {
      const dummyUser = {
        uid: `gain-usr-${email.replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)}`,
        displayName: registrationData?.desiredUsername || email.split('@')[0],
      } as any;
      setCurrentUser(dummyUser);
      if (typeof window !== 'undefined') {
        localStorage.setItem('gain_saved_user', JSON.stringify(dummyUser));
        localStorage.setItem('gain_session_timestamp', String(Date.now()));
      }
      await initUserProfile(dummyUser, registrationData);
    } catch (err: any) {
      reportClientEvent('auth.login.failed', { provider: 'direct-demo', errorCode: 'auth/direct-login-error' });
      setAuthError({ code: 'auth/direct-login-error', message: err?.message || 'Login langsung gagal' });
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = async () => {
    try {
      await signOutUser();
      reportClientEvent('auth.logout.success');
      if (typeof window !== 'undefined') {
        localStorage.removeItem('gain_saved_user');
        localStorage.removeItem('gain_session_timestamp');
        localStorage.removeItem('gain_active_api_creds');
        localStorage.removeItem('gain_active_api_creds_map');
        sessionStorage.removeItem('gain_active_api_creds');
      }
      setCurrentUser(null);
      setIs2faVerified(false);
    } catch (err: any) {
      const code = typeof err?.code === 'string' ? err.code : 'auth/logout-error';
      console.error('[AUTH_LOGOUT_FAILED]', { code });
      reportClientEvent('auth.logout.failed', { errorCode: code });
    }
  };

  const openLogin = () => {
    setAuthModalMode('login');
    setIsAuthModalOpen(true);
  };

  const openRegister = (sponsorId?: string) => {
    if (sponsorId) setPendingSponsorId(sponsorId);
    setAuthModalMode('register');
    setIsAuthModalOpen(true);
  };

  const verify2faSession = () => {
    setIs2faVerified(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('gain_session_timestamp', String(Date.now()));
    }
  };

  const clearSessionExpiredNotice = () => {
    setSessionExpiredNotice(null);
  };

  const clearAuthError = () => {
    setAuthError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        loginWithGoogle,
        loginDirectly,
        logout,
        isFirebaseConnected,
        isLoggingIn,
        isAdmin,
        isAuthModalOpen,
        setIsAuthModalOpen,
        authModalMode,
        setAuthModalMode,
        pendingSponsorId,
        setPendingSponsorId,
        openLogin,
        openRegister,
        is2faVerified,
        verify2faSession,
        sessionExpiredNotice,
        clearSessionExpiredNotice,
        sessionRemainingMs,
        authError,
        clearAuthError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
