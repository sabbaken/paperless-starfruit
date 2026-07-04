import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Pencil, Plus, Search, Tags } from 'lucide-react';
import { TAG_COMMENT_MAX, type TagUpdate, type TagView } from '@paperless-starfruit/shared';
import { useCreateTag, useTags, useUpdateTag } from '@/api/tags';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
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

export function TagsPage() {
  const tags = useTags();
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
  const visible = q
    ? list.filter(
        (t) => t.name.toLowerCase().includes(q) || t.comment?.toLowerCase().includes(q),
      )
    : list;

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
              {visible.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell className="py-3 pl-4">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-3 shrink-0 rounded-full border"
                        style={{ backgroundColor: tag.color ?? undefined }}
                      />
                      <span className="font-medium">{tag.name}</span>
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
                    <p
                      className="truncate text-muted-foreground"
                      title={tag.comment ?? undefined}
                    >
                      {tag.isTrigger
                        ? 'Marks documents for processing'
                        : (tag.comment ?? '—')}
                    </p>
                  </TableCell>
                  <TableCell className="py-3 text-right text-xs tabular-nums text-muted-foreground">
                    {tag.documentCount ?? ''}
                  </TableCell>
                  <TableCell className="py-0 pr-2 text-right">
                    {!tag.isTrigger && (
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${tag.name}`}
                        onClick={() => setForm({ mode: 'edit', tag })}
                      >
                        <Pencil className="size-4" />
                      </Button>
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
  const currentColor =
    tag?.color && /^#[0-9a-fA-F]{6}$/.test(tag.color) ? tag.color : null;
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
