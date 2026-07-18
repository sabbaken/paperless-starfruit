import { useState } from 'react';
import { ArrowLeft, Check, ExternalLink, Inbox, Loader2, Sparkles, X } from 'lucide-react';
import type { ReviewDetail, ReviewItemView } from '@paperless-starfruit/shared';
import {
  useApproveReview,
  useBulkApproveReview,
  useRejectReview,
  useReviewDetail,
  useReviewList,
} from '@/api/review';
import { usePaperlessBaseUrl } from '@/api/connection';
import { useSettings } from '@/api/settings';
import { paperlessDocumentUrl } from '@/lib/paperless';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslation } from '@/i18n/I18nProvider';

export function ReviewPage() {
  const items = useReviewList('pending');
  const settings = useSettings();
  const [openId, setOpenId] = useState<number | null>(null);

  // Wait for settings too. The empty-state copy depends on extractionEnabled,
  // and rendering before it resolves would flash the wrong explanation.
  if (items.isLoading || settings.isLoading) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }

  if (openId != null) {
    return <ReviewDetailView id={openId} onClose={() => setOpenId(null)} />;
  }

  return (
    <ReviewList
      items={items.data ?? []}
      extractionEnabled={settings.data?.extractionEnabled ?? true}
      onOpen={setOpenId}
    />
  );
}

