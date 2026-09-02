import { Injectable } from "@nestjs/common";
import { currentExecutor } from "@core/kernel/db/db.js";
import { newId } from "@core/kernel/id.js";
import { languageOf } from "@core/localization/domain/locale.js";

export interface RenderedTemplate {
  subject: string | null;
  body: string;
}

export interface TemplateSeed {
  key: string;
  locale: string;
  channel: "in_app" | "email";
  subject?: string;
  body: string;
}

/** Renders `{{placeholder}}` tokens. Unknown tokens are left visible. */
function interpolate(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) =>
    key in params ? String(params[key]) : `{{${key}}}`,
  );
}

@Injectable()
export class TemplateRepository {
  async render(
    key: string,
    channel: "in_app" | "email",
    locale: string,
    params: Record<string, string | number>,
  ): Promise<RenderedTemplate | null> {
    const lang = languageOf(locale);
    const row =
      (await currentExecutor()
        .selectFrom("notification_templates")
        .select(["subject", "body"])
        .where("key", "=", key)
        .where("channel", "=", channel)
        .where("locale", "=", lang)
        .executeTakeFirst()) ??
      (await currentExecutor()
        .selectFrom("notification_templates")
        .select(["subject", "body"])
        .where("key", "=", key)
        .where("channel", "=", channel)
        .where("locale", "=", "en")
        .executeTakeFirst());

    if (!row) return null;
    return {
      subject: row.subject ? interpolate(row.subject, params) : null,
      body: interpolate(row.body, params),
    };
  }

  async upsertMany(seeds: TemplateSeed[]): Promise<void> {
    for (const s of seeds) {
      await currentExecutor()
        .insertInto("notification_templates")
        .values({
          id: newId("tmpl"),
          key: s.key,
          locale: s.locale,
          channel: s.channel,
          subject: s.subject ?? null,
          body: s.body,
        })
        .onConflict((oc) =>
          oc.columns(["key", "locale", "channel"]).doUpdateSet({
            subject: s.subject ?? null,
            body: s.body,
          }),
        )
        .execute();
    }
  }
}
