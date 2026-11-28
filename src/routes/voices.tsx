import { createFileRoute } from "@tanstack/react-router";
import { VoiceBrowser } from "@/components/VoiceBrowser";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/voices")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "400 Voice Library — Modern Nova AI" },
      {
        name: "description",
        content:
          "Search and filter 400 voice profiles by age 6-80, gender, language, emotion and style, and hear a real story preview in each voice.",
      },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "400 Voice Library — Modern Nova AI" },
      {
        property: "og:description",
        content:
          "Search and filter 400 voice profiles by age, gender, language, emotion and style, with real audio previews.",
      },
    ],
  }),
  component: VoicesPage,
});

function VoicesPage() {
  const { t } = useI18n();
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          {t("voicesTitle")}
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("voicesSub")}</p>
      </header>
      <VoiceBrowser />
    </div>
  );
}
