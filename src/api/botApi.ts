import { postJson } from './httpClient';
import { auth } from '../firebase';

async function getBotAuthToken(): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error('Sesi Firebase diperlukan untuk mengelola bot.');
  return user.getIdToken();
}

export async function registerBackgroundBot(payload: Record<string, unknown>) {
  return postJson<Record<string, any>>('/api/bot/register', payload, undefined, await getBotAuthToken());
}

export async function deleteBackgroundBot(botId: string) {
  return postJson<Record<string, any>>('/api/bot/delete', { botId }, undefined, await getBotAuthToken());
}

export async function storeBotCredentials(credentials: {
  exchange: string;
  apiKey: string;
  secret: string;
  password?: string;
  isSandbox: boolean;
}) {
  return postJson<Record<string, any>>('/api/bot/credentials', credentials, undefined, await getBotAuthToken());
}

export async function disconnectBotExchange(exchange: string) {
  return postJson<Record<string, any>>('/api/bot/disconnect-exchange', { exchange }, undefined, await getBotAuthToken());
}

export async function activateBotKillSwitch() {
  return postJson<Record<string, any>>('/api/bot/kill-switch', {}, undefined, await getBotAuthToken());
}
