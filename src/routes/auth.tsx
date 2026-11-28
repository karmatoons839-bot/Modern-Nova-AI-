import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ArrowRight, Eye, EyeOff, LockKeyhole, Mail, UserRound, Loader2 } from "lucide-react";
import logo from "@/assets/modern-nova-logo-clear.png";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { recordFailedLogin } from "@/lib/admin.functions";

export const Route = createFileRoute("/auth")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Log in — Modern Nova AI" },
      { name: "description", content: "Log in or create your Modern Nova AI account to generate voice-overs, images and thumbnails." },
      { property: "og:title", content: "Log in — Modern Nova AI" },
      { property: "og:description", content: "Log in or sign up to Modern Nova AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

type Mode = "login" | "signup" | "forgot";

function AuthPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!session) return;
    const plan = localStorage.getItem("nova_after_login_plan");
    if (plan === "creator" || plan === "pro" || plan === "premium") {
      localStorage.removeItem("nova_after_login_plan");
      void navigate({ to: "/checkout/$plan", params: { plan }, replace: true });
    } else void navigate({ to: "/tools", replace: true });
  }, [session, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    setConfirmationEmail(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          void recordFailedLogin({ data: { email, password } }).catch(() => {});
          if (error.message.toLowerCase().includes("invalid login credentials")) {
            setNotice("Email/password sign-in failed. If you created this account with Google, use Continue with Google. Otherwise confirm your sign-up email or use Forgot password.");
            return;
          }
          if (error.message.toLowerCase().includes("email not confirmed")) {
            setConfirmationEmail(email.trim().toLowerCase());
            setNotice("Confirm your email before signing in. You can resend the confirmation below.");
            return;
          }
          throw error;
        }
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        if (!data.session) {
          setConfirmationEmail(email.trim().toLowerCase());
          setNotice("Account created. Check your email and click the confirmation link before logging in.");
        }
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setNotice("Password reset link sent. Check your email.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const resendConfirmation = async () => {
    if (!confirmationEmail) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email: confirmationEmail, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) toast.error(error.message);
    else setNotice("Confirmation email sent again. Check your inbox and spam folder.");
  };

  const google = async () => {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(r.error.message ?? "Google sign-in failed.");
  };

  const changeMode = (next: Mode) => { setMode(next); setNotice(null); setConfirmationEmail(null); };
  const field = "h-12 w-full min-w-0 rounded-lg border border-input bg-muted/40 pl-11 pr-4 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15";
  return (
    <section className="mx-auto w-full max-w-[440px] py-3 sm:py-8">
      <div className="text-center">
        <span className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl border border-border bg-card shadow-sm">
          <img src={logo} alt="Modern Nova AI" className="h-14 w-14 object-contain" />
        </span>
        <span className="mt-4 inline-block rounded-full bg-accent px-4 py-1.5 text-xs font-semibold text-primary">{mode === "login" ? "Welcome back" : mode === "signup" ? "A new beginning" : "Account recovery"}</span>
        <h1 className="mt-4 font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl">{mode === "login" ? "Log in to" : mode === "signup" ? "Join" : "Reset your password"}{mode !== "forgot" && <span className="mt-1 block text-primary">Modern Nova AI</span>}</h1>
      </div>
      <div className="mt-7 rounded-3xl border border-border bg-card p-5 shadow-sm sm:p-7">
        {mode !== "forgot" && <>
          <Button type="button" variant="outline" disabled={busy} onClick={() => void google()} className="h-12 w-full gap-3 rounded-lg text-sm font-semibold">
            <span aria-hidden="true" className="font-display text-xl font-bold text-primary">G</span>Continue with Google<ArrowRight className="ml-auto" />
          </Button>
          <div className="my-5 flex items-center gap-4 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />OR<span className="h-px flex-1 bg-border" /></div>
        </>}
        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && <label className="block text-sm font-medium">Your name<div className="relative mt-1.5"><UserRound className="absolute left-3.5 top-4 h-4 w-4 text-muted-foreground" /><input className={field} autoComplete="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required /></div></label>}
          <label className="block text-sm font-medium">Email address<div className="relative mt-1.5"><Mail className="absolute left-3.5 top-4 h-4 w-4 text-muted-foreground" /><input className={field} type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required /></div></label>
          {mode !== "forgot" && <label className="block text-sm font-medium">Password<div className="relative mt-1.5"><LockKeyhole className="absolute left-3.5 top-4 h-4 w-4 text-muted-foreground" /><input className={`${field} pr-12`} type={showPassword ? "text" : "password"} autoComplete={mode === "signup" ? "new-password" : "current-password"} placeholder="At least 6 characters" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /><Button type="button" variant="ghost" size="icon" className="absolute right-1.5 top-1.5" aria-label={showPassword ? "Hide password" : "Show password"} title={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</Button></div></label>}
          <Button type="submit" disabled={busy} className="h-12 w-full rounded-lg font-semibold">{busy ? <Loader2 className="animate-spin" /> : <ArrowRight />}{busy ? "Please wait…" : mode === "login" ? "Log in" : mode === "signup" ? "Create account" : "Send reset link"}</Button>
        </form>
        {notice && <div role="status" className="mt-4 rounded-lg border border-border bg-accent p-3 text-sm leading-relaxed"><p>{notice}</p>{confirmationEmail && <Button type="button" variant="link" disabled={busy} className="mt-1 h-auto whitespace-normal px-0 text-left" onClick={() => void resendConfirmation()}>Resend confirmation email</Button>}</div>}
        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 text-sm">{mode === "login" ? <><Button type="button" variant="link" className="justify-start px-0" disabled={busy} onClick={() => changeMode("signup")}>Create account <ArrowRight /></Button><Button type="button" variant="ghost" className="px-0 text-muted-foreground" disabled={busy} onClick={() => changeMode("forgot")}>Forgot password?</Button></> : <Button type="button" variant="link" className="justify-start px-0" disabled={busy} onClick={() => changeMode("login")}>Back to log in</Button>}</div>
      </div>
    </section>
  );
}
