import React, { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { ownerApi } from '../lib/api'

export function PlatformAnnouncements() {
  const [announcements, setAnnouncements] = useState([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)

  // New Announcement Form
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [type, setType] = useState('info')
  const [targetAudience, setTargetAudience] = useState('all')
  const [expiresAt, setExpiresAt] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadAnnouncements() {
    setLoading(true)
    try {
      const res = await ownerApi('announcements.list')
      setAnnouncements(res.announcements || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

  async function toggleActive(item) {
    try {
      await ownerApi('announcements.update', {
        method: 'POST',
        body: { id: item.id, isActive: !item.is_active }
      })
      loadAnnouncements()
    } catch (err) {
      alert(`Toggle failed: ${err.message}`)
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await ownerApi('announcements.create', {
        method: 'POST',
        body: {
          title: title.trim(),
          content: content.trim(),
          type,
          targetAudience,
          expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null
        }
      })
      setCreateModal(false)
      setTitle('')
      setContent('')
      loadAnnouncements()
    } catch (err) {
      alert(`Create failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-black/[0.06] shadow-sm flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Announcements</h2>
        <button onClick={() => setCreateModal(true)} className="btn-primary !text-xs !py-1.5">
          <Plus className="w-3.5 h-3.5" />
          New Announcement
        </button>
      </div>

      <div className="space-y-3">
        {loading ? (
          <div className="text-center py-12 text-xs text-slate-400">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <div className="text-center py-12 text-xs text-slate-400 p-6 rounded-2xl bg-white border border-black/[0.06] shadow-sm">
            No announcements created yet.
          </div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900 text-sm">{a.title}</span>
                  <span className="text-[11px] font-mono uppercase text-slate-500 font-semibold">{a.type}</span>
                </div>
                <p className="text-xs text-slate-600 mt-1">{a.content}</p>
                <div className="text-[11px] text-slate-400 font-mono mt-2">
                  Audience: {a.target_audience} • Created: {new Date(a.created_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleActive(a)}
                  className={`btn-secondary !py-1 !px-2.5 !text-xs font-medium ${a.is_active ? 'text-amber-600' : 'text-emerald-600'}`}
                >
                  {a.is_active ? 'Deactivate' : 'Publish'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {createModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">New Announcement</h3>
              <button onClick={() => setCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-medium">Title</label>
                <input
                  type="text"
                  required
                  placeholder="System Maintenance or Update"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="console-input w-full text-xs"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Content</label>
                <textarea
                  rows="3"
                  required
                  placeholder="Announcement message..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="console-input w-full text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-600 block mb-1 font-medium">Type</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="console-input w-full text-xs"
                  >
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-600 block mb-1 font-medium">Audience</label>
                  <select
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="console-input w-full text-xs"
                  >
                    <option value="all">All Users</option>
                    <option value="starter">Free Tier</option>
                    <option value="team">Team Tier</option>
                    <option value="pro">Pro Tier</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCreateModal(false)}
                  className="btn-secondary !text-xs font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary !text-xs font-medium"
                >
                  {saving ? 'Publishing...' : 'Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
