import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useWorkspace } from '../lib/WorkspaceContext'
import { useAuth } from '../lib/AuthContext'
import { updateDeadline } from '../lib/deadlines'
import CreateProjectModal from './CreateProjectModal'
import ReassignTaskModal from './ReassignTaskModal'
import NewDeadlineModal from './NewDeadlineModal'
import Paper5Logo from './Paper5Logo'
import {
  Calendar,
  Clock,
  Plus,
  Search,
  ArrowLeft,
  ArrowUpRight,
  UserCheck,
  Folder,
  CheckCircle2,
  Bell,
  RefreshCw,
  ExternalLink,
  Shield,
  Send,
  Flag,
  User,
  Activity,
  Layers,
  LayoutGrid,
  Users,
  MessageSquare,
  Video,
  Mic,
  Volume2,
  PhoneOff,
  SlidersHorizontal,
  Download,
  Edit3,
  Maximize2,
  X,
  PhoneCall,
  Mail,
  FileText
} from 'lucide-react'
import './AdminCommandCenter.css'

export default function AdminCommandCenter({ onSwitchToPersonal }) {
  const { workspaceId, workspace, isAdmin } = useWorkspace()
  const { user } = useAuth()

  // State
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [leadTab, setLeadTab] = useState('all') // 'all' | 'hot' | 'great' | 'medium' | 'low'
  const [taskTab, setTaskTab] = useState('all') // 'all' | 'hot' | 'due_today' | 'overdue' | 'completed'
  const [isVideoActive, setIsVideoActive] = useState(true)

  // Modals
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false)
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false)
  const [taskToReassign, setTaskToReassign] = useState(null)

  // Fetch Admin Overview Data
  const fetchOverview = useCallback(async () => {
    if (!workspaceId) return
    try {
      const res = await fetch(`/api/admin-overview?workspaceId=${encodeURIComponent(workspaceId)}`, {
        credentials: 'same-origin'
      })
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    } catch (err) {
      console.error('Failed to load admin overview:', err)
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  // Realtime updates
  useEffect(() => {
    const handleSync = () => fetchOverview()
    window.addEventListener('sprintos:data-sync', handleSync)
    window.addEventListener('sprintos:deadlines-updated', handleSync)
    window.addEventListener('sprintos:sprints-updated', handleSync)
    return () => {
      window.removeEventListener('sprintos:data-sync', handleSync)
      window.removeEventListener('sprintos:deadlines-updated', handleSync)
      window.removeEventListener('sprintos:sprints-updated', handleSync)
    }
  }, [fetchOverview])

  const overview = data?.overview || {}
  const teamWorkload = data?.teamWorkload || []
  const projects = data?.projects || []
  const upcomingDeadlines = data?.upcomingDeadlines || []

  // Sample Leads / Team Lead Cards exactly modeled on the mock
  const leads = useMemo(() => {
    if (teamWorkload.length >= 4) {
      return teamWorkload.slice(0, 4).map((m, i) => ({
        id: m.userId || String(i),
        name: m.name,
        role: m.role === 'owner' ? 'Workspace Owner & Lead' : `${m.role.toUpperCase()} at ${workspace?.name || 'TechNova'}`,
        avatar: m.avatarUrl || `https://images.unsplash.com/photo-${1534528741775 + i * 100}?w=150&auto=format&fit=crop&q=80`,
        sources: ['LinkedIn', 'Email'],
        hotLevel: 5 - (i % 2),
        tag: i === 0 ? 'Hot Client' : i === 1 ? 'High Interest' : 'Medium Interest'
      }))
    }
    return [
      {
        id: '1',
        name: 'Sophia Martinez',
        role: 'Marketing Director at TechNova',
        avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
        sources: ['LinkedIn', 'Email'],
        hotLevel: 5,
        tag: 'Hot Client'
      },
      {
        id: '2',
        name: 'Liam Anderson',
        role: 'Financial Manager at Vertex',
        avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
        sources: ['LinkedIn', 'Facebook'],
        hotLevel: 4,
        tag: 'Great Interest'
      },
      {
        id: '3',
        name: 'Noah Bennett',
        role: 'Operations Manager at BrightCore',
        avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        sources: ['Typeform'],
        hotLevel: 4,
        tag: 'Medium Interest'
      },
      {
        id: '4',
        name: 'Ethan Harper',
        role: 'Web Developer at CodeWave',
        avatar: 'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=150&auto=format&fit=crop&q=80',
        sources: ['Typeform'],
        hotLevel: 3,
        tag: 'Low Interest'
      }
    ]
  }, [teamWorkload, workspace?.name])

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    if (leadTab === 'hot') return leads.filter((l) => l.hotLevel >= 5)
    if (leadTab === 'great') return leads.filter((l) => l.hotLevel === 4)
    if (leadTab === 'medium') return leads.filter((l) => l.hotLevel === 3)
    if (leadTab === 'low') return leads.filter((l) => l.hotLevel < 3)
    return leads
  }, [leads, leadTab])

  // Today's formatted date
  const todayFormatted = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
  }, [])

  return (
    <div className="p5-mock-canvas">
      <div className="p5-mock-shell">
        {/* ─────────────────────────────────────────────────────────────
             1. TOP BAR: LOGO, BLACK SCHEDULE CAPSULE STRIP, NOTIFICATIONS, AVATAR
        ───────────────────────────────────────────────────────────── */}
        <div className="p5-mock-topbar">
          {/* Logo on Left */}
          <div className="p5-brand-block">
            <div className="p5-brand-logo-icon">
              <Paper5Logo size={28} decorative />
            </div>
            <div className="p5-brand-text">
              <span className="p5-brand-title">{workspace?.name || 'TaskOrbit'}</span>
              <span className="p5-brand-tag">CRM &amp; OPS</span>
            </div>
          </div>

          {/* Center Black Schedule Capsule Strip (Exact from Mock) */}
          <div className="p5-schedule-capsule">
            <span className="p5-capsule-schedule-label">Your Schedule</span>
            <div className="p5-capsule-date-pill">
              <Calendar size={13} color="#a1a1aa" />
              <span>{todayFormatted || '28 March'}</span>
            </div>

            {/* Lime Pill 30 min */}
            <div className="p5-capsule-lime-block">
              <img
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&auto=format&fit=crop&q=80"
                alt="Avatar"
                className="p5-capsule-lime-avatar"
              />
              <span>30 min</span>
              <ArrowUpRight size={13} />
            </div>

            {/* 2:00 pm slot */}
            <div className="p5-capsule-time-slot">
              <span>2:00 pm</span>
              <div className="p5-capsule-avatar-pair">
                <img src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=80&auto=format&fit=crop&q=80" alt="Avatar" className="p5-capsule-mini-avatar" />
                <img src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=80&auto=format&fit=crop&q=80" alt="Avatar" className="p5-capsule-mini-avatar" />
              </div>
              <div className="p5-capsule-slider-track">
                <div className="p5-capsule-slider-thumb" />
              </div>
            </div>

            {/* 3:00 pm slot */}
            <div className="p5-capsule-time-slot">
              <div style={{ background: '#a3e635', color: '#14532d', borderRadius: '4px', padding: '2px 4px', fontSize: '10px', fontWeight: 800 }}>
                G
              </div>
              <span>3:00 pm</span>
              <div className="p5-capsule-avatar-pair">
                <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&auto=format&fit=crop&q=80" alt="Avatar" className="p5-capsule-mini-avatar" />
                <img src="https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=80&auto=format&fit=crop&q=80" alt="Avatar" className="p5-capsule-mini-avatar" />
              </div>
            </div>

            <button type="button" className="p5-capsule-circle-arrow" title="Next schedule" onClick={() => (window.location.href = `/${workspaceId}/meeting`)}>
              <ArrowUpRight size={14} />
            </button>
          </div>

          {/* Right Topbar Icons */}
          <div className="p5-topbar-actions">
            <button type="button" className="p5-icon-button-circle" onClick={onSwitchToPersonal} title="Personal Task View">
              <User size={18} />
            </button>
            <button type="button" className="p5-icon-button-circle" title="Notifications">
              <Bell size={18} />
              <div className="p5-bell-dot" />
            </button>
            <img
              src={user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'}
              alt="User"
              className="p5-user-avatar-circle"
            />
          </div>
        </div>

        {/* ─────────────────────────────────────────────────────────────
             2. 3-COLUMN BODY: LEFT DOCK, CENTER STAGE, RIGHT WIDGETS
        ───────────────────────────────────────────────────────────── */}
        <div className="p5-mock-body-layout">
          {/* Left Icon Navigation Dock (Exact from Mock) */}
          <aside className="p5-mock-left-dock">
            <button type="button" className="p5-dock-item p5-dock-item--active" title="Command Center">
              <LayoutGrid size={20} />
            </button>
            <button type="button" className="p5-dock-item" title="Team Members" onClick={() => (window.location.href = `/${workspaceId}/settings`)}>
              <Users size={20} />
            </button>
            <button type="button" className="p5-dock-item" title="Meetings & Standups" onClick={() => (window.location.href = `/${workspaceId}/meeting`)}>
              <MessageSquare size={20} />
            </button>
            <button type="button" className="p5-dock-item" title="Sprint Workflow" onClick={() => (window.location.href = `/${workspaceId}/workflow`)}>
              <Calendar size={20} />
            </button>
          </aside>

          {/* Center Stage Content */}
          <main className="p5-mock-center-stage">
            {/* Hero Row: Back Button, Title (HELIXCRM), + New Task Pill, Metrics inline */}
            <div className="p5-mock-hero-row">
              <div className="p5-hero-left-wrap">
                <button type="button" className="p5-back-arrow-btn" onClick={onSwitchToPersonal} title="Back to personal tasks">
                  <ArrowLeft size={16} />
                </button>
                <h1 className="p5-mock-main-title">{(workspace?.name || 'HELIXCRM').toUpperCase()}</h1>
                <button type="button" className="p5-new-task-pill-btn" onClick={() => setIsNewTaskOpen(true)}>
                  <Plus size={16} /> New Task
                </button>
              </div>

              {/* Metric Counters (Exact from Mock: 34 Deals (+3), 20 won (+2), 3 lost (-1)) */}
              <div className="p5-hero-metrics-group">
                <div className="p5-hero-metric-item">
                  <span className="p5-hero-stat-number">{overview.totalTasks || 34}</span>
                  <span className="p5-hero-stat-label">Deals</span>
                  <span className="p5-hero-pill-badge p5-badge-green">+{overview.todoTasksCount || 3}</span>
                </div>

                <div className="p5-hero-metric-item">
                  <span className="p5-hero-stat-number">{overview.completedTasksCount || 20}</span>
                  <span className="p5-hero-stat-label">won</span>
                  <span className="p5-hero-pill-badge p5-badge-orange">+{overview.inProgressTasksCount || 2}</span>
                </div>

                <div className="p5-hero-metric-item">
                  <span className="p5-hero-stat-number" style={{ color: overview.overdueTasksCount > 0 ? '#dc2626' : undefined }}>
                    {overview.overdueTasksCount || 3}
                  </span>
                  <span className="p5-hero-stat-label">lost</span>
                  <span className="p5-hero-pill-badge p5-badge-red">-{overview.overdueTasksCount || 1}</span>
                </div>
              </div>
            </div>

            {/* ── SECTION 1: "NEW LEADS" (7 Leads) ── */}
            <section className="p5-mock-section">
              <div className="p5-mock-section-header">
                <div className="p5-section-title-combo">
                  <h2 className="p5-mock-h2">New Leads</h2>
                  <span className="p5-mock-count-pill">{filteredLeads.length} Leads</span>
                </div>

                <div className="p5-mock-filters-row">
                  <button type="button" className="p5-icon-pill-btn" title="Search leads">
                    <Search size={14} />
                  </button>
                  <button type="button" className="p5-icon-pill-btn" title="Filter options">
                    <SlidersHorizontal size={14} />
                  </button>
                  <button type="button" className={`p5-tab-pill-btn ${leadTab === 'all' ? 'p5-tab-pill-btn--active' : ''}`} onClick={() => setLeadTab('all')}>
                    All
                  </button>
                  <button type="button" className={`p5-tab-pill-btn ${leadTab === 'hot' ? 'p5-tab-pill-btn--active' : ''}`} onClick={() => setLeadTab('hot')}>
                    🔥 Hot Client
                  </button>
                  <button type="button" className={`p5-tab-pill-btn ${leadTab === 'great' ? 'p5-tab-pill-btn--active' : ''}`} onClick={() => setLeadTab('great')}>
                    Great interest
                  </button>
                  <button type="button" className={`p5-tab-pill-btn ${leadTab === 'medium' ? 'p5-tab-pill-btn--active' : ''}`} onClick={() => setLeadTab('medium')}>
                    Medium interest
                  </button>
                  <button type="button" className={`p5-tab-pill-btn ${leadTab === 'low' ? 'p5-tab-pill-btn--active' : ''}`} onClick={() => setLeadTab('low')}>
                    Low interest
                  </button>
                </div>
              </div>

              {/* 4 Horizontal Leads Cards */}
              <div className="p5-leads-cards-grid">
                {filteredLeads.map((lead) => (
                  <div key={lead.id} className="p5-lead-card">
                    <button type="button" className="p5-lead-arrow-btn" title="Inspect lead">
                      <ArrowUpRight size={14} />
                    </button>
                    <div>
                      <img src={lead.avatar} alt={lead.name} className="p5-lead-avatar" />
                      <h3 className="p5-lead-name">{lead.name}</h3>
                      <p className="p5-lead-role">{lead.role}</p>
                    </div>

                    <div className="p5-lead-meta-row">
                      <div className="p5-lead-sources">
                        {lead.sources.map((s, idx) => (
                          <span key={idx} className="p5-source-tag">
                            {s}
                          </span>
                        ))}
                      </div>

                      <div className="p5-dots-rating" title={`${lead.hotLevel} / 5 Interest Level`}>
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="p5-dot-orange"
                            style={{ opacity: i < lead.hotLevel ? 1 : 0.2 }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* ── SECTION 2: "YOUR DAYS TASKS" (16 Tasks) ── */}
            <section className="p5-mock-section">
              <div className="p5-mock-section-header">
                <div className="p5-section-title-combo">
                  <h2 className="p5-mock-h2">Your Days Tasks</h2>
                  <span className="p5-mock-count-pill">{upcomingDeadlines.length || 16} Tasks</span>
                </div>

                <div className="p5-mock-filters-row">
                  <button type="button" className="p5-icon-pill-btn" title="Search tasks">
                    <Search size={14} />
                  </button>
                  <button type="button" className="p5-icon-pill-btn" title="Filter tasks">
                    <SlidersHorizontal size={14} />
                  </button>
                  <button type="button" className={`p5-tab-pill-btn ${taskTab === 'all' ? 'p5-tab-pill-btn--active' : ''}`} onClick={() => setTaskTab('all')}>
                    All
                  </button>
                  <button type="button" className={`p5-tab-pill-btn ${taskTab === 'hot' ? 'p5-tab-pill-btn--active' : ''}`} onClick={() => setTaskTab('hot')}>
                    🔥 Hot
                  </button>
                  <button type="button" className={`p5-tab-pill-btn ${taskTab === 'due_today' ? 'p5-tab-pill-btn--active' : ''}`} onClick={() => setTaskTab('due_today')}>
                    Due Today
                  </button>
                  <button type="button" className={`p5-tab-pill-btn ${taskTab === 'overdue' ? 'p5-tab-pill-btn--active' : ''}`} onClick={() => setTaskTab('overdue')}>
                    Overdue
                  </button>
                  <button type="button" className={`p5-tab-pill-btn ${taskTab === 'completed' ? 'p5-tab-pill-btn--active' : ''}`} onClick={() => setTaskTab('completed')}>
                    Completed
                  </button>
                </div>
              </div>

              {/* Tasks Cards Grid (Lime Green Hero + White Cards) */}
              <div className="p5-tasks-cards-grid">
                {/* 1. VIBRANT LIME GREEN HERO CARD (Exact from Mock) */}
                <div className="p5-task-lime-card">
                  <div>
                    <div className="p5-task-lime-top">
                      <div className="p5-lime-user-group">
                        <img
                          src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80"
                          alt="David Thompson"
                          className="p5-lime-avatar"
                        />
                        <div>
                          <h4 className="p5-lime-user-name">David Thompson</h4>
                          <p className="p5-lime-user-role">CEO at InnovateX</p>
                        </div>
                      </div>

                      <div className="p5-lime-top-actions">
                        <button type="button" className="p5-lime-bell-icon" title="Urgent Task">
                          <Bell size={14} />
                        </button>
                        <button type="button" className="p5-lime-bell-icon" title="View Details" onClick={() => setIsNewTaskOpen(true)}>
                          <ArrowUpRight size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="p5-lime-title-row">
                      <div style={{ background: '#14532d', color: '#ffffff', borderRadius: '6px', padding: '4px', display: 'flex' }}>
                        <Video size={16} />
                      </div>
                      <h3 className="p5-lime-task-title">Google Meet Call</h3>
                    </div>

                    <div className="p5-lime-time-row">
                      <Calendar size={13} />
                      <span>{todayFormatted} at 2 pm</span>
                      <div className="p5-capsule-avatar-pair" style={{ marginLeft: '4px' }}>
                        <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80" alt="Avatar" className="p5-capsule-mini-avatar" />
                        <img src="https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=60&auto=format&fit=crop&q=80" alt="Avatar" className="p5-capsule-mini-avatar" />
                      </div>
                    </div>
                  </div>

                  <div className="p5-lime-bottom-row">
                    <div className="p5-lime-status-pill">
                      <PhoneCall size={13} />
                      <span>Call scheduled ▾</span>
                    </div>

                    <div className="p5-lime-circle-actions">
                      <button type="button" className="p5-black-circle-action-btn" title="Send email">
                        <Mail size={14} />
                      </button>
                      <button type="button" className="p5-black-circle-action-btn" title="Launch Video Call" onClick={() => (window.location.href = `/${workspaceId}/meeting`)}>
                        <Video size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2. WHITE CARD 1: Send Proposal */}
                <div className="p5-task-white-card">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="p5-white-user-group">
                        <img
                          src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80"
                          alt="Ava Williams"
                          className="p5-white-task-avatar"
                        />
                        <div>
                          <h4 className="p5-white-task-name">Ava Williams</h4>
                          <p className="p5-white-task-role">CEO at BlueHorizon</p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button type="button" className="p5-lead-arrow-btn">
                          <Bell size={13} />
                        </button>
                        <button type="button" className="p5-lead-arrow-btn">
                          <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="p5-white-title-row">
                      <FileText size={18} color="#71717a" />
                      <div>
                        <h3 className="p5-white-task-title">Send Proposal</h3>
                        <p className="p5-white-subdetail">Amount $20,000</p>
                      </div>
                    </div>
                  </div>

                  <div className="p5-white-bottom-row">
                    <div className="p5-white-status-pill">
                      <span>Waiting Proposal ▾</span>
                    </div>

                    <button type="button" className="p5-black-circle-action-btn" title="Send message">
                      <Mail size={14} />
                    </button>
                  </div>
                </div>

                {/* 3. WHITE CARD 2: Google Meet Call */}
                <div className="p5-task-white-card">
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div className="p5-white-user-group">
                        <img
                          src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=100&auto=format&fit=crop&q=80"
                          alt="Mia Johnson"
                          className="p5-white-task-avatar"
                        />
                        <div>
                          <h4 className="p5-white-task-name">Mia Johnson</h4>
                          <p className="p5-white-task-role">Brand Manager at Creative Studio</p>
                        </div>
                      </div>

                      <button type="button" className="p5-lead-arrow-btn">
                        <ArrowUpRight size={13} />
                      </button>
                    </div>

                    <div className="p5-white-title-row">
                      <Video size={18} color="#71717a" />
                      <div>
                        <h3 className="p5-white-task-title">Google Meet Call</h3>
                        <p className="p5-white-subdetail">28.03.2023 at 8 pm</p>
                      </div>
                    </div>
                  </div>

                  <div className="p5-white-bottom-row">
                    <div className="p5-white-status-pill">
                      <PhoneCall size={13} />
                      <span>Call scheduled ▾</span>
                    </div>

                    <button type="button" className="p5-black-circle-action-btn" title="Quick action">
                      <ArrowUpRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </main>

          {/* ─────────────────────────────────────────────────────────────
               6. RIGHT-SIDE MODULAR WIDGETS (VIDEO CALL + DARK SUMMARY DRAWER)
          ───────────────────────────────────────────────────────────── */}
          <aside className="p5-mock-right-widgets">
            {/* Live Video Call Card (Exact from Mock) */}
            {isVideoActive && (
              <div className="p5-video-call-card">
                <img
                  src="https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=600&auto=format&fit=crop&q=80"
                  alt="Live Call Video"
                  className="p5-video-feed-img"
                />

                <div className="p5-video-top-badges">
                  <div className="p5-video-meet-icon">
                    <Video size={15} color="#bef264" />
                  </div>
                  <div className="p5-video-window-actions">
                    <button type="button" className="p5-video-mini-btn" title="Expand">
                      <Maximize2 size={13} />
                    </button>
                    <button type="button" className="p5-video-mini-btn" onClick={() => setIsVideoActive(false)} title="Close video">
                      <X size={13} />
                    </button>
                  </div>
                </div>

                <div className="p5-video-bottom-controls">
                  <button type="button" className="p5-video-ctrl-btn" title="Camera">
                    <Video size={15} />
                  </button>
                  <button type="button" className="p5-video-ctrl-btn" title="Mute">
                    <Mic size={15} />
                  </button>
                  <button type="button" className="p5-video-ctrl-btn" title="Speaker">
                    <Volume2 size={15} />
                  </button>
                  <button type="button" className="p5-video-hangup-btn" onClick={() => setIsVideoActive(false)} title="End Call">
                    <PhoneOff size={16} />
                  </button>
                </div>
              </div>
            )}

            {/* Dark Summary Panel (Exact from Mock) */}
            <div className="p5-dark-summary-panel">
              <div className="p5-summary-panel-header">
                <div className="p5-summary-title-wrap">
                  <Activity size={16} color="#bef264" />
                  <span>Summary</span>
                </div>
                <button type="button" className="p5-summary-edit-btn" title="Edit summary">
                  <Edit3 size={15} />
                </button>
              </div>

              {/* Documents Section */}
              <div>
                <h4 className="p5-docs-section-title">Documents:</h4>
                <div className="p5-docs-thumbnails-row">
                  <div className="p5-doc-thumbnail-card" title="Download Brief.pdf">
                    <div className="p5-doc-icon-preview">
                      <div className="p5-doc-line" style={{ width: '80%' }} />
                      <div className="p5-doc-line" style={{ width: '100%' }} />
                      <div className="p5-doc-line" style={{ width: '60%' }} />
                    </div>
                    <span className="p5-doc-label-pill">Brief.pdf</span>
                  </div>

                  <div className="p5-doc-thumbnail-card" title="Download Requirement.pdf">
                    <div className="p5-doc-icon-preview">
                      <div className="p5-doc-line" style={{ width: '100%' }} />
                      <div className="p5-doc-line" style={{ width: '70%' }} />
                      <div className="p5-doc-line" style={{ width: '90%' }} />
                    </div>
                    <span className="p5-doc-label-pill">Requirement.pdf</span>
                  </div>
                </div>
              </div>

              {/* Goal Timeline Section (Exact from Mock) */}
              <div className="p5-timeline-goal-block">
                <div className="p5-timeline-time-col">3:15</div>
                <div className="p5-timeline-node-line">
                  <div className="p5-timeline-node-dot" />
                  <div className="p5-timeline-node-stem" />
                </div>
                <div className="p5-goal-content">
                  <div className="p5-goal-header">
                    <h5 className="p5-goal-title">Goal:</h5>
                    <Edit3 size={13} color="#71717a" style={{ cursor: 'pointer' }} />
                  </div>
                  <p className="p5-goal-text">
                    Reduce the number of security incidents by 50%. This goal is quantitative and measurable, and it would have a significant impact on workspace operations.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Modals */}
      {isNewTaskOpen && (
        <NewDeadlineModal
          workspaceId={workspaceId}
          onClose={() => setIsNewTaskOpen(false)}
          onCreated={() => fetchOverview()}
        />
      )}

      {isNewProjectOpen && (
        <CreateProjectModal
          existingCount={projects.length}
          members={teamWorkload}
          onClose={() => setIsNewProjectOpen(false)}
          onCreated={() => fetchOverview()}
        />
      )}
    </div>
  )
}
