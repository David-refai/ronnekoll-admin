'use client';

import writeXlsxFile from 'write-excel-file/browser';
import { todayIso } from './format';

export interface ExportColumn<R> {
  label: string;
  value: (row: R) => string | number | null | undefined;
}

/** Exports rows to an .xlsx file with Swedish headers, e.g. Enheter_2026-09-27.xlsx */
export async function exportXlsx<R>(name: string, columns: ExportColumn<R>[], rows: R[]) {
  const header = columns.map((c) => ({ value: c.label, fontWeight: 'bold' as const }));
  const body = rows.map((r) =>
    columns.map((c) => {
      const v = c.value(r);
      return { value: typeof v === 'number' ? v : v == null ? '' : String(v) };
    }),
  );
  await writeXlsxFile([header, ...body], {
    columns: columns.map((c) => ({ width: Math.max(14, Math.min(40, c.label.length + 8)) })),
  }).toFile(`${name}_${todayIso()}.xlsx`);
}
