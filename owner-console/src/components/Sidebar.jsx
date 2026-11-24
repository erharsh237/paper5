import React from 'react'
import { LogOut } from 'lucide-react'
import { MODULES } from '../constants/modules'

export function Sidebar({ currentModule, onSelectModule, adminProfile, onLogout }) {
  return (
    <aside className="w-56 bg-[#090C13] border-r border-[#1E293B] flex flex-col justify-between select-none shrink-0">
      <div>
        {/* Brand Header */}
        <div className="h-14 flex items-center px-5 border-b border-[#1E293B] gap-2.5">
          <span className="font-bold text-sm tracking-tight text-white">PAPER5</span>
          <span className="text-xs text-[#64748B]">Admin</span>
        </div>

        {/* Navigation List */}
        <nav className="p-2 space-y-0.5">
          {MODULES.map((m) => {
            const Icon = m.icon
            const isActive = currentModule === m.id
            return (
              <button
                key={m.id}
                onClick={() => onSelectModule(m.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                  isActive
                    ? 'bg-[#161F30] text-white'
                    : 'text-[#8DA0BA] hover:text-white hover:bg-[#111723]'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-[#64748B]'}`} />
                <span>{m.name}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Admin Profile & Logout */}
      <div className="p-3 border-t border-[#1E293B]">
        <div className="flex items-center justify-between p-2 rounded-md bg-[#0F1420] border border-[#1A2333]">
          <div className="overflow-hidden">
            <div className="text-xs font-medium text-white truncate max-w-[120px]">
              {adminProfile?.email || 'admin@paper5.co'}
            </div>
            <div className="text-[11px] text-[#64748B] capitalize">
              {adminProfile?.role || 'Owner'}
            </div>
          </div>
          <button
            onClick={onLogout}
            title="Sign out"
            className="p-1 rounded text-[#64748B] hover:text-rose-400 hover:bg-[#182030] transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  )
}
