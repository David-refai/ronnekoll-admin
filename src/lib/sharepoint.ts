'use client';

import * as graph from './graph';
import { EMPTY_DATA, LISTS, type Data, type ListKey, type Row } from './lists';

type ColType = 'text' | 'boolean' | 'number' | 'dateTime' | 'choice' | 'person' | 'lookup' | 'readonly';

interface ListMeta {
  id: string;
  /** internal name → column type */
  types: Record<string, ColType>;
  /** internal name → allowed choices */
  choices: Record<string, string[]>;
  /** display name → internal name */
  toInternal: Record<string, string>;
  /** internal name → display name */
  toDisplay: Record<string, string>;
}

export interface Connection {
  siteId: string;
  siteName: string;
  lists: Partial<Record<ListKey, ListMeta>>;
  missing: string[];
}

const SYSTEM = new Set([
  '@odata.etag', 'id', 'ContentType', 'Modified', 'Created', 'AuthorLookupId', 'EditorLookupId', '_UIVersionString',
  'Attachments', 'Edit', 'LinkTitleNoMenu', 'LinkTitle', 'ItemChildCount', 'FolderChildCount', '_ComplianceFlags',
  '_ComplianceTag', '_ComplianceTagWrittenTime', '_ComplianceTagUserId', 'AppAuthorLookupId', 'AppEditorLookupId',
]);

const norm = (s: string) => s.normalize('NFC').trim().toLowerCase();

export async function connect(hostname: string, sitePath: string): Promise<Connection> {
  const site = await graph.getSite(hostname, sitePath);
  const all = await graph.getLists(site.id);
  const conn: Connection = { siteId: site.id, siteName: site.displayName, lists: {}, missing: [] };

  await Promise.all(
    (Object.keys(LISTS) as ListKey[]).map(async (key) => {
      const want = norm(LISTS[key]);
      const found = all.find((l) => norm(l.displayName) === want || norm(l.name) === want);
      if (!found) {
        conn.missing.push(LISTS[key]);
        return;
      }
      const cols = await graph.getColumns(site.id, found.id);
      const toInternal: Record<string, string> = {};
      const toDisplay: Record<string, string> = {};
      const types: Record<string, ColType> = {};
      const choices: Record<string, string[]> = {};
      for (const c of cols) {
        if (SYSTEM.has(c.name)) continue;
        types[c.name] = c.readOnly || c.calculated ? 'readonly' : c.boolean ? 'boolean' : c.number ? 'number' : c.dateTime ? 'dateTime'
          : c.choice ? 'choice' : c.personOrGroup ? 'person' : c.lookup ? 'lookup' : 'text';
        if (c.choice?.choices) choices[c.name] = c.choice.choices;
        // Two columns can share a display name (e.g. an old "ElevID" and "ElevID" = field_2).
        let label = c.displayName;
        if (toInternal[label] && toInternal[label] !== c.name) label = `${c.displayName} (${c.name})`;
        toInternal[label] = c.name;
        toDisplay[c.name] = label;
      }
      conn.lists[key] = { id: found.id, toInternal, toDisplay, types, choices };
    }),
  );
  return conn;
}

function toRow(item: graph.SpItem, meta: ListMeta): Row {
  const row: Row = { _id: item.id, _created: item.createdDateTime, _modified: item.lastModifiedDateTime };
  for (const [k, v] of Object.entries(item.fields)) {
    if (SYSTEM.has(k)) continue;
    const lookup = k.endsWith('LookupId') ? k.slice(0, -8) : null;
    const display = meta.toDisplay[k] ?? (lookup && meta.toDisplay[lookup] ? meta.toDisplay[lookup] + 'Id' : k);
    row[display] = v;
  }
  return row;
}

export async function loadAll(conn: Connection): Promise<Data> {
  const data: Data = { ...EMPTY_DATA };
  await Promise.all(
    (Object.keys(conn.lists) as ListKey[]).map(async (key) => {
      const meta = conn.lists[key]!;
      const items = await graph.getAllItems(conn.siteId, meta.id);
      data[key] = items.map((i) => toRow(i, meta));
    }),
  );
  return data;
}

const truthy = (v: unknown) => v === true || /^(ja|yes|true|1)$/i.test(String(v ?? ''));

/** Converts display-name values to Graph fields, matching each column's real type. */
function toFields(meta: ListMeta, values: Record<string, unknown>, mode: 'create' | 'update') {
  const fields: Record<string, unknown> = {};
  for (const [k, raw] of Object.entries(values)) {
    if (k.startsWith('_')) continue;
    const internal = meta.toInternal[k];
    if (!internal) continue; // unknown column — skip rather than fail the write
    const type = meta.types[internal] ?? 'text';
    if (type === 'readonly' || type === 'person' || type === 'lookup') continue;
    const empty = raw == null || raw === '';
    if (empty) {
      if (mode === 'update') fields[internal] = null; // clears the field
      continue;
    }
    let v: unknown = raw;
    if (type === 'boolean') v = truthy(raw);
    else if (type === 'number') {
      const n = Number(raw);
      if (isNaN(n)) continue;
      v = n;
    } else if (type === 'dateTime') {
      const d = new Date(String(raw));
      if (isNaN(d.getTime())) continue;
      v = d.toISOString();
    } else if (type === 'choice') {
      v = String(raw);
      const allowed = meta.choices[internal];
      // Yes/No stored as choice: map booleans to the list's own wording
      if (typeof raw === 'boolean' && allowed) v = allowed.find((c) => truthy(c) === raw) ?? (raw ? 'Ja' : 'Nej');
    } else v = String(raw);
    fields[internal] = v;
  }
  return fields;
}

export async function create(conn: Connection, key: ListKey, values: Record<string, unknown>): Promise<Row> {
  const meta = conn.lists[key];
  if (!meta) throw new Error(`Listan ${LISTS[key]} hittades inte på webbplatsen.`);
  const item = await graph.createItem(conn.siteId, meta.id, toFields(meta, values, 'create'));
  return toRow(item, meta);
}

export async function update(conn: Connection, key: ListKey, id: string, values: Record<string, unknown>) {
  const meta = conn.lists[key];
  if (!meta) throw new Error(`Listan ${LISTS[key]} hittades inte på webbplatsen.`);
  await graph.updateItem(conn.siteId, meta.id, id, toFields(meta, values, 'update'));
}

export async function remove(conn: Connection, key: ListKey, id: string) {
  const meta = conn.lists[key];
  if (!meta) throw new Error(`Listan ${LISTS[key]} hittades inte på webbplatsen.`);
  await graph.deleteItem(conn.siteId, meta.id, id);
}

/** Allowed values of a Choice column, looked up by display name. */
export function choicesOf(conn: Connection | null, key: ListKey, column: string): string[] | undefined {
  const meta = conn?.lists[key];
  if (!meta) return undefined;
  const internal = meta.toInternal[column];
  return internal ? meta.choices[internal] : undefined;
}
