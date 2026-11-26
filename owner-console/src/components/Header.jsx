import React, { useState } from 'react'
import { Search, RefreshCw, LogOut, ChevronDown } from 'lucide-react'
import { MODULES } from '../constants/modules'

export function Header({
  currentModule,
  onSelectModule,
  adminProfile,
  onLogout,
  onRefresh,
  isRefreshing,
  onOpenCommandPalette,
  onOpenPasskeys,
  dbLatency
}) {
  const [userDropdown, setUserDropdown] = useState(false)

  // Primary navigation tabs shown in center pill
  const primaryModules = [
    { id: 'command-center', name: 'Home' },
    { id: 'users', name: 'Users' },
    { id: 'workspaces', name: 'Workspaces' },
    { id: 'billing', name: 'Billing' },
    { id: 'analytics', name: 'Analytics' },
    { id: 'database', name: 'Database' },
    { id: 'security', name: 'Security' },
    { id: 'support', name: 'Support' },
    { id: 'rbac', name: 'Admins' }
  ]

  return (
    <header className="h-16 px-4 sm:px-6 lg:px-8 border-b border-black/[0.06] bg-white sticky top-0 z-30">
      <div className="max-w-[1720px] mx-auto w-full h-full flex items-center justify-between gap-4">
        {/* Brand Logo - Clean Typography */}
        <div className="flex items-center shrink-0 cursor-pointer select-none" onClick={() => onSelectModule('command-center')}>
          <span className="font-bold text-base tracking-tight text-slate-900 hover:text-slate-700 transition-colors whitespace-nowrap">Paper5</span>
        </div>

      {/* Center Floating Pill Navigation */}
      <div className="hidden md:flex items-center min-w-0">
        <div className="pill-navbar max-w-full overflow-x-auto">
          {primaryModules.map((m) => {
            const isActive = currentModule === m.id
            return (
              <button
                key={m.id}
                onClick={() => onSelectModule(m.id)}
                className={`pill-nav-item ${isActive ? 'active' : ''}`}
              >
                {m.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Right Controls: Search, Latency & User Profile */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Search Input Trigger */}
        <button
          onClick={onOpenCommandPalette}
          className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 border border-slate-200/80 text-xs text-slate-500 hover:bg-slate-200/60 transition-colors whitespace-nowrap shrink-0"
        >
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="hidden xl:inline">Ask Paper5</span>
          <span className="xl:hidden">Search</span>
          <kbd className="px-1 py-0.2 rounded bg-white text-[10px] font-mono text-slate-500 shadow-2xs shrink-0">
            ⌘K
          </kbd>
        </button>

        {/* Database Latency */}
        {dbLatency !== null && (
          <span className="text-[11px] font-mono text-slate-500 hidden lg:inline">
            {dbLatency}ms
          </span>
        )}

        {/* Refresh */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh"
          className="p-1.5 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
        </button>

        {/* Profile Avatar & Dropdown */}
        <div className="relative">
          <button
            onClick={() => setUserDropdown(!userDropdown)}
            className="flex items-center gap-2 p-1 rounded-full hover:bg-slate-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-semibold">
              {adminProfile?.email?.charAt(0).toUpperCase() || 'A'}
            </div>
            <ChevronDown className="w-3 h-3 text-slate-400" />
          </button>

          {userDropdown && (
            <div
              className="absolute right-0 mt-2 w-48 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-50 text-xs text-slate-700"
              onClick={() => setUserDropdown(false)}
            >
              <div className="px-3 py-2 border-b border-slate-100">
                <div className="font-semibold text-slate-900 truncate">{adminProfile?.email || 'admin'}</div>
                <div className="text-[11px] text-slate-500 capitalize">{adminProfile?.role || 'Owner'}</div>
              </div>

              <div className="py-1">
                <button
                  onClick={() => onSelectModule('flags')}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-50 text-slate-700"
                >
                  Feature Flags
                </button>
                <button
                  onClick={() => onSelectModule('announcements')}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-50 text-slate-700"
                >
                  Announcements
                </button>
                <button
                  onClick={() => onSelectModule('health')}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-50 text-slate-700"
                >
                  System Health
                </button>
                <button
                  onClick={() => onSelectModule('analytics')}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-50 text-slate-700"
                >
                  Analytics
                </button>
                <button
                  onClick={() => onOpenPasskeys && onOpenPasskeys()}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-50 text-slate-700 font-medium"
                >
                  Passkey Security
                </button>
              </div>

              <div className="border-t border-slate-100 pt-1">
                <button
                  onClick={onLogout}
                  className="w-full px-3 py-1.5 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  </header>
  )
}
