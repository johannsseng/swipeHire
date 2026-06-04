// Generates a recruiter-outreach draft from the applicant's profile and the job.
//
// Deliberately template-based (deterministic, no external LLM dependency) so it
// works offline and produces a sensible message the user can edit before sending.

export type DraftInput = {
  applicantName: string | null;
  applicantHeadline: string | null;
  applicantLinks: { linkedin?: string; github?: string; portfolio?: string } | null;
  jobTitle: string;
  companyName: string;
  recruiterName: string | null;
};

export type Draft = { subject: string; body: string };

export function buildDraft(input: DraftInput): Draft {
  const name = input.applicantName?.trim() || "a candidate";
  const greetingName = input.recruiterName?.trim()?.split(" ")[0];
  const greeting = greetingName
    ? `Hi ${greetingName},`
    : `Hi ${input.companyName} hiring team,`;

  const headlineLine = input.applicantHeadline?.trim()
    ? ` I'm ${input.applicantHeadline.trim()}.`
    : "";

  const links: string[] = [];
  if (input.applicantLinks?.linkedin) links.push(`LinkedIn: ${input.applicantLinks.linkedin}`);
  if (input.applicantLinks?.portfolio) links.push(`Portfolio: ${input.applicantLinks.portfolio}`);
  if (input.applicantLinks?.github) links.push(`GitHub: ${input.applicantLinks.github}`);
  const linksBlock = links.length ? `\n\n${links.join("\n")}` : "";

  const subject = `Interested in the ${input.jobTitle} role at ${input.companyName}`;

  const body =
    `${greeting}\n\n` +
    `I came across the ${input.jobTitle} opening at ${input.companyName} and wanted to introduce myself.` +
    `${headlineLine} I'd love to learn more about the role and share how my background lines up with what your team is looking for.\n\n` +
    `Would you be open to a quick chat this week?` +
    `${linksBlock}\n\n` +
    `Best,\n${name}`;

  return { subject, body };
}
