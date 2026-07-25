import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: unknown;
  componentStack: string | null;
}

// Catches any uncaught error thrown during rendering anywhere below it and
// shows a friendly recovery screen instead of letting React unmount the
// entire app to a blank page. This is a safety net, not a fix for the
// underlying bug — the real error is still logged to the console for
// debugging, and this only prevents it from taking down the whole UI.
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, componentStack: null };
  }

  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, info.componentStack);
    this.setState({ componentStack: info.componentStack || null });
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error;
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;

      return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-[#F2F2F7]">
          <h1 className="text-xl font-black text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-500 font-semibold mb-6 max-w-sm">
            This page hit an unexpected error. Reloading usually fixes it — if it keeps happening, try a different
            file or let us know what you were doing.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer mb-6"
          >
            Reload Page
          </button>
          <details className="w-full max-w-2xl text-left bg-white border border-slate-200 rounded-lg p-4">
            <summary className="text-xs font-bold text-slate-500 uppercase tracking-widest cursor-pointer">
              Technical details (copy this if reporting the issue)
            </summary>
            <pre className="text-[11px] text-red-600 font-mono whitespace-pre-wrap mt-3 max-h-64 overflow-y-auto">
              {message}
              {stack ? `\n\n${stack}` : ''}
              {this.state.componentStack ? `\n\nComponent stack:${this.state.componentStack}` : ''}
            </pre>
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}
