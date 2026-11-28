import type { ReactNode } from "react";

export function Page({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{title}</h1>
      {sub && <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>}
      <div className="mt-6 space-y-4">{children}</div>
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-border bg-card p-5 ${className}`}>{children}</div>;
}

export function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2.5 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-foreground">{value}</span>
    </div>
  );
}

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50";
export const btnOutline =
  "inline-flex items-center justify-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-sm font-bold text-foreground transition hover:bg-accent disabled:opacity-50";
export const input =
  "w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm text-foreground outline-none focus:border-primary";
