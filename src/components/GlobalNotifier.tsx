import { useEffect, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Loader2, Mic } from "lucide-react";
import { useProfile } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";

const inIframe = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

let swReg: Promise<ServiceWorkerRegistration | null> | null = null;
function getReg() {
  if (!swReg) {
    swReg =
      "serviceWorker" in navigator && !inIframe()
        ? navigator.serviceWorker.register("/notify-sw.js").catch(() => null)
        : Promise.resolve(null);
  }
  return swReg;
}

/** Show a phone/desktop system notification (only if the user allowed it). */
export async function notify(title: string, body: string, url?: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  const opts: NotificationOptions = {
    body,
    icon: "/favicon.ico",
    badge: "/favicon.ico",
    tag: `${title}-${Date.now()}`,
    data: { url: url ?? window.location.pathname },
  };
  const reg = await getReg();
  if (reg) return reg.showNotification(title, opts).catch(() => {});
  try {
    const n = new Notification(title, opts);
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore */
  }
}

const GEN: Record<string, string> = {
  "/api/speech": "Voice Studio",
  "/api/story": "Script",
};

/** Full-screen loader on every page change + system notifications for generation, downloads and credits. */
export function GlobalNotifier() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const pending = useRouterState({ select: (s) => s.status === "pending" });
  const [show, setShow] = useState(false);
  const first = useRef(true);

  // Loading screen after every navigation click (links, three-dot menu, buttons).
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    setShow(true);
    const t = setTimeout(() => setShow(false), 250);
    return () => clearTimeout(t);
  }, [pathname]);

  // Ask for permission on the first tap; watch generations and downloads.
  useEffect(() => {
    void getReg();
    const ask = () => {
      if ("Notification" in window && Notification.permission === "default") {
        void Notification.requestPermission();
      }
      window.removeEventListener("click", ask);
    };
    window.addEventListener("click", ask);

    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.("a[download]");
      if (a) void notify("Download complete", `${a.getAttribute("download") || "File"} saved to your device.`);
    };
    document.addEventListener("click", onClick, true);

    const orig = window.fetch;
    window.fetch = async (...args) => {
      const req = args[0];
      const url = typeof req === "string" ? req : req instanceof URL ? req.href : req.url;
      const path = (() => {
        try {
          return new URL(url, window.location.origin).pathname;
        } catch {
          return "";
        }
      })();
      const label = GEN[path];
      const res = await orig(...args);
      if (label) {
        const here = window.location.pathname;
        if (document.visibilityState === "hidden") {
          void notify(
            res.ok ? `${label} ready ✅` : `${label} failed`,
            res.ok ? "Tap to open Modern Nova AI and see your result." : "Tap to open and try again. Credits were not charged.",
            here,
          );
        }
      }
      return res;
    };
    return () => {
      window.removeEventListener("click", ask);
      document.removeEventListener("click", onClick, true);
      window.fetch = orig;
    };
  }, []);

  // Credits added / spent.
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const last = useRef<number | null>(null);
  useEffect(() => {
    const t = setInterval(() => void qc.invalidateQueries({ queryKey: ["profile"] }), 30000);
    return () => clearInterval(t);
  }, [qc]);
  useEffect(() => {
    if (!profile || profile.is_admin) return;
    const c = profile.credits;
    if (last.current !== null && c !== last.current) {
      const diff = c - last.current;
      void notify(
        diff > 0 ? "Credits added 🎉" : "Credits used",
        diff > 0 ? `+${diff} credits. Balance: ${c}` : `${-diff} credits used. Balance: ${c}`,
        "/credits",
      );
    }
    last.current = c;
  }, [profile]);

  // Show the loader for slow page loads too, but never longer than 800ms.
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!pending) return setSlow(false);
    setSlow(true);
    const t = setTimeout(() => setSlow(false), 800);
    return () => clearTimeout(t);
  }, [pending]);

  if (!show && !slow) return null;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-background/85 backdrop-blur-sm animate-fade-in">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
        <Mic className="h-7 w-7" />
      </div>
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
