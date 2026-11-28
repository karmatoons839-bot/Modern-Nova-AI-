import { Link } from "@tanstack/react-router";
import { Check, Info } from "lucide-react";
import { useAuth, useProfile } from "@/lib/auth";
import { COST_LABELS, PLANS } from "@/lib/plans";
import { btn, btnOutline } from "./Page";

const TOOLS = ["Script Studio", "Voice Studio", "Script to Video", "SFX Maker", "Music Studio"];

const LIMITS: Record<string, string[]> = {
  free: ["One-time 5,000 credits", "Access to 50 of the 400 voices", "WAV download only"],
  creator: ["Access to 150 of the 400 voices", "Credits renew monthly"],
  pro: ["Access to 250 of the 400 voices", "Credits renew monthly"],
  premium: ["Credits renew monthly"],
};

export function PlanCards() {
  const { session } = useAuth();
  const { data: profile } = useProfile();
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((p) => {
          const current = profile?.plan === p.id;
          const featured = p.id === "pro";
          return (
            <div
              key={p.id}
              className={`relative flex flex-col rounded-3xl border bg-card p-6 ${featured ? "border-2 border-primary shadow-lg" : "border-border"}`}
            >
              {featured && (
                <span className="absolute -top-3 left-6 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                  Recommended
                </span>
              )}
              <h3 className="font-display text-xl font-bold text-foreground">{p.name}</h3>
              <p className="mt-2 font-display text-4xl font-bold text-foreground">
                ₹{p.priceInr}
                {p.priceInr > 0 && <span className="text-sm font-medium text-muted-foreground"> /month</span>}
              </p>
              <p className="mt-3 rounded-2xl bg-accent px-3 py-2 text-sm font-bold text-primary">
                {p.credits.toLocaleString("en-IN")} credits{p.priceInr > 0 ? " / month" : ""}
              </p>

              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Features</p>
              <ul className="mt-2 space-y-2 text-sm text-foreground">
                {p.features.map((f) => (
                  <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{f}</li>
                ))}
              </ul>

              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Tools included</p>
              <ul className="mt-2 space-y-1.5 text-sm text-foreground">
                {TOOLS.map((t) => (
                  <li key={t} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t}</li>
                ))}
              </ul>

              <p className="mt-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Limitations</p>
              <ul className="mt-2 flex-1 space-y-1.5 text-sm text-muted-foreground">
                {(LIMITS[p.id] ?? []).map((l) => (
                  <li key={l} className="flex gap-2"><Info className="mt-0.5 h-4 w-4 shrink-0" />{l}</li>
                ))}
              </ul>

              <div className="mt-6">
                {current ? (
                  <span className={`${btnOutline} w-full`}>Current plan</span>
                ) : p.id === "free" ? (
                  !session ? <Link to="/auth" className={`${btnOutline} w-full`}>Start free</Link> : null
                ) : session ? (
                  <Link to="/checkout/$plan" params={{ plan: p.id }} className={`${btn} w-full`}>
                    UPGRADE TO {p.name.toUpperCase()}
                  </Link>
                ) : (
                  <Link
                    to="/auth"
                    onClick={() => localStorage.setItem("nova_after_login_plan", p.id)}
                    className={`${btn} w-full`}
                  >
                    Log in to upgrade
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="rounded-3xl border border-border bg-card p-5 text-sm">
        <p className="font-bold text-foreground">Credit usage</p>
        <ul className="mt-2 space-y-1 text-muted-foreground">
          <li>Script Studio: 500 credits for 1 minute, +200 credits per extra minute (up to 30 minutes)</li>
          <li>Voice Studio: {COST_LABELS.voice}</li>
          <li>SFX Maker: 200 credits per second (5s = 1,000 credits)</li>
          <li>Voice preview: {COST_LABELS.preview}</li>
          <li>Failed generations are refunded automatically — you never pay for a failed result.</li>
        </ul>
      </div>
    </>
  );
}
