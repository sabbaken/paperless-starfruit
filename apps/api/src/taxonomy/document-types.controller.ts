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
  documentTypeCreateSchema,
  documentTypeUpdateSchema,
  type DocumentTypeCreate,
  type DocumentTypeUpdate,
  type DocumentTypeView,
} from '@paperless-starfruit/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { ConnectionService } from '../connection/connection.service';
import type { PaperlessClient } from '../paperless/paperless.client';
import { PaperlessError } from '../paperless/paperless.error';
import type { PaperlessDocumentType } from '../paperless/paperless.schemas';
import { DocumentTypeCommentsService } from './document-type-comments.service';
import { HiddenDocumentTypesService } from './hidden-document-types.service';
import { TaxonomyService } from './taxonomy.service';

const createPipe = new ZodValidationPipe(documentTypeCreateSchema);
const updatePipe = new ZodValidationPipe(documentTypeUpdateSchema);

/** Paperless document-type CRUD enriched with local AI hints and visibility. */
@Controller('document-types')
export class DocumentTypesController {
  constructor(
    private readonly connection: ConnectionService,
    private readonly taxonomy: TaxonomyService,
    private readonly comments: DocumentTypeCommentsService,
    private readonly hiddenTypes: HiddenDocumentTypesService,
  ) {}

  @Get()
  async list(): Promise<DocumentTypeView[]> {
    const client = this.requireClient();
    const { documentTypes } = await this.rethrow(() => this.taxonomy.getSnapshot(client, true));
    const comments = this.comments.map();
    const hidden = this.hiddenTypes.ids();
    return documentTypes
      .map((type) => this.toView(type, comments.get(type.id) ?? null, hidden.has(type.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  @Post()
  async create(@Body(createPipe) input: DocumentTypeCreate): Promise<DocumentTypeView> {
    const created = await this.rethrow(() => this.requireClient().createDocumentType(input.name));
    if (input.comment?.trim()) this.comments.set(created.id, input.comment);
    this.taxonomy.invalidateSnapshot();
    return this.toView(created, input.comment?.trim() || null, false);
  }

  @Patch(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body(updatePipe) input: DocumentTypeUpdate,
  ): Promise<DocumentTypeView> {
    const client = this.requireClient();
    const { documentTypes } = await this.rethrow(() => this.taxonomy.getSnapshot(client, true));
    const existing = documentTypes.find((type) => type.id === id);
    if (!existing) throw new NotFoundException(`Document type ${id} not found in paperless.`);

    const updated =
      input.name !== undefined
        ? await this.rethrow(() => client.updateDocumentType(id, { name: input.name! }))
        : existing;
    if (input.name !== undefined) this.taxonomy.invalidateSnapshot();
    if (input.comment !== undefined) this.comments.set(id, input.comment);
    if (input.hidden !== undefined) this.hiddenTypes.set(id, input.hidden);

    const comment =
      input.comment !== undefined ? input.comment?.trim() || null : this.comments.get(id);
    return this.toView(updated, comment, input.hidden ?? this.hiddenTypes.ids().has(id));
  }

  private toView(
    type: PaperlessDocumentType,
    comment: string | null,
    hidden: boolean,
  ): DocumentTypeView {
    return {
      id: type.id,
      name: type.name,
      documentCount: type.document_count ?? null,
      comment,
      hidden,
    };
  }

  private async rethrow<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof PaperlessError)) throw err;
      if (err.status === 400) {
        throw new BadRequestException(
          `paperless rejected the document type: ${err.body ?? err.message}`,
        );
      }
      if (err.status === 404) {
        throw new NotFoundException('The document type no longer exists in paperless.');
      }
      throw new BadGatewayException(err.message);
    }
  }

  private requireClient(): PaperlessClient {
    const client = this.connection.getClient();
    if (!client) throw new BadRequestException('Connect your paperless instance first.');
    return client;
  }
}
