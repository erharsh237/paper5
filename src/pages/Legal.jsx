import { useEffect } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import MarketingNav from '../components/MarketingNav'
import MarketingFooter from '../components/MarketingFooter'
import SEOHead from '../components/SEOHead'
import NotFound from './NotFound'
import './Legal.css'

// Import raw markdown content
import termsMd from '../content/legal/terms.md?raw'
import privacyMd from '../content/legal/privacy.md?raw'
import dpaMd from '../content/legal/dpa.md?raw'
import subprocessorsMd from '../content/legal/subprocessors.md?raw'

const DOCS = {
  'terms': {
    title: 'Terms of Service',
    description: 'Read the Paper5 Terms of Service covering workspace accounts, acceptable use, intellectual property rights, service availability, and customer obligations.',
    canonical: 'https://paper5.co/legal/terms',
    content: termsMd
  },
  'privacy': {
    title: 'Privacy Policy',
    description: 'Read the Paper5 Privacy Policy detailing data collection, authentication cookies, consent controls, third-party processors, retention, and deletion rights.',
    canonical: 'https://paper5.co/privacy',
    content: privacyMd
  },
  'dpa': {
    title: 'Data Processing Agreement',
    description: 'Review the Paper5 Data Processing Agreement (DPA) outlining controller-processor responsibilities, data safeguards, security controls, and compliance terms.',
    canonical: 'https://paper5.co/legal/dpa',
    content: dpaMd
  },
  'subprocessors': {
    title: 'Subprocessors',
    description: 'Inspect the verified list of infrastructure, analytics, email, authentication, and integration subprocessors used to deliver the Paper5 platform.',
    canonical: 'https://paper5.co/legal/subprocessors',
    content: subprocessorsMd
  },
}

export default function Legal({ defaultDocId }) {
  const { docId: paramDocId } = useParams()
  const { pathname } = useLocation()
  const resolvedId = paramDocId || defaultDocId || (pathname === '/privacy' ? 'privacy' : 'terms')
  const doc = DOCS[resolvedId]

  // Scroll to top when switching docs
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  if (!doc) {
    return <NotFound />
  }

  return (
    <div className="legal-page" style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      <SEOHead 
        title={`${doc.title} | Paper5 Legal`} 
        description={doc.description}
        canonicalUrl={doc.canonical}
      />
      <MarketingNav />

      <main className="legal-container" style={{ flex: 1 }}>
        <aside className="legal-sidebar">
          <nav className="legal-nav" aria-label="Legal documents">
            <h3 className="mono" style={{ fontSize: '11px', color: 'var(--text-tertiary)', letterSpacing: '0.05em', margin: '0 0 12px 0' }}>DOCUMENTS</h3>
            {Object.entries(DOCS).map(([id, d]) => (
              <Link 
                key={id} 
                to={id === 'privacy' ? '/privacy' : `/legal/${id}`}
                className={`legal-nav-link ${resolvedId === id ? 'active' : ''}`}
              >
                {d.title}
              </Link>
            ))}
          </nav>
        </aside>

        <article className="legal-content">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content}</ReactMarkdown>
        </article>
      </main>
      
      <MarketingFooter hideCTA={true} />
    </div>
  )
}
