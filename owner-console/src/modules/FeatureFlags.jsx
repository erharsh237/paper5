import React, { useState, useEffect } from 'react'
import { Plus, X } from 'lucide-react'
import { ownerApi } from '../lib/api'

export function FeatureFlags() {
  const [flags, setFlags] = useState([])
  const [loading, setLoading] = useState(true)
  const [createModal, setCreateModal] = useState(false)

  // New Flag Form
  const [newKey, setNewKey] = useState('')
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newEnabled, setNewEnabled] = useState(false)
  const [saving, setSaving] = useState(false)

  async function loadFlags() {
    setLoading(true)
    try {
      const res = await ownerApi('flags.list')
      setFlags(res.flags || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFlags()
  }, [])

  async function toggleFlag(flag) {
    const nextState = !flag.enabled
    try {
      await ownerApi('flags.update', {
        method: 'POST',
        body: {
          key: flag.key,
          enabled: nextState,
          rolloutPercentage: flag.rollout_percentage,
          tierRestrictions: flag.tier_restrictions
        }
      })
      loadFlags()
    } catch (err) {
      alert(`Toggle failed: ${err.message}`)
    }
  }

  async function updateRollout(flag, pct) {
    try {
      await ownerApi('flags.update', {
        method: 'POST',
        body: {
          key: flag.key,
          enabled: flag.enabled,
          rolloutPercentage: pct,
          tierRestrictions: flag.tier_restrictions
        }
      })
      loadFlags()
    } catch (err) {
      alert(`Update failed: ${err.message}`)
    }
  }

  async function createFlag(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await ownerApi('flags.create', {
        method: 'POST',
        body: {
          key: newKey.trim(),
          name: newName.trim(),
          description: newDesc.trim(),
          enabled: newEnabled,
          tierRestrictions: []
        }
      })
      setCreateModal(false)
      setNewKey('')
      setNewName('')
      setNewDesc('')
      loadFlags()
    } catch (err) {
      alert(`Create failed: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white p-5 rounded-2xl border border-black/[0.06] shadow-sm flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">Feature Flags</h2>
        <button onClick={() => setCreateModal(true)} className="btn-primary !text-xs !py-1.5">
          <Plus className="w-3.5 h-3.5" />
          Create Flag
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading ? (
          <div className="col-span-2 text-center py-12 text-xs text-slate-400">Loading flags...</div>
        ) : flags.length === 0 ? (
          <div className="col-span-2 text-center py-12 text-xs text-slate-400 bg-white rounded-2xl border border-black/[0.06] shadow-sm">
            No feature flags created yet.
          </div>
        ) : (
          flags.map((flag) => (
            <div key={flag.key} className="p-5 rounded-2xl bg-white border border-black/[0.06] shadow-sm space-y-3.5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{flag.name}</div>
                  <div className="font-mono text-[11px] text-slate-500">{flag.key}</div>
                  {flag.description && (
                    <div className="text-xs text-slate-600 mt-1">{flag.description}</div>
                  )}
                </div>

                <button
                  onClick={() => toggleFlag(flag)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    flag.enabled ? 'bg-slate-900' : 'bg-slate-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      flag.enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <span className="font-medium">Rollout percentage</span>
                  <span className="font-mono font-bold text-slate-900">{flag.rollout_percentage}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={flag.rollout_percentage}
                  onChange={(e) => updateRollout(flag, parseInt(e.target.value))}
                  className="w-full accent-slate-900 cursor-pointer"
                />
              </div>
            </div>
          ))
        )}
      </div>

      {createModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200/80 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-sm font-bold text-slate-900">Create Feature Flag</h3>
              <button onClick={() => setCreateModal(false)} className="text-slate-400 hover:text-slate-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={createFlag} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-600 block mb-1 font-medium">Key (e.g. new_dashboard)</label>
                <input
                  type="text"
                  required
                  placeholder="flag_key"
                  value={newKey}
                  onChange={(e) => setNewKey(e.target.value)}
                  className="console-input w-full font-mono text-xs"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Display Name</label>
                <input
                  type="text"
                  required
                  placeholder="New Dashboard Experience"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="console-input w-full text-xs"
                />
              </div>

              <div>
                <label className="text-slate-600 block mb-1 font-medium">Description</label>
                <input
                  type="text"
                  placeholder="Description of the feature"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  className="console-input w-full text-xs"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="enabledCheck"
                  checked={newEnabled}
                  onChange={(e) => setNewEnabled(e.target.checked)}
                  className="accent-slate-900 rounded"
                />
                <label htmlFor="enabledCheck" className="text-slate-900 cursor-pointer font-medium">
                  Enable immediately
                </label>
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
                  {saving ? 'Creating...' : 'Create Flag'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
