import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { Check, ChevronRight, Inbox, Loader2, X } from 'lucide-react';
import type { ReviewDetail, ReviewItemView } from '@paperless-starfruit/shared';
import {
  useApproveReview,
  useBulkApproveReview,
  useRejectReview,
  useReviewDetail,
  useReviewList,
} from '@/api/review';
import { useSettings } from '@/api/settings';
import { useTags } from '@/api/tags';
import { useDocumentTypes } from '@/api/document-types';
import { ReviewTaxonomyPicker } from '@/components/review-taxonomy-picker';
import { PageSection } from '@/components/ui/page-section';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
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
import { useSidebar } from '@/components/ui/sidebar';
import { useTranslation } from '@/i18n/I18nProvider';

export function ReviewPage() {
  const items = useReviewList('pending');
  const settings = useSettings();
  const { t } = useTranslation();

  // Wait for settings too. The empty-state copy depends on extractionEnabled,
  // and rendering before it resolves would flash the wrong explanation.
  if (items.isLoading || settings.isLoading) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }

  if (items.isError || settings.isError)
    return (
      <div className="space-y-3">
        <p role="alert">{t('review.loadFailed')}</p>
        <Button
          variant="outline"
          onClick={() => {
            void items.refetch();
            void settings.refetch();
          }}
        >
          {t('review.retry')}
        </Button>
      </div>
    );

  return (
    <ReviewList
      items={items.data ?? []}
      extractionEnabled={settings.data?.extractionEnabled ?? true}
    />
  );
}

