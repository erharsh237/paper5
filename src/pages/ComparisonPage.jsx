import React, { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import MarketingLayout from '../components/MarketingLayout'
import SEOHead from '../components/SEOHead'
import { Check, X, ArrowRight, ShieldCheck, Zap, GitPullRequest, Users, Sparkles, ChevronDown } from 'lucide-react'
import './ComparisonPage.css'

const COMPARISONS_DATA = {
  trello: {
    competitor: 'Trello',
    slug: 'trello',
    title: 'Paper5 vs Trello: Project Management Software for Small Teams (2026 Comparison)',
    metaDescription: 'Detailed comparison between Paper5 and Trello for small teams and startups. Compare sprint tracking, GitHub PR sync, single ownership accountability, and pricing.',
    h1: 'Paper5 vs Trello: Which Task Management Software Is Best for Your Small Team?',
    quickAnswer: 'While Trello excels as a simple digital sticky-note board for generic checklists, Paper5 is purpose-built project management software for startups and small teams that need structured sprints, automated two-way GitHub PR synchronization, and strict single-owner task accountability without paying for expensive add-on Power-Ups.',
    competitorTagline: 'Visual Kanban boards for general task lists',
    paper5Tagline: 'Connected sprint and task management platform for fast-moving teams',
    matrix: [
      { feature: 'Core Methodology', paper5: 'Agile Sprints, Kanban & 8 Methodology Tiers', competitor: 'Generic Kanban Lists' },
      { feature: 'Two-Way GitHub PR Sync', paper5: 'Native (Automatic PR Status & Branch Link)', competitor: 'Requires Paid Third-Party Power-Up' },
      { feature: 'Task Accountability', paper5: 'Strict Single Owner (No Diffusion of Responsibility)', competitor: 'Multiple Assignees Allowed' },
      { feature: 'Sprint Scope Locking', paper5: 'Built-in (Protects Mid-Sprint Drag)', competitor: 'Not Available' },
      { feature: 'Integrated Meeting Notes', paper5: 'Native Live Notes Tied to Sprints', competitor: 'Requires Confluence or External Tool' },
      { feature: 'Setup Time', paper5: 'Under 2 Minutes (Pre-configured Templates)', competitor: '15+ Minutes (Power-Up Setup)' },
      { feature: 'Free Tier', paper5: 'Free Forever (1 Workspace, 3 Seats, Full Sync)', competitor: 'Limited Free Tier (Workspace Limits)' },
      { feature: 'Pricing For Growing Teams', paper5: 'Flat Startup-Friendly Launch Pricing', competitor: '$5 – $17.50 / user / month' }
    ],
    whenToChooseCompetitor: [
      'You only need a simple personal to-do board or mood board.',
      'Your team has no software developers and does not use GitHub.',
      'You are already heavily invested in the Atlassian ecosystem plugins.'
    ],
    whenToChoosePaper5: [
      'You are a startup or small team building digital products or software.',
      'You want tasks to automatically update when pull requests are created and merged.',
      'You want clear, single-person ownership on every sprint deliverable.',
      'You need sprint retrospectives, meeting notes, and task tracking unified in one tab.'
    ],
    faqs: [
      {
        question: 'Why choose Paper5 over Trello for startup task management?',
        answer: 'Paper5 eliminates the need for messy third-party Power-Ups by offering native sprint planning, two-way GitHub synchronization, and locked sprint scope out of the box, whereas Trello is a generic card board that requires multiple extensions to support agile development workflows.'
      },
      {
        question: 'Can I migrate my tasks from Trello to Paper5?',
        answer: 'Yes. Paper5 allows small teams to import their existing task backlogs, project boards, and sprint cards easily using CSV and JSON exports.'
      },
      {
        question: 'Is Paper5 more expensive than Trello?',
        answer: 'No. Paper5 offers a free forever plan for up to 3 team members, and its paid tiers are structured transparently for startups without punishing per-seat markups.'
      }
    ]
  },
  asana: {
    competitor: 'Asana',
    slug: 'asana',
    title: 'Paper5 vs Asana: The Agile Project Management Comparison for Startups',
    metaDescription: 'Comparing Paper5 vs Asana for small teams and startups. Discover how Paper5 provides developer-friendly task tracking and sprint velocity without enterprise administrative overhead.',
    h1: 'Paper5 vs Asana: Modern Team Task Management vs Enterprise Coordination',
    quickAnswer: 'Asana is architected for large enterprise corporations with deep hierarchies and dedicated project managers. Paper5 is engineered for small teams and startups who want instant setup, lightweight sprint tracking, native GitHub code sync, and zero bureaucratic overhead.',
    competitorTagline: 'Enterprise work management and corporate task coordination',
    paper5Tagline: 'High-velocity project management platform for startups & small squads',
    matrix: [
      { feature: 'Target Team Size', paper5: 'Small Teams, Startups & High-Velocity Squads (1-50)', competitor: 'Medium to Enterprise Corporations (100-10,000+)' },
      { feature: 'GitHub Integration', paper5: 'Deep Native PR Linking & Automated Progression', competitor: 'Surface-Level Integration via Enterprise Connector' },
      { feature: 'Learning Curve', paper5: 'Instant (Under 2 Minutes)', competitor: 'Steep (Requires Onboarding & Workspace Admin)' },
      { feature: 'Sprint Management', paper5: 'Native Agile Sprints with Velocity Tracking', competitor: 'Requires Complex Portfolios and Custom Rules' },
      { feature: 'Meeting Notes & Retros', paper5: 'Built-in Collaborative Notes Tied to Sprints', competitor: 'Separate Docs or Third-Party Add-on' },
      { feature: 'Single-Owner Accountability', paper5: 'Enforced Single Owner Model', competitor: 'Single Assignee (Collaborators Blur Roles)' },
      { feature: 'Starting Price', paper5: 'Free Forever Plan Available', competitor: '$10.99 / user / month (Starter Plan)' }
    ],
    whenToChooseCompetitor: [
      'You are a large enterprise with cross-functional corporate marketing and legal departments.',
      'You require advanced portfolio resource allocation for hundreds of employees.',
      'You have full-time project management officers (PMOs) to manage workflows.'
    ],
    whenToChoosePaper5: [
      'You are a lean team or early-stage startup that needs to move fast.',
      'You want your team focused on shipping deliverables rather than updating ticket statuses.',
      'You want automatic GitHub sync that triggers task status updates directly from code commits.',
      'You refuse to pay enterprise per-seat pricing for features your small team will never use.'
    ],
    faqs: [
      {
        question: 'Why do small teams switch from Asana to Paper5?',
        answer: 'Small teams switch from Asana because Asana often feels overly complex and bloated for squads of 2 to 30 people. Paper5 delivers the exact sprint tracking, GitHub integration, and daily task management small teams need without administrative drag.'
      },
      {
        question: 'Does Paper5 have GitHub pull request tracking like Asana?',
        answer: 'Paper5 has deeper native GitHub sync than Asana. Pull requests, commit links, and automated task completions are built directly into Paper5 sprint columns without needing enterprise connectors.'
      },
      {
        question: 'How does Paper5 pricing compare to Asana?',
        answer: 'Asana charges $10.99 to $24.99 per user per month billed annually. Paper5 is free for up to 3 seats, and its startup plans are substantially more affordable for growing companies.'
      }
    ]
  },
  clickup: {
    competitor: 'ClickUp',
    slug: 'clickup',
    title: 'Paper5 vs ClickUp: Lightweight Project Management vs The "Everything App"',
    metaDescription: 'Paper5 vs ClickUp comparison. See why startups choose Paper5 for fast, focused project management and GitHub sprint automation over sluggish all-in-one software.',
    h1: 'Paper5 vs ClickUp: Focused Project Management Software vs Feature Overload',
    quickAnswer: 'While ClickUp attempts to be the "everything app for work" with hundreds of customizable menus that frequently cause slow load times and decision fatigue, Paper5 is a fast, focused sprint and task management platform that gives small teams clear visibility, instant responsiveness, and automatic GitHub code tracking.',
    competitorTagline: 'All-in-one productivity platform with extensive nested customization',
    paper5Tagline: 'Fast, lightweight sprint and task management software for small teams',
    matrix: [
      { feature: 'App Speed & Performance', paper5: 'Sub-second Instant Page Transitions', competitor: 'Frequently Sluggish Due to Feature Bloat' },
      { feature: 'Interface Simplicity', paper5: 'Clean, Distraction-Free Sprint & Task Board', competitor: 'Dozens of Nested Views, Menus & Sidebars' },
      { feature: 'Native GitHub Automation', paper5: 'Built-in Two-Way PR Status & Branch Sync', competitor: 'Requires Complex Custom Automation Triggers' },
      { feature: 'Time to Value', paper5: 'Immediate (Teams Ship Sprints on Day 1)', competitor: 'Days of Configuration & Space Architecture' },
      { feature: 'Accountability Framework', paper5: 'Single Responsible Owner Per Task', competitor: 'Multiple Assignees Leading to Task Neglect' },
      { feature: 'Sprint Retrospectives & Notes', paper5: 'Integrated Inline Sprint Documentation', competitor: 'Separate ClickUp Docs Module' },
      { feature: 'Pricing', paper5: 'Free Forever Starter Plan', competitor: '$7 – $19 / user / month' }
    ],
    whenToChooseCompetitor: [
      'You want a single software application to replace your CRM, spreadsheets, and whiteboard.',
      'Your team enjoys spending hours tweaking custom fields, nested spaces, and formulas.',
      'You do not mind waiting for complex single-page apps to load.'
    ],
    whenToChoosePaper5: [
      'You prioritize speed, focus, and a clean user experience.',
      'You want sprint and task management that works immediately without configuration.',
      'Your engineering and product squads need seamless GitHub synchronization.',
      'You want clear team accountability where one person owns each task.'
    ],
    faqs: [
      {
        question: 'Is Paper5 faster than ClickUp?',
        answer: 'Yes. Paper5 is built on modern lightweight frontend architecture that renders instantly, eliminating the sluggish navigation and heavy memory consumption common in ClickUp workspaces.'
      },
      {
        question: 'Does Paper5 support sprint management?',
        answer: 'Yes. Paper5 provides full agile sprint cycles, backlog grooming, locked sprint scope protection, and team velocity metrics tailored specifically for small teams.'
      },
      {
        question: 'Can Paper5 replace ClickUp for small software teams?',
        answer: 'Yes. If your small team uses ClickUp primarily for tasks, sprint planning, meeting notes, and developer tracking, Paper5 provides a significantly cleaner, faster, and more accountable alternative.'
      }
    ]
  },
  jira: {
    competitor: 'Jira',
    slug: 'jira',
    title: 'Paper5 vs Jira: Agile Sprint Software for Small Teams & Startups',
    metaDescription: 'Compare Paper5 vs Jira. See why modern engineering startups choose Paper5 for agile sprint management without legacy enterprise bureaucracy and complex setup.',
    h1: 'Paper5 vs Jira: Lightweight Sprint Management vs Legacy Bureaucracy',
    quickAnswer: 'Jira was created for enterprise software corporations with dedicated administrators and complex workflow schemes. Paper5 delivers the core agile power engineering squads need — sprint planning, GitHub PR tracking, and velocity metrics — with zero configuration overhead and instant setup.',
    competitorTagline: 'Legacy enterprise issue tracker and enterprise agile suite',
    paper5Tagline: 'Agile sprint and task management engineered for modern startup teams',
    matrix: [
      { feature: 'Setup & Maintenance', paper5: 'Zero Admin Required (Ready in 2 Minutes)', competitor: 'Requires Dedicated Jira Administrator' },
      { feature: 'Speed & UI Responsiveness', paper5: 'Instant, Lightweight Interface', competitor: 'Heavy, Multi-Second Page Loads' },
      { feature: 'Workflow Flexibility', paper5: '8 Agile Methodologies (Scrum, Kanban, XP)', competitor: 'Complex Custom Schemes & Permission Matrices' },
      { feature: 'GitHub Synchronization', paper5: 'Two-Way Native PR Sync with Zero Config', competitor: 'Requires Atlassian Marketplace Add-on Setup' },
      { feature: 'Meeting Documentation', paper5: 'Native Inline Sprint Notes & Retros', competitor: 'Requires Separate Confluence Subscription' },
      { feature: 'Pricing Predictability', paper5: 'Transparent Startup Tiers & Free Forever Plan', competitor: 'Escalating Per-User Costs + Plugin Fees' }
    ],
    whenToChooseCompetitor: [
      'You have more than 500 developers and complex enterprise compliance audits.',
      'You already employ full-time Jira administrators to manage custom issue schemes.',
      'Your company is strictly locked into the Atlassian product suite.'
    ],
    whenToChoosePaper5: [
      'You are a high-growth startup or small agile team that wants to move fast.',
      'You want sprint tracking that works out of the box without reading lengthy admin manuals.',
      'You want unified sprint planning, GitHub PR sync, and meeting notes in one clean workspace.',
      'You want your team spending time writing code and shipping product, not managing tickets.'
    ],
    faqs: [
      {
        question: 'Why do startups prefer Paper5 over Jira?',
        answer: 'Startups choose Paper5 because Jira is overly complex and requires substantial administrative time to configure and maintain. Paper5 gives engineering teams the agile sprint tools they need without the bureaucratic friction.'
      },
      {
        question: 'Does Paper5 sync with GitHub like Jira does?',
        answer: 'Yes. Paper5 features automatic two-way GitHub pull request synchronization, updating task cards as pull requests are opened, reviewed, and merged.'
      },
      {
        question: 'Is Paper5 free for small teams?',
        answer: 'Yes. Paper5 has a free forever plan that includes 1 workspace and up to 3 team members, whereas Jira charges per user once free tier thresholds or advanced features are needed.'
      }
    ]
  }
}

export default function ComparisonPage() {
  const { tool } = useParams()
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState(null)

  const currentToolKey = (tool || 'trello').toLowerCase()
  const data = COMPARISONS_DATA[currentToolKey] || COMPARISONS_DATA.trello

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index)
  }

  // Schema.org Structured Data: BreadcrumbList and FAQPage
  const pageJsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        '@id': `https://paper5.co/vs/${data.slug}#breadcrumbs`,
        'itemListElement': [
          {
            '@type': 'ListItem',
            'position': 1,
            'name': 'Home',
            'item': 'https://paper5.co/'
          },
          {
            '@type': 'ListItem',
            'position': 2,
            'name': 'Comparisons',
            'item': 'https://paper5.co/vs/trello'
          },
          {
            '@type': 'ListItem',
            'position': 3,
            'name': `Paper5 vs ${data.competitor}`,
            'item': `https://paper5.co/vs/${data.slug}`
          }
        ]
      },
      {
        '@type': 'FAQPage',
        '@id': `https://paper5.co/vs/${data.slug}#faq`,
        'mainEntity': data.faqs.map(faq => ({
          '@type': 'Question',
          'name': faq.question,
          'acceptedAnswer': {
            '@type': 'Answer',
            'text': faq.answer
          }
        }))
      }
    ]
  }

  return (
    <MarketingLayout>
      <SEOHead
        title={data.title}
        description={data.metaDescription}
        canonicalUrl={`https://paper5.co/vs/${data.slug}`}
        jsonLd={pageJsonLd}
      />

      <div className="comparison-page-container">
        {/* Breadcrumb Navigation */}
        <nav className="comparison-breadcrumbs" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <span className="breadcrumb-separator">/</span>
          <span>Comparisons</span>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">Paper5 vs {data.competitor}</span>
        </nav>

        {/* Competitor Switcher Tabs */}
        <div className="competitor-nav-tabs">
          {Object.keys(COMPARISONS_DATA).map((key) => {
            const item = COMPARISONS_DATA[key]
            const isActive = item.slug === data.slug
            return (
              <button
                key={key}
                className={`competitor-nav-btn ${isActive ? 'active' : ''}`}
                onClick={() => navigate(`/vs/${item.slug}`)}
              >
                vs {item.competitor}
              </button>
            )
          })}
        </div>

        {/* Hero Section */}
        <header className="comparison-hero">
          <span className="comparison-eyebrow">Project Management Software Comparison</span>
          <h1 className="comparison-h1">{data.h1}</h1>
          <p className="comparison-subtitle">
            An objective, in-depth evaluation of features, sprint workflows, GitHub integration, and team accountability.
          </p>
        </header>

        {/* Direct Answer Box (AEO Snippet Target) */}
        <section className="comparison-quick-answer-card">
          <div className="quick-answer-badge">
            <Sparkles size={16} />
            <span>Executive Summary</span>
          </div>
          <p className="quick-answer-text">{data.quickAnswer}</p>
        </section>

        {/* Side-by-Side Comparison Matrix */}
        <section className="comparison-matrix-section">
          <h2 className="section-title">Side-by-Side Feature Comparison</h2>
          <p className="section-desc">
            How Paper5 compares to {data.competitor} across essential project management and developer workflow capabilities.
          </p>

          <div className="matrix-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th style={{ width: '34%' }}>Feature / Capability</th>
                  <th style={{ width: '33%', background: 'rgba(79, 70, 229, 0.05)', color: '#4f46e5' }}>
                    <strong>Paper5</strong>
                  </th>
                  <th style={{ width: '33%' }}>
                    <strong>{data.competitor}</strong>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.matrix.map((row, idx) => (
                  <tr key={idx}>
                    <td className="matrix-feature-name">{row.feature}</td>
                    <td className="matrix-val-paper5">
                      <div className="matrix-cell-content">
                        <Check size={16} className="icon-check" />
                        <span>{row.paper5}</span>
                      </div>
                    </td>
                    <td className="matrix-val-competitor">
                      <div className="matrix-cell-content">
                        <span>{row.competitor}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Decision Guide: Who Should Choose What */}
        <section className="decision-guide-grid">
          <div className="decision-card competitor-card">
            <h3>When {data.competitor} Is the Right Choice</h3>
            <p className="decision-intro">{data.competitorTagline}</p>
            <ul className="decision-list">
              {data.whenToChooseCompetitor.map((item, idx) => (
                <li key={idx}>
                  <Check size={16} className="bullet-neutral" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="decision-card paper5-card">
            <div className="recommended-ribbon">Recommended for Small Teams</div>
            <h3>When Paper5 Is the Better Choice</h3>
            <p className="decision-intro">{data.paper5Tagline}</p>
            <ul className="decision-list">
              {data.whenToChoosePaper5.map((item, idx) => (
                <li key={idx}>
                  <Check size={16} className="bullet-accent" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Key Architectural Differentiators */}
        <section className="deep-dive-section">
          <h2 className="section-title">Key Differences: Why Teams Choose Paper5</h2>
          <div className="differentiators-grid">
            <div className="differentiator-item">
              <div className="diff-icon"><GitPullRequest size={22} /></div>
              <h3>Automated Two-Way GitHub Code Synchronization</h3>
              <p>
                Paper5 connects directly to your team’s GitHub repositories. When an engineer opens or merges a pull request, the associated task card progresses automatically across sprint columns. No manual status nagging required.
              </p>
            </div>
            <div className="differentiator-item">
              <div className="diff-icon"><Users size={22} /></div>
              <h3>Single Task Ownership for True Accountability</h3>
              <p>
                Diffusion of responsibility happens when multiple team members are assigned to one ticket. Paper5 enforces single strict ownership, ensuring every sprint commitment has an unmistakable driver.
              </p>
            </div>
            <div className="differentiator-item">
              <div className="diff-icon"><Zap size={22} /></div>
              <h3>Lightweight Velocity Without Administrative Drag</h3>
              <p>
                Traditional project tools slow teams down with complex setup and endless nested screens. Paper5 is lightning-fast, giving small teams and startup founders instant visibility over project status in seconds.
              </p>
            </div>
          </div>
        </section>

        {/* FAQ Section with Accordion */}
        <section className="comparison-faq-section">
          <h2 className="section-title">Frequently Asked Questions: Paper5 vs {data.competitor}</h2>
          <div className="faq-accordion-list">
            {data.faqs.map((faq, index) => {
              const isOpen = openFaq === index
              return (
                <div key={index} className={`faq-accordion-item ${isOpen ? 'open' : ''}`}>
                  <button
                    className="faq-accordion-header"
                    onClick={() => toggleFaq(index)}
                    aria-expanded={isOpen}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown size={18} className="faq-chevron" />
                  </button>
                  {isOpen && (
                    <div className="faq-accordion-body">
                      <p>{faq.answer}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </section>

        {/* Bottom Call to Action */}
        <section className="comparison-cta-card">
          <h2>Ready to Streamline Your Team’s Projects?</h2>
          <p>
            Join hundreds of small teams and startups using Paper5 to organize tasks, automate GitHub sprints, and ship on time.
          </p>
          <div className="cta-actions">
            <button
              className="btn-primary"
              style={{ padding: '14px 32px', fontSize: '16px' }}
              onClick={() => navigate('/#pricing')}
            >
              Start Free Workspace <ArrowRight size={16} style={{ marginLeft: 8 }} />
            </button>
            <button
              className="btn-ghost"
              style={{ padding: '14px 28px', fontSize: '16px' }}
              onClick={() => navigate('/features')}
            >
              Explore All Features
            </button>
          </div>
        </section>
      </div>
    </MarketingLayout>
  )
}
