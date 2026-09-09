import { z } from "zod";

/**
 * Just enough Zod → JSON Schema for tool parameter definitions. Tool schemas
 * are intentionally shallow (flat objects of strings / numbers / booleans /
 * enums / arrays), so a tiny hand-rolled converter beats another dependency and
 * stays fully in our control. Anything it can't express should not be a tool
 * parameter.
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const node = unwrap(schema);
  const def = node._def as { typeName: string; [k: string]: unknown };
  const description = schema.description ?? node.description;
  const base = description ? { description } : {};

  switch (def.typeName) {
    case z.ZodFirstPartyTypeKind.ZodString:
      return { type: "string", ...base };
    case z.ZodFirstPartyTypeKind.ZodNumber:
      return { type: "number", ...base };
    case z.ZodFirstPartyTypeKind.ZodBoolean:
      return { type: "boolean", ...base };
    case z.ZodFirstPartyTypeKind.ZodEnum:
      return { type: "string", enum: [...(def.values as string[])], ...base };
    case z.ZodFirstPartyTypeKind.ZodNativeEnum:
      return {
        type: "string",
        enum: Object.values(def.values as Record<string, string | number>).filter(
          (v) => typeof v === "string",
        ),
        ...base,
      };
    case z.ZodFirstPartyTypeKind.ZodArray:
      return {
        type: "array",
        items: zodToJsonSchema((node as z.ZodArray<z.ZodTypeAny>).element),
        ...base,
      };
    case z.ZodFirstPartyTypeKind.ZodObject: {
      const shape = (node as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value);
        if (!isOptional(value)) required.push(key);
      }
      return {
        type: "object",
        properties,
        ...(required.length > 0 ? { required } : {}),
        additionalProperties: false,
        ...base,
      };
    }
    default:
      // Fall back to a permissive object rather than throwing — a tool with an
      // exotic schema still works, it just isn't described to the model.
      return { type: "object", ...base };
  }
}

/** Strip Optional / Nullable / Default / Effects wrappers to reach the core type. */
function unwrap(schema: z.ZodTypeAny): z.ZodTypeAny {
  const def = schema._def as { typeName: string; innerType?: z.ZodTypeAny; schema?: z.ZodTypeAny };
  if (
    def.typeName === z.ZodFirstPartyTypeKind.ZodOptional ||
    def.typeName === z.ZodFirstPartyTypeKind.ZodNullable ||
    def.typeName === z.ZodFirstPartyTypeKind.ZodDefault
  ) {
    return unwrap(def.innerType!);
  }
  if (def.typeName === z.ZodFirstPartyTypeKind.ZodEffects) {
    return unwrap(def.schema!);
  }
  return schema;
}

function isOptional(schema: z.ZodTypeAny): boolean {
  const def = schema._def as { typeName: string; innerType?: z.ZodTypeAny };
  if (
    def.typeName === z.ZodFirstPartyTypeKind.ZodOptional ||
    def.typeName === z.ZodFirstPartyTypeKind.ZodDefault
  ) {
    return true;
  }
  if (def.typeName === z.ZodFirstPartyTypeKind.ZodNullable) {
    return isOptional(def.innerType!);
  }
  return false;
}
