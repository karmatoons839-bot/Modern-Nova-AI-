import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, Mail } from "lucide-react";
import { Card, Page } from "@/components/Page";
import { FAQS, SUPPORT_EMAIL } from "@/lib/help-faq";

export const Route = createFileRoute("/help/$slug")({
  staticData: { sitemap: false },
  loader: ({ params }) => {
    const faq = FAQS.find((f) => f.slug === params.slug);
    if (!faq) throw notFound();
    return { faq };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Not found — Modern Nova AI" }, { name: "robots", content: "noindex" }] };
    const t = `${loaderData.faq.q} — Help · Modern Nova AI`;
    return {
      meta: [
        { title: t },
        { name: "description", content: loaderData.faq.short },
        { property: "og:title", content: t },
        { property: "og:description", content: loaderData.faq.short },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  notFoundComponent: () => (
    <Page title="Question not found">
      <Link to="/help" className="text-primary font-semibold">Back to Help & Support</Link>
    </Page>
  ),
  component: FaqPage,
});

function FaqPage() {
  const { faq } = Route.useLoaderData();
  return (
    <Page title={faq.q} sub={faq.short}>
      <Link to="/help" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
        <ArrowLeft className="h-4 w-4" /> Back to Help & Support
      </Link>
      <Card>
        <p className="font-bold text-foreground">What to do</p>
        <ol className="mt-3 space-y-3">
          {faq.steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-foreground">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <p className="text-sm text-muted-foreground">Still need help? Email us:</p>
        <p className="mt-1 inline-flex items-center gap-2 font-semibold text-foreground select-all break-all">
          <Mail className="h-4 w-4 text-primary" /> {SUPPORT_EMAIL}
        </p>
      </Card>
    </Page>
  );
}
