import type { Metadata } from "next";
import Link from "next/link";
import { AuditLogView } from "@/components/ai/audit-log-view";
import { Note, PageHeader, Section } from "@/components/editorial/page-header";

export const metadata: Metadata = {
  title: "AI audit log",
  description:
    "Every AI call made from this browser: question, provider and model, generated SQL, validator verdict, rows, latency, token usage and the human decision. Stored only in your browser; exportable.",
  robots: { index: false },
};

export default function AiLogPage() {
  return (
    <>
      <PageHeader
        kicker="Transparency"
        title="AI audit log"
        lede={
          <>
            One record per AI interaction made from this browser: what was asked, which provider and model
            answered, what came back, what the server&apos;s SQL validator decided, how long it took, the
            tokens the provider reported and what a person did with the answer.
          </>
        }
      />
      <Section kicker="Records" title="Your log" className="pt-10">
        <AuditLogView />
        <Note className="mt-6 max-w-3xl">
          Stored in this browser&apos;s IndexedDB (database <code>social-sense-ai</code>, store{" "}
          <code>audit_log</code>). This site is read-only and has no accounts, so there is no server-side
          copy: clearing site data deletes it. Records never contain your API key; before each write the key,
          and anything shaped like a provider key, is replaced with <code>[redacted]</code>. Field definitions
          are in the{" "}
          <Link className="link" href="/methods#ai-use">
            AI use statement
          </Link>
          .
        </Note>
      </Section>
    </>
  );
}
