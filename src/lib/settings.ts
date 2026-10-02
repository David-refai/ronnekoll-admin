'use client';

/** Non-secret app settings (site address, demo mode). Stored in localStorage. */

export interface Settings {
  /** e.g. malmostad.sharepoint.com */
  hostname: string;
  /** e.g. /sites/Ronnenskolan-IT */
  sitePath: string;
  /** Use built-in sample data instead of SharePoint. */
  demo: boolean;
  /** The display name written to Aktivitetslogg.Användare when the token has no name. */
  userName: string;
}

const KEY = 'rk.settings';

/** Rönnenskolan's SharePoint site — the default everywhere, can be changed under Inställningar. */
export const DEFAULT_SITE = { hostname: 'cityofmalmo.sharepoint.com', sitePath: '/sites/GRFRnnenskolan' };

export const DEFAULT_SETTINGS: Settings = {
  ...DEFAULT_SITE,
  demo: false,
  userName: 'David',
};

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } as Settings;
      // An empty saved address falls back to the school's site.
      if (!s.hostname) return { ...s, ...DEFAULT_SITE };
      return s;
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(s: Settings) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/** Accepts any SharePoint link (site, list or item) and returns host + site path. */
export function parseSharePoint(input: string): { hostname: string; sitePath: string } | null {
  const v = input.trim();
  if (!v) return null;
  const m = v.match(/^(?:https?:\/\/)?([^/\s]+\.sharepoint\.com)((?:\/(?:sites|teams)\/[^/?#\s]+)?)/i);
  if (!m) return null;
  return { hostname: m[1].toLowerCase(), sitePath: m[2] || '/' };
}

