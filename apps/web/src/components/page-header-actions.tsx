import { createContext, useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export const PageHeaderActionsContext = createContext<HTMLDivElement | null>(null);

/** Keep page actions next to their forms while rendering them in the shared header. */
export function PageHeaderActions({ children }: { children: ReactNode }) {
  const target = useContext(PageHeaderActionsContext);
  return target ? createPortal(children, target) : null;
}
