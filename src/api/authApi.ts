import { postJson } from './httpClient';
import { auth } from '../firebase';

async function getAuthorizationToken(): Promise<string> {
  if (!auth.currentUser) throw new Error('Silakan login ulang dengan akun Google Anda.');
  return auth.currentUser.getIdToken();
}

export async function sendVerificationCode(payload: Record<string, unknown> = {}) {
  const token = await getAuthorizationToken();
  return postJson<Record<string, any>>('/api/auth/send-verification-code', payload, undefined, token);
}

export async function verifyEmailVerificationCode(code: string) {
  const token = await getAuthorizationToken();
  return postJson<Record<string, any>>('/api/auth/verify-email-code', { code }, undefined, token);
}
