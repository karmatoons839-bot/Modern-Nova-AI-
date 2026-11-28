import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/projects")({
  staticData: { sitemap: true },
  head: () => ({
    meta: [
      { title: "Projects — Modern Nova AI" },
      {
        name: "description",
        content: "Your recent Modern Nova AI voice-over productions, with character and line counts.",
      },
      { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { property: "og:title", content: "Projects — Modern Nova AI" },
      {
        property: "og:description",
        content: "Recent voice-over productions created in Modern Nova AI.",
      },
    ],
  }),
  component: ProjectsPage,
});

type Project = {
  id: string;
  name: string;
  characters: number;
  lines: number;
  createdAt: string;
};

function ProjectsPage() {
  const { lang } = useI18n();
  const hi = lang === "hi";
  const [projects, setProjects] = useState<Project[]>([]);

  useEffect(() => {
    try {
      setProjects(JSON.parse(window.localStorage.getItem("mn-projects") || "[]") as Project[]);
    } catch {
      setProjects([]);
    }
  }, []);

  function remove(id: string) {
    const next = projects.filter((p) => p.id !== id);
    setProjects(next);
    window.localStorage.setItem("mn-projects", JSON.stringify(next));
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground md:text-3xl">
          Projects
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hi
            ? "Aapke haal ke voice-over productions, isi device par save."
            : "Your recent voice-over productions, saved on this device."}
        </p>
      </header>

      {projects.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border p-10 text-center">
          <p className="text-sm text-muted-foreground">
            {hi ? "Abhi koi project nahi hai." : "No projects yet."}
          </p>
          <Link
            to="/studio"
            className="mt-4 inline-flex rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground transition hover:opacity-90"
          >
            {hi ? "Studio kholo" : "Open the studio"}
          </Link>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="font-display text-sm font-bold text-foreground">{p.name}</h2>
                  <p className="text-[11px] text-muted-foreground">
                    {p.characters} characters · {p.lines} lines ·{" "}
                    {new Date(p.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="inline-flex items-center gap-1.5 self-end rounded-xl border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-accent sm:self-center"
              >
                <Trash2 className="h-3.5 w-3.5" /> {hi ? "Hatao" : "Remove"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
