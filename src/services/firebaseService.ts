import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  getDocs,
  query,
  orderBy,
  documentId,
  limit,
  startAfter,
  type DocumentData,
  type Query,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../firebase';
import { UserWallet, TradingPosition, TransactionRecord, TradeRecord } from '../types';
import { initialWallet, initialPositions, initialTransactions } from '../data/mockData';
import { isValidMemberId, registerMemberInDirectory, reserveMemberId } from './memberService';
import { generateDedicatedBEP20Address } from './walletGeneratorService';
import { validateFinancialAction } from '../utils/serverValidation';

export type FirestorePageCursor = QueryDocumentSnapshot<DocumentData>;

export interface FirestorePage<T> {
  items: T[];
  cursor: FirestorePageCursor | null;
  hasMore: boolean;
}

export const FIRESTORE_HISTORY_PAGE_SIZE = 50;

const FIRESTORE_MAINTENANCE_PAGE_SIZE = 100;

function omitUndefinedFields<T extends Record<string, unknown>>(record: T): T {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => value !== undefined)
  ) as T;
}

async function requireMemberId(userId: string): Promise<string> {
  if (typeof window !== 'undefined') {
    try {
      const wallet = JSON.parse(localStorage.getItem(`gain_wallet_${userId}`) || 'null') as UserWallet | null;
      if (isValidMemberId(wallet?.memberId)) return wallet.memberId;
    } catch {
      // Fall through to the Firestore profile.
    }
  }

  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    return '';
  }
  const profile = await getDoc(doc(db, 'users', userId));
  const memberId = profile.data()?.memberId;
  if (!isValidMemberId(memberId)) throw new Error('Member ID akun belum tersedia.');
  return memberId;
}

function isClientLedgerWriteAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname;
  return import.meta.env.DEV || host === 'localhost' || host === '127.0.0.1';
}

async function loadAllUserPositionDocuments(userId: string): Promise<QueryDocumentSnapshot<DocumentData>[]> {
  const positionsRef = collection(db, 'users', userId, 'positions');
  const documents: QueryDocumentSnapshot<DocumentData>[] = [];
  let cursor: QueryDocumentSnapshot<DocumentData> | null = null;

  while (true) {
    const positionsQuery: Query<DocumentData> = cursor
      ? query(positionsRef, orderBy(documentId()), startAfter(cursor), limit(FIRESTORE_MAINTENANCE_PAGE_SIZE))
      : query(positionsRef, orderBy(documentId()), limit(FIRESTORE_MAINTENANCE_PAGE_SIZE));
    const snapshot = await getDocs(positionsQuery);
    documents.push(...snapshot.docs);
    if (snapshot.size < FIRESTORE_MAINTENANCE_PAGE_SIZE) return documents;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }
}

