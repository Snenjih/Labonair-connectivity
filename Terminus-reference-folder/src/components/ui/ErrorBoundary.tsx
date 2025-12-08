import React, { Component, ErrorInfo, ReactNode } from "react";
import { ErrorDisplay } from "./ErrorDisplay";

interface ErrorBoundaryProps {
  children: ReactNode;
  componentName?: string;
  onRetry?: () => void;
  onGoHome?: () => void;
  showLogs?: boolean;
  fallback?: (error: Error, errorInfo: ErrorInfo) => ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({
      error,
      errorInfo,
    });

    // Log to console for debugging
    console.error(
      `[ErrorBoundary] Error in ${this.props.componentName || "Component"}:`,
      error,
      errorInfo
    );

    // You could also send error to an error tracking service here
    // e.g., Sentry, LogRocket, etc.
  }

  handleRetry = () => {
    // Reset error state
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    // Call custom retry handler if provided
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.state.errorInfo!);
      }

      // Default error display
      return (
        <ErrorDisplay
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          componentName={this.props.componentName || "Component"}
          onRetry={this.handleRetry}
          onGoHome={this.props.onGoHome}
          showLogs={this.props.showLogs !== false}
        />
      );
    }

    return this.props.children;
  }
}
