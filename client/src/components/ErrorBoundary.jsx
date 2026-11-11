import { Component } from 'react';
import { TriangleAlert, RefreshCw } from 'lucide-react';
import StatusPanel from './StatusPanel';

// Catches a render crash anywhere below it and shows a way out instead of a white screen
// (KAN-63). It sits outside the router and the auth provider, so the fallback uses plain links
// and no header.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // The only record of a client crash until there's error reporting
    // eslint-disable-next-line no-console
    console.error('Unhandled error', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="status-layout">
        <main className="status-page">
          <StatusPanel
            variant="error"
            icon={TriangleAlert}
            title="Something went wrong"
            actions={
              <>
                <button
                  type="button"
                  className="status-panel-action"
                  onClick={() => window.location.reload()}
                >
                  <RefreshCw size={20} aria-hidden="true" />
                  Reload
                </button>
                <a href="/" className="status-panel-action status-panel-action--secondary">
                  Go to the map
                </a>
              </>
            }
          >
            <p>BetterBearings hit an unexpected error. Reloading usually fixes it.</p>
          </StatusPanel>
        </main>
      </div>
    );
  }
}
