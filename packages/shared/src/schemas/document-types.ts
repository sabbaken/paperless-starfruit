import { z } from 'zod';

/** Hints are prompt context, so keep the same compact limit as tag hints. */
export const DOCUMENT_TYPE_COMMENT_MAX = 500;

/** A paperless document type enriched with Starfruit's local AI guidance. */
export const documentTypeViewSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  documentCount: z.number().int().nullable(),
  comment: z.string().nullable(),
  /** Hidden types are neither offered to the model nor accepted from its output. */
  hidden: z.boolean(),
});
export type DocumentTypeView = z.infer<typeof documentTypeViewSchema>;

export const documentTypeCreateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(128),
  comment: z.string().trim().max(DOCUMENT_TYPE_COMMENT_MAX).optional(),
});
export type DocumentTypeCreate = z.infer<typeof documentTypeCreateSchema>;

export const documentTypeUpdateSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(128).optional(),
  comment: z.string().trim().max(DOCUMENT_TYPE_COMMENT_MAX).nullable().optional(),
  hidden: z.boolean().optional(),
});
export type DocumentTypeUpdate = z.infer<typeof documentTypeUpdateSchema>;
