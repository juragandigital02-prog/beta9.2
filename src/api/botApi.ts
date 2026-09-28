import { postJson } from './httpClient';

export function registerBackgroundBot(payload: Record<string, unknown>) {
  return postJson<Record<string, any>>('/api/bot/register', payload);
}

export function deleteBackgroundBot(botId: string) {
  return postJson<Record<string, any>>('/api/bot/delete', { botId });
}
