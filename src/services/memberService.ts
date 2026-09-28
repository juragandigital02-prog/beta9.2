import {
  collection,
  deleteField,
  doc,
  documentId,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  startAfter,
  updateDoc,
  type DocumentData,
  type QueryConstraint,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { NetworkMember } from '../types';

export interface DirectoryMember {
  memberId: string;
  userId: string;
  username: string;
  accountStatus: 'active' | 'non-active';
  vipTier?: string;
  emailMasked: string;
  sponsorId?: string;
  sponsorName?: string;
  joinedAt: string;
  role?: string;
}

// Initial directory of verifiable GAIN members for internal P2P & sponsor lookups
export const DEFAULT_DIRECTORY_MEMBERS: DirectoryMember[] = [
  {
    memberId: 'GN-10001',
    userId: 'usr-master-001',
    username: 'Master GAIN Foundation',
    accountStatus: 'active',
    emailMasked: 'mas***@gainkoin.io',
    joinedAt: '2026-01-01',
  },
  {
    memberId: 'GN-10823',
    userId: 'usr-sinon-823',
    username: 'sinonnggi (Sponsor)',
    accountStatus: 'active',
    emailMasked: 'sin***@gmail.com',
    sponsorId: 'GN-10001',
    joinedAt: '2026-02-14',
  },
  {
    memberId: 'GN-20419',
    userId: 'usr-tera-419',
    username: 'tera_areh',
    accountStatus: 'active',
    emailMasked: 'ter***@yahoo.com',
    sponsorId: 'GN-10823',
    joinedAt: '2026-03-01',
  },
  {
    memberId: 'GN-31952',
    userId: 'usr-wglm-952',
    username: 'wGLmfcbq',
    accountStatus: 'active',
    emailMasked: 'wgl***@gmail.com',
    sponsorId: 'GN-10823',
    joinedAt: '2026-03-10',
  },
  {
    memberId: 'GN-45812',
    userId: 'usr-budi-812',
    username: 'Budi Santoso (Surabaya)',
    accountStatus: 'non-active',
    emailMasked: 'bud***@gmail.com',
    sponsorId: 'GN-10823',
    joinedAt: '2026-03-15',
  },
  {
    memberId: 'GN-58903',
    userId: 'usr-hendra-903',
    username: 'Hendra Crypto (Bandung)',
    accountStatus: 'active',
    emailMasked: 'hen***@gmail.com',
    sponsorId: 'GN-10823',
    joinedAt: '2026-03-18',
  },
];

// Direct Referrals (Single-Tier / Non-MLM)
export const DEFAULT_NETWORK_DOWNLINES: NetworkMember[] = [
  {
    id: 'net-01',
    memberId: 'GN-20419',
    name: 'tera_areh (Jakarta)',
    emailMasked: 'ter***@yahoo.com',
    sponsorId: 'GN-10823',
    joinDate: '2026-03-01',
    accountStatus: 'active',
    botStatus: 'ACTIVE',
    exchangeConnected: 'Bitget Spot',
    totalTurnoverUsdt: 12500,
    bonusYieldUsdt: 25.0,
  },
  {
    id: 'net-02',
    memberId: 'GN-31952',
    name: 'wGLmfcbq (Medan)',
    emailMasked: 'wgl***@gmail.com',
    sponsorId: 'GN-10823',
    joinDate: '2026-03-10',
    accountStatus: 'active',
    botStatus: 'ACTIVE',
    exchangeConnected: 'Binance Spot',
    totalTurnoverUsdt: 34200,
    bonusYieldUsdt: 68.4,
  },
  {
    id: 'net-03',
    memberId: 'GN-45812',
    name: 'Budi Santoso (Surabaya)',
    emailMasked: 'bud***@gmail.com',
    sponsorId: 'GN-10823',
    joinDate: '2026-03-15',
    accountStatus: 'non-active',
    botStatus: 'STANDBY',
    exchangeConnected: 'OKX Spot',
    totalTurnoverUsdt: 4500,
    bonusYieldUsdt: 9.0,
  },
  {
    id: 'net-04',
    memberId: 'GN-58903',
    name: 'Hendra Crypto (Bandung)',
    emailMasked: 'hen***@gmail.com',
    sponsorId: 'GN-10823',
    joinDate: '2026-03-18',
    accountStatus: 'active',
    botStatus: 'ACTIVE',
    exchangeConnected: 'Bitget Spot',
    totalTurnoverUsdt: 8900,
    bonusYieldUsdt: 8.9,
  },
];

/**
 * Generate a clean standard GAIN Member ID: GN-XXXXX (5 digits)
 */
export function generateCleanMemberId(seedStr?: string): string {
  if (seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
      hash = (hash << 5) - hash + seedStr.charCodeAt(i);
      hash |= 0;
    }
    const num = Math.abs(hash % 90000) + 10000;
    return `GN-${num}`;
  }
  const randomNum = Math.floor(10000 + Math.random() * 90000);
  return `GN-${randomNum}`;
}

