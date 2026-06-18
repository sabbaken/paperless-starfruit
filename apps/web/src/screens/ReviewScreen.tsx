import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Loader2, Sparkles, X } from 'lucide-react';
import type { ReviewDetail, ReviewItemView } from '@paperless-ai/shared';
import { reviewApi } from '../lib/api';
import { cn } from '../lib/cn';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

export function ReviewScreen() {
  const items = useQuery({
    queryKey: ['review', 'pending'],
    queryFn: () => reviewApi.list('pending'),
    refetchInterval: 5000,
  });
  const [openId, setOpenId] = useState<number | null>(null);

  if (items.isLoading) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }

  if (openId != null) {
    return <ReviewDetailView id={openId} onClose={() => setOpenId(null)} />;
  }

  return <ReviewList items={items.data ?? []} onOpen={setOpenId} />;
}

function ReviewList({ items, onOpen }: { items: ReviewItemView[]; onOpen: (id: number) => void }) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const bulk = useMutation({
    mutationFn: (ids: number[]) => reviewApi.bulkApprove(ids),
    onSuccess: () => {
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ['review'] });
      void queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const toggle = (id: number) =>
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nothing to review</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          When a document tagged <code className="font-mono">ai-process</code> is processed, its
          AI suggestions land here for your approval.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex h-8 items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} awaiting review</p>
        {selected.size > 0 && (
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
            <Button size="sm" onClick={() => bulk.mutate([...selected])} disabled={bulk.isPending}>
              {bulk.isPending && <Loader2 className="animate-spin" />}
              Approve {selected.size} selected
            </Button>
          </div>
        )}
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3"
          >
            <Checkbox
              checked={selected.has(item.id)}
              onCheckedChange={() => toggle(item.id)}
              aria-label={`Select document ${item.documentId}`}
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
                was “{item.suggestions.current.title}” · doc #{item.documentId} ·{' '}
                {item.suggestions.tags.length} tag(s)
                {item.suggestions.date ? ` · ${item.suggestions.date}` : ''}
              </p>
            </button>
            <Button size="sm" variant="outline" onClick={() => onOpen(item.id)}>
              Review
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewDetailView({ id, onClose }: { id: number; onClose: () => void }) {
  const detail = useQuery({ queryKey: ['review', id], queryFn: () => reviewApi.get(id) });

  if (detail.isLoading || !detail.data) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }
  return <ReviewEditor detail={detail.data} onClose={onClose} />;
}

function ReviewEditor({ detail, onClose }: { detail: ReviewDetail; onClose: () => void }) {
  const queryClient = useQueryClient();
  const s = detail.suggestions;

  const [title, setTitle] = useState(s.title);
  const [tags, setTags] = useState<Set<string>>(new Set(s.tags.map((t) => t.name)));
  const [correspondent, setCorrespondent] = useState(
    s.correspondent?.name ?? s.current.correspondentName ?? '',
  );
  const [date, setDate] = useState(s.date ?? '');

  const onResolved = () => {
    void queryClient.invalidateQueries({ queryKey: ['review'] });
    void queryClient.invalidateQueries({ queryKey: ['stats'] });
    onClose();
  };

  const approve = useMutation({
    mutationFn: () =>
      reviewApi.approve(detail.id, {
        title: title.trim(),
        tagNames: [...tags],
        correspondentName: correspondent.trim() || null,
        date: date || null,
      }),
    onSuccess: onResolved,
  });
  const reject = useMutation({ mutationFn: () => reviewApi.reject(detail.id), onSuccess: onResolved });
  const busy = approve.isPending || reject.isPending;

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
        Back to queue
      </Button>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="md:max-h-[32rem]">
          <CardHeader>
            <CardTitle className="text-sm">Document #{detail.documentId}</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[26rem] overflow-auto rounded-md bg-muted/40 p-3 text-xs whitespace-pre-wrap text-muted-foreground">
              {detail.documentContent ?? 'No text preview available.'}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Sparkles className="size-4 text-muted-foreground" />
              AI suggestions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Title" current={s.current.title} changed={s.current.title !== title}>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Field>

            <div className="space-y-2">
              <Label>Tags</Label>
              <div className="flex flex-wrap gap-1.5">
                {s.tags.length === 0 && (
                  <span className="text-sm text-muted-foreground">No tags suggested.</span>
                )}
                {s.tags.map((t) => {
                  const on = tags.has(t.name);
                  return (
                    <button
                      key={t.name}
                      type="button"
                      onClick={() => toggleTag(t.name)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                        on
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-input text-muted-foreground line-through',
                      )}
                    >
                      {on ? <Check className="size-3" /> : <X className="size-3" />}
                      {t.name}
                      {t.isNew && <span className="text-[10px] text-muted-foreground">new</span>}
                    </button>
                  );
                })}
              </div>
              {s.current.tagNames.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Current: {s.current.tagNames.join(', ')} (kept)
                </p>
              )}
            </div>

            <Field
              label="Correspondent"
              current={s.current.correspondentName}
              changed={s.current.correspondentName !== (correspondent || null)}
            >
              <Input
                value={correspondent}
                placeholder="(none)"
                onChange={(e) => setCorrespondent(e.target.value)}
              />
            </Field>

            <Field label="Date" current={s.current.date} changed={s.current.date !== (date || null)}>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
          </CardContent>
        </Card>
      </div>

      {(approve.error || reject.error) && (
        <p className="text-sm text-destructive">
          {(approve.error ?? reject.error) instanceof Error
            ? (approve.error ?? reject.error)!.message
            : 'Action failed'}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => reject.mutate()} disabled={busy}>
          {reject.isPending && <Loader2 className="animate-spin" />}
          Reject
        </Button>
        <Button onClick={() => approve.mutate()} disabled={busy || !title.trim()}>
          {approve.isPending && <Loader2 className="animate-spin" />}
          Approve & apply
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
