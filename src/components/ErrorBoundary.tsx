import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home, Trash2 } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetCache = () => {
    try {
      // Clear app state keys
      Object.keys(localStorage).forEach((key) => {
        if (key.startsWith('gwcc_')) {
          localStorage.removeItem(key);
        }
      });
    } catch {
      // Ignore
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 text-slate-800">
          <div className="max-w-lg w-full bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xl text-center space-y-5">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 mx-auto flex items-center justify-center shadow-xs">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h1 className="text-xl font-bold text-slate-900">Application Notice</h1>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                An unexpected interface anomaly occurred. Greater Works City Church system data has been safely preserved.
              </p>
            </div>

            {this.state.error && (
              <div className="bg-slate-100 p-3 rounded-2xl text-left border border-slate-200">
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">Error Detail</span>
                <p className="text-xs font-mono text-rose-700 break-words line-clamp-3">
                  {this.state.error.message || 'Unknown runtime exception'}
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Application</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetCache}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-4 h-4 text-slate-400" />
                <span>Reset Local Cache</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
