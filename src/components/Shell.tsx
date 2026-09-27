'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Avatar, Badge, Banner, Button, IconButton, NAV, NavDrawer, SearchBar, Snackbar, TokenStatus } from '@/ds';
import { useStore } from '@/lib/store';
import { buildDevices, isOpenCase, serialKey } from '@/lib/derive';
import { str } from '@/lib/lists';

export const ROUTES: Record<string, string> = {
  oversikt: '/',
  analys: '/analys',
  enheter: '/enheter',
  importera: '/importera',
  inventering: '/inventering',
  etiketter: '/etiketter',
  elever: '/elever',
  tilldelning: '/tilldelning',
  aterlamning: '/aterlamning',
  utlaning: '/utlaning',
  felanmalningar: '/felanmalningar',
  skolarenden: '/skolarenden',
  losenord: '/losenord',
  rapporter: '/rapporter',
  logg: '/logg',
  personal: '/personal',
  datakvalitet: '/datakvalitet',
  installningar: '/installningar',
};

function activeId(path: string) {
  if (path === '/') return 'oversikt';
  const seg = path.split('/')[1];
  return Object.keys(ROUTES).find((k) => ROUTES[k] === '/' + seg) ?? '';
}

function useTheme() {
  const [dark, setDark] = React.useState(false);
  React.useEffect(() => setDark(document.documentElement.getAttribute('data-theme') === 'dark'), []);
  const toggle = () => {
    const next = dark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem('rk.theme', next);
    } catch {
      /* ignore */
    }
    setDark(!dark);
  };
  return { dark, toggle };
}

export function Shell({ children }: { children: React.ReactNode }) {
  const store = useStore();
  const router = useRouter();
  const path = usePathname();
  const { dark, toggle } = useTheme();
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileNav, setMobileNav] = React.useState(false);
  React.useEffect(() => setMobileNav(false), [path]);
  const searchWrap = React.useRef<HTMLDivElement>(null);

  // Scan-first screens use the collapsed rail for more room
  React.useEffect(() => {
    setCollapsed(['/inventering', '/tilldelning', '/aterlamning'].some((p) => path.startsWith(p)));
  }, [path]);

  // Ctrl/Cmd + K focuses the scan/search field
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchWrap.current?.querySelector('input')?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const d = store.data;
  const counts: Record<string, number> = {
    felanmalningar: d.felanmalningar.filter((f) => isOpenCase(f.Status)).length,
    skolarenden: d.skolarenden.filter((f) => isOpenCase(f.Status)).length,
    losenord: d.losenord.filter((p) => str(p.Status) !== 'Klart').length,
  };
  const groups = NAV.map((g) => ({
    ...g,
    items: g.items.map((it) => ({ ...it, count: counts[it.id] || undefined })),
  }));
  const notifications = counts.felanmalningar + counts.skolarenden + counts.losenord;

  const onSearch = (raw: string) => {
    const q = raw.trim();
    if (!q) return;
    const key = serialKey(q);
    const devices = buildDevices(store.data);
    const dev = devices.find((x) => serialKey(x.serial) === key || serialKey(x.assetId) === key);
    if (dev) {
      router.push(`/enheter?open=${encodeURIComponent(dev.serial)}`);
    } else if (/^[0-9][abc]$/i.test(q)) {
      router.push(`/enheter?klass=${encodeURIComponent(q.toUpperCase())}`);
    } else {
      router.push(`/enheter?q=${encodeURIComponent(q)}`);
    }
    const input = searchWrap.current?.querySelector('input');
    if (input) input.value = '';
  };

  const ts = store.tokenStatus;
  const tokenPill =
    store.mode === 'demo' ? (
      <button type="button" className="rk-tokenpill rk-badge--gray" onClick={() => router.push('/installningar')} title="Inställningar">
        <span className="rk-icon" style={{ fontSize: 18, width: 18, height: 18 }} aria-hidden>science</span>
        <span>Demoläge</span>
      </button>
    ) : (
      <TokenStatus
        state={ts.state === 'none' ? 'expired' : ts.state}
        minutes={ts.minutes}
        onClick={() => router.push('/installningar')}
      />
    );

  const showTokenBanner = store.mode === 'live' && (ts.state === 'expired' || ts.state === 'none') && path !== '/installningar';

  return (
    <div className="rk-shell">
      <div className="app-nav">
        <NavDrawer
          groups={groups}
          active={activeId(path)}
          collapsed={collapsed}
          onToggle={() => setCollapsed((c) => !c)}
          onSelect={(id) => router.push(ROUTES[id] ?? '/')}
        />
      </div>
      <div className="rk-shell__main">
        <header className="rk-topbar app-topbar">
          <span className="app-menu-btn">
            <IconButton icon="menu" label="Meny" onClick={() => setMobileNav(true)} />
          </span>
          <div className="rk-topbar__search" ref={searchWrap}>
            <SearchBar onSubmit={onSearch} />
          </div>
          <div className="rk-topbar__actions">
            {tokenPill}
            <IconButton icon="notifications" label="Aviseringar" badge={notifications || undefined} onClick={() => router.push('/felanmalningar')} />
            <IconButton icon={dark ? 'light_mode' : 'dark_mode'} label="Byt tema" onClick={toggle} />
            <Avatar name={store.userName} />
          </div>
        </header>
        {showTokenBanner && (
          <Banner
            tone="error"
            title={ts.state === 'none' ? 'Ingen token' : 'Token har gått ut'}
            action={<Button variant="danger" icon="content_paste" onClick={() => router.push('/installningar')}>Klistra in ny token</Button>}
          >
            Du ser data från senaste hämtningen. Inget kan sparas förrän du klistrar in en ny token.
          </Banner>
        )}
        {store.mode === 'demo' && path === '/' && (
          <div className="app-demo">
            <Badge tone="gray" icon="science">Demoläge — exempeldata. Anslut SharePoint under Inställningar.</Badge>
          </div>
        )}
        <main className="rk-shell__content">{children}</main>
      </div>
      {mobileNav && (
        <div className="rk-scrim app-mobile-nav" onClick={(e) => e.target === e.currentTarget && setMobileNav(false)}>
          <NavDrawer groups={groups} active={activeId(path)} onSelect={(id) => router.push(ROUTES[id] ?? '/')} />
        </div>
      )}
      <div className="app-toasts">
        {store.toasts.map((t) => (
          <Snackbar
            key={t.id}
            icon={t.icon}
            message={t.message}
            actionLabel={t.onAction ? t.actionLabel || 'Ångra' : false}
            onAction={() => {
              t.onAction?.();
              store.dismissToast(t.id);
            }}
            onClose={() => store.dismissToast(t.id)}
          />
        ))}
      </div>
    </div>
  );
}
