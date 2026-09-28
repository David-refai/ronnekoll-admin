'use client';

import * as React from 'react';
import { makeDemo } from './demo';
import { EMPTY_DATA, type Data, type ListKey, type Row } from './lists';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from './settings';
import * as sp from './sharepoint';
import { decodeToken, getToken, setToken as storeToken, subscribeToken, tokenState, type TokenInfo } from './token';

export interface Toast {
  id: number;
  message: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface Store {
  data: Data;
  mode: 'demo' | 'live';
  loading: boolean;
  error: string | null;
  loadedAt: Date | null;
  settings: Settings;
  setSettings(s: Settings): void;
  token: TokenInfo | null;
  tokenStatus: ReturnType<typeof tokenState>;
  setToken(t: string | null): void;
  connection: sp.Connection | null;
  /** True when writes are blocked (token expired in live mode). */
  readOnly: boolean;
  reload(): Promise<void>;
  create(key: ListKey, values: Record<string, unknown>): Promise<Row>;
  update(key: ListKey, id: string, values: Record<string, unknown>): Promise<void>;
  userName: string;
  /** Allowed values for a Choice column (live), else the given fallback. */
  choices(key: ListKey, column: string, fallback: string[]): string[];
  toast(t: Omit<Toast, 'id'>): void;
  toasts: Toast[];
  dismissToast(id: number): void;
}

const Ctx = React.createContext<Store | null>(null);

export function useStore() {
  const s = React.useContext(Ctx);
  if (!s) throw new Error('useStore utanför StoreProvider');
  return s;
}

let demoId = 100000;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettingsState] = React.useState<Settings>(DEFAULT_SETTINGS);
  const [data, setData] = React.useState<Data>(EMPTY_DATA);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [loadedAt, setLoadedAt] = React.useState<Date | null>(null);
  const [token, setTokenInfo] = React.useState<TokenInfo | null>(null);
  const [connection, setConnection] = React.useState<sp.Connection | null>(null);
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [, tick] = React.useReducer((x: number) => x + 1, 0);
  const connRef = React.useRef<sp.Connection | null>(null);

  // Initial load of settings + token
  React.useEffect(() => {
    setSettingsState(loadSettings());
    const t = getToken();
    setTokenInfo(t ? decodeToken(t) : null);
    const off = subscribeToken(() => {
      const t2 = getToken();
      setTokenInfo(t2 ? decodeToken(t2) : null);
    });
    const timer = window.setInterval(tick, 30000); // refresh token countdown
    return () => {
      off();
      window.clearInterval(timer);
    };
  }, []);

  const mode: 'demo' | 'live' = settings.demo ? 'demo' : 'live';

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (settings.demo) {
        setData(makeDemo());
        setConnection(null);
        connRef.current = null;
      } else {
        if (!settings.hostname || !settings.sitePath) throw new Error('Ange SharePoint-webbplats under Inställningar.');
        if (!getToken()) throw new Error('Ingen token. Klistra in en token under Inställningar.');
        const conn = connRef.current ?? (await sp.connect(settings.hostname, settings.sitePath));
        connRef.current = conn;
        setConnection(conn);
        setData(await sp.loadAll(conn));
      }
      setLoadedAt(new Date());
    } catch (e) {
      connRef.current = null;
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [settings]);

  // Reload when settings change (first render uses defaults; wait until loaded)
  const settingsLoaded = React.useRef(false);
  React.useEffect(() => {
    if (!settingsLoaded.current) {
      settingsLoaded.current = true;
      return;
    }
    reload();
  }, [reload]);

  const setSettings = React.useCallback((s: Settings) => {
    connRef.current = null;
    saveSettings(s);
    setSettingsState(s);
  }, []);

  const setToken = React.useCallback((t: string | null) => {
    storeToken(t);
    connRef.current = null;
  }, []);

  const status = tokenState(token);
  const readOnly = mode === 'live' && (status.state === 'expired' || status.state === 'none');

  const create = React.useCallback(
    async (key: ListKey, values: Record<string, unknown>) => {
      if (mode === 'demo') {
        const now = new Date().toISOString();
        const row: Row = { _id: String(++demoId), _created: now, _modified: now, ...values };
        setData((d) => ({ ...d, [key]: [...d[key], row] }));
        return row;
      }
      if (!connRef.current) throw new Error('Inte ansluten till SharePoint.');
      const row = await sp.create(connRef.current, key, values);
      // keep all given values locally even if SharePoint returns a subset
      const merged = { ...values, ...row };
      setData((d) => ({ ...d, [key]: [...d[key], merged] }));
      return merged;
    },
    [mode],
  );

  const update = React.useCallback(
    async (key: ListKey, id: string, values: Record<string, unknown>) => {
      if (mode === 'live') {
        if (!connRef.current) throw new Error('Inte ansluten till SharePoint.');
        await sp.update(connRef.current, key, id, values);
      }
      const now = new Date().toISOString();
      setData((d) => ({ ...d, [key]: d[key].map((r) => (r._id === id ? { ...r, ...values, _modified: now } : r)) }));
    },
    [mode],
  );

  const toast = React.useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((l) => [...l.slice(-2), { ...t, id }]);
    window.setTimeout(() => setToasts((l) => l.filter((x) => x.id !== id)), 6000);
  }, []);
  const dismissToast = React.useCallback((id: number) => setToasts((l) => l.filter((x) => x.id !== id)), []);

  const userName = token?.name || settings.userName || 'David';
  const choices = React.useCallback(
    (key: ListKey, column: string, fallback: string[]) => sp.choicesOf(connection, key, column) ?? fallback,
    [connection],
  );

  const value: Store = {
    data, mode, loading, error, loadedAt, settings, setSettings, token, tokenStatus: status, setToken,
    connection, readOnly, reload, create, update, userName, choices, toast, toasts, dismissToast,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
