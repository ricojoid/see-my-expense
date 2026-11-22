export default function Header({ view, onNavigate, onLogout }) {
  const tabs = [
    { key: 'dashboard', label: 'dashboard' },
    { key: 'categories', label: 'categories' },
  ];

  return (
    <header className="border-b border-term-border bg-term-panel/80 backdrop-blur px-4 py-3">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-term-red/80" />
          <span className="h-3 w-3 rounded-full bg-term-amber/80" />
          <span className="h-3 w-3 rounded-full bg-term-green/80" />
          <span className="ml-4 text-sm text-term-dim">admin@localhost:~$</span>
        </div>

        <h1 className="text-sm sm:text-base tracking-widest text-term-green drop-shadow-glowSm">
          SEE_MY_EX-PENSE
          <span className="animate-blink">_</span>
        </h1>

        <nav className="flex items-center gap-2 text-xs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => onNavigate(tab.key)}
              className={`rounded border px-3 py-1.5 uppercase tracking-wide transition ${
                view === tab.key
                  ? 'border-term-green text-term-green shadow-glowSm'
                  : 'border-term-border text-term-dim hover:border-term-green/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
          <button
            onClick={onLogout}
            className="rounded border border-term-red/60 px-3 py-1.5 uppercase tracking-wide text-term-red transition hover:bg-term-red/10"
          >
            logout
          </button>
        </nav>
      </div>
    </header>
  );
}
