'use client';

import { useParams, useRouter } from 'next/navigation';
import { Button, EmptyState, NAV, PageHeader } from '@/ds';
import { ROUTES } from '@/components/Shell';

/** Screens that are designed but not built yet. */
export default function ComingSoon() {
  const { section } = useParams<{ section: string }>();
  const router = useRouter();
  const id = Object.keys(ROUTES).find((k) => ROUTES[k] === '/' + section);
  const item = NAV.flatMap((g) => g.items).find((i) => i.id === id);

  if (!item) {
    return (
      <div className="rk-card" style={{ padding: 0 }}>
        <EmptyState icon="explore_off" title="Sidan finns inte" description={`/${section} finns inte i RönneKoll.`}
          action={<Button variant="tonal" icon="home" onClick={() => router.push('/')}>Till Översikt</Button>} />
      </div>
    );
  }
  return (
    <>
      <PageHeader title={item.label} />
      <div className="rk-card" style={{ padding: 0 }}>
        <EmptyState icon={item.icon} title="Under uppbyggnad"
          description={`${item.label} är designad och byggs i nästa steg. Översikt, Enheter och Inställningar fungerar redan.`}
          action={<Button variant="tonal" icon="laptop_chromebook" onClick={() => router.push('/enheter')}>Öppna Enheter</Button>} />
      </div>
    </>
  );
}
