// Full-page error with a retry, used instead of an endless loading screen.
export default function ErrorScreen({ message, onRetry }) {
  return (
    <div className="page-loading">
      <p className="error-screen-text" role="alert">
        {message}
      </p>
      <button className="btn-primary" type="button" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
