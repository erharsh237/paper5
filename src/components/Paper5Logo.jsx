import logoPng from '../assets/logo.png'

export default function Paper5Logo({ size = 28, className = "", style = {}, decorative = false, alt = "Paper5" }) {
  return (
    <img 
      src={logoPng} 
      alt={decorative ? "" : alt}
      aria-hidden={decorative ? "true" : undefined}
      width={size} 
      height={size} 
      className={className}
      style={{ 
        width: `${size}px`, 
        height: `${size}px`, 
        objectFit: 'contain', 
        flexShrink: 0, 
        display: 'inline-block', 
        verticalAlign: 'middle', 
        ...style 
      }} 
      onError={(e) => {
        if (!e.currentTarget.dataset.retried) {
          e.currentTarget.dataset.retried = 'true'
          e.currentTarget.src = '/logo.png'
        }
      }}
    />
  )
}