function ReviewList({
  items,
  extractionEnabled,
  onOpen,
}: {
  items: ReviewItemView[];
  extractionEnabled: boolean;
  onOpen: (id: number) => void;
}) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const bulk = useBulkApproveReview();

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (items.length === 0) {
    return (
      // flex-1 fills the layout's column so the empty state sits mid-page.
      <div className="flex flex-1 items-center justify-center">
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Inbox />
            </EmptyMedia>
            <EmptyTitle>{t('review.emptyTitle')}</EmptyTitle>
            <EmptyDescription>
              {extractionEnabled ? (
                <>
                  {t('review.emptyProcessedBefore')} <code className="font-mono">psf-process</code>{' '}
                  {t('review.emptyProcessedAfter')}
                </>
              ) : (
                <>{t('review.emptyExtractionOff')}</>
              )}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  const failures = bulk.data?.filter((r) => !r.ok) ?? [];

  return (
    <div className="space-y-4">
      <div className="flex h-8 items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('review.awaiting', { count: items.length })}
        </p>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {t('review.clear')}
            </Button>
            <Button
              size="sm"
              onClick={() =>
                bulk.mutate([...selected], {
                  // Keep only the items that failed selected, so the user can
                  // see them, retry, or open one. A full success clears all.
                  onSuccess: (results) =>
                    setSelected(new Set(results.filter((r) => !r.ok).map((r) => r.id))),
                })
              }
              disabled={bulk.isPending}
            >
              {bulk.isPending && <Loader2 className="animate-spin" />}
              {t('review.approveSelected', { count: selected.size })}
            </Button>
          </div>
        )}
      </div>

      {bulk.error && (
        <p className="text-sm text-destructive">
          {bulk.error instanceof Error ? bulk.error.message : t('review.bulkApproveFailed')}
        </p>
      )}
      {failures.length > 0 && (
        <p className="text-sm text-destructive">
          {t('review.someFailed', { failed: failures.length, total: bulk.data!.length })}
          {failures[0].error ? `: ${failures[0].error}` : ''}
        </p>
      )}

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
            <Checkbox
              checked={selected.has(item.id)}
              onCheckedChange={() => toggle(item.id)}
              aria-label={t('review.selectDocument', { documentId: item.documentId })}
            />
            <button
              type="button"
              onClick={() => onOpen(item.id)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium">{item.suggestions.title}</span>
              </div>
              <p className="truncate text-xs text-muted-foreground">
                {t('review.itemMeta', {
                  title: item.suggestions.current.title,
                  documentId: item.documentId,
                  count: item.suggestions.tags.length,
                })}
                {item.suggestions.date ? ` · ${item.suggestions.date}` : ''}
              </p>
            </button>
            <Button size="sm" variant="outline" onClick={() => onOpen(item.id)}>
              {t('review.review')}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewDetailView({ id, onClose }: { id: number; onClose: () => void }) {
  const detail = useReviewDetail(id);

  if (detail.isLoading || !detail.data) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }
  return <ReviewEditor detail={detail.data} onClose={onClose} />;
}

function ReviewEditor({ detail, onClose }: { detail: ReviewDetail; onClose: () => void }) {
  const { t } = useTranslation();
  const s = detail.suggestions;
  const base = usePaperlessBaseUrl();

  const [title, setTitle] = useState(s.title);
  const [tags, setTags] = useState<Set<string>>(new Set(s.tags.map((tag) => tag.name)));
  const [correspondent, setCorrespondent] = useState(
    s.correspondent?.name ?? s.current.correspondentName ?? '',
  );
  const [date, setDate] = useState(s.date ?? '');

  const approve = useApproveReview();
  const reject = useRejectReview();
  const busy = approve.isPending || reject.isPending;

  const onApprove = () =>
    approve.mutate(
      {
        id: detail.id,
        payload: {
          title: title.trim(),
          tagNames: [...tags],
          correspondentName: correspondent.trim() || null,
          date: date || null,
        },
      },
      { onSuccess: onClose },
    );
  const onReject = () => reject.mutate(detail.id, { onSuccess: onClose });

  const toggleTag = (name: string) =>
    setTags((cur) => {
      const next = new Set(cur);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onClose} className="-ml-2 text-muted-foreground">
        <ArrowLeft className="size-4" />
        {t('review.backToQueue')}
      </Button>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:max-h-[32rem]">
          <CardHeader>
            <CardTitle className="text-sm">
              {base ? (
                <a
                  href={paperlessDocumentUrl(base, detail.documentId)}
                  target="_blank"
                  rel="noreferrer"
                  title={t('review.openInPaperless')}
                  className="inline-flex items-center gap-1 underline-offset-2 hover:underline"
                >
                  {t('review.documentNumber', { documentId: detail.documentId })}
                  <ExternalLink className="size-3.5 text-muted-foreground" />
                </a>
              ) : (
                <>{t('review.documentNumber', { documentId: detail.documentId })}</>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[26rem] overflow-auto rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap text-muted-foreground">
              {detail.documentContent ?? t('review.noTextPreview')}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-muted-foreground" />
              {t('review.aiSuggestions')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field
              label={t('review.fieldTitle')}
              current={s.current.title}
              changed={s.current.title !== title}
            >
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>

            <div className="space-y-2">
              <Label>{t('review.tags')}</Label>
              <div className="flex flex-wrap gap-1.5">
                {s.tags.length === 0 && (
                  <span className="text-sm text-muted-foreground">
                    {t('review.noTagsSuggested')}
                  </span>
                )}
                {s.tags.map((tag) => {
                  const on = tags.has(tag.name);
                  return (
                    <button
                      key={tag.name}
                      type="button"
                      onClick={() => toggleTag(tag.name)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                        on
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-input text-muted-foreground line-through',
                      )}
                    >
                      {on ? <Check className="size-3" /> : <X className="size-3" />}
                      {tag.name}
                      {tag.isNew && (
                        <span className="text-[10px] text-muted-foreground">{t('review.new')}</span>
                      )}
                    </button>
                  );
                })}
              </div>
              {s.current.tagNames.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('review.currentKept', { tags: s.current.tagNames.join(', ') })}
                </p>
              )}
            </div>

            <Field
              label={t('review.fieldCorrespondent')}
              current={s.current.correspondentName}
              changed={s.current.correspondentName !== (correspondent || null)}
            >
              <Input
                value={correspondent}
                placeholder={t('review.nonePlaceholder')}
                onChange={(e) => setCorrespondent(e.target.value)}
              />
            </Field>

            <Field
              label={t('review.fieldDate')}
              current={s.current.date}
              changed={s.current.date !== (date || null)}
            >
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </CardContent>
        </Card>
      </div>

      {(approve.error || reject.error) && (
        <p className="text-sm text-destructive">
          {(approve.error ?? reject.error) instanceof Error
            ? (approve.error ?? reject.error)!.message
            : t('review.actionFailed')}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onReject} disabled={busy}>
          {reject.isPending && <Loader2 className="animate-spin" />}
          {t('review.reject')}
        </Button>
        <Button onClick={onApprove} disabled={busy || !title.trim()}>
          {approve.isPending && <Loader2 className="animate-spin" />}
          {t('review.approveApply')}
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  current,
  changed,
  children,
}: {
  label: string;
  current: string | null;
  changed: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <Label>{label}</Label>
        {changed && current && (
          <span className="truncate text-xs text-muted-foreground line-through">{current}</span>
        )}
      </div>
      {children}
    </div>
  );
}
