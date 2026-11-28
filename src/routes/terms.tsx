import { createFileRoute } from "@tanstack/react-router";
import { Card, Page } from "@/components/Page";

export const Route = createFileRoute("/terms")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Modern Nova AI" },
      { name: "description", content: "Terms for using Modern Nova AI's voice, image and thumbnail tools." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Terms & Conditions — Modern Nova AI" },
      { property: "og:description", content: "Terms of use for Modern Nova AI." },
    ],
  }),
  component: () => (
    <Page title="Terms & Conditions">
      <Card className="space-y-3 text-sm text-muted-foreground">
        <p>By using Modern Nova AI you agree to use the tools lawfully and not to generate content that is harmful, hateful, or infringes anyone's rights.</p>
        <p>Credits are used when you generate. Failed generations are refunded automatically. Paid plans renew monthly and credits are added only after payment is verified.</p>
        <p>You are responsible for how you use generated voices, images and thumbnails. We may suspend accounts that misuse the service.</p>
      </Card>
    </Page>
  ),
});
