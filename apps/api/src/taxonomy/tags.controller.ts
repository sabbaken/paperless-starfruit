import {
  BadGatewayException,
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  DEFAULT_TRIGGER_TAG,
  tagCreateSchema,
  tagUpdateSchema,
  type TagCreate,
  type TagUpdate,
  type TagView,
} from '@paperless-starfruit/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ConnectionService } from '../connection/connection.service';
import type { PaperlessClient } from '../paperless/paperless.client';
import { PaperlessError } from '../paperless/paperless.error';
import type { PaperlessTag } from '../paperless/paperless.schemas';
import { HiddenTagsService } from './hidden-tags.service';
import { TagCommentsService } from './tag-comments.service';
import { TaxonomyService } from './taxonomy.service';

const createPipe = new ZodValidationPipe(tagCreateSchema);
const updatePipe = new ZodValidationPipe(tagUpdateSchema);

const norm = (s: string) => s.trim().toLowerCase();
const isTrigger = (name: string) => norm(name) === norm(DEFAULT_TRIGGER_TAG);

/**
 * The Tags admin page: paperless's tags merged with the local per-tag AI
 * hints. Name/colour writes go straight to paperless; the hint only ever
 * touches our own table.
 */
@Controller('tags')
export class TagsController {
  constructor(
    private readonly connection: ConnectionService,
    private readonly taxonomy: TaxonomyService,
    private readonly comments: TagCommentsService,
    private readonly hiddenTags: HiddenTagsService,
  ) {}

  @Get()
  async list(): Promise<TagView[]> {
    // Bypass the snapshot TTL — an admin list must reflect edits made in
    // paperless itself moments ago (and this refreshes the cache as a bonus).
    const client = this.requireClient();
    const { tags } = await this.rethrow(() => this.taxonomy.getSnapshot(client, true));
    const comments = this.comments.map();
    const hidden = this.hiddenTags.ids();
    return tags
      .map((t) => this.toView(t, comments.get(t.id) ?? null, hidden.has(t.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  @Post()
  async create(@Body(createPipe) input: TagCreate): Promise<TagView> {
    if (isTrigger(input.name)) {
      throw new BadRequestException(
        `"${DEFAULT_TRIGGER_TAG}" is the processing trigger tag — it already exists.`,
      );
    }
    const client = this.requireClient();
    const created = await this.rethrow(() => client.createTag(input.name, input.color));
    if (input.comment?.trim()) this.comments.set(created.id, input.comment);
    this.taxonomy.invalidateSnapshot();
    return this.toView(created, input.comment?.trim() || null, false);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(updatePipe) input: TagUpdate,
  ): Promise<TagView> {
    const client = this.requireClient();
    const { tags } = await this.rethrow(() => this.taxonomy.getSnapshot(client, true));
    const existing = tags.find((t) => t.id === id);
    if (!existing) throw new NotFoundException(`Tag ${id} not found in paperless.`);
    if (isTrigger(existing.name)) {
      throw new BadRequestException(
        'The processing trigger tag cannot be edited — Starfruit finds documents by its name.',
      );
    }
    if (input.name && isTrigger(input.name)) {
      throw new BadRequestException(
        `"${DEFAULT_TRIGGER_TAG}" is reserved for the processing trigger tag.`,
      );
    }

    const paperlessPatch: { name?: string; color?: string } = {};
    if (input.name !== undefined) paperlessPatch.name = input.name;
    if (input.color !== undefined) paperlessPatch.color = input.color;
    // The snapshot only mirrors paperless, so a hint-only edit leaves it valid.
    const touchesPaperless = Object.keys(paperlessPatch).length > 0;
    const updated = touchesPaperless
      ? await this.rethrow(() => client.updateTag(id, paperlessPatch))
      : existing;
    if (touchesPaperless) this.taxonomy.invalidateSnapshot();
    if (input.comment !== undefined) this.comments.set(id, input.comment);
    if (input.hidden !== undefined) this.hiddenTags.set(id, input.hidden);

    const comment =
      input.comment !== undefined ? input.comment?.trim() || null : this.comments.get(id);
    const hidden = input.hidden ?? this.hiddenTags.ids().has(id);
    return this.toView(updated, comment, hidden);
  }

  private toView(tag: PaperlessTag, comment: string | null, hidden: boolean): TagView {
    return {
      id: tag.id,
      name: tag.name,
      color: tag.color ?? null,
      parent: tag.parent ?? null,
      documentCount: tag.document_count ?? null,
      comment,
      isTrigger: isTrigger(tag.name),
      hidden,
    };
  }

  /** Surface paperless failures as readable client errors instead of blank 500s. */
  private async rethrow<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof PaperlessError)) throw err;
      if (err.status === 400) {
        throw new BadRequestException(`paperless rejected the tag: ${err.body ?? err.message}`);
      }
      if (err.status === 404) {
        throw new NotFoundException('The tag no longer exists in paperless.');
      }
      // Network failure, revoked token, 5xx — paperless's fault, not the client's.
      throw new BadGatewayException(err.message);
    }
  }

  private requireClient(): PaperlessClient {
    const client = this.connection.getClient();
    if (!client) throw new BadRequestException('Connect your paperless instance first.');
    return client;
  }
}
