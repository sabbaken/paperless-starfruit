import { useState } from 'react';
import { ArrowUpCircle, X } from 'lucide-react';
import { useVersion } from '@/api/version';

const DISMISSED_KEY = 'paperless-starfruit:dismissed-update';

/**
 * A compact "new release available" notice for the sidebar footer. Shows only
 * when the backend reports an update and the user hasn't dismissed *this*
 * version. Dismissal is per-version, so the next release re-surfaces it.
 * Hidden when the sidebar is collapsed to icons.
 */
export function UpdateNotice() {
  const { data } = useVersion();
  const latest = data?.updateAvailable ? data.latest : null;
  const [dismissed, setDismissed] = useState<string | null>(readDismissed);

  if (!latest || dismissed === latest) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISSED_KEY, latest);
    } catch {
      /* storage disabled (private mode): just hide for this session */
    }
    setDismissed(latest);
  };

  return (
    <div className="flex items-start gap-2 rounded-md border border-brand/30 bg-brand/10 p-2 text-xs group-data-[collapsible=icon]:hidden">
      <ArrowUpCircle className="mt-0.5 size-4 shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">Update available</p>
        {data?.releaseUrl ? (
          <a
            href={data.releaseUrl}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
          >
            v{latest}: view release
          </a>
        ) : (
          <p className="text-muted-foreground">v{latest}</p>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss update notice"
        className="-mt-0.5 -mr-0.5 shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}
