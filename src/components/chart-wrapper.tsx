"use client";

import { ReactNode, Component, ErrorInfo } from "react";

interface ChartWrapperProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ChartWrapperState {
  hasError: boolean;
  error?: Error;
}

export class ChartWrapper extends Component<ChartWrapperProps, ChartWrapperState> {
  constructor(props: ChartWrapperProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ChartWrapperState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Chart rendering error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="py-8 text-center text-gray-500">
          <p>Error rendering chart</p>
          {this.props.fallback}
        </div>
      );
    }

    return <>{this.props.children}</>;
  }
}

