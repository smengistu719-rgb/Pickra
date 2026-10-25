import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMessage: '',
  };

  public static getDerivedStateFromError(error: Error): State {
    let readable = error.message || 'An unexpected application error occurred.';
    try {
      const parsed = JSON.parse(error.message);
      if (parsed && typeof parsed.error === 'string') {
        if (parsed.error.includes('Quota exceeded')) {
          readable =
            'Firestore daily free-tier quota has been reached. Quota resets tomorrow.';
        } else {
          readable = `Database permission or validation error during ${parsed.operationType || 'operation'} on ${parsed.path || 'resource'}: ${parsed.error}`;
        }
      }
    } catch {
      // Plain error string
    }
    return { hasError: true, errorMessage: readable };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught application error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FBF9F5] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-stone-200 rounded-xl p-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#9A3412] shrink-0 mt-0.5" />
              <div>
                <h1 className="font-serif text-xl font-medium text-stone-900">
                  Something interrupted this view
                </h1>
                <p className="mt-2 text-sm text-stone-600 leading-relaxed">
                  {this.state.errorMessage}
                </p>
                <button
                  type="button"
                  onClick={this.handleReset}
                  className="mt-6 inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#1C1917] rounded-lg hover:bg-stone-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Return to Journal</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
