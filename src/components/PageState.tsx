'use client';

import { Button, EmptyState, Skeleton } from '@/ds';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { TokenButtons } from '@/components/TokenHelp';

/** Loading skeleton / error state shared by all data pages. Returns null when data is ready. */
export function PageState({ rows = 8 }: { rows?: number }) {
  const store = useStore();
  const router = useRouter();
  if (store.error) {
    const needsSetup = /Inställningar/.test(store.error);
    const needsToken = /token/i.test(store.error);
    if (needsToken) {
      return (
        <div className="rk-card" style={{ padding: 0 }}>
          <EmptyState icon="key" tone="amber" title="Klistra in en token"
            description="Kopiera Access token i Graph Explorer och tryck på knappen — SharePoint-adressen är redan ifylld."
            action={<div style={{ display: 'flex', justifyContent: 'center' }}><TokenButtons /></div>} />
        </div>
      );
    }
    return (
      <div className="rk-card" style={{ padding: 0 }}>
        <EmptyState
          icon={needsSetup ? 'settings' : 'cloud_off'}
          tone="red"
          title={needsSetup ? 'Anslutning saknas' : 'Kunde inte hämta data'}
          description={store.error}
          action={
            needsSetup ? (
              <Button variant="tonal" icon="settings" onClick={() => router.push('/installningar')}>Öppna Inställningar</Button>
            ) : (
              <Button variant="outlined" icon="refresh" onClick={() => store.reload()}>Försök igen</Button>
            )
          }
        />
      </div>
    );
  }
  if (store.loading && !store.loadedAt) {
    return (
      <div className="rk-card" aria-busy="true" aria-label="Laddar">
        <div className="stack">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} width={`${60 + ((i * 17) % 35)}%`} />
          ))}
        </div>
      </div>
    );
  }
  return null;
}

export function useReady() {
  const s = useStore();
  return !s.error && !(s.loading && !s.loadedAt);
}
