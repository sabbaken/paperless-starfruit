import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { CornerDownRight, Eye, EyeOff, Loader2, Pencil, Plus, Search, Tags } from 'lucide-react';
import { TAG_COMMENT_MAX, type TagUpdate, type TagView } from '@paperless-starfruit/shared';
import { useCreateTag, useTags, useUpdateTag } from '@/api/tags';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

/** paperless's own default for new tags — a sensible starting swatch. */
const DEFAULT_COLOR = '#a6cee3';

type FormState = { mode: 'create' } | { mode: 'edit'; tag: TagView };

/** A tag paired with its depth in the parent chain, in rendered (tree) order. */
type TagRow = { tag: TagView; depth: number };

/**
 * Flatten tags into display order: root tags A→Z, each followed by its
 * subtree. A tag whose parent is missing from the list, or whose parent chain
 * loops (paperless forbids both, but stay safe), renders as a root.
 */
function toTreeRows(tags: TagView[]): TagRow[] {
  const ids = new Set(tags.map((t) => t.id));
  const children = new Map<number, TagView[]>();
  const roots: TagView[] = [];
  for (const t of tags) {
    if (t.parent !== null && t.parent !== t.id && ids.has(t.parent)) {
      const bucket = children.get(t.parent);
      if (bucket) bucket.push(t);
      else children.set(t.parent, [t]);
    } else {
      roots.push(t);
    }
  }

  const rows: TagRow[] = [];
  const seen = new Set<number>();
  const visit = (group: TagView[], depth: number) => {
    for (const tag of [...group].sort((a, b) => a.name.localeCompare(b.name))) {
      if (seen.has(tag.id)) continue;
      seen.add(tag.id);
      rows.push({ tag, depth });
      visit(children.get(tag.id) ?? [], depth + 1);
    }
  };
  visit(roots, 0);
  // A parent cycle strands its whole subtree off the root walk — show those flat.
  for (const tag of tags) {
    if (!seen.has(tag.id)) rows.push({ tag, depth: 0 });
  }
  return rows;
}

