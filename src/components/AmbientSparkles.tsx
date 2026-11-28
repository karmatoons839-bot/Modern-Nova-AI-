/** Decorative, deterministic particles; CSS owns motion and reduced-motion behavior. */
export function AmbientSparkles({ hero = false }: { hero?: boolean }) {
  return (
    <div className={hero ? "ambient-sparkles hero-sparkles" : "ambient-sparkles site-sparkles"} aria-hidden="true">
      {Array.from({ length: hero ? 12 : 14 }, (_, index) => <i key={index} />)}
    </div>
  );
}