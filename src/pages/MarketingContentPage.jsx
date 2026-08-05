import React from 'react'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'
import './MarketingContentPage.css'

export default function MarketingContentPage({ title, lastUpdated, children }) {
  const slug = title ? title.toLowerCase().replace(/\s+/g, '-') : ''
  const canonical = `https://paper5.com/${slug}`

  return (
    <MarketingLayout>
      <SEOHead 
        title={`${title} | Paper5`} 
        description={`Read official ${title} for Paper5 and SprintOS engineering execution platform.`}
        canonicalUrl={canonical}
      />
      <div className="marketing-content-page">
        <header className="content-page-header">
          <h1>{title}</h1>
          {lastUpdated && <p className="last-updated">Last updated: {lastUpdated}</p>}
        </header>
        <div className="content-page-body">
          {children}
        </div>
      </div>
    </MarketingLayout>
  )
}
