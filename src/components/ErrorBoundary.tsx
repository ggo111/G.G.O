import React, { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[GGO ErrorBoundary]', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#161412] px-6 text-center">
          <div className="max-w-md rounded-2xl border border-[rgba(217,155,38,0.35)] bg-[#221e1b] p-8 shadow-2xl">
            <h1 className="font-[family-name:var(--font-display)] text-2xl font-bold text-[#F5EFE6]">
              Something went wrong
            </h1>
            <p className="mt-3 text-sm text-[#C7BEB2]">
              An unexpected error occurred. Your progress is usually safe in local storage.
            </p>
            {this.state.error && (
              <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-black/40 p-3 text-left text-xs text-red-300">
                {this.state.error.message}
              </pre>
            )}
            <button
              type="button"
              onClick={this.handleReload}
              className="mt-6 w-full rounded-xl bg-[#D99B26] px-5 py-3 text-sm font-semibold text-[#161412] transition hover:brightness-110 active:scale-[0.98]"
            >
              Reload Game
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
