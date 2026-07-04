import { ExternalLink } from 'lucide-react';
import { usePaperlessBaseUrl } from '@/api/connection';
import { paperlessDocumentUrl } from '@/lib/paperless';

/** "doc #N", deep-linking into paperless; plain text when no connection is known. */
export function DocumentLink({ documentId }: { documentId: number }) {
  const base = usePaperlessBaseUrl();
  if (!base) return <span className="text-muted-foreground">doc #{documentId}</span>;
  return (
    <a
      href={paperlessDocumentUrl(base, documentId)}
      target="_blank"
      rel="noreferrer"
      // Often sits inside a clickable row: follow the link without also firing the row action.
      onClick={(e) => e.stopPropagation()}
      title="Open in paperless"
      className="inline-flex items-center gap-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
    >
      doc #{documentId}
      <ExternalLink className="size-3" />
    </a>
  );
}
