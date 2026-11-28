import { Link, useRouterState } from "@tanstack/react-router";
import {
  Code2,
  CreditCard,
  FileText,
  Film,
  History,
  HelpCircle,
  Home,
  Info,
  LayoutGrid,
  LogOut,
  MoreVertical,
  Rocket,
  Settings,
  Shield,
  Tag,
  User,
  UserCog,
  Wallet,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { signOut, useAuth, useProfile } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import logo from "@/assets/modern-nova-logo-clear.png";
import { useSiteContent } from "@/lib/site-content";
import { LanguagePrompt } from "./LanguagePrompt";
import { AdminBell } from "./AdminBell";
import { applyTheme, getTheme } from "@/lib/theme";
import { AmbientSparkles } from "./AmbientSparkles";
import { ToolEarningBox } from './EarningRewards';

const ACCOUNT_MENU = [
  { to: "/profile", label: "Profile", icon: User },
  { to: "/account", label: "Account", icon: UserCog },
  { to: "/credits", label: "My Credits", icon: Wallet },
  { to: "/history", label: "Generation History", icon: History },
  { to: "/pricing", label: "Pricing & Plans", icon: Tag },
  { to: "/upgrade", label: "Upgrade Plan", icon: Rocket },
  { to: "/payments", label: "Payment History", icon: CreditCard },
  { to: "/developer", label: "Developer API", icon: Code2 },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/help", label: "Help & Support", icon: HelpCircle },
  { to: "/terms", label: "Terms & Conditions", icon: FileText },
  { to: "/privacy", label: "Privacy Policy", icon: Shield },
] as const;

import { ReferralCapture } from '@/components/ReferralCard';

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const sc = useSiteContent();
  const { session, ready } = useAuth();
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const isTool = /^\/(story|studio|script-video|sfx|music)(\/|-studio|$)/.test(pathname);

  useEffect(() => applyTheme(getTheme()), []);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | TouchEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [open]);

  const item =
    "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-popover-foreground transition hover:bg-accent";

  return (
    <div className="relative isolate min-h-screen bg-background">
      <AmbientSparkles />
      <ReferralCapture />
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 lg:px-8">
          <Link to="/" className="flex items-center gap-2.5">
            <img src={sc("header.logo", logo)} alt="Modern Nova AI logo" className="h-10 w-10 object-contain" />
            <span className="leading-tight">
              <span className="block font-display text-base font-bold tracking-tight text-foreground">{sc("header.brand", t("brand"))}</span>
              <span className="block text-[11px] font-medium text-muted-foreground">{sc("header.tagline", t("tagline"))}</span>
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <Link
              to="/tools"
              className="hidden rounded-xl px-3 py-2 text-sm font-semibold text-foreground transition hover:bg-accent sm:inline-flex"
            >
              Tools
            </Link>
            {ready && !session && (
              <Link
                to="/auth"
                className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                Login
              </Link>
            )}
            {session && (
              <>
                {profile && (
                  <Link
                    to="/credits"
                    className="hidden items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-xs font-bold text-foreground sm:inline-flex"
                  >
                    <Wallet className="h-3.5 w-3.5 text-primary" />
                    {profile.credits.toLocaleString()}
                  </Link>
                )}
                {(profile?.is_admin || profile?.team?.sections.includes("notifications")) && <AdminBell />}
                <div ref={menuRef} className="relative">
                  <button
                    type="button"
                    aria-label="Account menu"
                    aria-expanded={open}
                    onClick={() => setOpen((o) => !o)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground transition hover:bg-accent"
                  >
                    <MoreVertical className="h-5 w-5" />
                  </button>
                  {open && (
                    <div className="absolute right-0 top-11 max-h-[75vh] w-60 overflow-y-auto rounded-2xl border border-border bg-popover p-1.5 shadow-lg">
                      <div className="border-b border-border px-2.5 pb-2 pt-1.5">
                        <p className="truncate text-sm font-bold text-foreground">{profile?.display_name ?? "Account"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {profile ? `${profile.is_owner ? 'OWNER' : profile.is_admin ? 'ADMIN' : profile.team ? 'TEAM ADMIN' : profile.plan.toUpperCase()} · ${profile.credits.toLocaleString()} credits` : session.user.email}
                        </p>
                      </div>
                      <div className="py-1">
                        <Link to="/" onClick={() => setOpen(false)} className={item}>
                          <Home className="h-4 w-4 text-muted-foreground" /> Home
                        </Link>
                        <Link to="/tools" onClick={() => setOpen(false)} className={item}>
                          <LayoutGrid className="h-4 w-4 text-muted-foreground" /> Tools
                        </Link>
                        <Link to="/script-video" onClick={() => setOpen(false)} className={item}>
                          <Film className="h-4 w-4 text-primary" /> Script to Video
                        </Link>
                        <Link to="/about" onClick={() => setOpen(false)} className={item}>
                          <Info className="h-4 w-4 text-muted-foreground" /> About
                        </Link>
                      </div>
                      <div className="border-t border-border py-1">
                        {(profile?.is_admin || profile?.team) && (
                          <Link to="/admin" onClick={() => setOpen(false)} className={item}>
                            <Shield className="h-4 w-4 text-primary" /> Admin Dashboard
                          </Link>
                        )}
                        {ACCOUNT_MENU.map((m) => (
                          <Link key={m.to} to={m.to} onClick={() => setOpen(false)} className={item}>
                            <m.icon className="h-4 w-4 text-muted-foreground" /> {m.label}
                          </Link>
                        ))}
                      </div>
                      <div className="border-t border-border pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setOpen(false);
                            void signOut();
                          }}
                          className={`${item} w-full text-destructive`}
                        >
                          <LogOut className="h-4 w-4" /> Log Out
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <main className={`mx-auto max-w-7xl px-4 py-6 lg:px-8 lg:py-10${isTool ? " tool-page" : ""}`}>{isTool && <ToolEarningBox />}{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row lg:px-8">
          <p>© {new Date().getFullYear()} Modern Nova AI</p>
          <nav className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/about" className="hover:text-foreground">About</Link>
            <Link to="/tools" className="hover:text-foreground">Tools</Link>
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link to="/help" className="hover:text-foreground">Help</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
          </nav>
        </div>
      </footer>
      <LanguagePrompt />
    </div>
  );
}
