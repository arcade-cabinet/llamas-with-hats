import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render errors anywhere in the React tree below it.
 * Prevents the entire app from white-screening on an unexpected throw.
 */
export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  private handleReturnToMenu = () => {
    // Force a full page reload to reset all singletons and state
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="fixed inset-0 flex flex-col items-center justify-center p-6"
          style={{ background: 'var(--color-void, #0a0a0c)', color: '#fff' }}
        >
          <h1
            className="font-serif mb-2"
            style={{
              fontSize: 'clamp(1.5rem, 5vw, 2.5rem)',
              color: '#8B0000',
              textShadow: '0 0 20px rgba(139,0,0,0.5)',
            }}
          >
            CAAAAARL!
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
            Something went very wrong. Even for Carl.
          </p>
          <p
            style={{
              fontSize: 11,
              color: 'rgba(255,255,255,0.3)',
              fontFamily: 'monospace',
              maxWidth: 480,
              textAlign: 'center',
              marginBottom: 24,
              wordBreak: 'break-word',
            }}
          >
            {this.state.error?.message}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={this.handleRetry}
              className="font-serif transition-colors"
              style={{
                padding: '10px 24px',
                background: 'rgba(139,0,0,0.2)',
                border: '1px solid rgba(139,0,0,0.5)',
                borderRadius: 8,
                color: '#cd5c5c',
                fontSize: 14,
              }}
            >
              Try Again
            </button>
            <button
              onClick={this.handleReturnToMenu}
              className="font-serif transition-colors"
              style={{
                padding: '10px 24px',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 8,
                color: 'rgba(255,255,255,0.6)',
                fontSize: 14,
              }}
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
