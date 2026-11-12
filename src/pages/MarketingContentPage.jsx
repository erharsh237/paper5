import React from 'react'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'
import './MarketingContentPage.css'

export default function MarketingContentPage({ title, description, canonicalPath, lastUpdated, children }) {
  const slug = title ? title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : ''
  const path = canonicalPath || `/${slug}`
  const canonical = `https://paper5.co${path.startsWith('/') ? path : `/${path}`}`

  return (
    <MarketingLayout>
      <SEOHead 
        title={`${title} | Paper5`} 
        description={description || `Read official ${title} updates for the Paper5 connected project management and team accountability workspace.`}
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
