import { Component, type ReactNode } from 'react';

/** If a screen crashes, show a recover card instead of a blank app. Data in IndexedDB is untouched. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="screen">
        <section className="card">
          <span className="label">Something broke on this screen</span>
          <p className="muted sm">Your data is safe. Reloading usually fixes it.</p>
          <code className="fine">{this.state.error.message}</code>
          <button className="btn primary big" onClick={() => location.reload()}>
            Reload
          </button>
        </section>
      </div>
    );
  }
}
