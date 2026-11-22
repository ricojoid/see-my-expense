/** Slow-drifting colour blobs behind everything, plus a faint grain. */
export default function Aurora({ intense = false }) {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      <div
        className={`absolute -left-[20%] -top-[25%] h-[70vmax] w-[70vmax] animate-drift rounded-full bg-[radial-gradient(circle,rgba(198,244,50,0.16),transparent_60%)] blur-3xl ${
          intense ? 'opacity-100' : 'opacity-60'
        }`}
      />
      <div
        className={`absolute -right-[25%] top-[10%] h-[60vmax] w-[60vmax] animate-drift-slow rounded-full bg-[radial-gradient(circle,rgba(34,211,238,0.14),transparent_60%)] blur-3xl ${
          intense ? 'opacity-100' : 'opacity-50'
        }`}
      />
      <div className="absolute -bottom-[30%] left-[20%] h-[55vmax] w-[55vmax] animate-drift rounded-full bg-[radial-gradient(circle,rgba(167,139,250,0.10),transparent_60%)] blur-3xl" />
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
    </div>
  );
}
