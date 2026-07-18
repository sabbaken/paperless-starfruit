import { forwardRef, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  FlaskConical,
  Loader2,
  type LucideIcon,
  RotateCcw,
  ScanText,
  Sparkles,
  Wand2,
} from 'lucide-react';
import {
  PROMPT_KEY,
  type PromptConfig,
  type PromptKey,
  type PromptTestResult,
} from '@paperless-starfruit/shared';
import {
  usePrompts,
  useResetPrompt,
  useTestDocuments,
  useTestPrompt,
  useUpdatePrompt,
} from '@/api/prompts';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { useTranslation } from '@/i18n/I18nProvider';
import { cn } from '@/lib/utils';
import { ACTIVE_NAV_ITEM } from '@/lib/nav';
import { toastSave } from '@/lib/toast';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSection } from '@/components/ui/page-section';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

const ICONS: Record<PromptKey, LucideIcon> = {
  [PROMPT_KEY.EXTRACTION]: Wand2,
  [PROMPT_KEY.OCR]: ScanText,
};

export function PromptsPage() {
  const prompts = usePrompts();
  const [selected, setSelected] = useState<PromptKey>(PROMPT_KEY.EXTRACTION);

  if (prompts.isLoading || !prompts.data) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }

  const list = prompts.data;
  const active = list.find((p) => p.key === selected) ?? list[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <PromptList list={list} selected={active.key} onSelect={setSelected} />
      {/* Key by prompt so switching prompts resets the editor's local draft. */}
      <PromptEditor key={active.key} prompt={active} />
    </div>
  );
}

