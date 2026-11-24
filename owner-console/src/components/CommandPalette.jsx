import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  Search,
  X,
  LayoutDashboard,
  Users,
  Briefcase,
  CreditCard,
  BarChart3,
  ShieldAlert,
  Activity,
  LifeBuoy,
  Flag,
  Megaphone,
  TrendingUp,
  KeyRound
} from 'lucide-react'

export function CommandPalette({ isOpen, onClose, onNavigate }) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        if (isOpen) onClose()
      }
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const items = [
    { title: 'Overview', module: 'command-center', icon: LayoutDashboard },
    { title: 'Users', module: 'users', icon: Users },
    { title: 'Workspaces', module: 'workspaces', icon: Briefcase },
    { title: 'Billing', module: 'billing', icon: CreditCard },
    { title: 'Analytics', module: 'analytics', icon: BarChart3 },
    { title: 'Security & Logs', module: 'security', icon: ShieldAlert },
    { title: 'System Health', module: 'health', icon: Activity },
    { title: 'Support', module: 'support', icon: LifeBuoy },
    { title: 'Feature Flags', module: 'flags', icon: Flag },
    { title: 'Announcements', module: 'announcements', icon: Megaphone },
    { title: 'Growth', module: 'growth', icon: TrendingUp },
    { title: 'Admins & Audit', module: 'rbac', icon: KeyRound }
  ]

  const filtered = items.filter(i =>
    i.title.toLowerCase().includes(query.toLowerCase())
  )

  return typeof document !== 'undefined' ? createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-xs flex items-start justify-center pt-24 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-slate-100">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Go to module or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-xs text-slate-900 outline-none placeholder-slate-400 font-medium"
          />
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 space-y-0.5">
          {filtered.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No matching modules.
            </div>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              return (
                <button
                  key={idx}
                  onClick={() => {
                    onNavigate(item.module)
                    onClose()
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors text-left"
                >
                  <Icon className="w-4 h-4 text-slate-400" />
                  <span className="font-medium">{item.title}</span>
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>,
    document.body
  ) : null
}
