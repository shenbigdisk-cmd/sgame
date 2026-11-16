import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

/**
 * Catches render-time failures so the cockpit never shows a blank page.
 *
 * The game boots three.js eagerly; on a machine without WebGL (or with it
 * blocked by a privacy tool) the renderer constructor throws. Without a
 * boundary React unmounts the whole tree and the player gets a white screen
 * with no explanation.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Steel Horizon crashed:', error, info.componentStack);
  }

  private readonly reset = () => {
    this.setState({ error: null });
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    const webgl = /webgl/i.test(error.message);

    return (
      <div className="crash-screen">
        <div className="crash-panel">
          <h1 className="crash-title">COCKPIT OFFLINE</h1>
          <p className="crash-lead">
            {webgl
              ? 'This browser could not start a WebGL context, so the 3D cockpit cannot be rendered.'
              : 'Steel Horizon hit an unexpected fault while starting up.'}
          </p>
          <pre className="crash-detail">{error.message}</pre>
          {webgl && (
            <p className="crash-hint">
              Try enabling hardware acceleration, updating your graphics driver, or opening the game
              in a different browser.
            </p>
          )}
          <div className="crash-actions">
            <button type="button" className="crash-button" onClick={this.reset}>
              TRY AGAIN
            </button>
            <button
              type="button"
              className="crash-button crash-button-ghost"
              onClick={() => window.location.reload()}
            >
              RELOAD
            </button>
          </div>
        </div>
      </div>
    );
  }
}
