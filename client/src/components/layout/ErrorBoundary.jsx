import { Component } from 'react';
import Logo from '../ui/Logo';

/** If anything fails while rendering, offer a reload instead of leaving a frozen screen. */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[app] crashed:', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <Logo size={56} className="mx-auto" />
          <h1 className="mt-5 text-xl font-extrabold">Something went wrong</h1>
          <p className="mt-1 text-sm text-ink-3">Your data is safe. Reloading usually fixes it.</p>
          <button onClick={() => window.location.reload()} className="mt-6 h-12 rounded-2xl bg-accent px-6 font-bold text-accent-ink">
            Reload
          </button>
        </div>
      </div>
    );
  }
}
