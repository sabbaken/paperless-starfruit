import { useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { Brain, Loader2, ScanText } from 'lucide-react';
import { DEFAULT_TRIGGER_TAG, TRIGGER_TAG_COLOR } from '@paperless-starfruit/shared';
import { useProviders } from '@/api/providers';
import { useSettings, useUpdateSettings } from '@/api/settings';
import { ModelPicker } from '@/components/model-picker';
import { PaperlessConnectionForm } from '@/components/paperless-connection-card';
import { Button } from '@/components/ui/button';
import { SelectRow } from '@/components/ui/select-row';
import { StepIndicator } from '@/components/ui/step-indicator';
import { ApiKeysPage } from '@/pages/ApiKeysPage';
import { toastSave } from '@/lib/toast';

/** `label` is the (short) navbar tab text; it falls back to `title`. */
const STEPS: { label?: string; title: string; description: ReactNode }[] = [
  {
    title: 'Connect paperless',
    description: 'Point Starfruit at your paperless-ngx instance.',
  },
  {
    title: 'API keys',
    description: 'Connect at least one AI provider — a cloud key or a local endpoint.',
  },
  {
    title: 'Processing',
    description: 'Pick which models read and enrich your documents.',
  },
  {
    label: 'Start processing',
    title: 'How to start processing?',
    description: (
      <>
        Tag a document with <TriggerTag /> in paperless — Starfruit picks it up on the next poll.
      </>
    ),
  },
];

/** The trigger tag, rendered the way paperless shows it (its real name and colour). */
function TriggerTag() {
  return (
    <span
      className="inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs font-medium text-black"
      style={{ backgroundColor: TRIGGER_TAG_COLOR }}
    >
      {DEFAULT_TRIGGER_TAG}
    </span>
  );
}

/**
 * Guided first-run setup, shown right after the admin account is created.
 * Deliberately not gated on anything beyond auth: every step is skippable and
 * the page stays reachable at /onboarding once everything is configured, so
 * the whole flow can be re-run (or just inspected) by hand at any time.
 *
 * The current step lives in the URL (/onboarding/1 … /onboarding/4), so steps
 * are directly linkable and the browser's back button walks the flow.
 */
export function OnboardingPage() {
  const navigate = useNavigate();
  const params = useParams();

  const n = Number(params.step);
  if (!Number.isInteger(n) || n < 1 || n > STEPS.length) {
    return <Navigate to="/onboarding/1" replace />;
  }
  const step = n - 1;
  const last = step === STEPS.length - 1;
  const setStep = (i: number) => navigate(`/onboarding/${i + 1}`);

  return (
    <div className="flex min-h-svh flex-col">
      {/* Three-zone navbar: logo | centered step tabs | (empty). minmax(0,1fr)
          (not plain 1fr, whose min-content floor lets the wider logo side win)
          forces the side columns equal, keeping the tabs truly centered. */}
      <header className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-6 py-4">
        <div className="flex items-center gap-2">
          <img src="/paperless-starfruit.png" alt="" className="size-5 shrink-0" />
          <span className="hidden text-sm font-semibold tracking-tight whitespace-nowrap md:inline">
            Paperless Starfruit
          </span>
        </div>
        <StepIndicator
          steps={STEPS.map((s) => s.label ?? s.title)}
          current={step}
          onSelect={setStep}
        />
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-6 pt-14 pb-8">
        <div className="space-y-1">
          <h1 className="text-lg font-semibold tracking-tight">{STEPS[step].title}</h1>
          <p className="text-sm text-muted-foreground">{STEPS[step].description}</p>
        </div>

        <div className="mt-6">
          {step === 0 && <PaperlessConnectionForm onConnected={() => setStep(1)} />}
          {step === 1 && <ApiKeysPage />}
          {step === 2 && <ProcessingStep onGoToProviders={() => setStep(1)} />}
        </div>
      </main>

      {/* Outside <main>, so the buttons hug the viewport bottom no matter how
          tall the step content is — no vertical jumping between steps. Absent
          on the connection step: its "Save & continue" is the next button (and
          Back has nowhere to go); the navbar tabs still allow skipping. */}
      {step > 0 && (
        <footer className="mx-auto w-full max-w-xl px-6 pb-8">
          <div className="flex items-center justify-between">
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              Back
            </Button>
            <Button onClick={() => (last ? navigate('/dashboard') : setStep(step + 1))}>
              {last ? 'Done' : 'Next'}
            </Button>
          </div>
        </footer>
      )}
    </div>
  );
}

/** Model choice only — the two pickers, nothing else. Every other processing
 *  knob keeps its default and lives in Settings → Processing. "Add a key" in
 *  the picker points back at the API-keys step instead of the settings route. */
function ProcessingStep({ onGoToProviders }: { onGoToProviders: () => void }) {
  const settings = useSettings();
  const providers = useProviders();
  const save = useUpdateSettings();
  const [picker, setPicker] = useState<'ocr' | 'llm' | null>(null);

  if (settings.isLoading || providers.isLoading || !settings.data) {
    return <Loader2 className="mx-auto size-5 animate-spin text-muted-foreground" />;
  }
  const s = settings.data;
  const list = providers.data ?? [];
  const describe = (id: number | null, model: string | null) =>
    model ? `${list.find((p) => p.id === id)?.name ?? 'Unknown'} · ${model}` : null;

  const onSelectModel = (providerId: number, model: string) => {
    void toastSave(
      save.mutateAsync(
        picker === 'ocr'
          ? { ocrProviderId: providerId, ocrModel: model }
          : { llmProviderId: providerId, llmModel: model },
      ),
    );
    setPicker(null);
  };

  return (
    <>
      <div className="divide-y">
        <SelectRow
          icon={<ScanText className="size-4" />}
          label="OCR model"
          hint="Extract text with a vision model"
          value={describe(s.ocrProviderId, s.ocrModel)}
          onClick={() => setPicker('ocr')}
        />
        <SelectRow
          icon={<Brain className="size-4" />}
          label="Extraction model"
          hint="Suggests title, tags, correspondent and date"
          value={describe(s.llmProviderId, s.llmModel)}
          onClick={() => setPicker('llm')}
        />
      </div>

      {picker && (
        <ModelPicker
          title={picker === 'ocr' ? 'OCR model' : 'Language model'}
          visionOnly={picker === 'ocr'}
          selected={
            picker === 'ocr'
              ? { providerId: s.ocrProviderId, model: s.ocrModel }
              : { providerId: s.llmProviderId, model: s.llmModel }
          }
          onSelect={onSelectModel}
          onClose={() => setPicker(null)}
          onAddKey={() => {
            setPicker(null);
            onGoToProviders();
          }}
        />
      )}
    </>
  );
}
