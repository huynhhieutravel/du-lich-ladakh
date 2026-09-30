import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  errorMsg: string;
  errorStack: string;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    errorMsg: "",
    errorStack: ""
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true, errorMsg: _.message, errorStack: _.stack || "" };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#fee2e2', color: '#991b1b', borderRadius: '8px', margin: '20px', fontFamily: 'monospace' }}>
          <h2>React Crashed!</h2>
          <p><strong>Error:</strong> {this.state.errorMsg}</p>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: '12px', background: '#fef2f2', padding: '10px' }}>
            {this.state.errorStack}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
