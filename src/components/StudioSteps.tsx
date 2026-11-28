import { Link } from "@tanstack/react-router";

const STEPS = [
  { to: "/studio", label: "Script Studio" },
  { to: "/studio/cast", label: "Voice Casting" },
  { to: "/studio/voiceover", label: "Voiceover" },
] as const;

export function StudioSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <nav aria-label="Voice Studio steps" className="flex gap-1.5 overflow-x-auto text-xs font-semibold">
      {STEPS.map((s, i) => (
        <Link
          key={s.to}
          to={s.to}
          className={`shrink-0 rounded-full border px-3 py-1.5 transition ${
            i === current
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:bg-accent"
          }`}
        >
          {i + 1}. {s.label}
        </Link>
      ))}
    </nav>
  );
}
