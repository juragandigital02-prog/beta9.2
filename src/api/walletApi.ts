import { postJson } from './httpClient';
import { auth } from '../firebase';

export async function processWalletActivation(payload: Record<string, unknown>) {
  if (!auth.currentUser) throw new Error('Silakan login ulang dengan akun Google Anda.');
  const token = await auth.currentUser.getIdToken();
  return postJson<Record<string, any>>('/api/wallet/process-activation', payload, undefined, token);
}

export function verifyOnChainDeposit(payload: Record<string, unknown>) {
  return postJson<Record<string, any>>('/api/wallet/verify-deposit', payload);
}

export function submitWithdrawal(payload: Record<string, unknown>) {
  return postJson<Record<string, any>>('/api/wallet/submit-withdraw', payload);
}

export function topUpGas(payload: Record<string, unknown>) {
  return postJson<Record<string, any>>('/api/wallet/topup-gas', payload);
}

export async function transferToMember(payload: Record<string, unknown>) {
  if (!auth.currentUser) throw new Error('Silakan login ulang dengan akun Google Anda.');
  const token = await auth.currentUser.getIdToken();
  return postJson<Record<string, any>>('/api/member/transfer', payload, undefined, token);
}
