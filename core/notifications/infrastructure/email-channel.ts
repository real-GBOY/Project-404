import nodemailer, { type Transporter } from "nodemailer";
import { moduleLogger } from "@core/kernel/logging/logger.js";

const log = moduleLogger("email");

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface EmailChannel {
  send(message: EmailMessage): Promise<void>;
}

/**
 * Email transport. With no SMTP configured it uses nodemailer's JSON
 * transport and logs the payload — so dev and tests never send real mail and
 * never need a mail server. This is an EXTERNAL side effect, so it only ever
 * runs from the outbox worker (§6.1).
 */
export function createEmailChannel(params: { from: string; smtpUrl?: string }): EmailChannel {
  const transport: Transporter = params.smtpUrl
    ? nodemailer.createTransport(params.smtpUrl)
    : nodemailer.createTransport({ jsonTransport: true });

  return {
    async send(message) {
      const info = await transport.sendMail({
        from: params.from,
        to: message.to,
        subject: message.subject,
        text: message.text,
        ...(message.html ? { html: message.html } : {}),
      });
      if (params.smtpUrl) {
        log.info({ to: message.to, subject: message.subject, messageId: info.messageId }, "email sent");
      } else {
        log.info(
          { to: message.to, subject: message.subject, body: message.text },
          "email (dev transport — not actually sent)",
        );
      }
    },
  };
}
