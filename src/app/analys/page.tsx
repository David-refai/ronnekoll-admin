'use client';

import { useRouter } from 'next/navigation';
import { Button, EmptyState, PageHeader } from '@/ds';

export default function Analys() {
  const router = useRouter();
  return (
    <>
      <PageHeader title="Analys" />
      <div className="rk-card" style={{ padding: 0 }}>
        <EmptyState icon="monitoring" title="Under uppbyggnad" description="Analys är designad och byggs i ett senare steg. Rapporter har redan det mesta som Excel-export."
          action={<Button variant="tonal" icon="summarize" onClick={() => router.push('/rapporter')}>Öppna Rapporter</Button>} />
      </div>
    </>
  );
}