export async function initUserProfile(
  user: { uid: string; displayName?: string | null; email?: string | null; emailVerified?: boolean },
  registrationData?: { sponsorId?: string; sponsorName?: string; desiredUsername?: string }
) {
  const googleEmail = user.email || 'user@gainkoin.io';
  const isAdminUser = false;
  const googleName = registrationData?.desiredUsername || user.displayName || googleEmail.split('@')[0] || 'Member GAIN';
  const userRef = doc(db, 'users', user.uid);
  const profileSnap = auth.currentUser ? await getDoc(userRef) : null;
  const existingProfile = profileSnap?.exists() ? profileSnap.data() : null;
  const cleanMemberId = isValidMemberId(existingProfile?.memberId)
    ? existingProfile.memberId
    : auth.currentUser
      ? await reserveMemberId(user.uid)
      : initialWallet.memberId;
  const sponsorId = registrationData?.sponsorId || '';
  const sponsorName = registrationData?.sponsorName || '';
  const depositAddress = generateDedicatedBEP20Address(cleanMemberId, googleEmail);

  // Initialize or load local wallet cache
  const localKey = `gain_wallet_${user.uid}`;
  let cachedWallet: UserWallet | null = null;
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem(localKey);
    if (raw) {
      try {
        cachedWallet = JSON.parse(raw);
      } catch {
        // Ignore JSON error
      }
    }
  }

  if (!cachedWallet) {
    const newWallet: UserWallet = {
      ...initialWallet,
      username: googleName,
      email: googleEmail,
      memberId: cleanMemberId,
      depositAddress,
      role: isAdminUser ? 'admin' : 'user',
      sponsorId,
      sponsorName,
      directReferralsCount: isAdminUser ? 12 : 0,
      accountStatus: isAdminUser ? 'active' : 'non-active',
      activationFeeUsdt: isAdminUser ? 0 : 100,
      teamTurnoverUsdt: isAdminUser ? 250000 : 0,
      totalReferralBonusUsdt: isAdminUser ? 1250 : 0,
      liquidBalance: isAdminUser ? 5000 : 0,
      availableCash: isAdminUser ? 5000 : 0,
      gasReserve: isAdminUser ? 1000 : 0,
      emailVerified: user.emailVerified === true,
    };
    if (typeof window !== 'undefined') {
      localStorage.setItem(localKey, JSON.stringify(newWallet));
    }
  } else if (cachedWallet.memberId !== cleanMemberId || !cachedWallet.depositAddress) {
    cachedWallet.memberId = cleanMemberId;
    cachedWallet.depositAddress = cachedWallet.depositAddress || depositAddress;
    if (typeof window !== 'undefined') {
      localStorage.setItem(localKey, JSON.stringify(cachedWallet));
    }
  }

  // If Firebase Auth does not have active token (e.g. instant session mode), skip remote Firestore write to avoid permission errors
  if (!auth.currentUser || !profileSnap) {
    return;
  }

  try {
    const snap = profileSnap;

    if (!snap.exists()) {
      const sponsorId = registrationData?.sponsorId || '';
      const sponsorName = registrationData?.sponsorName || '';

      const newWallet: UserWallet = {
        ...initialWallet,
        username: googleName,
        email: googleEmail,
        memberId: cleanMemberId,
        depositAddress,
        role: isAdminUser ? 'admin' : 'user',
        sponsorId,
        sponsorName,
        directReferralsCount: isAdminUser ? 12 : 0,
        accountStatus: isAdminUser ? 'active' : 'non-active',
        activationFeeUsdt: isAdminUser ? 0 : 100,
        teamTurnoverUsdt: isAdminUser ? 250000 : 0,
        totalReferralBonusUsdt: isAdminUser ? 1250 : 0,
        liquidBalance: isAdminUser ? 5000 : 0,
        availableCash: isAdminUser ? 5000 : 0,
        gasReserve: isAdminUser ? 1000 : 0,
      };

      await setDoc(userRef, {
        id: user.uid,
        username: newWallet.username,
        email: newWallet.email,
        memberId: newWallet.memberId,
        depositAddress,
        role: newWallet.role || 'user',
        accountStatus: newWallet.accountStatus || 'non-active',
        activationFeeUsdt: newWallet.activationFeeUsdt ?? 100,
        liquidBalance: newWallet.liquidBalance,
        availableCash: newWallet.availableCash,
        gasReserve: newWallet.gasReserve,
        totalInflow: newWallet.totalInflow,
        totalOutflow: newWallet.totalOutflow,
        gasConsumed: newWallet.gasConsumed,
        referralYield: newWallet.referralYield,
        nonCashGasBonus: newWallet.nonCashGasBonus ?? 0,
        withdrawableTradingYield: newWallet.withdrawableTradingYield ?? newWallet.referralYield ?? 0,
        allocatedAssetUsdt: newWallet.allocatedAssetUsdt,
        volume24h: newWallet.volume24h,
        sponsorId: newWallet.sponsorId,
        sponsorName: newWallet.sponsorName,
        directReferralsCount: newWallet.directReferralsCount,
        teamTurnoverUsdt: newWallet.teamTurnoverUsdt,
        totalReferralBonusUsdt: newWallet.totalReferralBonusUsdt,
        twoFactorEnabled: newWallet.twoFactorEnabled ?? true,
        twoFactorSecret: newWallet.twoFactorSecret ?? 'JBSWY3DPEHPK3PXPJA2G6ZRA',
        emailVerified: isAdminUser || user.emailVerified === true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await registerMemberInDirectory({
        memberId: cleanMemberId,
        userId: user.uid,
        username: googleName,
        accountStatus: isAdminUser ? 'active' : 'non-active',
        emailMasked: googleEmail
          ? `${googleEmail.slice(0, 3)}***@${googleEmail.split('@')[1] || 'gmail.com'}`
          : 'user***@gmail.com',
        sponsorId,
        sponsorName,
        joinedAt: new Date().toISOString(),
      });

      // Initialize subcollections
      for (const pos of initialPositions) {
        const posRef = doc(db, 'users', user.uid, 'positions', pos.id);
        await setDoc(posRef, {
          ...pos,
          userId: user.uid,
          memberId: cleanMemberId,
          updatedAt: new Date().toISOString(),
        });
      }

      const welcomeTx = {
        id: `tx-welcome-${Date.now()}`,
        title: isAdminUser ? 'Akses Super Administrator GAIN Diberikan' : 'Akun Member GAIN Terdaftar via Google',
        type: 'inflow',
        status: 'Confirmed',
        statusColor: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        timestamp: 'Baru saja',
        counterparty: googleEmail || 'Google Verified',
        counterpartyLabel: 'Google: ',
        amount: isAdminUser ? 5000 : 0,
        amountFormatted: isAdminUser ? '+5,000.00 USDT' : `ID: ${cleanMemberId}`,
        feeInfo: `Referral: ${sponsorName} (${sponsorId})`,
        userId: user.uid,
        createdAt: new Date().toISOString(),
      };
      await setDoc(doc(db, 'users', user.uid, 'transactions', welcomeTx.id), welcomeTx);
    } else {
      // Synchronize Google User details if different or missing clean memberId
      const existing = snap.data();
      const updates: Record<string, any> = {};
      if (googleName && existing.username !== googleName && registrationData?.desiredUsername) {
        updates.username = googleName;
      }
      if (googleEmail && existing.email !== googleEmail) {
        updates.email = googleEmail;
      }
      if (user.emailVerified === true && existing.emailVerified !== true) {
        updates.emailVerified = true;
      }

      // Automatically upgrade cuanteknologi01@gmail.com to admin role
      if (isAdminUser) {
        if (existing.role !== 'admin') {
          updates.role = 'admin';
        }
        if (existing.accountStatus !== 'active') {
          updates.accountStatus = 'active';
        }
      }

      let activeMemberId = existing.memberId;
      if (!isValidMemberId(activeMemberId)) {
        activeMemberId = cleanMemberId;
        updates.memberId = activeMemberId;
      }
      if (!existing.sponsorId) {
        if (registrationData?.sponsorId) {
          updates.sponsorId = registrationData.sponsorId;
          updates.sponsorName = registrationData.sponsorName || '';
        }
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date().toISOString();
        await updateDoc(userRef, updates);
      }

      await registerMemberInDirectory({
        memberId: activeMemberId,
        userId: user.uid,
        username: updates.username || existing.username || googleName,
        accountStatus: (updates.accountStatus || existing.accountStatus || (isAdminUser ? 'active' : 'non-active')) as 'active' | 'non-active',
        emailMasked: googleEmail
          ? `${googleEmail.slice(0, 3)}***@${googleEmail.split('@')[1] || 'gmail.com'}`
          : 'user***@gmail.com',
        sponsorId: existing.sponsorId || registrationData?.sponsorId || '',
        sponsorName: existing.sponsorName || registrationData?.sponsorName || '',
        joinedAt: existing.createdAt || new Date().toISOString(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
  }
}

export function subscribeToUserWallet(
  userId: string,
  onUpdate: (wallet: UserWallet) => void
) {
  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) {
    return () => {};
  }

  const path = `users/${userId}`;
  return onSnapshot(
    doc(db, 'users', userId),
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onUpdate({
          liquidBalance: data.liquidBalance ?? initialWallet.liquidBalance,
          availableCash: data.availableCash ?? initialWallet.availableCash,
          gasReserve: data.gasReserve ?? initialWallet.gasReserve,
          totalInflow: data.totalInflow ?? initialWallet.totalInflow,
          totalOutflow: data.totalOutflow ?? initialWallet.totalOutflow,
          gasConsumed: data.gasConsumed ?? initialWallet.gasConsumed,
          referralYield: data.referralYield ?? initialWallet.referralYield,
          nonCashGasBonus: data.nonCashGasBonus ?? initialWallet.nonCashGasBonus ?? 0,
          withdrawableTradingYield: data.withdrawableTradingYield ?? data.referralYield ?? initialWallet.withdrawableTradingYield ?? 0,
          allocatedAssetUsdt: data.allocatedAssetUsdt ?? initialWallet.allocatedAssetUsdt,
          volume24h: data.volume24h ?? initialWallet.volume24h,
          memberId: data.memberId ?? initialWallet.memberId,
          username: data.username ?? initialWallet.username,
          accountStatus: data.accountStatus ?? initialWallet.accountStatus ?? 'non-active',
          activationFeeUsdt: data.activationFeeUsdt ?? 100,
          vipTier: data.vipTier ?? initialWallet.vipTier,
          email: data.email ?? initialWallet.email,
          downlineCount: data.downlineCount ?? 4,
          winRatePct: data.winRatePct ?? 98.4,
          connectedExchange: data.connectedExchange,
          connectedExchanges: data.connectedExchanges || (data.connectedExchange ? [data.connectedExchange] : []),
          activeExchange: data.activeExchange || data.connectedExchange?.exchange,
          sponsorId: data.sponsorId ?? initialWallet.sponsorId,
          sponsorName: data.sponsorName ?? initialWallet.sponsorName,
          directReferralsCount: data.directReferralsCount ?? initialWallet.directReferralsCount,
          teamTurnoverUsdt: data.teamTurnoverUsdt ?? initialWallet.teamTurnoverUsdt,
          totalReferralBonusUsdt: data.totalReferralBonusUsdt ?? initialWallet.totalReferralBonusUsdt,
          twoFactorEnabled: data.twoFactorEnabled ?? initialWallet.twoFactorEnabled ?? true,
          twoFactorSecret: data.twoFactorSecret ?? initialWallet.twoFactorSecret ?? 'JBSWY3DPEHPK3PXPJA2G6ZRA',
          emailVerified: data.emailVerified ?? false,
          emailVerificationCode: data.emailVerificationCode,
        });
      }
    },
    (err) => {
      if (!auth.currentUser) return;
      handleFirestoreError(err, OperationType.GET, path);
    }
  );
}

export async function syncRealPortfolioAssetsToFirestore(
  userId: string,
  exchangeName: string,
  isSandbox: boolean,
  usdtBalance: number,
  portfolioAssets: Array<{
    coin: string;
    pair: string;
    total: number;
    price: number;
    change24h: number;
    valueUsdt: number;
  }>
) {
  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) {
    return;
  }
  const userRef = doc(db, 'users', userId);
  try {
    const totalCoinValue = portfolioAssets.reduce((sum, a) => sum + (a.valueUsdt || 0), 0);
    const totalAllocated = Number(totalCoinValue.toFixed(2));

    await updateDoc(userRef, {
      allocatedAssetUsdt: totalAllocated,
      updatedAt: new Date().toISOString(),
    });

    // Update or create positions in users/${userId}/positions
    const positionDocs = await loadAllUserPositionDocuments(userId);
    const existingPositions = new Map<string, any>();
    positionDocs.forEach((d) => {
      const data = d.data();
      if (data.coin) {
        existingPositions.set(data.coin.toUpperCase(), { ref: d.ref, data });
      }
    });

    const activeCoinSet = new Set<string>();

    for (const asset of portfolioAssets) {
      const coinKey = asset.coin.toUpperCase();
      activeCoinSet.add(coinKey);
      const existing = existingPositions.get(coinKey);

      if (existing) {
        await updateDoc(existing.ref, {
          allocationQty: `${asset.total} ${asset.coin}`,
          allocationUsdt: `~${asset.valueUsdt.toFixed(2)} USDT`,
          price: asset.price,
          change24h: asset.change24h,
          status: 'active',
          statusLabel: 'HOLDING / ACTIVE',
          engine: `${exchangeName.toUpperCase()} Spot ${isSandbox ? '(Testnet)' : ''} · Saldo Riil`,
          updatedAt: new Date().toISOString(),
        });
      } else {
        const newPosRef = doc(db, 'users', userId, 'positions', `${asset.coin.toLowerCase()}-usdt`);
        await setDoc(newPosRef, {
          id: `${asset.coin.toLowerCase()}-usdt`,
          coin: asset.coin,
          pair: asset.pair || `${asset.coin}/USDT`,
          logoUrl: `/coins/${asset.coin.toLowerCase()}.svg`,
          badgeSymbol: asset.coin.substring(0, 1),
          badgeBg: 'bg-emerald-500/10',
          badgeColor: 'text-emerald-400',
          price: asset.price,
          change24h: asset.change24h,
          engine: `${exchangeName.toUpperCase()} Spot ${isSandbox ? '(Testnet)' : ''} · Saldo Riil`,
          allocationQty: `${asset.total} ${asset.coin}`,
          allocationUsdt: `~${asset.valueUsdt.toFixed(2)} USDT`,
          stepLayer: 1,
          maxStep: 100,
          layerQuota: 'Exchange Asset Synced',
          floatingPnl: 0,
          roiPct: 0,
          status: 'active',
          statusLabel: 'HOLDING / ACTIVE',
          trailingInfo: 'Real Portfolio Live',
          trailingProgressPct: 100,
          userId,
          updatedAt: new Date().toISOString(),
        });
      }
    }

    // Set non-holding positions to inactive/standby
    for (const [coin, { ref, data }] of existingPositions.entries()) {
      if (!activeCoinSet.has(coin)) {
        await updateDoc(ref, {
          allocationQty: `0 ${coin}`,
          allocationUsdt: '0.00 USDT',
          status: 'inactive',
          statusLabel: 'STANDBY',
          floatingPnl: 0,
          roiPct: 0,
          engine: `${exchangeName.toUpperCase()} Spot ${isSandbox ? '(Testnet)' : ''} · Standby`,
          updatedAt: new Date().toISOString(),
        });
      }
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/portfolio-sync`);
  }
}

export async function saveConnectedExchangeToFirestore(
  userId: string,
  config: import('../types').ConnectedExchangeConfig,
  currentAllConfigs?: import('../types').ConnectedExchangeConfig[]
) {
  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) {
    return;
  }
  const userRef = doc(db, 'users', userId);
  try {
    // Merge or append to list of connected exchanges
    const existingList = currentAllConfigs ? [...currentAllConfigs] : [];
    const index = existingList.findIndex((item) => item.exchange === config.exchange);

    const updatedConfig = { ...config, isActive: true };
    let newList: import('../types').ConnectedExchangeConfig[];

    if (index >= 0) {
      existingList[index] = updatedConfig;
      // Mark others as isActive: false
      newList = existingList.map((item) => ({
        ...item,
        isActive: item.exchange === config.exchange,
      }));
    } else {
      newList = [
        ...existingList.map((item) => ({ ...item, isActive: false })),
        updatedConfig,
      ];
    }

    await updateUserWallet(userId, {
      connectedExchange: updatedConfig,
      connectedExchanges: newList,
      activeExchange: config.exchange,
    });

    if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) {
      return;
    }

    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      connectedExchange: updatedConfig,
      connectedExchanges: newList,
      activeExchange: config.exchange,
      updatedAt: new Date().toISOString(),
    });

    // Update positions engine labels to match the connected exchange
    const positionDocs = await loadAllUserPositionDocuments(userId);
    for (const pDoc of positionDocs) {
      await updateDoc(pDoc.ref, {
        engine: `${config.exchange} Spot ${config.isSandbox ? '(Testnet)' : ''} · Moon Logic Engine`,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    if (!auth.currentUser) return;
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/exchange`);
  }
}

export async function setActiveExchangeInFirestore(
  userId: string,
  exchangeName: import('../types').ExchangeName,
  currentAllConfigs: import('../types').ConnectedExchangeConfig[]
) {
  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) {
    return;
  }
  const userRef = doc(db, 'users', userId);
  try {
    const targetConfig = currentAllConfigs.find((c) => c.exchange === exchangeName);
    const updatedList = currentAllConfigs.map((c) => ({
      ...c,
      isActive: c.exchange === exchangeName,
    }));

    const updates: Record<string, any> = {
      connectedExchanges: updatedList,
      activeExchange: exchangeName,
      updatedAt: new Date().toISOString(),
    };

    if (targetConfig) {
      updates.connectedExchange = { ...targetConfig, isActive: true };
    }

    await updateDoc(userRef, updates);

    // Update positions engine labels
    const positionDocs = await loadAllUserPositionDocuments(userId);
    for (const pDoc of positionDocs) {
      await updateDoc(pDoc.ref, {
        engine: `${exchangeName} Spot · Active Engine`,
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    if (!auth.currentUser) return;
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/set-active-exchange`);
  }
}

export async function disconnectSingleExchangeFromFirestore(
  userId: string,
  exchangeName: import('../types').ExchangeName,
  currentAllConfigs: import('../types').ConnectedExchangeConfig[]
) {
  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) {
    return;
  }
  const userRef = doc(db, 'users', userId);
  try {
    const remainingList = currentAllConfigs.filter((c) => c.exchange !== exchangeName);
    let nextActive = remainingList.find((c) => c.isActive) || remainingList[0];

    const updates: Record<string, any> = {
      connectedExchanges: remainingList,
      updatedAt: new Date().toISOString(),
    };

    if (nextActive) {
      nextActive = { ...nextActive, isActive: true };
      updates.connectedExchange = nextActive;
      updates.activeExchange = nextActive.exchange;
    } else {
      updates.connectedExchange = {
        exchange: 'Tokocrypto',
        isConnected: false,
        isSandbox: false,
        apiKeyMasked: '',
        usdtBalance: 0,
        lastSynced: new Date().toLocaleTimeString(),
      };
      updates.activeExchange = null;
      updates.allocatedAssetUsdt = 0;
    }

    await updateDoc(userRef, updates);
  } catch (err) {
    if (!auth.currentUser) return;
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/disconnect-single-exchange`);
  }
}

export async function disconnectExchangeFromFirestore(userId: string) {
  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) {
    return;
  }
  const userRef = doc(db, 'users', userId);
  try {
    await updateDoc(userRef, {
      connectedExchange: {
        exchange: 'Tokocrypto',
        isConnected: false,
        isSandbox: false,
        apiKeyMasked: '',
        usdtBalance: 0,
        lastSynced: new Date().toLocaleTimeString(),
      },
      allocatedAssetUsdt: 0,
      updatedAt: new Date().toISOString(),
    });

    // Reset positions back to Standby
    const positionDocs = await loadAllUserPositionDocuments(userId);
    for (const pDoc of positionDocs) {
      await updateDoc(pDoc.ref, {
        allocationQty: '0',
        allocationUsdt: '0.00 USDT',
        status: 'inactive',
        statusLabel: 'STANDBY',
        engine: 'Algorithmic Standby · Menunggu API',
        updatedAt: new Date().toISOString(),
      });
    }
  } catch (err) {
    if (!auth.currentUser) return;
    handleFirestoreError(err, OperationType.WRITE, `users/${userId}/disconnect-exchange`);
  }
}

export function subscribeToUserPositions(
  userId: string,
  onUpdate: (positions: TradingPosition[]) => void
) {
  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) {
    return () => {};
  }
  const path = `users/${userId}/positions`;
  return onSnapshot(
    collection(db, 'users', userId, 'positions'),
    (snap) => {
      const list: TradingPosition[] = [];
      snap.forEach((docSnap) => {
        list.push(docSnap.data() as TradingPosition);
      });
      if (list.length > 0) {
        onUpdate(list);
      }
    },
    (error) => {
      if (!auth.currentUser) return;
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export function subscribeToUserTransactions(
  userId: string,
  onUpdate: (transactions: TransactionRecord[]) => void,
  onPageInfo?: (cursor: FirestorePageCursor | null, hasMore: boolean) => void
) {
  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) {
    return () => {};
  }
  const path = `users/${userId}/transactions`;
  const transactionsQuery = query(
    collection(db, 'users', userId, 'transactions'),
    orderBy('createdAt', 'desc'),
    limit(FIRESTORE_HISTORY_PAGE_SIZE)
  );
  return onSnapshot(
    transactionsQuery,
    (snap) => {
      const list: TransactionRecord[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data() as TransactionRecord;
        // Auto-purge and filter legacy exchange API sync audit entries from wallet ledger
        if (
          docSnap.id.startsWith('tx-ex-') ||
          docSnap.id.startsWith('tx-dc-') ||
          data.title?.includes('Sinkronisasi API') ||
          data.title?.includes('Pemutusan Sambungan')
        ) {
          deleteDoc(docSnap.ref).catch(() => {});
          return;
        }
        list.push(data);
      });
      onUpdate(list);
      onPageInfo?.(snap.docs.at(-1) || null, snap.size === FIRESTORE_HISTORY_PAGE_SIZE);
    },
    (error) => {
      if (!auth.currentUser) return;
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function fetchOlderUserTransactions(
  userId: string,
  cursor: FirestorePageCursor,
  pageSize = FIRESTORE_HISTORY_PAGE_SIZE
): Promise<FirestorePage<TransactionRecord>> {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    return { items: [], cursor: null, hasMore: false };
  }

  const transactionsQuery = query(
    collection(db, 'users', userId, 'transactions'),
    orderBy('createdAt', 'desc'),
    startAfter(cursor),
    limit(pageSize)
  );
  const snap = await getDocs(transactionsQuery);
  const items = snap.docs
    .filter((docSnap) => {
      const data = docSnap.data() as TransactionRecord;
      return !docSnap.id.startsWith('tx-ex-')
        && !docSnap.id.startsWith('tx-dc-')
        && !data.title?.includes('Sinkronisasi API')
        && !data.title?.includes('Pemutusan Sambungan');
    })
    .map((docSnap) => docSnap.data() as TransactionRecord);

  return {
    items,
    cursor: snap.docs.at(-1) || null,
    hasMore: snap.size === pageSize,
  };
}

export async function updateUserWallet(userId: string, partial: Partial<UserWallet>) {
  const validation = validateFinancialAction('profile', {
    userId,
    ...partial,
  });
  if (!validation.ok) {
    throw new Error(validation.reason || 'Validasi wallet gagal');
  }

  if (!isClientLedgerWriteAllowed()) {
    throw new Error('Client-side wallet mutation is disabled in production. Use the server-authoritative wallet API.');
  }

  if (typeof window !== 'undefined' && userId) {
    const localKey = `gain_wallet_${userId}`;
    const raw = localStorage.getItem(localKey);
    let current: Partial<UserWallet> = {};
    if (raw) {
      try {
        current = JSON.parse(raw);
      } catch {}
    }
    const updated = { ...current, ...partial };
    localStorage.setItem(localKey, JSON.stringify(updated));
  }

  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) {
    return;
  }

  const path = `users/${userId}`;
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...partial,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (!auth.currentUser) return;
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function addTransactionToFirestore(userId: string, tx: TransactionRecord) {
  const validation = validateFinancialAction('profile', {
    userId,
    amount: tx.amount,
    type: tx.type,
    title: tx.title,
  });
  if (!validation.ok) {
    throw new Error(validation.reason || 'Validasi transaksi gagal');
  }

  if (!isClientLedgerWriteAllowed()) {
    throw new Error('Client-side transaction ledger mutation is disabled in production. Use the server-authoritative wallet API.');
  }

  const memberId = await requireMemberId(userId);
  const transaction = { ...tx, memberId };

  if (typeof window !== 'undefined' && userId) {
    const localKey = `gain_transactions_${userId}`;
    const raw = localStorage.getItem(localKey);
    let list: TransactionRecord[] = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch {}
    }
    list = [transaction, ...list.filter((t) => t.id !== tx.id)];
    localStorage.setItem(localKey, JSON.stringify(list));
  }

  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) return;
  const path = `users/${userId}/transactions/${tx.id}`;
  try {
    const txRef = doc(db, 'users', userId, 'transactions', tx.id);
    await setDoc(txRef, omitUndefinedFields({
      ...transaction,
      userId,
      createdAt: new Date().toISOString(),
      sourceAction: tx.sourceAction || 'transaction',
    }));
  } catch (error) {
    if (!auth.currentUser) return;
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updatePositionInFirestore(userId: string, pos: TradingPosition) {
  if (!isClientLedgerWriteAllowed()) {
    throw new Error('Client-side position mutation is disabled in production. Use the server-authoritative wallet API.');
  }

  const memberId = await requireMemberId(userId);
  const position = { ...pos, memberId };

  if (typeof window !== 'undefined' && userId) {
    const localKey = `gain_positions_${userId}`;
    const raw = localStorage.getItem(localKey);
    let list: TradingPosition[] = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch {}
    }
    const idx = list.findIndex((p) => p.id === position.id);
    if (idx >= 0) list[idx] = position;
    else list.push(position);
    localStorage.setItem(localKey, JSON.stringify(list));
  }

  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) return;
  const path = `users/${userId}/positions/${position.id}`;
  try {
    const posRef = doc(db, 'users', userId, 'positions', position.id);
    await setDoc(posRef, {
      ...position,
      userId,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    if (!auth.currentUser) return;
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deletePositionFromFirestore(userId: string, posId: string) {
  if (!isClientLedgerWriteAllowed()) {
    throw new Error('Client-side position deletion is disabled in production. Use the server-authoritative wallet API.');
  }

  if (typeof window !== 'undefined' && userId) {
    const localKey = `gain_positions_${userId}`;
    const raw = localStorage.getItem(localKey);
    let list: TradingPosition[] = [];
    if (raw) {
      try { list = JSON.parse(raw); } catch {}
    }
    list = list.filter((p) => p.id !== posId);
    localStorage.setItem(localKey, JSON.stringify(list));
  }

  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) return;
  const path = `users/${userId}/positions/${posId}`;
  try {
    const posRef = doc(db, 'users', userId, 'positions', posId);
    await deleteDoc(posRef);
  } catch (error) {
    if (!auth.currentUser) return;
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeToUserTradeHistory(
  userId: string,
  onUpdate: (trades: TradeRecord[]) => void,
  onPageInfo?: (cursor: FirestorePageCursor | null, hasMore: boolean) => void
) {
  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) {
    return () => {};
  }
  const path = `users/${userId}/trade_history`;
  const tradesQuery = query(
    collection(db, 'users', userId, 'trade_history'),
    orderBy('timestamp', 'desc'),
    limit(FIRESTORE_HISTORY_PAGE_SIZE)
  );
  return onSnapshot(
    tradesQuery,
    (snap) => {
      const map = new Map<string, TradeRecord>();
      snap.forEach((docSnap) => {
        const data = docSnap.data() as TradeRecord;
        const id = data.id || docSnap.id;
        map.set(id, { ...data, id });
      });
      // Sort newest trades first
      const list = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      onUpdate(list);
      onPageInfo?.(snap.docs.at(-1) || null, snap.size === FIRESTORE_HISTORY_PAGE_SIZE);
    },
    (error) => {
      if (!auth.currentUser) return;
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

export async function fetchOlderUserTrades(
  userId: string,
  cursor: FirestorePageCursor,
  pageSize = FIRESTORE_HISTORY_PAGE_SIZE
): Promise<FirestorePage<TradeRecord>> {
  if (!auth.currentUser || auth.currentUser.uid !== userId) {
    return { items: [], cursor: null, hasMore: false };
  }

  const tradesQuery = query(
    collection(db, 'users', userId, 'trade_history'),
    orderBy('timestamp', 'desc'),
    startAfter(cursor),
    limit(pageSize)
  );
  const snap = await getDocs(tradesQuery);
  const items = snap.docs.map((docSnap) => {
    const trade = docSnap.data() as TradeRecord;
    return { ...trade, id: trade.id || docSnap.id };
  });

  return {
    items,
    cursor: snap.docs.at(-1) || null,
    hasMore: snap.size === pageSize,
  };
}

export async function addTradeRecordToFirestore(userId: string, trade: TradeRecord) {
  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) return;
  const memberId = await requireMemberId(userId);
  const path = `users/${userId}/trade_history/${trade.id}`;
  try {
    const tradeRef = doc(db, 'users', userId, 'trade_history', trade.id);
    await setDoc(tradeRef, omitUndefinedFields({
      ...trade,
      userId,
      memberId,
      createdAt: new Date().toISOString(),
    }));
  } catch (error) {
    if (!auth.currentUser) return;
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function syncTradesFromExchangeToFirestore(userId: string, trades: TradeRecord[]) {
  if (!auth.currentUser || !userId || userId.startsWith('usr-') || auth.currentUser.uid !== userId) return;
  try {
    const memberId = await requireMemberId(userId);
    for (const trade of trades) {
      const tradeRef = doc(db, 'users', userId, 'trade_history', trade.id);
      await setDoc(
        tradeRef,
        {
          ...trade,
          userId,
          memberId,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    }
  } catch (error) {
    if (!auth.currentUser) return;
    handleFirestoreError(error, OperationType.WRITE, `users/${userId}/trade_history_batch`);
  }
}
