import { postJson } from './httpClient';

export function processWalletActivation(payload: Record<string, unknown>) {
  return postJson<Record<string, any>>('/api/wallet/process-activation', payload);
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

export function transferToMember(payload: Record<string, unknown>) {
  return postJson<Record<string, any>>('/api/member/transfer', payload);
}
