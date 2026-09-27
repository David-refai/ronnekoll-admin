'use client';

/**
 * Manual access token (Microsoft Graph).
 * Kept only in memory + sessionStorage — it disappears when the tab closes.
 */

const KEY = 'rk.token';
let memoryToken: string | null = null;
const listeners = new Set<() => void>();

export interface TokenInfo {
  token: string;
  name?: string;
  upn?: string;
  expiresAt?: number; // ms epoch
  scopes?: string[];
}

function decodePart(part: string): Record<string, unknown> | null {
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(pad)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function decodeToken(token: string): TokenInfo {
  const clean = token.trim().replace(/^Bearer\s+/i, '');
  const parts = clean.split('.');
  const payload = parts.length === 3 ? decodePart(parts[1]) : null;
  return {
    token: clean,
    name: (payload?.name as string) || undefined,
    upn: (payload?.upn as string) || (payload?.preferred_username as string) || (payload?.unique_name as string) || undefined,
    expiresAt: typeof payload?.exp === 'number' ? (payload.exp as number) * 1000 : undefined,
    scopes: typeof payload?.scp === 'string' ? (payload.scp as string).split(' ') : undefined,
  };
}

export function getToken(): string | null {
  if (memoryToken) return memoryToken;
  if (typeof window === 'undefined') return null;
  try {
    memoryToken = window.sessionStorage.getItem(KEY);
  } catch {
    /* sessionStorage unavailable */
  }
  return memoryToken;
}

export function setToken(token: string | null) {
  memoryToken = token ? token.trim().replace(/^Bearer\s+/i, '') : null;
  try {
    if (memoryToken) window.sessionStorage.setItem(KEY, memoryToken);
    else window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function subscribeToken(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export type TokenState = 'none' | 'valid' | 'expiring' | 'expired';

export function tokenState(info: TokenInfo | null, now = Date.now()): { state: TokenState; minutes?: number } {
  if (!info) return { state: 'none' };
  if (!info.expiresAt) return { state: 'valid' };
  const minutes = Math.floor((info.expiresAt - now) / 60000);
  if (minutes < 0) return { state: 'expired', minutes: 0 };
  if (minutes < 10) return { state: 'expiring', minutes };
  return { state: 'valid', minutes };
}
