// Email provider abstraction for recruiter outreach.
//
// Uses Resend (https://resend.com) by default — set RESEND_API_KEY and
// OUTREACH_FROM_EMAIL to enable real sending. When no key is configured the
// mailer runs in "noop" mode: it reports as not configured so the caller can
// persist the outreach as a draft instead of pretending it was sent.

export type SendResult =
  | { ok: true; providerId: string | null }
  | { ok: false; error: string };

export interface Mailer {
  isConfigured(): boolean;
  send(input: {
    to: string;
    replyTo?: string;
    subject: string;
    text: string;
  }): Promise<SendResult>;
}

const RESEND_API_KEY = process.env["RESEND_API_KEY"];
const FROM_EMAIL = process.env["OUTREACH_FROM_EMAIL"] ?? "outreach@swipehire.app";

class ResendMailer implements Mailer {
  isConfigured(): boolean {
    return Boolean(RESEND_API_KEY);
  }

  async send(input: {
    to: string;
    replyTo?: string;
    subject: string;
    text: string;
  }): Promise<SendResult> {
    if (!this.isConfigured()) {
      return { ok: false, error: "Email provider not configured" };
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: input.to,
          reply_to: input.replyTo,
          subject: input.subject,
          text: input.text,
        }),
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return { ok: false, error: `Provider error ${res.status}: ${detail.slice(0, 300)}` };
      }
      const data: any = await res.json().catch(() => ({}));
      return { ok: true, providerId: data?.id ?? null };
    } catch (err: any) {
      return { ok: false, error: err?.message ?? "Send failed" };
    }
  }
}

export const mailer: Mailer = new ResendMailer();
