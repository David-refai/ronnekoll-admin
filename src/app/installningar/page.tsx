'use client';

import * as React from 'react';
import { Badge, Banner, Button, Icon, PageHeader, StatusBadge, Switch, TextField, TokenStatus } from '@/ds';
import { LISTS, type ListKey } from '@/lib/lists';
import { useStore } from '@/lib/store';
import { shortDate } from '@/lib/format';
import * as graph from '@/lib/graph';
import { DEFAULT_SITE, parseSharePoint } from '@/lib/settings';
import { TokenButtons } from '@/components/TokenHelp';
import { useInstall } from '@/components/Pwa';
import { ProvisionLists } from '@/components/ProvisionLists';

export default function Installningar() {
  const store = useStore();
  const [raw, setRaw] = React.useState('');
  const siteUrl = (h: string, p: string) => (h ? `https://${h}${p === '/' ? '' : p}` : '');
  const [address, setAddress] = React.useState(siteUrl(store.settings.hostname, store.settings.sitePath));
  const [name, setName] = React.useState(store.settings.userName);
  const [test, setTest] = React.useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    setAddress(siteUrl(store.settings.hostname, store.settings.sitePath));
    setName(store.settings.userName);
  }, [store.settings]);

  const t = store.token;
  const app = useInstall();
  const ts = store.tokenStatus;

  const saveToken = () => {
    if (!raw.trim()) return;
    store.setToken(raw);
    setRaw('');
    setTest(null);
    if (!store.settings.demo) window.setTimeout(() => store.reload(), 0);
  };

  const parsed = parseSharePoint(address);

  const saveSite = () => {
    if (!parsed) return;
    // Saving a real address switches Demoläge off.
    store.setSettings({ ...store.settings, ...parsed, demo: false, userName: name.trim() || 'David' });
  };

  const testConnection = async () => {
    setBusy(true);
    setTest(null);
    try {
      const who = await graph.me();
      let msg = `Inloggad som ${who.displayName}.`;
      const target = parsed ?? (store.settings.hostname ? { hostname: store.settings.hostname, sitePath: store.settings.sitePath } : null);
      if (target) {
        const site = await graph.getSite(target.hostname, target.sitePath);
        msg += ` Webbplats: ${site.displayName}.`;
      }
      setTest({ ok: true, msg });
    } catch (e) {
      setTest({ ok: false, msg: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
    }
  };

  const conn = store.connection;

  return (
    <>
      <PageHeader title="Inställningar" description="Token, SharePoint-webbplats och datakälla." />

      <section className="rk-card stack" style={{ gap: 12, maxWidth: 880 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="section-title">Installera appen</h2>
          {app.installed && <Badge tone="green" icon="check_circle">Installerad</Badge>}
        </div>
        {app.installed ? (
          <p className="small muted" style={{ margin: 0 }}>RönneKoll körs som app. Uppdateringar kommer automatiskt nästa gång du öppnar den.</p>
        ) : app.canPrompt ? (
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <Button icon="install_mobile" onClick={app.install}>Installera RönneKoll</Button>
            <span className="small muted">Lägger till appen på hemskärmen / i startmenyn.</span>
          </div>
        ) : app.ios ? (
          <p className="small" style={{ margin: 0 }}>På iPhone/iPad: öppna sidan i <b>Safari</b>, tryck på <b>Dela</b> <span className="rk-icon" aria-hidden style={{ fontSize: 16, verticalAlign: 'middle' }}>ios_share</span> och välj <b>Lägg till på hemskärmen</b>.</p>
        ) : (
          <p className="small" style={{ margin: 0 }}>Android/Chrome/Edge: öppna webbläsarens meny <b>⋮</b> och välj <b>Installera app</b> eller <b>Lägg till på startskärmen</b>. Kräver att sidan är publicerad med https (t.ex. GitHub Pages).</p>
        )}
      </section>

      <section className="rk-card stack" style={{ gap: 16, maxWidth: 880 }}>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <h2 className="section-title">Token</h2>
          {store.mode === 'live' && t && <TokenStatus state={ts.state === 'none' ? 'expired' : ts.state} minutes={ts.minutes} />}
        </div>
        <p className="small muted" style={{ margin: 0 }}>
          1. Öppna Graph Explorer och logga in med ditt malmo.se-konto. 2. Under <b>Modify permissions</b>: <span className="mono">Sites.ReadWrite.All</span> (och <span className="mono">Sites.Manage.All</span> för att kunna skapa listor).
          3. Fliken <b>Access token</b> → kopiera. 4. Tryck <b>Klistra in token från urklipp</b>.
          Token sparas bara i minnet och i den här fliken (sessionStorage) — den försvinner när du stänger fliken.
        </p>
        <TokenButtons onSaved={() => setTest(null)} />
        <TextField label="Access token" mono multiline rows={4} placeholder="eyJ0eXAiOiJKV1Qi…" value={raw}
          onChange={(e) => setRaw(e.target.value)} />
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <Button icon="content_paste" disabled={!raw.trim()} onClick={saveToken}>Spara token</Button>
          <Button variant="outlined" icon="network_check" disabled={!t || busy} onClick={testConnection}>Testa anslutning</Button>
          {t && <Button variant="danger-text" icon="logout" onClick={() => store.setToken(null)}>Ta bort token</Button>}
        </div>
        {t && (
          <dl className="kv">
            <dt>Användare</dt><dd>{t.name ?? '—'} {t.upn && <span className="muted mono small">({t.upn})</span>}</dd>
            <dt>Går ut</dt><dd>{t.expiresAt ? `${new Date(t.expiresAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })} · ${shortDate(new Date(t.expiresAt).toISOString())}` : 'Okänt'}{ts.minutes != null && ts.state !== 'expired' ? ` (om ${ts.minutes} min)` : ''}</dd>
            <dt>Behörigheter</dt><dd className="small">{t.scopes?.join(', ') || '—'}</dd>
          </dl>
        )}
        {t?.scopes && !t.scopes.some((s) => /^Sites\.(ReadWrite|Manage|FullControl)\.All$/.test(s)) && (
          <Banner tone="warning" title="Token saknar skrivbehörighet">Utan Sites.ReadWrite.All kan appen läsa men inte spara ändringar.</Banner>
        )}
        {test && <Banner tone={test.ok ? 'success' : 'error'} title={test.ok ? 'Anslutningen fungerar' : 'Anslutningen misslyckades'}>{test.msg}</Banner>}
      </section>

      <section className="rk-card stack" style={{ gap: 16, maxWidth: 880 }}>
        <h2 className="section-title">Datakälla</h2>
        <Switch
          checked={store.settings.demo}
          onChange={(v) => store.setSettings({ ...store.settings, demo: v })}
          label={<span><b>Demoläge</b> — använd exempeldata i stället för SharePoint. Inget sparas.</span>}
        />
        <div className="form-grid">
          <TextField className="full" label="SharePoint-adress" value={address} onChange={(e) => setAddress(e.target.value)}
            placeholder="https://cityofmalmo.sharepoint.com/sites/GRFRnnenskolan"
            error={address.trim() && !parsed ? 'Det här ser inte ut som en SharePoint-adress' : undefined}
            helper={parsed ? `Webbplats: ${parsed.hostname}${parsed.sitePath === '/' ? '' : parsed.sitePath} — klistra gärna in en länk till valfri lista, appen hittar själv alla listor` : 'Klistra in länken till webbplatsen eller till någon av listorna'} />
          <TextField label="Ditt namn i Aktivitetslogg" value={name} onChange={(e) => setName(e.target.value)} helper="Används om token saknar namn" />
        </div>
        <div className="row">
          <Button icon="save" onClick={saveSite} disabled={!parsed}>Spara och anslut</Button>
          {(store.settings.hostname !== DEFAULT_SITE.hostname || store.settings.sitePath !== DEFAULT_SITE.sitePath) && (
            <Button variant="text" icon="restart_alt" onClick={() => store.setSettings({ ...store.settings, ...DEFAULT_SITE, demo: false })}>Rönnenskolans adress</Button>
          )}
          <Button variant="outlined" icon="refresh" onClick={() => store.reload()} disabled={store.loading}>Hämta data igen</Button>
          {store.loadedAt && <span className="small muted">Senast hämtat {store.loadedAt.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        {store.error && <Banner tone="error" title="Fel vid hämtning">{store.error}</Banner>}
      </section>

      {store.mode === 'live' && (
        <section className="rk-card stack" style={{ gap: 12, maxWidth: 880 }}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h2 className="section-title">SharePoint-listor</h2>
            {conn && <Badge tone="primary" icon="cloud_done">{conn.siteName}</Badge>}
          </div>
          <p className="small muted" style={{ margin: 0 }}>Appen hittar listorna på namn och kolumnerna på visningsnamn, så interna namn som field_2 spelar ingen roll.</p>
          <ProvisionLists keys={['brandslackare', 'brandkontroller']} compact />
          <div className="stack" style={{ gap: 8 }}>
            {(Object.keys(LISTS) as ListKey[]).map((k) => {
              const found = conn?.lists[k];
              return (
                <div key={k} className="row" style={{ justifyContent: 'space-between', borderBottom: '1px solid var(--line)', paddingBottom: 8 }}>
                  <span className="row" style={{ gap: 8 }}><Icon name="list_alt" size={20} />{LISTS[k]}</span>
                  <span className="row" style={{ gap: 8 }}>
                    {found && <span className="small muted">{store.data[k].length} rader · {Object.keys(found.toInternal).length} kolumner</span>}
                    {conn ? (found ? <StatusBadge status="Klar" label="Hittad" /> : <StatusBadge status="Avvisad" label="Saknas" />) : <span className="small muted">Inte ansluten</span>}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </>
  );
}
