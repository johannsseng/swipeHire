import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, type AuthedRequest } from "../auth/middleware.js";
import { requireAdmin } from "../auth/admin.js";
import {
  enrichCompanyRecruiter,
  recruiterEnrichmentConfigured,
} from "../recruiters/service.js";
import { resolveCompanyInbox } from "../outreach/inbox.js";

export const companiesRouter = Router();

// All company-admin routes require an authenticated admin.
companiesRouter.use(requireAuth, requireAdmin);

// List companies with their current outreach inbox (for the admin screen).
companiesRouter.get("/", async (_req, res) => {
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      website: true,
      recruiterName: true,
      recruiterEmail: true,
      recruiterTitle: true,
    },
  });

  res.json({
    items: companies.map((c) => {
      const inbox = resolveCompanyInbox(c);
      return {
        id: c.id,
        name: c.name,
        website: c.website,
        recruiterEmail: c.recruiterEmail,
        recruiterName: c.recruiterName,
        inbox: { email: inbox.email, kind: inbox.kind, label: inbox.label },
      };
    }),
  });
});

const setRecruiterSchema = z
  .object({
    name: z.string().max(120).optional(),
    title: z.string().max(120).optional(),
    // A specific inbox is optional — usually just setting the website is enough,
    // since outreach derives careers@<domain> from it.
    email: z.string().email().optional(),
    website: z.string().url().optional(),
  })
  .refine((d) => d.email || d.website, {
    message: "Provide an email and/or a website/domain",
  });

// Set a company's outreach inbox and/or website (which yields careers@<domain>).
companiesRouter.post("/:id/recruiter", async (req: AuthedRequest, res) => {
  const parse = setRecruiterSchema.safeParse(req.body);
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  const { name, title, email, website } = parse.data;

  const company = await prisma.company.findUnique({ where: { id: req.params.id } });
  if (!company) return res.status(404).json({ error: "Company not found" });

  const updated = await prisma.company.update({
    where: { id: req.params.id },
    data: {
      ...(email !== undefined ? { recruiterEmail: email, recruiterName: name ?? null, recruiterTitle: title ?? null } : {}),
      ...(website ? { website } : {}),
    },
    select: {
      id: true,
      name: true,
      website: true,
      recruiterName: true,
      recruiterEmail: true,
      recruiterTitle: true,
    },
  });

  res.json({ ok: true, company: updated });
});

const enrichSchema = z.object({
  domain: z.string().optional(),
});

// Auto-find a recruiter contact via the configured provider (Hunter.io).
companiesRouter.post("/:id/recruiter/enrich", async (req: AuthedRequest, res) => {
  const parse = enrichSchema.safeParse(req.body ?? {});
  if (!parse.success) {
    return res.status(400).json({ error: parse.error.flatten() });
  }
  if (!recruiterEnrichmentConfigured()) {
    return res
      .status(422)
      .json({ error: "Recruiter enrichment not configured (set HUNTER_API_KEY)" });
  }

  const result = await enrichCompanyRecruiter(req.params.id, parse.data.domain);
  if (!result.ok) {
    const status = result.reason === "Company not found" ? 404 : 422;
    return res.status(status).json({ error: result.reason });
  }

  res.json({
    ok: true,
    found: result.updated,
    email: result.email,
    note: result.updated ? undefined : "No recruiter contact found for that domain.",
  });
});
