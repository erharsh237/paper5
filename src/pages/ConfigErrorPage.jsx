import './ConfigErrorPage.css'

export default function ConfigErrorPage({ message }) {
  return (
    <div className="cfg-err-wrap">
      <div className="cfg-err-card">
        <div className="cfg-err-badge">
          <span className="cfg-err-dot" />
          Setup incomplete
        </div>
        <h1 className="cfg-err-title">The app can't reach Firebase.</h1>
        <p className="cfg-err-sub">{message}</p>
        <p className="cfg-err-hint">
          This is a configuration issue, not something to retry — check the deployment's
          environment variables, then reload.
        </p>
        <button className="cfg-err-cta" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    </div>
  )
}
