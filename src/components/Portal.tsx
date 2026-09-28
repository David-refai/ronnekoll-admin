'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

/** Renders overlays at <body> so dialogs opened from inside a side sheet are not clipped or transformed. */
export function Portal({ children }: { children: React.ReactNode }) {
  // Overlays only open after a click, so document exists; render straight away so refs are ready.
  const [el, setEl] = React.useState<HTMLElement | null>(() => (typeof document !== 'undefined' ? document.body : null));
  React.useEffect(() => setEl(document.body), []);
  return el ? createPortal(children, el) : null;
}
