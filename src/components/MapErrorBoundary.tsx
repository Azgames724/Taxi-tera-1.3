/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Component, ReactNode, ErrorInfo } from 'react';

export interface MapErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
}

export interface MapErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class MapErrorBoundary extends Component<MapErrorBoundaryProps, MapErrorBoundaryState> {
  constructor(props: MapErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): MapErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('MapErrorBoundary caught an error:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 p-6 text-center select-none z-10">
          <div className="w-12 h-12 rounded-2xl bg-white shadow-md flex items-center justify-center text-xl mb-3 border border-slate-200">
            🗺️
          </div>
          <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider mb-1">
            Map View Restoring
          </h3>
          <p className="text-xs text-slate-500 max-w-xs mb-4">
            A temporary map coordinate anomaly occurred. Tap below to reload the view.
          </p>
          <button
            onClick={this.handleRetry}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
          >
            Reset Map
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