function ReviewList({
  items,
  extractionEnabled,
}: {
  items: ReviewItemView[];
  extractionEnabled: boolean;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const bulk = useBulkApproveReview();
  const selectedIds = items.filter((item) => selected.has(item.id)).map((item) => item.id);

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
        {selectedIds.length > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {t('review.clear')}
            </Button>
            <Button
              size="sm"
              onClick={() =>
                bulk.mutate(selectedIds, {
                  // Keep only the items that failed selected, so the user can
                  // see them, retry, or open one. A full success clears all.
                  onSuccess: (results) =>
                    setSelected(new Set(results.filter((r) => !r.ok).map((r) => r.id))),
                })
              }
              disabled={bulk.isPending}
            >
              {bulk.isPending && <Loader2 className="animate-spin" />}
              {t('review.approveSelected', { count: selectedIds.length })}
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

      <Table className="table-fixed">
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label={t('review.selectAll')}
                checked={
                  items.every((item) => selected.has(item.id))
                    ? true
                    : items.some((item) => selected.has(item.id))
                      ? 'indeterminate'
                      : false
                }
                onCheckedChange={(checked) =>
                  setSelected(checked ? new Set(items.map((item) => item.id)) : new Set())
                }
              />
            </TableHead>
            <TableHead className="md:w-[42%] lg:w-[24%]">{t('review.fieldTitle')}</TableHead>
            <TableHead className="hidden w-[16%] md:table-cell">
              {t('review.fieldDocumentType')}
            </TableHead>
            <TableHead className="hidden lg:table-cell">{t('review.tags')}</TableHead>
            <TableHead className="hidden w-28 sm:table-cell">{t('review.fieldDate')}</TableHead>
            <TableHead className="w-24">
              <span className="sr-only">{t('review.review')}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow
              key={item.id}
              data-state={selected.has(item.id) ? 'selected' : undefined}
              className="cursor-pointer"
              onClick={(event) => {
                if ((event.target as HTMLElement).closest('a, button, input, [role="checkbox"]'))
                  return;
                navigate(`/review/${item.id}`);
              }}
            >
              <TableCell>
                <Checkbox
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                  aria-label={t('review.selectDocument', { documentId: item.documentId })}
                />
              </TableCell>
              <TableCell className="whitespace-normal py-4">
                <Link
                  to={`/review/${item.id}`}
                  className="block truncate font-medium hover:underline"
                >
                  {item.suggestions.title}
                </Link>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  #{item.documentId} · {item.suggestions.current.title}
                </p>
              </TableCell>
              <TableCell className="hidden whitespace-normal break-words md:table-cell">
                {item.suggestions.documentType?.name ??
                  item.suggestions.current.documentTypeName ??
                  '—'}
              </TableCell>
              <TableCell className="hidden whitespace-normal break-words lg:table-cell">
                <span className="block">
                  {item.suggestions.tags.map((tag) => tag.name).join(', ') || '—'}
                </span>
              </TableCell>
              <TableCell className="hidden tabular-nums sm:table-cell">
                {item.suggestions.date ?? '—'}
              </TableCell>
              <TableCell>
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/review/${item.id}`}>
                    {t('review.review')}
                    <ChevronRight className="size-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export function ReviewDetailPage() {
  const { id: rawId } = useParams();
  const { t } = useTranslation();
  const id = Number(rawId);
  if (!rawId || !/^\d+$/.test(rawId) || !Number.isSafeInteger(id) || id < 1) {
    return (
      <div className="space-y-4">
        <p role="alert">{t('review.loadFailed')}</p>
        <Button asChild variant="outline">
          <Link to="/review">{t('review.backToQueue')}</Link>
        </Button>
      </div>
    );
  }
  return <ReviewDetailView id={id} />;
}

function ReviewDetailView({ id }: { id: number }) {
  const detail = useReviewDetail(id);
  const { t } = useTranslation();
  if (detail.isError)
    return (
      <div className="space-y-4">
        <p role="alert">{t('review.loadFailed')}</p>
        <Button variant="outline" onClick={() => void detail.refetch()}>
          {t('review.retry')}
        </Button>
        <Button asChild variant="ghost">
          <Link to="/review">{t('review.backToQueue')}</Link>
        </Button>
      </div>
    );
  if (!detail.data)
    return (
      <Loader2
        aria-label={t('review.loading')}
        className="mx-auto size-5 animate-spin text-muted-foreground"
      />
    );
  return <ReviewEditor key={detail.data.id} detail={detail.data} />;
}

type ReviewDraft = {
  title: string;
  tags: string[];
  correspondent: string;
  documentType: string;
  date: string;
};
const reviewDrafts = new Map<number, ReviewDraft>();

function ReviewEditor({ detail }: { detail: ReviewDetail }) {
  const { state: sidebarState, isMobile } = useSidebar();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queue = useReviewList();
  const s = detail.suggestions;
  const availableTags = useTags();
  const availableTypes = useDocumentTypes();
  const draft = reviewDrafts.get(detail.id);
  const [title, setTitle] = useState(draft?.title ?? s.title);
  const [tags, setTags] = useState<Set<string>>(
    new Set(draft?.tags ?? s.tags.map((tag) => tag.name)),
  );
  const [correspondent, setCorrespondent] = useState(
    draft?.correspondent ?? s.correspondent?.name ?? s.current.correspondentName ?? '',
  );
  const [documentType, setDocumentType] = useState(
    draft?.documentType ?? s.documentType?.name ?? s.current.documentTypeName ?? '',
  );
  const [date, setDate] = useState(draft?.date ?? s.date ?? s.current.date ?? '');
  const approve = useApproveReview();
  const reject = useRejectReview();
  const busy = approve.isPending || reject.isPending;
  const pending = detail.status === 'pending';
  const index = queue.data?.findIndex((item) => item.id === detail.id) ?? -1;
  const next =
    queue.data?.find((item, i) => i > index && item.id !== detail.id) ??
    queue.data?.find((item) => item.id !== detail.id);
  useEffect(() => {
    if (pending)
      reviewDrafts.set(detail.id, { title, tags: [...tags], correspondent, documentType, date });
    else reviewDrafts.delete(detail.id);
  }, [detail.id, pending, title, tags, correspondent, documentType, date]);
  useEffect(() => {
    if (!pending) return;
    const edited =
      title !== s.title ||
      correspondent !== (s.correspondent?.name ?? s.current.correspondentName ?? '') ||
      documentType !== (s.documentType?.name ?? s.current.documentTypeName ?? '') ||
      date !== (s.date ?? s.current.date ?? '') ||
      tags.size !== s.tags.length ||
      s.tags.some((tag) => !tags.has(tag.name));
    if (!edited) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending, s, title, tags, correspondent, documentType, date]);
  const finish = (advance: boolean) => {
    reviewDrafts.delete(detail.id);
    navigate(advance && next ? `/review/${next.id}` : '/review', { replace: true });
  };
  const onApprove = (advance = false) =>
    approve.mutate(
      {
        id: detail.id,
        payload: {
          title: title.trim(),
          tagNames: [...tags],
          documentTypeName: documentType.trim() || null,
          correspondentName: correspondent.trim() || null,
          date: date || null,
        },
      },
      { onSuccess: () => finish(advance) },
    );
  const toggleTag = (name: string) =>
    setTags((current) => {
      const result = new Set(current);
      if (result.has(name)) result.delete(name);
      else result.add(name);
      return result;
    });
  const existingTags = s.current.tagNames.filter(
    (name) => !availableTags.data?.some((tag) => tag.name === name && tag.isTrigger),
  );
  const newTags = [...tags].filter((name) => !existingTags.includes(name));

  return (
    <div
      className={pending ? 'space-y-6 pb-[calc(8rem+env(safe-area-inset-bottom))]' : 'space-y-6'}
    >
      {!pending && (
        <p role="status" className="rounded-md bg-muted p-3 text-sm">
          {t('review.alreadyReviewed')}
        </p>
      )}
      {/* Equal gutters: available width = source + 24px gap + metadata. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <PageSection title={t('review.sourceText')} className="min-w-0 lg:sticky lg:top-20">
          <div className="max-h-[60vh] overflow-auto rounded-lg bg-muted/40 p-4 text-sm leading-7 whitespace-pre-wrap break-words text-foreground">
            {detail.documentContent || t('review.noTextPreview')}
          </div>
        </PageSection>
        <section aria-label={t('review.aiSuggestions')} className="min-w-0">
          <fieldset disabled={busy || !pending} className="space-y-5">
            <Field
              id="review-title"
              label={t('review.fieldTitle')}
              current={s.current.title}
              changed={s.current.title !== title}
            >
              <Input id="review-title" value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>
            <div className="space-y-2">
              <Label htmlFor="review-tags">{t('review.tags')}</Label>
              {existingTags.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('review.keptTags', { tags: existingTags.join(', ') })}
                </p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {newTags.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => toggleTag(name)}
                    aria-label={t('review.removeTag', { name })}
                    className="inline-flex items-center gap-1 rounded-md border bg-muted/50 px-2 py-1 text-sm hover:bg-muted"
                  >
                    {name}
                    {!availableTags.data?.some((tag) => tag.name === name) && (
                      <span className="text-xs text-muted-foreground">({t('review.new')})</span>
                    )}
                    <X className="size-3.5" />
                  </button>
                ))}
              </div>
              <ReviewTaxonomyPicker
                id="review-tags"
                label={t('review.addTags')}
                options={(availableTags.data ?? [])
                  .filter((tag) => !tag.isTrigger && !existingTags.includes(tag.name))
                  .map((tag) => tag.name)}
                selected={newTags}
                onSelect={toggleTag}
                multiple
                disabled={availableTags.isLoading || availableTags.isError || busy || !pending}
              />
              {availableTags.isError && (
                <p role="alert" className="text-xs text-destructive">
                  {t('review.taxonomyFailed')}{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void availableTags.refetch()}
                  >
                    {t('review.retry')}
                  </button>
                </p>
              )}
            </div>
            <Field
              id="review-type"
              label={t('review.fieldDocumentType')}
              current={s.current.documentTypeName}
              changed={s.current.documentTypeName !== (documentType || null)}
            >
              <ReviewTaxonomyPicker
                id="review-type"
                label={t('review.keepCurrent')}
                options={(availableTypes.data ?? []).map((type) => type.name)}
                selected={documentType ? [documentType] : []}
                onSelect={setDocumentType}
                disabled={availableTypes.isLoading || availableTypes.isError || busy || !pending}
              />
              {availableTypes.isError && (
                <p role="alert" className="text-xs text-destructive">
                  {t('review.taxonomyFailed')}{' '}
                  <button
                    type="button"
                    className="underline"
                    onClick={() => void availableTypes.refetch()}
                  >
                    {t('review.retry')}
                  </button>
                </p>
              )}
            </Field>
            <Field
              id="review-correspondent"
              label={t('review.fieldCorrespondent')}
              current={s.current.correspondentName}
              changed={s.current.correspondentName !== (correspondent || null)}
            >
              <Input
                id="review-correspondent"
                value={correspondent}
                placeholder={t('review.keepCurrent')}
                onChange={(e) => setCorrespondent(e.target.value)}
              />
            </Field>
            <Field
              id="review-date"
              label={t('review.fieldDate')}
              current={s.current.date}
              changed={s.current.date !== (date || null)}
            >
              <Input
                id="review-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </Field>
          </fieldset>
        </section>
      </div>
      {(approve.error || reject.error) && (
        <p role="alert" className="text-sm text-destructive">
          {(approve.error ?? reject.error) instanceof Error
            ? (approve.error ?? reject.error)!.message
            : t('review.actionFailed')}
        </p>
      )}
      {pending && (
        <footer
          className="fixed right-0 bottom-0 z-10 border-t bg-background px-6 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-[left] duration-200 ease-linear sm:pt-4 sm:pb-[calc(1rem+env(safe-area-inset-bottom))]"
          style={{
            left: isMobile
              ? 0
              : sidebarState === 'expanded'
                ? 'var(--sidebar-width)'
                : 'var(--sidebar-width-icon)',
          }}
        >
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-end gap-2 sm:gap-3">
            {next && (
              <Button asChild variant="ghost" disabled={busy}>
                <Link
                  to={`/review/${next.id}`}
                  aria-disabled={busy}
                  tabIndex={busy ? -1 : undefined}
                  onClick={(event) => {
                    if (busy) event.preventDefault();
                  }}
                >
                  {t('review.skip')}
                </Link>
              </Button>
            )}
            <Button
              variant="destructive"
              onClick={() => reject.mutate(detail.id, { onSuccess: () => finish(false) })}
              disabled={busy}
            >
              {reject.isPending && <Loader2 className="animate-spin" />}
              {t('review.reject')}
            </Button>
            <Button onClick={() => onApprove(Boolean(next))} disabled={busy || !title.trim()}>
              {approve.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Check className="size-4" />
              )}
              {next ? t('review.applyNext') : t('review.approveApply')}
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}

function Field({
  id,
  label,
  current,
  changed,
  children,
}: {
  id: string;
  label: string;
  current: string | null;
  changed: boolean;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {changed && (
        <p className="break-words text-xs text-muted-foreground">
          {t('review.beforeAiValue', { value: current || t('review.notSet') })}
        </p>
      )}
    </div>
  );
}
