import { Link } from 'react-router';
import { ChevronRight, ExternalLink } from 'lucide-react';
import { useReviewDetail, useReviewList } from '@/api/review';
import { usePaperlessBaseUrl } from '@/api/connection';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/i18n/I18nProvider';
import { paperlessDocumentUrl } from '@/lib/paperless';

export function ReviewHeader({ id }: { id: number }) {
  const { t } = useTranslation();
  const detail = useReviewDetail(id);
  const queue = useReviewList();
  const base = usePaperlessBaseUrl();
  const index = queue.data?.findIndex((item) => item.id === id) ?? -1;

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <nav aria-label={t('review.backToQueue')} className="flex min-w-0 items-center gap-2 text-sm">
        <Link to="/review" className="text-muted-foreground hover:text-foreground hover:underline">
          {t('nav.meta.review.title')}
        </Link>
        {detail.data && (
          <>
            <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            <h1 aria-current="page" className="truncate font-semibold tracking-tight">
              {t('review.documentNumber', { documentId: detail.data.documentId })}
            </h1>
          </>
        )}
      </nav>
      <div className="ml-auto flex items-center gap-3">
        {index >= 0 && (
          <span
            className="text-xs text-muted-foreground tabular-nums"
            aria-label={t('review.position', {
              current: index + 1,
              total: queue.data?.length ?? 0,
            })}
          >
            <span className="sm:hidden">
              {index + 1} / {queue.data?.length}
            </span>
            <span className="hidden sm:inline">
              {t('review.position', { current: index + 1, total: queue.data?.length ?? 0 })}
            </span>
          </span>
        )}
        {base && detail.data && (
          <Button asChild variant="ghost" size="sm">
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
    </div>
  );
}
