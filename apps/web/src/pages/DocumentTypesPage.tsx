import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Eye, EyeOff, FileType2, Loader2, Pencil, Plus, Search } from 'lucide-react';
import {
  DOCUMENT_TYPE_COMMENT_MAX,
  type DocumentTypeUpdate,
  type DocumentTypeView,
} from '@paperless-starfruit/shared';
import {
  useCreateDocumentType,
  useDocumentTypes,
  useUpdateDocumentType,
} from '@/api/document-types';
import { useTranslation } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { PageHeaderActions } from '@/components/page-header-actions';
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

type FormState = { mode: 'create' } | { mode: 'edit'; documentType: DocumentTypeView };

export function DocumentTypesPage() {
  const { t } = useTranslation();
  const documentTypes = useDocumentTypes();
  const toggleHidden = useUpdateDocumentType();
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<FormState | null>(null);
  const lastForm = useRef<FormState | null>(null);
  if (form) lastForm.current = form;
  const shown = form ?? lastForm.current;

  if (documentTypes.isLoading) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }
  if (documentTypes.isError) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FileType2 />
          </EmptyMedia>
          <EmptyTitle>{t('documentTypes.loadErrorTitle')}</EmptyTitle>
          <EmptyDescription>{documentTypes.error.message}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const list = documentTypes.data ?? [];
  const q = query.trim().toLowerCase();
  const visible = q
    ? list.filter(
        (type) => type.name.toLowerCase().includes(q) || type.comment?.toLowerCase().includes(q),
      )
    : list;

  return (
    <div className="space-y-4">
      <PageHeaderActions>
        <Button size="sm" onClick={() => setForm({ mode: 'create' })}>
          <Plus className="size-4" />
          {t('documentTypes.newType')}
        </Button>
      </PageHeaderActions>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label={t('documentTypes.filterAriaLabel')}
          placeholder={t('documentTypes.filterPlaceholder')}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="pl-8"
        />
      </div>

      {list.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <FileType2 />
            </EmptyMedia>
            <EmptyTitle>{t('documentTypes.emptyTitle')}</EmptyTitle>
            <EmptyDescription>{t('documentTypes.emptyDescription')}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('documentTypes.colType')}</TableHead>
              <TableHead className="w-full">{t('documentTypes.colHint')}</TableHead>
              <TableHead className="text-right">{t('documentTypes.colDocs')}</TableHead>
              <TableHead aria-label={t('documentTypes.actionsAriaLabel')} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((type) => (
              <TableRow key={type.id} className={cn(type.hidden && 'bg-muted/30')}>
                <TableCell>
                  <span
                    className={cn(
                      'font-medium',
                      type.hidden && 'text-muted-foreground line-through',
                    )}
                  >
                    {type.name}
                  </span>
                </TableCell>
                <TableCell className="w-full max-w-0">
                  <p className="truncate text-muted-foreground" title={type.comment ?? undefined}>
                    {type.comment ?? '—'}
                  </p>
                </TableCell>
                <TableCell className="text-right text-sm tabular-nums text-muted-foreground">
                  {type.documentCount ?? ''}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={
                        type.hidden
                          ? t('documentTypes.showToAi', { name: type.name })
                          : t('documentTypes.hideFromAi', { name: type.name })
                      }
                      title={
                        type.hidden
                          ? t('documentTypes.hiddenTitle')
                          : t('documentTypes.visibleTitle')
                      }
                      disabled={toggleHidden.isPending && toggleHidden.variables?.id === type.id}
                      onClick={() =>
                        toggleHidden.mutate({ id: type.id, input: { hidden: !type.hidden } })
                      }
                    >
                      {type.hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={t('documentTypes.editAria', { name: type.name })}
                      onClick={() => setForm({ mode: 'edit', documentType: type })}
                    >
                      <Pencil className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {visible.length === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  {t('documentTypes.noMatch', { query: query.trim() })}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}

      <Dialog open={!!form} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent aria-describedby={undefined} className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {shown?.mode === 'edit'
                ? t('documentTypes.editTitle', { name: shown.documentType.name })
                : t('documentTypes.newType')}
            </DialogTitle>
          </DialogHeader>
          {shown && (
            <DocumentTypeForm
              key={shown.mode === 'edit' ? shown.documentType.id : 'create'}
              documentType={shown.mode === 'edit' ? shown.documentType : undefined}
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
  comment: string;
}

function DocumentTypeForm({
  documentType,
  onDone,
}: {
  documentType?: DocumentTypeView;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const editing = !!documentType;
  const { register, handleSubmit, watch, formState } = useForm<FormValues>({
    defaultValues: { name: documentType?.name ?? '', comment: documentType?.comment ?? '' },
  });
  const create = useCreateDocumentType();
  const update = useUpdateDocumentType();
  const save = editing ? update : create;

  const onSave = handleSubmit((values) => {
    if (editing && documentType) {
      const input: DocumentTypeUpdate = {};
      if (values.name.trim() !== documentType.name) input.name = values.name.trim();
      if (values.comment.trim() !== (documentType.comment ?? '')) {
        input.comment = values.comment.trim();
      }
      update.mutate({ id: documentType.id, input }, { onSuccess: onDone });
    } else {
      create.mutate(
        { name: values.name.trim(), comment: values.comment.trim() },
        { onSuccess: onDone },
      );
    }
  });
  const comment = watch('comment');

  return (
    <>
      <form id="document-type-form" onSubmit={onSave} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label htmlFor="document-type-name">{t('documentTypes.nameLabel')}</Label>
          <Input
            id="document-type-name"
            placeholder={t('documentTypes.namePlaceholder')}
            aria-invalid={!!formState.errors.name}
            {...register('name', { required: t('common.required') })}
          />
          {formState.errors.name && (
            <p className="text-sm text-destructive">{formState.errors.name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="document-type-comment">{t('documentTypes.colHint')}</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {t('documentTypes.charCount', {
                count: comment.length,
                max: DOCUMENT_TYPE_COMMENT_MAX,
              })}
            </span>
          </div>
          <Textarea
            id="document-type-comment"
            rows={3}
            maxLength={DOCUMENT_TYPE_COMMENT_MAX}
            placeholder={t('documentTypes.hintPlaceholder')}
            {...register('comment')}
          />
        </div>
        {save.error && <p className="text-sm text-destructive">{save.error.message}</p>}
      </form>
      <div className="mt-5 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone} disabled={save.isPending}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" form="document-type-form" disabled={save.isPending}>
          {save.isPending && <Loader2 className="animate-spin" />}
          {editing ? t('common.save') : t('documentTypes.createType')}
        </Button>
      </div>
    </>
  );
}
