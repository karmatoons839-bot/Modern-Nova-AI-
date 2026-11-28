import { createFileRoute, Link } from "@tanstack/react-router";
import { ChevronRight, Mail } from "lucide-react";
import { Card, Page } from "@/components/Page";
import { SupportForm } from "@/components/SupportForm";
import { FAQS, SUPPORT_EMAIL } from "@/lib/help-faq";

export const Route = createFileRoute("/help")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Help & Support — Modern Nova AI" },
      { name: "description", content: "Answers about credits, plans, languages and downloads on Modern Nova AI." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Help & Support — Modern Nova AI" },
      { property: "og:description", content: "Get help with Modern Nova AI." },
    ],
  }),
  component: () => (
    <Page title="Help & Support" sub="Tap a question to see the full steps.">
      <Card>
        <p className="text-sm text-muted-foreground">Official support email</p>
        <p className="mt-1 inline-flex items-center gap-2 font-semibold text-foreground select-all break-all">
          <Mail className="h-4 w-4 text-primary" /> {SUPPORT_EMAIL}
        </p>
      </Card>
      {FAQS.map((f) => (
        <Link key={f.slug} to="/help/$slug" params={{ slug: f.slug }} className="block">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-bold text-foreground">{f.q}</p>
                <p className="mt-1 text-sm text-muted-foreground">{f.short}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-primary" />
            </div>
          </Card>
        </Link>
      ))}
      <SupportForm />
    </Page>
  ),
});
