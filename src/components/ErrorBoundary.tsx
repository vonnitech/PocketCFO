import { Component, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-base flex items-center justify-center p-8">
          <div className="bg-surface border-4 border-action-bleed rounded-[32px] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] text-center">
            <h1 className="text-4xl font-black italic uppercase tracking-tighter text-action-bleed mb-4">
              Something crashed
            </h1>
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6">
              {this.state.error?.message ?? 'An unexpected error occurred'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-12 px-8 border-4 border-black rounded-full bg-black text-action-primary font-black uppercase tracking-widest text-xs shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-1 hover:translate-y-1 transition-all"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
