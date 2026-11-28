import { createFileRoute } from "@tanstack/react-router";
import { Card, Page } from "@/components/Page";

export const Route = createFileRoute("/privacy")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Privacy Policy — Modern Nova AI" },
      { name: "description", content: "How Modern Nova AI stores your account, credits and generations." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Privacy Policy — Modern Nova AI" },
      { property: "og:description", content: "Privacy policy for Modern Nova AI." },
    ],
  }),
  component: () => (
    <Page title="Privacy Policy">
      <Card className="space-y-3 text-sm text-muted-foreground">
        <p>We store your name, email, plan, credit balance, generation history and payment records so your account works.</p>
        <p>Your generated files are private to your account. We never show your payment details to anyone and never sell your data.</p>
        <p>You can ask us to delete your account and data from Help & Support.</p>
      </Card>
    </Page>
  ),
});
