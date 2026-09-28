'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';

/** Renders overlays at <body> so dialogs opened from inside a side sheet are not clipped or transformed. */
export function Portal({ children }: { children: React.ReactNode }) {
  const [el, setEl] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => setEl(document.body), []);
  return el ? createPortal(children, el) : null;
}
