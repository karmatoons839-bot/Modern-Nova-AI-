import { createFileRoute, Link } from "@tanstack/react-router";
import { btnOutline, Card, Page, Row } from "@/components/Page";
import { signOut, useAuth, useProfile } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/account")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Account — Modern Nova AI" }, { name: "description", content: "Account and subscription details." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Account — Modern Nova AI" }, { property: "og:description", content: "Account details." }] }),
  component: AccountPage,
});

function AccountPage() {
  const { session } = useAuth();
  const { data: p } = useProfile();
  const provider = session?.user.app_metadata.provider === "google" ? "Google" : "Email & password";
  return (
    <Page title="Account">
      <Card>
        <Row label="Email" value={session?.user.email} />
        <Row label="Sign-in method" value={provider} />
        <Row label="Member since" value={p ? new Date(p.created_at).toLocaleDateString() : "—"} />
        <Row label="Account status" value={session?.user.email_confirmed_at ? "Active" : "Email not confirmed"} />
      </Card>
      <Card>
        <Row label="Subscription" value={p?.plan.toUpperCase() ?? "—"} />
        <Row label="Renews" value={p?.plan_renews_at ? new Date(p.plan_renews_at).toLocaleDateString() : "—"} />
      </Card>
      <Card className="flex flex-wrap gap-2">
        {provider !== "Google" && <Link to="/reset-password" className={btnOutline}>Change password</Link>}
        <button className={btnOutline} onClick={() => void signOut()}>Log out</button>
      </Card>
    </Page>
  );
}
