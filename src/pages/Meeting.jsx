import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'
import { subscribeSprints } from '../lib/sprints'
import { subscribeMembers } from '../lib/deadlines'
import { subscribeEventNotes, saveEventNote, deleteEventNote } from '../lib/meetings'
import NotificationBell from '../components/NotificationBell'
import NavTabs from '../components/NavTabs'
import ReflectionPanel from '../components/ReflectionPanel'
import UserMenu from '../components/UserMenu'
import CalendarWidget from '../components/CalendarWidget'
import { useWorkspace } from '../lib/WorkspaceContext'
import { Plus, Edit2, Trash2, Calendar, FileText, X } from 'lucide-react'
import './Dashboard.css'
import './Meeting.css'

export default function Meeting() {
  const { workspaceId, workspace, isAdmin, isOwner, workspaceRole } = useWorkspace()
  const { user } = useAuth()
  const [sprints, setSprints] = useState([])
  const [members, setMembers] = useState([])
  
  // Notes state
  const [eventNotes, setEventNotes] = useState({})
  const [selectedEventId, setSelectedEventId] = useState('')

  // Modal State
  const [isNoteModalOpen, setIsNoteModalOpen] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState(null)
  const [noteTitle, setNoteTitle] = useState('')
  const [noteDate, setNoteDate] = useState('')
  const [noteContent, setNoteContent] = useState('')
  const [savingNote, setSavingNote] = useState(false)
  const [modalError, setModalError] = useState('')

  const isAdminOrOwner = isAdmin || isOwner || workspaceRole === 'owner' || workspaceRole === 'admin'

  useEffect(() => {
    const unsub1 = subscribeSprints(workspaceId, undefined, setSprints)
    const unsub2 = subscribeMembers(workspaceId, undefined, setMembers)
    const unsub3 = subscribeEventNotes(workspaceId, setEventNotes)
    return () => { unsub1(); unsub2(); unsub3() }
  }, [workspaceId])

  const activeSprint = sprints.find(s => s.status === 'active')

  const handleOpenNewNote = () => {
    setEditingNoteId(null)
    setNoteTitle('')
    setNoteDate(new Date().toISOString().split('T')[0])
    setNoteContent('')
    setModalError('')
    setIsNoteModalOpen(true)
  }

  const handleEditNote = (id, note) => {
    setEditingNoteId(id)
    setNoteTitle(note.title || '')
    setNoteDate(note.date || new Date().toISOString().split('T')[0])
    setNoteContent(note.notes || '')
    setModalError('')
    setIsNoteModalOpen(true)
  }

  const handleSaveNote = async (e) => {
    e.preventDefault()
    if (!noteTitle.trim()) {
      setModalError('Please enter a meeting title.')
      return
    }

    setSavingNote(true)
    setModalError('')

    try {
      const noteId = editingNoteId || `note_${Date.now()}_${Math.random().toString(36).substring(7)}`
      await saveEventNote(workspaceId, undefined, noteId, {
        title: noteTitle.trim(),
        date: noteDate || new Date().toISOString().split('T')[0],
        notes: noteContent.trim(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.email || 'Admin'
      }, user?.email)

      setIsNoteModalOpen(false)
      setEditingNoteId(null)
      setNoteTitle('')
      setNoteContent('')
    } catch (err) {
      console.error('Failed to save meeting note:', err)
      setModalError('Failed to save note: ' + err.message)
    } finally {
      setSavingNote(false)
    }
  }

  const handleDeleteNote = async (id, title) => {
    if (window.confirm(`Are you sure you want to delete notes for "${title || 'this meeting'}"?`)) {
      try {
        await deleteEventNote(workspaceId, undefined, id)
        if (selectedEventId === id) setSelectedEventId('')
      } catch (err) {
        console.error('Failed to delete meeting note:', err)
        alert('Failed to delete note.')
      }
    }
  }

  return (
    <div className="dash-root">
      <nav className="dash-sticky-nav">
        <div className="dash-container dash-nav-inner">
          <Link to={`/${workspaceId}`} className="dash-nav-brand">
            <span className="dash-logo-name">SprintOS</span>
            <span className="dash-env-tag">{(workspace?.name || 'TEST').toUpperCase()}</span>
          </Link>

          <NavTabs />

          <div className="dash-nav-actions">
            <NotificationBell currentUser={user} />
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className="dash-container" style={{ paddingBottom: '48px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', alignItems: 'stretch' }}>
          
          {/* Calendar Top Area */}
          <div>
            <CalendarWidget 
              user={user} 
              onSelectEvent={setSelectedEventId} 
              selectedEventId={selectedEventId} 
            />
          </div>

          {/* Main Notes Area */}
          <section className="dash-surface-card" style={{ padding: '24px 28px', minHeight: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px 0', fontSize: '18px', fontWeight: 800, color: 'var(--text, #1C1D2B)' }}>
                  Meeting Notes &amp; Syncs
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted, #6E7091)' }}>
                  Record agendas, action items, and retrospective takeaways for your team.
                </p>
              </div>

              {isAdminOrOwner && (
                <button 
                  type="button"
                  className="dash-btn-accent"
                  onClick={handleOpenNewNote}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', fontSize: '13px' }}
                >
                  <Plus size={15} />
                  <span>+ Add Meeting Note</span>
                </button>
              )}
            </div>
            
            {(() => {
              const savedNoteList = Object.entries(eventNotes).filter(([id, n]) => n && (n.title || n.notes || n.date))

              if (selectedEventId) {
                const note = eventNotes[selectedEventId]
                if (note && (note.title || note.date || note.notes)) {
                  return (
                    <div style={{ background: 'var(--surface-2, #EEF0F9)', border: '1px solid var(--border-soft, #EAECF6)', borderRadius: '12px', padding: '24px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                        <div>
                          <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 800, color: 'var(--text, #1C1D2B)' }}>
                            {note.title || 'Untitled Meeting'}
                          </h3>
                          {note.date && (
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--muted, #6E7091)', background: '#FFFFFF', padding: '3px 10px', borderRadius: '100px', border: '1px solid var(--border-soft, #EAECF6)' }}>
                              <Calendar size={13} />
                              <span>{note.date}</span>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {isAdminOrOwner && (
                            <>
                              <button 
                                type="button" 
                                className="btn-ghost btn-sm" 
                                onClick={() => handleEditNote(selectedEventId, note)}
                                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Edit2 size={13} /> Edit
                              </button>
                              <button 
                                type="button" 
                                className="btn-ghost btn-sm" 
                                onClick={() => handleDeleteNote(selectedEventId, note.title)}
                                style={{ color: 'var(--accent-critical, #D14343)', padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Trash2 size={13} /> Delete
                              </button>
                            </>
                          )}
                          <button className="btn-ghost btn-sm" style={{ fontSize: '12px', padding: '6px 12px' }} onClick={() => setSelectedEventId('')}>
                            Show all notes
                          </button>
                        </div>
                      </div>
                      
                      <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text, #1C1D2B)', fontSize: '14px', lineHeight: '1.6', background: '#FFFFFF', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-soft, #EAECF6)', marginTop: '16px' }}>
                        {note.notes || 'No detailed notes provided.'}
                      </div>
                    </div>
                  )
                }
                return (
                  <div style={{ padding: '48px 0', textAlign: 'center', background: 'var(--surface-2, #EEF0F9)', borderRadius: '12px', border: '1px dashed var(--border-soft, #EAECF6)' }}>
                    <FileText size={32} style={{ color: 'var(--muted, #6E7091)', margin: '0 auto 12px auto' }} />
                    <p style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: 600, color: 'var(--text, #1C1D2B)' }}>No meeting notes added for this event yet.</p>
                    {isAdminOrOwner && (
                      <button 
                        type="button" 
                        className="dash-btn-accent" 
                        style={{ marginTop: '8px', padding: '6px 14px', fontSize: '12px' }} 
                        onClick={() => {
                          setEditingNoteId(selectedEventId)
                          setNoteTitle('Meeting Notes')
                          setNoteDate(new Date().toISOString().split('T')[0])
                          setNoteContent('')
                          setIsNoteModalOpen(true)
                        }}
                      >
                        + Add Notes for this Event
                      </button>
                    )}
                    <div>
                      <button className="btn-ghost" style={{ fontSize: '12px', marginTop: '12px' }} onClick={() => setSelectedEventId('')}>Show all notes</button>
                    </div>
                  </div>
                )
              }

              if (savedNoteList.length > 0) {
                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
                    {savedNoteList.map(([id, note]) => (
                      <div key={id} style={{ background: 'var(--surface-2, #EEF0F9)', border: '1px solid var(--border-soft, #EAECF6)', borderRadius: '12px', padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: 'var(--text, #1C1D2B)' }}>
                              {note.title || 'Untitled Meeting'}
                            </h3>
                            {note.date && (
                              <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--muted, #6E7091)', background: '#FFFFFF', padding: '3px 8px', borderRadius: '100px', border: '1px solid var(--border-soft, #EAECF6)', whiteSpace: 'nowrap' }}>
                                {note.date}
                              </span>
                            )}
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', color: 'var(--muted, #6E7091)', fontSize: '13px', lineHeight: '1.5', maxHeight: '140px', overflow: 'hidden', textOverflow: 'ellipsis', background: '#FFFFFF', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-soft, #EAECF6)', marginBottom: '14px' }}>
                            {note.notes || 'No detailed notes provided.'}
                          </div>
                        </div>

                        {isAdminOrOwner && (
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border-soft, #EAECF6)', paddingTop: '10px' }}>
                            <button 
                              type="button" 
                              className="btn-ghost btn-sm" 
                              onClick={() => handleEditNote(id, note)}
                              style={{ padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Edit2 size={12} /> Edit
                            </button>
                            <button 
                              type="button" 
                              className="btn-ghost btn-sm" 
                              onClick={() => handleDeleteNote(id, note.title)}
                              style={{ color: 'var(--accent-critical, #D14343)', padding: '4px 10px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              }

              return (
                <div style={{ padding: '60px 24px', textAlign: 'center', background: 'var(--surface-2, #EEF0F9)', borderRadius: '12px', border: '1px dashed var(--border-soft, #EAECF6)' }}>
                  <FileText size={40} style={{ color: 'var(--muted, #6E7091)', margin: '0 auto 14px auto', opacity: 0.7 }} />
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '16px', fontWeight: 800, color: 'var(--text, #1C1D2B)' }}>No Meeting Notes Recorded</h3>
                  <p style={{ margin: '0 auto 16px auto', fontSize: '13px', color: 'var(--muted, #6E7091)', maxWidth: '420px', lineHeight: 1.5 }}>
                    Keep your team aligned by recording sprint discussions, architectural decisions, and sync action items.
                  </p>
                  {isAdminOrOwner && (
                    <button 
                      type="button" 
                      className="dash-btn-accent" 
                      onClick={handleOpenNewNote}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px', fontSize: '13px' }}
                    >
                      <Plus size={15} />
                      <span>+ Create First Meeting Note</span>
                    </button>
                  )}
                </div>
              )
            })()}
          </section>
        </div>

        {activeSprint && (
          <ReflectionPanel teamId={TEAM_ID} sprint={activeSprint} currentUser={user} members={members} />
        )}
      </main>

      {/* Note Creation / Edit Modal */}
      {isNoteModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(15, 23, 42, 0.45)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--surface, #FFFFFF)',
            border: '1px solid var(--border-soft, #EAECF6)',
            borderRadius: '16px',
            maxWidth: '560px',
            width: '100%',
            padding: '28px',
            boxShadow: '0 20px 40px rgba(30, 32, 80, 0.15)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--text, #1C1D2B)' }}>
                {editingNoteId ? 'Edit Meeting Note' : 'Add New Meeting Note'}
              </h3>
              <button 
                type="button" 
                onClick={() => setIsNoteModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted, #6E7091)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '13px', marginBottom: '16px' }}>
                {modalError}
              </div>
            )}

            <form onSubmit={handleSaveNote} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text, #1C1D2B)', marginBottom: '6px' }}>
                  Meeting Title *
                </label>
                <input 
                  type="text" 
                  placeholder="e.g. Sprint 4 Retrospective & Planning" 
                  value={noteTitle} 
                  onChange={e => setNoteTitle(e.target.value)} 
                  required
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-soft, #EAECF6)',
                    background: 'var(--surface-2, #EEF0F9)',
                    color: 'var(--text, #1C1D2B)',
                    fontSize: '13.5px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text, #1C1D2B)', marginBottom: '6px' }}>
                  Meeting Date
                </label>
                <input 
                  type="date" 
                  value={noteDate} 
                  onChange={e => setNoteDate(e.target.value)} 
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-soft, #EAECF6)',
                    background: 'var(--surface-2, #EEF0F9)',
                    color: 'var(--text, #1C1D2B)',
                    fontSize: '13.5px'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 700, color: 'var(--text, #1C1D2B)', marginBottom: '6px' }}>
                  Notes, Decisions &amp; Action Items
                </label>
                <textarea 
                  rows={6}
                  placeholder="Write meeting summary, key architectural decisions, team blockers, or action items..."
                  value={noteContent} 
                  onChange={e => setNoteContent(e.target.value)} 
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-soft, #EAECF6)',
                    background: 'var(--surface-2, #EEF0F9)',
                    color: 'var(--text, #1C1D2B)',
                    fontSize: '13.5px',
                    fontFamily: 'inherit',
                    lineHeight: '1.5',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn-ghost" 
                  onClick={() => setIsNoteModalOpen(false)}
                  disabled={savingNote}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="dash-btn-accent"
                  disabled={savingNote}
                  style={{ padding: '9px 20px', fontSize: '13px' }}
                >
                  {savingNote ? 'Saving Notes...' : 'Save Meeting Notes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
