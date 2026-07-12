/**
 * The brand-tinted active-item look, shared by the sidebar and any other in-app
 * nav list so the tint lives in ONE place (no copy-pasted magic string to drift).
 * Relies on a `data-active` attribute on the element. Set `data-active={isActive}`.
 */
export const ACTIVE_NAV_ITEM = 'data-[active=true]:bg-brand/20 data-[active=true]:text-foreground';
