import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Download, Trash2 } from 'lucide-react';
import {clearScopedCache} from '../lib/storageScope';
import {exportPendingChanges, getSyncStatus} from '../lib/supabase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  backupSnapshot?: string;
  recoveryMessage?: string;
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
    if (!this.canReload()) return;
    window.location.reload();
  };

  private canReload = () => {
    const status = getSyncStatus();
    if ((status.pending > 0 || status.error) && this.state.backupSnapshot !== exportPendingChanges()) {
      this.setState({recoveryMessage: 'Export the latest pending backup and keep the file before reloading. Some changes may exist only in this open tab.'});
      return false;
    }
    return true;
  };

  private handleExportPending = () => {
    try {
      const snapshot = exportPendingChanges();
      const url = URL.createObjectURL(new Blob([snapshot], {type: 'application/json'}));
      const link = document.createElement('a');
      link.href = url; link.download = `gwcc-pending-${new Date().toISOString().slice(0, 10)}.json`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.setState({backupSnapshot: snapshot, recoveryMessage: 'Backup download started. Keep the file before reloading; it contains private pending changes.'});
    } catch {
      this.setState({recoveryMessage: 'The backup could not be downloaded. Keep this tab open and contact the administrator before reloading.'});
    }
  };

  private handleResetCache = () => {
    if (!this.canReload()) return;
    try {
      clearScopedCache();
    } catch {
      this.setState({recoveryMessage: 'The page cache could not be cleared. Keep any pending backup and try again.'});
      return;
    }
    window.location.reload();
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
                An unexpected error stopped this page. Export any pending changes before reloading. Clearing the page cache preserves saved pending queues and sign-in settings.
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

            {this.state.recoveryMessage && <p role="status" className="text-left text-xs text-amber-900">{this.state.recoveryMessage}</p>}
            <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
              {(getSyncStatus().pending > 0 || getSyncStatus().error) && <button type="button" onClick={this.handleExportPending} className="px-4 py-2.5 rounded-xl bg-amber-100 text-amber-950 text-xs font-bold flex items-center gap-1.5"><Download className="w-4 h-4"/>Export pending backup</button>}
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
                <span>Clear Page Cache & Reload</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
