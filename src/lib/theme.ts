export type Theme = "light" | "dark";
export function getTheme(): Theme {
  return typeof window !== "undefined" && localStorage.getItem("mn-theme") === "dark" ? "dark" : "light";
}
export function applyTheme(t: Theme) {
  localStorage.setItem("mn-theme", t);
  document.documentElement.classList.toggle("dark", t === "dark");
}
