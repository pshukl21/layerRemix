import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

// Catches any uncaught error thrown during rendering anywhere below it and
// shows a friendly recovery screen instead of letting React unmount the
// entire app to a blank page. This is a safety net, not a fix for the
// underlying bug — the real error is still logged to the console for
// debugging, and this only prevents it from taking down the whole UI.
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-[#F2F2F7]">
          <h1 className="text-xl font-black text-slate-900 mb-2">Something went wrong</h1>
          <p className="text-sm text-slate-500 font-semibold mb-6 max-w-sm">
            This page hit an unexpected error. Reloading usually fixes it — if it keeps happening, try a different
            file or let us know what you were doing.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-widest transition-all active:scale-95 cursor-pointer"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
