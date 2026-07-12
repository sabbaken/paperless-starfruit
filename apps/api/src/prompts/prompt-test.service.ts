import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DEFAULT_TRIGGER_TAG,
  EXTRACTION_SCHEMA_DESCRIPTION,
  EXTRACTION_SCHEMA_NAME,
  PROMPT_KEY,
  extractionSchema,
  normalizeDocumentDate,
  type Extraction,
  type PromptKey,
  type PromptTestInput,
  type PromptTestResult,
  type TestDocument,
} from '@paperless-starfruit/shared';
import { ConnectionService } from '../connection/connection.service';
import type { PaperlessClient } from '../paperless/paperless.client';
import { ProviderService } from '../providers/provider.service';
import { LlmService } from '../providers/llm.service';
import { OcrService } from '../providers/ocr.service';
import { buildLanguageModel, type ResolvedProvider } from '../providers/model.factory';
import { SettingsService } from '../settings/settings.service';
import { HiddenTagsService } from '../taxonomy/hidden-tags.service';
import { TagCommentsService } from '../taxonomy/tag-comments.service';
import { TaxonomyService } from '../taxonomy/taxonomy.service';
import { PromptsService } from './prompts.service';
import { extractionVars, ocrVars, renderTemplate } from './render';

/**
 * Runs a (possibly unsaved) prompt body against a real paperless document so the
 * user can preview what the model would return: the "test on a document" panel.
 * Mirrors the pipeline's provider/taxonomy wiring without touching the queue,
 * review or audit; OCR tests never write the text back.
 */
@Injectable()
export class PromptTestService {
  constructor(
    private readonly connection: ConnectionService,
    private readonly settings: SettingsService,
    private readonly providers: ProviderService,
    private readonly llm: LlmService,
    private readonly ocr: OcrService,
    private readonly taxonomy: TaxonomyService,
    private readonly tagComments: TagCommentsService,
    private readonly hiddenTags: HiddenTagsService,
    private readonly prompts: PromptsService,
  ) {}

  /** Most-recent documents for the picker. */
  async recentDocuments(): Promise<TestDocument[]> {
    const docs = await this.requireClient().listRecentDocuments(20);
    return docs.map((d) => ({ id: d.id, title: d.title }));
  }

  async test(key: PromptKey, input: PromptTestInput): Promise<PromptTestResult> {
    const client = this.requireClient();
    const doc = await this.loadDocument(client, input.documentId);
    const body = input.body ?? this.prompts.getBody(key);

    if (key === PROMPT_KEY.OCR) return this.testOcr(client, doc, body);
    return this.testExtraction(client, doc, body);
  }

  private async testExtraction(
    client: PaperlessClient,
    doc: Awaited<ReturnType<PaperlessClient['getDocument']>>,
    body: string,
  ): Promise<PromptTestResult> {
    const settings = this.settings.get();
    const provider = this.resolveProvider(settings.llmProviderId, settings.llmModel, 'LLM');

    const snap = await this.taxonomy.getSnapshot(client);
    const triggerNames = new Set<string>([DEFAULT_TRIGGER_TAG]);
    const triggerIds = new Set(snap.tags.filter((t) => triggerNames.has(t.name)).map((t) => t.id));
    const tagName = (id: number) => snap.tags.find((t) => t.id === id)?.name;
    const tagHints = this.tagComments.map();
    // Mirror the pipeline: hidden tags never reach the rendered prompt, so the
    // preview shows exactly what a real run would send.
    const hiddenIds = this.hiddenTags.ids();
    const excluded = (id: number) => triggerIds.has(id) || hiddenIds.has(id);

    const rendered = renderTemplate(
      body,
      extractionVars({
        content: (doc.content ?? '').trim(),
        language: settings.language,
        allTags: snap.tags
          .filter((t) => !excluded(t.id))
          .map((t) => ({ name: t.name, comment: tagHints.get(t.id) ?? null })),
        allCorrespondents: snap.correspondents.map((c) => c.name),
        allowNewTags: settings.createNewTags,
        allowNewCorrespondents: settings.createNewCorrespondents,
        currentTitle: doc.title,
        currentTags: doc.tags
          .filter((id) => !excluded(id))
          .map(tagName)
          .filter((n): n is string => !!n),
        currentCorrespondent:
          snap.correspondents.find((c) => c.id === doc.correspondent)?.name ?? null,
        created: doc.created ? doc.created.slice(0, 10) : null,
        filename: doc.original_file_name ?? null,
      }),
    );

    const { object, usage } = await this.llm.generateStructured<Extraction>({
      model: buildLanguageModel(provider),
      schema: extractionSchema,
      schemaName: EXTRACTION_SCHEMA_NAME,
      schemaDescription: EXTRACTION_SCHEMA_DESCRIPTION,
      prompt: rendered,
    });

    // Mirror the pipeline: a partial period date is padded to the first of the
    // period, so the preview shows exactly what a real run would apply.
    object.date = normalizeDocumentDate(object.date);
    return { rendered, tokens: usage.totalTokens, extraction: object };
  }

  private async testOcr(
    client: PaperlessClient,
    doc: Awaited<ReturnType<PaperlessClient['getDocument']>>,
    body: string,
  ): Promise<PromptTestResult> {
    const settings = this.settings.get();
    const provider = this.resolveProvider(settings.ocrProviderId, settings.ocrModel, 'OCR');

    const file = await client.downloadOriginal(doc.id);
    const rendered = renderTemplate(
      body,
      ocrVars({ language: settings.language, filename: doc.original_file_name ?? null }),
    );

    const result = await this.ocr.ocr(
      provider,
      { data: file.data, contentType: file.contentType },
      { language: settings.language, prompt: rendered },
    );
    return { rendered, tokens: result.usage?.totalTokens ?? null, text: result.text };
  }

  private resolveProvider(
    providerId: number | null,
    model: string | null,
    role: 'LLM' | 'OCR',
  ): ResolvedProvider {
    if (providerId == null || !model) {
      throw new BadRequestException(
        role === 'OCR'
          ? 'No OCR model is selected. Choose one in Settings → Processing first.'
          : 'No language model is selected. Choose one in Settings → Processing first.',
      );
    }
    const credential = this.providers.getCredential(providerId);
    if (!credential) {
      throw new BadRequestException(`The selected ${role} provider no longer exists.`);
    }
    return { ...credential, model };
  }

  private async loadDocument(client: PaperlessClient, id: number) {
    try {
      return await client.getDocument(id);
    } catch {
      throw new BadRequestException(`Couldn't load document ${id} from paperless.`);
    }
  }

  private requireClient(): PaperlessClient {
    const client = this.connection.getClient();
    if (!client) throw new BadRequestException('Connect your paperless instance first.');
    return client;
  }
}