function PromptList({
  list,
  selected,
  onSelect,
}: {
  list: PromptConfig[];
  selected: PromptKey;
  onSelect: (key: PromptKey) => void;
}) {
  const { t } = useTranslation();
  return (
    // Horizontal pair on small screens, a quiet vertical rail on desktop. No card.
    <nav
      aria-label={t('prompts.navAriaLabel')}
      className="flex gap-1 lg:flex-col lg:gap-0.5 lg:pt-1"
    >
      {list.map((p) => {
        const Icon = ICONS[p.key];
        const isActive = p.key === selected;
        return (
          <button
            key={p.key}
            type="button"
            onClick={() => onSelect(p.key)}
            aria-current={isActive ? 'true' : undefined}
            // Same brand-tint source of truth as the sidebar (see lib/nav). The
            // icon inherits the text colour (black when active), never brand.
            data-active={isActive}
            className={cn(
              'flex flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground lg:flex-none',
              ACTIVE_NAV_ITEM,
            )}
          >
            <Icon className="size-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{p.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function PromptEditor({ prompt }: { prompt: PromptConfig }) {
  const { t } = useTranslation();
  const [body, setBody] = useState(prompt.body);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const update = useUpdatePrompt();
  const reset = useResetPrompt();

  const validVars = useMemo(() => new Set(prompt.variables.map((v) => v.name)), [prompt.variables]);

  const canReset = prompt.customized || body !== prompt.default;

  // Edits save themselves (like the settings pages). A Save button here is easy
  // to miss and "why weren't my changes saved?" is worse than an extra write.
  // After a reset the pending timer must not re-save the old draft, so it's
  // suppressed until the user types again.
  const skipAutoSave = useRef(false);
  const commitSave = useDebouncedCallback(() => {
    if (skipAutoSave.current) return;
    if (!body.trim() || body === prompt.body) return;
    void toastSave(update.mutateAsync({ key: prompt.key, body }));
  }, 800);

  // Flush on unmount: switching prompts (the editor is keyed) or leaving the page
  // inside the debounce window must not silently drop the last keystrokes.
  const latest = useRef({ body, saved: prompt.body });
  latest.current = { body, saved: prompt.body };
  const flushRef = useRef(() => {
    const { body: draft, saved } = latest.current;
    if (skipAutoSave.current || !draft.trim() || draft === saved) return;
    void toastSave(update.mutateAsync({ key: prompt.key, body: draft }));
  });
  useEffect(() => () => flushRef.current(), []);

  const onEdit = (value: string) => {
    skipAutoSave.current = false;
    setBody(value);
    commitSave();
  };

  const insertVar = (name: string) => {
    const token = `{{${name}}}`;
    const el = textareaRef.current;
    if (!el) {
      onEdit(body + token);
      return;
    }
    el.focus();
    // Insert through the browser's native edit pipeline: it fires `input` (so the
    // onChange below updates `body`) AND keeps the undo/redo history intact.
    // A programmatic value set would wipe the native undo stack.
    const inserted = document.execCommand('insertText', false, token);
    if (!inserted) {
      // Fallback if execCommand is unavailable; loses one undo step but works.
      const start = el.selectionStart ?? body.length;
      const end = el.selectionEnd ?? body.length;
      onEdit(body.slice(0, start) + token + body.slice(end));
    }
  };

  const onReset = () => {
    skipAutoSave.current = true;
    void toastSave(
      reset.mutateAsync(prompt.key).then((cfg) => {
        setBody(cfg.body);
        return cfg;
      }),
    );
  };

  return (
    <div className="space-y-8">
      {/* Test panel first: prompt bodies differ in height, so anchoring it above
          the editor keeps it in the same spot when switching prompts. */}
      <TestPanel promptKey={prompt.key} body={body} />

      {/* No section header: the selected prompt is already named in the rail. */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label>{t('prompts.variables')}</Label>
          <p className="text-xs text-muted-foreground">{t('prompts.variablesHint')}</p>
          <div className="flex flex-wrap gap-2">
            {prompt.variables.map((v) => (
              <Button
                key={v.name}
                type="button"
                variant="outline"
                size="sm"
                title={v.description}
                onClick={() => insertVar(v.name)}
                className="font-mono text-xs"
              >
                {`{{${v.name}}}`}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt-body">{t('prompts.prompt')}</Label>
          <HighlightedTextarea
            id="prompt-body"
            ref={textareaRef}
            value={body}
            validVars={validVars}
            onChange={(e) => onEdit(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">{t('prompts.autosaveHint')}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={onReset}
            disabled={!canReset || reset.isPending}
            title={t('prompts.resetTitle')}
          >
            <RotateCcw className="size-4" />
            {t('prompts.resetToDefault')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// Splits a body into `{{var}}` tokens and everything between them. The capture
// group keeps the delimiters in the result so they can be rendered as spans.
const VAR_SPLIT = /(\{\{\s*[a-zA-Z_]+\s*\}\})/g;
// Same token shape the server-side renderer recognises (see render.ts), used to
// pull the name back out so it can be checked against the known variables.
const VAR_NAME = /^\{\{\s*([a-zA-Z_]+)\s*\}\}$/;

// Typography that MUST be byte-identical between the textarea and the backdrop, or
// the highlight boxes drift out of alignment with the caret. Only color/background
// may differ between the two layers. Anything affecting glyph metrics (font,
// size, leading, padding, border width) has to match.
const EDITOR_TYPOGRAPHY = 'min-h-72 rounded-md border px-3 py-2 font-mono text-xs leading-relaxed';

function highlightBody(body: string, validVars: Set<string>) {
  return body.split(VAR_SPLIT).map((seg, i) => {
    const name = seg.match(VAR_NAME)?.[1];
    if (name == null) return <span key={i}>{seg}</span>;
    const known = validVars.has(name);
    return (
      <span
        key={i}
        className={cn(
          'rounded-[3px]',
          // No horizontal padding: it would widen the box and shift every
          // following character away from the textarea's real caret position.
          known
            ? 'bg-brand/30 text-foreground'
            : 'text-destructive underline decoration-dotted underline-offset-2',
        )}
      >
        {seg}
      </span>
    );
  });
}

/**
 * A prompt editor that colours `{{variables}}` inline. A native textarea can't
 * style its own text, so the visible text is rendered by a backdrop div and the
 * textarea sits on top with transparent text (but a real caret). Known variables
 * get a brand highlight; unknown ones (typos that won't be substituted) are
 * flagged so they stand out rather than silently failing at run time.
 */
const HighlightedTextarea = forwardRef<
  HTMLTextAreaElement,
  {
    id?: string;
    value: string;
    validVars: Set<string>;
    onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  }
>(({ id, value, validVars, onChange }, ref) => {
  const backdropRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const setRefs = (el: HTMLTextAreaElement | null) => {
    innerRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };

  const syncScroll = () => {
    const el = innerRef.current;
    const bd = backdropRef.current;
    if (el && bd) {
      bd.scrollTop = el.scrollTop;
      bd.scrollLeft = el.scrollLeft;
    }
  };
  // Keep the backdrop aligned when the value changes programmatically (variable
  // insert, reset) or the textarea auto-scrolls while typing at the bottom.
  useEffect(syncScroll, [value]);

  return (
    <div className="relative">
      <div
        ref={backdropRef}
        aria-hidden
        className={cn(
          EDITOR_TYPOGRAPHY,
          'pointer-events-none absolute inset-0 w-full overflow-hidden border-transparent whitespace-pre-wrap text-foreground wrap-break-word dark:bg-input/30',
        )}
      >
        {highlightBody(value, validVars)}
        {/* A trailing newline the div would otherwise collapse. Keeps the
            backdrop's last line height matching the textarea's. */}
        {'\n'}
      </div>
      <Textarea
        id={id}
        ref={setRefs}
        value={value}
        spellCheck={false}
        onChange={onChange}
        onScroll={syncScroll}
        className={cn(
          EDITOR_TYPOGRAPHY,
          'relative bg-transparent text-transparent caret-foreground dark:bg-transparent',
        )}
      />
    </div>
  );
});
HighlightedTextarea.displayName = 'HighlightedTextarea';

function TestPanel({ promptKey, body }: { promptKey: PromptKey; body: string }) {
  const { t } = useTranslation();
  const docs = useTestDocuments(true);
  const test = useTestPrompt();
  const [docId, setDocId] = useState<number | ''>('');

  // Default the picker to the most recent document once the list loads.
  useEffect(() => {
    if (docId === '' && docs.data && docs.data.length > 0) setDocId(docs.data[0].id);
  }, [docs.data, docId]);

  const onRun = () => {
    if (docId === '') return;
    test.mutate({ key: promptKey, input: { documentId: docId, body } });
  };

  return (
    <PageSection title={t('prompts.testTitle')} description={t('prompts.testDescription')}>
      <div className="space-y-4">
        {docs.isError ? (
          <p className="text-sm text-muted-foreground">{t('prompts.testUnavailable')}</p>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-56 flex-1 space-y-2">
              <Label htmlFor="test-doc">{t('prompts.document')}</Label>
              <Select
                id="test-doc"
                value={docId === '' ? '' : String(docId)}
                disabled={docs.isLoading || !docs.data?.length}
                onChange={(e) => setDocId(e.target.value ? Number(e.target.value) : '')}
              >
                {docs.isLoading && <option value="">{t('common.loading')}</option>}
                {!docs.isLoading && !docs.data?.length && (
                  <option value="">{t('prompts.noDocuments')}</option>
                )}
                {docs.data?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title || t('prompts.documentFallback', { id: d.id })}
                  </option>
                ))}
              </Select>
            </div>
            <Button onClick={onRun} disabled={docId === '' || test.isPending}>
              {test.isPending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FlaskConical className="size-4" />
              )}
              {t('prompts.runTest')}
            </Button>
          </div>
        )}

        {test.isError && (
          <p className="text-sm text-destructive">
            {test.error instanceof Error ? test.error.message : t('prompts.testFailed')}
          </p>
        )}

        {test.data && <TestResult result={test.data} promptKey={promptKey} />}
      </div>
    </PageSection>
  );
}

function TestResult({ result, promptKey }: { result: PromptTestResult; promptKey: PromptKey }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4 rounded-md border bg-muted/30 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 text-brand" />
        <span className="text-sm font-medium">{t('prompts.result')}</span>
        <Badge variant="secondary" className="ml-auto">
          {result.tokens != null
            ? t('prompts.tokens', { tokens: result.tokens.toLocaleString() })
            : t('prompts.pageBilled')}
        </Badge>
      </div>

      {promptKey === PROMPT_KEY.EXTRACTION && result.extraction ? (
        <dl className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
          <Field label={t('prompts.fieldTitle')} value={result.extraction.title} />
          <Field
            label={t('prompts.fieldTags')}
            value={result.extraction.tags.length ? result.extraction.tags.join(', ') : '—'}
          />
          <Field
            label={t('prompts.fieldCorrespondent')}
            value={result.extraction.correspondent ?? '—'}
          />
          <Field label={t('prompts.fieldDate')} value={result.extraction.date ?? '—'} />
        </dl>
      ) : (
        <pre className="max-h-80 overflow-auto rounded-md bg-background p-3 text-xs whitespace-pre-wrap">
          {result.text || t('prompts.noTextReturned')}
        </pre>
      )}

      <details className="text-xs">
        <summary className="cursor-pointer text-muted-foreground select-none">
          {t('prompts.promptSent')}
        </summary>
        <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-background p-3 whitespace-pre-wrap">
          {result.rendered}
        </pre>
      </details>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 font-medium wrap-break-word">{value}</dd>
    </>
  );
}