export function TagsPage() {
  const tags = useTags();
  const toggleHidden = useUpdateTag();
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  // Keep the last form around so the dialog body stays rendered through the
  // close animation instead of collapsing the instant `form` clears.
  const lastForm = useRef<FormState | null>(null);
  if (form) lastForm.current = form;
  const shown = form ?? lastForm.current;

  if (tags.isLoading) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }
  if (tags.isError) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Tags />
          </EmptyMedia>
          <EmptyTitle>Couldn&apos;t load tags</EmptyTitle>
          <EmptyDescription>{tags.error.message}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const list = tags.data ?? [];
  const q = query.trim().toLowerCase();
  let visible = toTreeRows(list);
  if (q) {
    // Keep matches plus their ancestor chain, so a matched child stays
    // attached to its place in the tree instead of floating rootless.
    const byId = new Map(list.map((t) => [t.id, t]));
    const keep = new Set<number>();
    for (const t of list) {
      if (!t.name.toLowerCase().includes(q) && !t.comment?.toLowerCase().includes(q)) {
        continue;
      }
      let cur: TagView | undefined = t;
      while (cur && !keep.has(cur.id)) {
        keep.add(cur.id);
        cur = cur.parent !== null ? byId.get(cur.parent) : undefined;
      }
    }
    visible = visible.filter((r) => keep.has(r.tag.id));
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Filter tags"
            placeholder="Filter by name or hint…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button size="sm" variant="outline" onClick={() => setForm({ mode: 'create' })}>
          <Plus className="size-4" />
          New tag
        </Button>
      </div>

      {list.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Tags />
            </EmptyMedia>
            <EmptyTitle>No tags yet</EmptyTitle>
            <EmptyDescription>
              Create your first tag — it appears in paperless immediately.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4">Tag</TableHead>
                <TableHead className="w-full">AI hint</TableHead>
                <TableHead className="text-right">Docs</TableHead>
                <TableHead aria-label="Actions" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.map(({ tag, depth }) => (
                // A hidden tag reads as "switched off": a faint wash over the whole
                // row instead of a badge, so the tag column keeps its layout.
                <TableRow key={tag.id} className={cn(tag.hidden && 'bg-muted/30')}>
                  <TableCell className="py-3 pl-4">
                    <div
                      className="flex items-center gap-2"
                      style={depth > 1 ? { paddingLeft: `${(depth - 1) * 1.25}rem` } : undefined}
                    >
                      {depth > 0 && (
                        <CornerDownRight
                          aria-hidden
                          className="size-3.5 shrink-0 text-muted-foreground/70"
                        />
                      )}
                      <span
                        aria-hidden
                        className="size-3 shrink-0 rounded-full border"
                        style={{ backgroundColor: tag.color ?? undefined }}
                      />
                      <span
                        className={cn(
                          'font-medium',
                          // Struck-through, not just dimmed — an accidentally hidden
                          // tag should be impossible to overlook.
                          tag.hidden && 'text-muted-foreground line-through',
                        )}
                      >
                        {tag.name}
                      </span>
                      {tag.isTrigger && (
                        <Badge
                          variant="secondary"
                          title="Starfruit picks up documents carrying this tag; it can't be edited here."
                        >
                          Trigger
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="w-full max-w-0 py-3">
                    <p className="truncate text-muted-foreground" title={tag.comment ?? undefined}>
                      {tag.isTrigger ? 'Marks documents for processing' : (tag.comment ?? '—')}
                    </p>
                  </TableCell>
                  <TableCell className="py-3 text-right text-xs tabular-nums text-muted-foreground">
                    {tag.documentCount ?? ''}
                  </TableCell>
                  <TableCell className="py-0 pr-2 text-right">
                    {!tag.isTrigger && (
                      <div className="flex items-center justify-end">
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={
                            tag.hidden
                              ? `Show ${tag.name} to the AI`
                              : `Hide ${tag.name} from the AI`
                          }
                          title={
                            tag.hidden
                              ? 'Hidden from the AI — click to show it again'
                              : 'Visible to the AI — click to hide it'
                          }
                          disabled={toggleHidden.isPending && toggleHidden.variables?.id === tag.id}
                          onClick={() =>
                            toggleHidden.mutate({ id: tag.id, input: { hidden: !tag.hidden } })
                          }
                        >
                          {tag.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          aria-label={`Edit ${tag.name}`}
                          onClick={() => setForm({ mode: 'edit', tag })}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {visible.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                    No tags match “{query.trim()}”.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent aria-describedby={undefined} className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {shown?.mode === 'edit' ? `Edit “${shown.tag.name}”` : 'New tag'}
            </DialogTitle>
          </DialogHeader>
          {shown && (
            <TagForm
              key={shown.mode === 'edit' ? shown.tag.id : 'create'}
              tag={shown.mode === 'edit' ? shown.tag : undefined}
              onDone={() => setForm(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface FormValues {
  name: string;
  color: string;
  comment: string;
}

function TagForm({ tag, onDone }: { tag?: TagView; onDone: () => void }) {
  const editing = !!tag;
  // paperless may hold no (or a malformed) color; a native color input coerces
  // anything invalid to #000000, so only a valid hex counts as "current".
  const currentColor = tag?.color && /^#[0-9a-fA-F]{6}$/.test(tag.color) ? tag.color : null;
  const { register, handleSubmit, watch, formState } = useForm<FormValues>({
    defaultValues: {
      name: tag?.name ?? '',
      color: currentColor ?? DEFAULT_COLOR,
      comment: tag?.comment ?? '',
    },
  });

  const create = useCreateTag();
  const update = useUpdateTag();
  const save = editing ? update : create;

  const onSave = handleSubmit((v) => {
    if (editing && tag) {
      // Only send what changed — a hint-only edit shouldn't PATCH paperless.
      // A colorless tag always gets the color the dialog displayed, so what
      // the user saw (and possibly deliberately kept) is what gets saved.
      const input: TagUpdate = {};
      if (v.name.trim() !== tag.name) input.name = v.name.trim();
      if (v.color !== currentColor) input.color = v.color;
      if (v.comment.trim() !== (tag.comment ?? '')) input.comment = v.comment.trim();
      update.mutate({ id: tag.id, input }, { onSuccess: onDone });
    } else {
      create.mutate(
        { name: v.name.trim(), color: v.color, comment: v.comment.trim() },
        { onSuccess: onDone },
      );
    }
  });

  const comment = watch('comment');

  return (
    <>
      <form id="tag-form" onSubmit={onSave} className="space-y-4" noValidate>
        <div className="flex gap-3">
          <div className="flex-1 space-y-2">
            <Label htmlFor="tag-name">Name</Label>
            <Input
              id="tag-name"
              placeholder="Insurance"
              aria-invalid={!!formState.errors.name}
              {...register('name', { required: 'Required' })}
            />
            {formState.errors.name && (
              <p className="text-sm text-destructive">{formState.errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="tag-color">Color</Label>
            <input
              id="tag-color"
              type="color"
              className="block h-9 w-14 cursor-pointer rounded-md border bg-transparent p-1"
              {...register('color')}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="tag-comment">AI hint</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {comment.length}/{TAG_COMMENT_MAX}
            </span>
          </div>
          <Textarea
            id="tag-comment"
            rows={3}
            maxLength={TAG_COMMENT_MAX}
            placeholder="e.g. Anything from an insurance company: policies, claims, renewal letters."
            {...register('comment')}
          />
        </div>

        {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
      </form>

      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={save.isPending}>
          Cancel
        </Button>
        <Button type="submit" form="tag-form" disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {editing ? 'Save' : 'Create tag'}
        </Button>
      </div>
    </>
  );
}
