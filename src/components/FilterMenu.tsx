'use client';

import * as React from 'react';
import { Chip, Icon } from '@/ds';

/** A filter chip with a dropdown menu of options (single select). */
export function FilterMenu({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { value: string; label?: string; count?: number }[];
  onChange(v: string | null): void;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div className="chip-wrap" ref={ref}>
      <Chip
        label={value ? `${label}: ${options.find((o) => o.value === value)?.label ?? value}` : label}
        selected={!!value}
        dropdown
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="menu" role="menu">
          {value && (
            <button type="button" onClick={() => { onChange(null); setOpen(false); }}>
              <Icon name="close" size={18} /> Alla
            </button>
          )}
          {options.map((o) => (
            <button key={o.value} type="button" role="menuitemradio" aria-checked={o.value === value} className={o.value === value ? 'is-on' : undefined}
              onClick={() => { onChange(o.value); setOpen(false); }}>
              <Icon name={o.value === value ? 'check' : 'blank'} size={18} />
              <span style={{ flex: 1 }}>{o.label ?? o.value}</span>
              {o.count != null && <span className="muted small">{o.count}</span>}
            </button>
          ))}
          {options.length === 0 && <div className="small muted" style={{ padding: 12 }}>Inga värden</div>}
        </div>
      )}
    </div>
  );
}
