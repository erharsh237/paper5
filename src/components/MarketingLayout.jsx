import React from 'react'
import MarketingNav from './MarketingNav'
import MarketingFooter from './MarketingFooter'
import '../pages/Landing.css'

export default function MarketingLayout({ children, hideFooterCTA = false }) {
  return (
    <div className="landing-page">
      <MarketingNav />
      <main style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
      <MarketingFooter hideCTA={hideFooterCTA} />
    </div>
  )
}
