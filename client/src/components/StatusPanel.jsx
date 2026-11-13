import './StatusPanel.css';

/** The one loading spinner in the app (KAN-63); also used inside Save Street Set */
export function Spinner({ size = 32 }) {
  return <span className="bb-spinner" style={{ width: size, height: size }} aria-hidden="true" />;
}

/**
 * A centered card for loading, error and empty states (KAN-63).
 * variant: 'loading' shows the spinner and is announced politely;
 *          'error' is announced at once; 'info' (empty states, 404) is not announced.
 * icon: a lucide icon component, ignored for 'loading'.
 * actions: buttons or links, laid out in a row that stacks on phones.
 */
export default function StatusPanel({ variant = 'info', icon: Icon, title, children, actions }) {
  const role = variant === 'loading' ? 'status' : variant === 'error' ? 'alert' : undefined;
  return (
    <section className={`status-panel status-panel--${variant}`} role={role}>
      <div className="status-panel-icon">
        {variant === 'loading' ? (
          <Spinner size={40} />
        ) : (
          Icon && <Icon size={40} aria-hidden="true" />
        )}
      </div>
      <h2 className="status-panel-title">{title}</h2>
      {children && <div className="status-panel-message">{children}</div>}
      {actions && <div className="status-panel-actions">{actions}</div>}
    </section>
  );
}
