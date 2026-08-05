import { Link, useParams } from 'react-router-dom'
import './Breadcrumbs.css'

// trail: array of { label, to? } — the last item (no `to`) renders as the
// current, non-linked page. Home is always implicit and always first.
export default function Breadcrumbs({ trail = [] }) {
  const { workspaceId } = useParams()
  return (
    <nav className="breadcrumbs mono" aria-label="Breadcrumb">
      <Link to={workspaceId ? `/${workspaceId}` : "/"} className="breadcrumb-link">Home</Link>
      {trail.map((item, i) => (
        <span key={i} className="breadcrumb-item">
          <span className="breadcrumb-sep">/</span>
          {item.to ? (
            <Link to={item.to} className="breadcrumb-link">{item.label}</Link>
          ) : (
            <span className="breadcrumb-current">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  )
}
