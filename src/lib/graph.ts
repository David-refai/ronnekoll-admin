'use client';

import { getToken } from './token';

const GRAPH = 'https://graph.microsoft.com/v1.0';

export class GraphError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function call<T>(url: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  if (!token) throw new GraphError(401, 'Ingen token. Klistra in en token under Inställningar.');
  const res = await fetch(url.startsWith('http') ? url : GRAPH + url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const j = await res.json();
      if (j?.error?.message) msg = `${res.status}: ${j.error.message}`;
    } catch {
      /* ignore */
    }
    if (res.status === 401) msg = 'Token har gått ut eller saknar behörighet (401).';
    throw new GraphError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface SpColumn {
  name: string;
  displayName: string;
  readOnly?: boolean;
  hidden?: boolean;
}

export interface SpList {
  id: string;
  displayName: string;
  name: string;
}

export interface SpItem {
  id: string;
  createdDateTime: string;
  lastModifiedDateTime: string;
  fields: Record<string, unknown>;
}

export async function getSite(hostname: string, sitePath: string) {
  const path = sitePath.startsWith('/') ? sitePath : '/' + sitePath;
  return call<{ id: string; displayName: string; webUrl: string }>(`/sites/${hostname}:${path}`);
}

export async function getLists(siteId: string) {
  const r = await call<{ value: SpList[] }>(`/sites/${siteId}/lists?$select=id,displayName,name&$top=200`);
  return r.value;
}

export async function getColumns(siteId: string, listId: string) {
  const r = await call<{ value: SpColumn[] }>(
    `/sites/${siteId}/lists/${listId}/columns?$select=name,displayName,readOnly,hidden`,
  );
  return r.value;
}

export async function getAllItems(siteId: string, listId: string) {
  const out: SpItem[] = [];
  let next: string | undefined = `/sites/${siteId}/lists/${listId}/items?$expand=fields&$top=999`;
  while (next) {
    const page: { value: SpItem[]; '@odata.nextLink'?: string } = await call(next);
    out.push(...page.value);
    next = page['@odata.nextLink'];
  }
  return out;
}

export async function createItem(siteId: string, listId: string, fields: Record<string, unknown>) {
  return call<SpItem>(`/sites/${siteId}/lists/${listId}/items`, {
    method: 'POST',
    body: JSON.stringify({ fields }),
  });
}

export async function updateItem(siteId: string, listId: string, itemId: string, fields: Record<string, unknown>) {
  return call<Record<string, unknown>>(`/sites/${siteId}/lists/${listId}/items/${itemId}/fields`, {
    method: 'PATCH',
    body: JSON.stringify(fields),
  });
}

export async function me() {
  return call<{ displayName: string; mail: string; userPrincipalName: string }>('/me?$select=displayName,mail,userPrincipalName');
}
