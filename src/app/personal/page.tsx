'use client';

import * as React from 'react';
import { Avatar, Badge, Button, DataTable, Dialog, PageHeader, Switch, TextField, type Column } from '@/ds';
import { PageState, useReady } from '@/components/PageState';
import { log } from '@/lib/actions';
import { unique } from '@/lib/derive';
import { str, withId, yes, type TRow } from '@/lib/lists';
import { useStore } from '@/lib/store';

const ROLE_FALLBACK = ['Admin', 'Ansvarig', 'Lärare'];

export default function Personal() {
  const store = useStore();
  const ready = useReady();
  const [edit, setEdit] = React.useState<TRow | 'new' | null>(null);
  const [showInactive, setShowInactive] = React.useState(false);
  const rows = withId(store.data.personal).sort((a, b) => str(a.Title).localeCompare(str(b.Title), 'sv'));
  const visible = rows.filter((r) => showInactive || r.Aktiv == null || r.Aktiv === '' || yes(r.Aktiv));

  const columns: Column<TRow>[] = [
    { key: 'Title', label: 'Namn', render: (r) => <span className="row" style={{ gap: 10 }}><Avatar name={str(r.Title) || '?'} /><span style={{ display: 'flex', flexDirection: 'column', lineHeight: '18px' }}><b>{str(r.Title)}</b><span className="rk-muted rk-small">{str(r.Epost)}</span></span></span> },
    { key: 'Roll', label: 'Roll', render: (r) => <Badge tone={str(r.Roll) === 'Admin' ? 'primary' : str(r.Roll) === 'Ansvarig' ? 'violet' : 'gray'}>{str(r.Roll) || '—'}</Badge> },
    { key: 'MinKlass', label: 'Klasser', render: (r) => (str(r.MinKlass) === 'ALLA' ? 'Alla klasser' : str(r.MinKlass) || '—') },
    { key: 'Aktiv', label: 'Aktiv', render: (r) => (r.Aktiv == null || r.Aktiv === '' || yes(r.Aktiv) ? <Badge tone="green">Ja</Badge> : <Badge tone="gray">Nej</Badge>) },
  ];

  return (
    <>
      <PageHeader title="Personal & behörigheter" description="Lärare och personal som använder lärarappen: roll och vilka klasser de ansvarar för."
        actions={<Button icon="person_add" disabled={store.readOnly} onClick={() => setEdit('new')}>Lägg till</Button>} />
      {!ready ? <PageState /> : (
        <div className="stack" style={{ gap: 20 }}>
          <Switch checked={showInactive} onChange={setShowInactive} label="Visa inaktiva" />
          <DataTable<TRow> columns={columns} rows={visible} onRowClick={(r) => setEdit(r)} />
        </div>
      )}
      {edit && <StaffDialog row={edit === 'new' ? null : edit} classes={unique(store.data.elever.map((e) => str(e.Klass)))} onClose={() => setEdit(null)} />}
    </>
  );
}

function StaffDialog({ row, classes, onClose }: { row: TRow | null; classes: string[]; onClose(): void }) {
  const store = useStore();
  const roles = store.choices('personal', 'Roll', ROLE_FALLBACK);
  const [name, setName] = React.useState(str(row?.Title));
  const [mail, setMail] = React.useState(str(row?.Epost));
  const [roll, setRoll] = React.useState(str(row?.Roll) || 'Lärare');
  const initial = str(row?.MinKlass);
  const [alla, setAlla] = React.useState(initial === 'ALLA');
  const [kl, setKl] = React.useState<string[]>(initial && initial !== 'ALLA' ? initial.split(/[,;\s]+/).filter(Boolean) : []);
  const [aktiv, setAktiv] = React.useState(row ? row.Aktiv == null || row.Aktiv === '' || yes(row.Aktiv) : true);
  const [busy, setBusy] = React.useState(false);

  const save = async () => {
    setBusy(true);
    const values = { Title: name.trim(), Epost: mail.trim().toLowerCase(), Roll: roll, MinKlass: alla ? 'ALLA' : kl.join(', '), Aktiv: aktiv ? 'Ja' : 'Nej' };
    try {
      if (row) await store.update('personal', row._id, values);
      else await store.create('personal', values);
      await log(store, { typ: 'Behörighet', detaljer: `${values.Title}: ${values.Roll}, klasser ${values.MinKlass || '—'}${aktiv ? '' : ', inaktiv'}` });
      store.toast({ icon: 'check_circle', message: `${values.Title} sparad` });
      onClose();
    } catch (e) {
      store.toast({ icon: 'error', message: e instanceof Error ? e.message : String(e) });
      setBusy(false);
    }
  };

  return (
    <Dialog open onClose={onClose} icon="badge" title={row ? str(row.Title) : 'Lägg till personal'}
      actions={<><Button variant="text" onClick={onClose}>Avbryt</Button><Button disabled={!name.trim() || !mail.includes('@') || busy || store.readOnly} onClick={save}>Spara</Button></>}>
      <div className="form-grid">
        <TextField label="Namn" value={name} onChange={(e) => setName(e.target.value)} />
        <TextField label="E-post" value={mail} onChange={(e) => setMail(e.target.value)} placeholder="fornamn.efternamn@malmo.se" />
      </div>
      <div>
        <label className="field-label" htmlFor="st-roll">Roll i lärarappen</label>
        <select id="st-roll" className="select" value={roll} onChange={(e) => setRoll(e.target.value)}>{roles.map((r) => <option key={r}>{r}</option>)}</select>
      </div>
      <Switch checked={alla} onChange={setAlla} label="Ansvarar för alla klasser" />
      {!alla && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {classes.map((k) => (
            <button key={k} type="button" className={`rk-chip rk-chip--filter${kl.includes(k) ? ' is-on' : ''}`} onClick={() => setKl(kl.includes(k) ? kl.filter((x) => x !== k) : [...kl, k])}>{k}</button>
          ))}
        </div>
      )}
      <Switch checked={aktiv} onChange={setAktiv} label="Aktiv" />
    </Dialog>
  );
}
