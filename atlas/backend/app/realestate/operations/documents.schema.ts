import { z } from "zod";

export const createDocumentSchema = z.object({
  name: z.string().trim().min(1).max(300),
  docType: z.string().trim().min(1).max(60),
  relatedType: z.string().nullish(),
  relatedId: z.string().nullish(),
  /** id of a file already uploaded via Core's /api/files presigned-upload flow */
  fileId: z.string().nullish(),
  uploadedBy: z.string().min(1),
});

export const listDocumentsQuery = z.object({
  relatedType: z.string().optional(),
  relatedId: z.string().optional(),
});

export type CreateDocumentBody = z.infer<typeof createDocumentSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuery>;
