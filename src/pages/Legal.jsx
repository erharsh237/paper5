import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import MarketingNav from '../components/MarketingNav'
import MarketingFooter from '../components/MarketingFooter'
import SEOHead from '../components/SEOHead'
import './Legal.css'

// Import raw markdown content
import termsMd from '../content/legal/terms.md?raw'
import privacyMd from '../content/legal/privacy.md?raw'
import dpaMd from '../content/legal/dpa.md?raw'
import subprocessorsMd from '../content/legal/subprocessors.md?raw'

const DOCS = {
  'terms': { title: 'Terms of Service', content: termsMd },
  'privacy': { title: 'Privacy Policy', content: privacyMd },
  'dpa': { title: 'Data Processing Agreement', content: dpaMd },
  'subprocessors': { title: 'Subprocessors', content: subprocessorsMd },
}

export default function Legal() {
  const { docId } = useParams()
  const { pathname } = useLocation()
  const doc = DOCS[docId] || DOCS['terms']

  // Scroll to top when switching docs
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="legal-page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <SEOHead 
        title={`${doc.title} | Paper5 Legal`} 
        description={`Read the official Paper5 ${doc.title}. Compliance, data privacy, and service terms.`}
        canonicalUrl={`https://paper5.com/legal/${docId || 'terms'}`}
      />
      <MarketingNav />

      <main className="legal-container" style={{ flex: 1 }}>
        <aside className="legal-sidebar">
          <nav className="legal-nav">
            <h3 className="mono" style={{ fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>DOCUMENTS</h3>
            {Object.entries(DOCS).map(([id, d]) => (
              <Link 
                key={id} 
                to={`/legal/${id}`}
                className={`legal-nav-link ${docId === id ? 'active' : ''}`}
              >
                {d.title}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="legal-content">
          <ReactMarkdown>{doc.content}</ReactMarkdown>
        </article>
      </main>
      
      <MarketingFooter hideCTA={true} />
    </div>
  )
}
