import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { ist, useAdminBell } from "@/lib/admin-client";

export function AdminBell() {
  const { data } = useAdminBell();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const unread = data?.unread ?? 0;
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={`Admin notifications, ${unread} unread`}
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-border text-foreground transition hover:bg-accent"
      >
        <Bell className="h-4.5 w-4.5" />
        {unread > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full bg-destructive px-1 text-center text-[10px] font-bold leading-5 text-destructive-foreground">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-11 w-72 rounded-2xl border border-border bg-popover p-1.5 shadow-lg">
          <p className="px-2.5 py-1.5 text-xs font-bold text-muted-foreground">Admin notifications</p>
          {(data?.latest ?? []).length === 0 && <p className="px-2.5 py-2 text-sm text-muted-foreground">Nothing yet.</p>}
          {data?.latest.map((n) => (
            <div key={n.id} className="rounded-lg px-2.5 py-2 hover:bg-accent">
              <p className={`truncate text-sm ${n.is_read ? "text-muted-foreground" : "font-bold text-foreground"}`}>{n.title.replace("[Modern Nova AI] ", "")}</p>
              <p className="text-[11px] text-muted-foreground">{n.priority} · {ist(n.updated_at)}</p>
            </div>
          ))}
          <Link to="/admin" onClick={() => setOpen(false)} className="mt-1 block rounded-lg px-2.5 py-2 text-center text-sm font-bold text-primary hover:bg-accent">
            Open Notification Center
          </Link>
        </div>
      )}
    </div>
  );
}
