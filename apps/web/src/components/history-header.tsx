import { Link, useSearchParams } from 'react-router';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { useAuditDetail } from '@/api/audit';
import { usePaperlessBaseUrl } from '@/api/connection';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/I18nProvider';
import { paperlessDocumentUrl } from '@/lib/paperless';

export function HistoryHeader({ id }: { id: number }) {
  const { t } = useTranslation();
  const detail = useAuditDetail(id);
  const base = usePaperlessBaseUrl();
  const [params] = useSearchParams();
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <nav
        aria-label={t('history.backToHistory')}
        className="flex min-w-0 items-center gap-2 text-sm"
      >
        <Link
          to={`/history${params.size ? `?${params}` : ''}`}
          className="text-muted-foreground hover:text-foreground hover:underline"
        >
          {t('nav.meta.history.title')}
        </Link>
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
        <h1 aria-current="page" className="truncate font-semibold tracking-tight">
          {detail.data
            ? t('review.documentNumber', { documentId: detail.data.documentId })
            : t('history.runLabel', { id })}
        </h1>
      </nav>
      {base && detail.data && (
        <Button asChild variant="ghost" size="sm" className="ml-auto">
          <a
            href={paperlessDocumentUrl(base, detail.data.documentId)}
            target="_blank"
            rel="noreferrer"
            aria-label={t('review.openInPaperless')}
            title={t('review.openInPaperless')}
          >
            <span className="hidden md:inline">{t('review.openInPaperless')}</span>
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      )}
    </div>
  );
}
