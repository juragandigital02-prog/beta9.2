import {
  collection,
  deleteField,
  doc,
  getDoc,
  limit,
  onSnapshot,
  query,
  runTransaction,
  setDoc,
  where,
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

export function isValidMemberId(value: unknown): value is string {
  return typeof value === 'string' && /^GN-\d{5}$/.test(value);
}

/** Reserve a permanent sequential ID. The counter transaction serializes concurrent registrations. */
export async function reserveMemberId(userId: string): Promise<string> {
  const reservationRef = doc(db, 'member_id_reservations', userId);
  const counterRef = doc(db, 'system', 'member_id_counter');

  return runTransaction(db, async (transaction) => {
    const reservation = await transaction.get(reservationRef);
    if (reservation.exists()) {
      const memberId = reservation.data().memberId;
      if (isValidMemberId(memberId)) return memberId;
      throw new Error('Reservasi Member ID tersimpan tidak valid.');
    }

    const counter = await transaction.get(counterRef);
    let sequence = Number(counter.data()?.value || 0);
    let memberId = '';
    let directoryRef;
    let directorySnapshot;
    let indexRef;
    let indexSnapshot;

    do {
      sequence += 1;
      if (sequence > 99999) throw new Error('Kapasitas Member ID GN-99999 telah tercapai.');
      memberId = `GN-${String(sequence).padStart(5, '0')}`;
      directoryRef = doc(db, 'member_directory', memberId);
      indexRef = doc(db, 'member_id_index', memberId);
      directorySnapshot = await transaction.get(directoryRef);
      indexSnapshot = await transaction.get(indexRef);
    } while (directorySnapshot.exists() || indexSnapshot.exists());

    transaction.set(reservationRef, {
      userId,
      memberId,
      sequence,
      createdAt: new Date().toISOString(),
    });
    transaction.set(indexRef, { userId, memberId, sequence });
    transaction.set(counterRef, { value: sequence });
    return memberId;
  });
}

/**
 * Register member in directory for lookup & internal P2P transfer
 */
export async function registerMemberInDirectory(member: DirectoryMember): Promise<void> {
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
}

/**
 * Look up member in directory by Member ID (e.g. "GN-00001").
 */
export async function lookupMemberInDirectory(
  memberIdInput: string
): Promise<DirectoryMember | null> {
  const cleanId = memberIdInput.trim().toUpperCase();
  if (!cleanId) return null;

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

/** Subscribe to real direct referrals in the public member directory. */
export function subscribeToDirectReferrals(
  userId: string | undefined,
  userMemberId: string,
  onUpdate: (members: NetworkMember[]) => void,
  onError: () => void,
): () => void {
  if (!userId || !userMemberId || userId.startsWith('gain-usr-')) {
    onUpdate([]);
    return () => {};
  }

  const membersQuery = query(
    collection(db, 'member_directory'),
    where('sponsorId', '==', userMemberId),
    limit(100),
  );

  return onSnapshot(membersQuery, (snapshot) => {
    const members = snapshot.docs.map((memberDoc) => {
      const data = memberDoc.data();
      return {
        id: memberDoc.id,
        memberId: String(data.memberId || memberDoc.id),
        name: String(data.username || 'Member'),
        emailMasked: String(data.emailMasked || ''),
        sponsorId: String(data.sponsorId || ''),
        joinDate: String(data.joinedAt || ''),
        accountStatus: data.accountStatus === 'active' ? 'active' : 'non-active',
        ...(typeof data.bonusYieldUsdt === 'number' ? { bonusYieldUsdt: data.bonusYieldUsdt } : {}),
        ...(typeof data.totalTurnoverUsdt === 'number' ? { totalTurnoverUsdt: data.totalTurnoverUsdt } : {}),
        ...(data.botStatus === 'ACTIVE' || data.botStatus === 'STANDBY' ? { botStatus: data.botStatus } : {}),
      } satisfies NetworkMember;
    });
    members.sort((left, right) => right.joinDate.localeCompare(left.joinDate));
    onUpdate(members);
  }, onError);
}

export function subscribeToMemberDirectory(
  onUpdate: (members: DirectoryMember[]) => void,
  onError: () => void,
): () => void {
  return onSnapshot(query(collection(db, 'member_directory'), limit(200)), (snapshot) => {
    onUpdate(snapshot.docs.map((memberDoc) => ({ ...memberDoc.data(), memberId: memberDoc.id }) as DirectoryMember));
  }, onError);
}