/**
 * Register member in directory for lookup & internal P2P transfer
 */
export async function registerMemberInDirectory(member: DirectoryMember): Promise<void> {
  try {
    const dirRef = doc(db, 'member_directory', member.memberId);
    await setDoc(dirRef, {
      memberId: member.memberId,
      userId: member.userId,
      username: member.username,
      accountStatus: member.accountStatus,
      emailMasked: member.emailMasked,
      sponsorId: member.sponsorId,
      sponsorName: member.sponsorName,
      joinedAt: member.joinedAt,
      emailFull: deleteField(),
      liquidBalance: deleteField(),
      gasReserve: deleteField(),
      depositAddress: deleteField(),
      role: deleteField(),
    }, { merge: true });
  } catch {
    // Graceful offline fallback
  }
}

/**
 * Look up member in directory by Member ID (e.g. "GN-10823" or "GN-20419")
 */
export async function lookupMemberInDirectory(
  memberIdInput: string
): Promise<DirectoryMember | null> {
  const cleanId = memberIdInput.trim().toUpperCase();
  if (!cleanId) return null;

  // Check local registry first for instant response
  const localMatch = DEFAULT_DIRECTORY_MEMBERS.find(
    (m) => m.memberId.toUpperCase() === cleanId
  );
  if (localMatch) return localMatch;

  try {
    const dirRef = doc(db, 'member_directory', cleanId);
    const snap = await getDoc(dirRef);
    if (snap.exists()) {
      return snap.data() as DirectoryMember;
    }
  } catch {
    // Return null if not found
  }

  return null;
}

/**
 * Fetch network downlines from Firestore or default mock
 */
export interface NetworkMemberPage {
  members: NetworkMember[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
}

export type NetworkCursor = QueryDocumentSnapshot<DocumentData>;

export async function fetchUserNetworkPage(
  userId: string | undefined,
  userMemberId: string,
  cursor: NetworkCursor | null = null,
  pageSize = 25
): Promise<NetworkMemberPage> {
  if (!userId) {
    return { members: DEFAULT_NETWORK_DOWNLINES, cursor: null, hasMore: false };
  }

  try {
    const colRef = collection(db, 'users', userId, 'network');
    const constraints: QueryConstraint[] = [orderBy(documentId(), 'desc')];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(pageSize));
    const snap = await getDocs(query(colRef, ...constraints));
    if (!snap.empty) {
      return {
        members: snap.docs.map((document) => ({ ...document.data(), id: document.id }) as NetworkMember),
        cursor: snap.docs.at(-1) || null,
        hasMore: snap.size === pageSize,
      };
    }
  } catch {
    if (cursor) return { members: [], cursor: null, hasMore: false };
  }

  return { members: DEFAULT_NETWORK_DOWNLINES.slice(0, pageSize), cursor: null, hasMore: false };
}
