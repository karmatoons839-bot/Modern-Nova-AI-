import { createFileRoute } from "@tanstack/react-router";
import { Page } from "@/components/Page";
import { PlanCards } from "@/components/PlanCards";

export const Route = createFileRoute("/pricing")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Pricing & Plans — Modern Nova AI" },
      { name: "description", content: "Free (5,000 credits), Basic ₹199 (50,000), Standard ₹499 (100,000) and Premium ₹999 (500,000) plans for Modern Nova AI tools." },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Pricing & Plans — Modern Nova AI" },
      { property: "og:description", content: "Free, Basic, Standard and Premium plans with credits for all three AI tools." },
    ],
  }),
  component: () => (
    <Page title="Pricing & Plans" sub="All plans include Script Studio, Voice Studio, Script to Video, SFX Maker and Music Studio.">
      <PlanCards />
    </Page>
  ),
});
