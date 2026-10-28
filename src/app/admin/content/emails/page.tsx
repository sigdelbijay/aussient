import type { Metadata } from "next";
import { EmailForm } from "@/components/admin/content/email-form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { requireStaff } from "@/lib/auth/dal";
import { EMAIL_TEMPLATES, type EmailKey } from "@/lib/email-templates";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Emails" };

export default async function EmailsPage() {
  await requireStaff("/admin/content/emails");
  const rows = await prisma.emailTemplate.findMany();
  const saved = new Map(rows.map((r) => [r.key, r]));

  return (
    <>
      <PageHeader title="Emails" description="The subject and opening words of each email the shop sends. The button and the rest are filled in for you." />
      <div className="grid max-w-3xl gap-4">
        {(Object.keys(EMAIL_TEMPLATES) as EmailKey[]).map((key) => {
          const t = EMAIL_TEMPLATES[key];
          const row = saved.get(key);
          return (
            <Panel
              key={key}
              title={t.name}
              description={t.live ? `Sent when: ${t.when.toLowerCase()}.` : `Sent when: ${t.when.toLowerCase()} — starts once checkout is built.`}
            >
              <EmailForm emailKey={key} subject={row?.subject ?? t.subject} body={row?.body ?? t.body} placeholders={t.placeholders} edited={!!row} />
            </Panel>
          );
        })}
      </div>
    </>
  );
}
