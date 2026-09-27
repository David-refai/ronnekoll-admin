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

export const DEFAULT_SETTINGS: Settings = {
  hostname: '',
  sitePath: '',
  demo: true,
  userName: 'David',
};

export function loadSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
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
