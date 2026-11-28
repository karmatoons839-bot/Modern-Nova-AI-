import logo from "@/assets/modern-nova-logo-clear.png";
import { useEffect, useState } from "react";

export function SplashScreen() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("fade"), 500);
    const t2 = setTimeout(() => setPhase("gone"), 750);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background transition-opacity duration-200 ${
        phase === "fade" ? "opacity-0" : "opacity-100"
      }`}
    >
      <div className="relative flex h-20 w-20 items-center justify-center">
        <span className="absolute inset-0 animate-ping rounded-3xl bg-primary/20" />
        <img src={logo} alt="" className="relative h-20 w-20 object-contain" />
      </div>
      <p className="mt-6 font-display text-2xl font-bold tracking-tight text-foreground">Modern Nova AI</p>
      <p className="mt-1 text-sm text-muted-foreground">All in One</p>
      <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-muted">
        <div className="h-full w-1/2 animate-pulse rounded-full bg-primary" />
      </div>
    </div>
  );
}
