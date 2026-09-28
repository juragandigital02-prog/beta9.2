import { postJson } from './httpClient';

export function sendVerificationCode(payload: Record<string, unknown>) {
  return postJson<Record<string, any>>('/api/auth/send-verification-code', payload);
}
