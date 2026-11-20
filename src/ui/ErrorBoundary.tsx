import { Component, type ReactNode } from "react";

// A render error shows a reload card (bilingual, no i18n dependency) instead of a blank page.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="loading-screen">
        <div className="box panel" style={{ padding: 24, maxWidth: 420 }}>
          <p>Algo salió mal. · Something went wrong.</p>
          <p className="mono faint" style={{ fontSize: 12 }}>{String(this.state.error.message).slice(0, 200)}</p>
          <button className="btn primary" onClick={() => location.reload()}>
            Recargar · Reload
          </button>
        </div>
      </div>
    );
  }
}
