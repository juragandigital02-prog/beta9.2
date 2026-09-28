export interface ApiErrorPayload {
  success?: false;
  error?: string;
  code?: string;
  category?: string;
  requestId?: string;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly category?: string;
  readonly requestId?: string;

  constructor(status: number, payload: ApiErrorPayload) {
    super(payload.error || 'Permintaan ke server gagal.');
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = payload.code;
    this.category = payload.category;
    this.requestId = payload.requestId;
  }
}

export async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal,
  });

  const payload = await response.json().catch(() => null) as (T & ApiErrorPayload) | null;
  if (!response.ok || payload?.success === false) {
    throw new ApiRequestError(response.status, payload || {});
  }

  if (!payload) {
    throw new ApiRequestError(response.status, { error: 'Respons server tidak valid.' });
  }

  return payload;
}
