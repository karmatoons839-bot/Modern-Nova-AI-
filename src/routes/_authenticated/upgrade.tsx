import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/Page";
import { PlanCards } from "@/components/PlanCards";

export const Route = createFileRoute("/_authenticated/upgrade")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Upgrade Plan — Modern Nova AI" }, { name: "description", content: "Upgrade to Pro or Premium." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Upgrade Plan — Modern Nova AI" }, { property: "og:description", content: "Upgrade your plan." }] }),
  component: () => (
    <Page title="Upgrade Plan" sub="Pick a plan. You can add a promo code on the next screen. Your plan activates only after the payment is verified.">
      <PlanCards />
    </Page>
  ),
});
