'use client';

import * as React from 'react';
import { Button, Dialog } from '@/ds';
import { useStore } from '@/lib/store';
import { Portal } from '@/components/Portal';

/** Destructive confirmation that names the exact object. */
export function ConfirmDelete({
  title,
  children,
  blocked,
  onConfirm,
  onClose,
}: {
  title: string;
  children?: React.ReactNode;
  blocked?: string | null;
  onConfirm(): Promise<void>;
  onClose(): void;
}) {
  const store = useStore();
  const [busy, setBusy] = React.useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await onConfirm();
      onClose();
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };
  return (
    <Portal>
    <Dialog open onClose={onClose} tone="danger" icon="delete" title={title}
      actions={<><Button variant="text" onClick={onClose}>Avbryt</Button><Button variant="danger" disabled={!!blocked || busy || store.readOnly} onClick={run}>Ta bort</Button></>}>
      {children}
      {blocked ? <span className="small" style={{ color: 'var(--status-red)', fontWeight: 600 }}>{blocked}</span> : <span className="small muted">Raden tas bort från SharePoint. Det går inte att ångra, men borttagningen loggas i Aktivitetslogg.</span>}
    </Dialog>
    </Portal>
  );
}
