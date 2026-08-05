'use client';
import React, { Component, ReactNode } from 'react';
import { RefreshCw, WifiOff, AlertTriangle } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


interface Props {
  children: ReactNode;
  dashboardName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorType: 'connection' | 'data' | 'unknown';
}

function classifyError(error: Error): State['errorType'] {
  const msg = error?.message?.toLowerCase() ?? '';
  if (
    msg.includes('fetch') ||
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('supabase') ||
    msg.includes('connection') ||
    msg.includes('timeout') ||
    msg.includes('econnrefused')
  ) {
    return 'connection';
  }
  if (
    msg.includes('null') ||
    msg.includes('undefined') ||
    msg.includes('cannot read') ||
    msg.includes('missing') ||
    msg.includes('not found')
  ) {
    return 'data';
  }
  return 'unknown';
}

export default class DashboardErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorType: 'unknown' };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorType: classifyError(error),
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[DashboardErrorBoundary] Caught error:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorType: 'unknown' });
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { dashboardName = 'Dashboard', errorType, error } = this.state;

    const isConnection = errorType === 'connection';
    const isData = errorType === 'data';

    const Icon = isConnection ? WifiOff : isData ? AlertTriangle : AlertTriangle;
    const iconColor = isConnection ? 'text-blue-400' : 'text-amber-400';
    const bgColor = isConnection ? 'bg-blue-50 border-blue-200' : isData ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';
    const titleColor = isConnection ? 'text-blue-800' : isData ? 'text-amber-800' : 'text-red-800';
    const descColor = isConnection ? 'text-blue-600' : isData ? 'text-amber-600' : 'text-red-600';
    const btnColor = isConnection
      ? 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500'
      : isData
      ? 'bg-amber-600 hover:bg-amber-700 focus:ring-amber-500' :'bg-red-600 hover:bg-red-700 focus:ring-red-500';

    const title = isConnection
      ? 'Connection Issue'
      : isData
      ? 'Data Unavailable' :'Something Went Wrong';

    const description = isConnection
      ? `Unable to connect to the server. Please check your internet connection and try again.`
      : isData
      ? `Some required data for the ${dashboardName} could not be loaded. This may be a temporary issue.`
      : `An unexpected error occurred while loading the ${dashboardName}. Please try again.`;

    return (
      <div className="min-h-[60vh] flex items-center justify-center p-6">
        <div className={`max-w-md w-full rounded-2xl border-2 p-8 text-center shadow-lg ${bgColor}`}>
          {/* Icon */}
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center">
              <Icon className={`w-8 h-8 ${iconColor}`} />
            </div>
          </div>

          {/* Title */}
          <h2 className={`text-xl font-bold mb-2 ${titleColor}`}>{title}</h2>

          {/* Description */}
          <p className={`text-sm mb-6 leading-relaxed ${descColor}`}>{description}</p>

          {/* Error detail (collapsed, dev-friendly) */}
          {error?.message && (
            <details className="mb-5 text-left">
              <summary className={`text-xs cursor-pointer select-none ${descColor} opacity-70 hover:opacity-100`}>
                Error details
              </summary>
              <pre className="mt-2 text-xs bg-white bg-opacity-60 rounded-lg p-3 overflow-auto max-h-28 text-gray-600 whitespace-pre-wrap break-words">
                {error.message}
              </pre>
            </details>
          )}

          {/* Retry button */}
          <button
            onClick={this.handleRetry}
            className={`inline-flex items-center gap-2 px-6 py-3 rounded-xl text-white text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-md ${btnColor}`}
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>

          {/* Soft hint */}
          <p className={`mt-4 text-xs ${descColor} opacity-60`}>
            If the problem persists, please contact support.
          </p>
        </div>
      </div>
    );
  }
}
