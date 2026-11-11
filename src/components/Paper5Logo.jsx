export default function Paper5Logo({ size = 28, className = "", style = {} }) {
  return (
    <svg 
      width={size} 
      height={size} 
      viewBox="0 0 32 32" 
      fill="none" 
      className={className}
      style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle', ...style }}
      aria-label="Paper5 Logo"
    >
      <rect x="3" y="8" width="17" height="21" rx="3.5" transform="rotate(-15 3 8)" fill="#8b5cf6" />
      <rect x="7" y="6" width="17" height="21" rx="3.5" transform="rotate(-7 7 6)" fill="#3b82f6" />
      <rect x="11" y="5" width="17" height="21" rx="3.5" fill="#06b6d4" />
      <rect x="13" y="6" width="16" height="21" rx="3.5" transform="rotate(8 13 6)" fill="#10b981" />
    </svg>
  )
}
