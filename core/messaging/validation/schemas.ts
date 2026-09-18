import { z } from "zod";

/** Shared by the REST controller and the socket gateway — one definition of "valid input". */

const id = z.string().trim().min(1).max(128);
const limit = (def: number, max: number) => z.coerce.number().int().min(1).max(max).default(def);

export const MAX_MESSAGE_BODY = 8000;
export const MAX_ATTACHMENTS_PER_MESSAGE = 10;

export const createConversationSchema = z.object({
  type: z.enum(["direct", "group", "channel"]),
  title: z.string().trim().min(1).max(200).nullish(),
  memberIds: z.array(id).max(200).default([]),
  subjectType: z.string().trim().min(1).max(64).nullish(),
  subjectId: id.nullish(),
  metadata: z.record(z.unknown()).optional(),
});
export type CreateConversationInput = z.infer<typeof createConversationSchema>;

export const updateConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(200).nullable().optional(),
    archived: z.boolean().optional(),
    metadata: z.record(z.unknown()).optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to update." });
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;

export const addMembersSchema = z.object({ userIds: z.array(id).min(1).max(200) });

const sendMessageBase = z.object({
  body: z.string().max(MAX_MESSAGE_BODY).default(""),
  /** Client-generated UUID (or any unique token) — makes retries idempotent. */
  clientMessageId: z.string().trim().min(8).max(64).optional(),
  replyToMessageId: id.optional(),
  attachmentFileIds: z.array(id).max(MAX_ATTACHMENTS_PER_MESSAGE).optional(),
  metadata: z.record(z.unknown()).optional(),
});
const needsTextOrAttachment = {
  message: "A message needs text or at least one attachment.",
  path: ["body"],
};
const hasContent = (v: { body: string; attachmentFileIds?: string[] | undefined }) =>
  v.body.trim().length > 0 || (v.attachmentFileIds?.length ?? 0) > 0;

export const sendMessageSchema = sendMessageBase.refine(hasContent, needsTextOrAttachment);
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

/** The socket command: same shape plus the target conversation; the idempotency key is mandatory. */
export const messageCreateCommandSchema = sendMessageBase
  .extend({ conversationId: id, clientMessageId: z.string().trim().min(8).max(64) })
  .refine(hasContent, needsTextOrAttachment);

export const conversationCommandSchema = z.object({ conversationId: id });
export const conversationReadCommandSchema = z.object({ conversationId: id, messageId: id.optional() });
export const authRefreshCommandSchema = z.object({ token: z.string().min(10).max(4096) });

export const editMessageSchema = z.object({ body: z.string().trim().min(1).max(MAX_MESSAGE_BODY) });

export const historyQuerySchema = z.object({
  /** Exclusive `seq` upper bound — omit for the latest page. */
  before: z.coerce.number().int().positive().optional(),
  limit: limit(50, 100),
});

export const syncQuerySchema = z.object({
  afterChangeSeq: z.coerce.number().int().min(0).default(0),
  limit: limit(200, 500),
});

export const listConversationsQuerySchema = z.object({
  limit: limit(30, 100),
  cursor: z.string().min(1).max(200).optional(),
  archived: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  subjectType: z.string().trim().min(1).max(64).optional(),
  subjectId: id.optional(),
});

export const markReadSchema = z.object({ messageId: id.optional() });

export const reactionSchema = z.object({ emoji: z.string().trim().min(1).max(32) });

export const searchQuerySchema = z.object({
  q: z.string().trim().min(2).max(200),
  conversationId: id.optional(),
  limit: limit(20, 50),
});
