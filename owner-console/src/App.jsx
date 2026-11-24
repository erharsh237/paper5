import React, { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { ownerApi } from './lib/api'
import { Header } from './components/Header'
import { CommandPalette } from './components/CommandPalette'
import { LoginModal } from './components/LoginModal'
import { Plus } from 'lucide-react'

// Modules
import { CommandCenter } from './modules/CommandCenter'
import { UserManagement } from './modules/UserManagement'
import { WorkspaceManagement } from './modules/WorkspaceManagement'
import { BillingSubscriptions } from './modules/BillingSubscriptions'
import { ProductAnalytics } from './modules/ProductAnalytics'
import { SecurityOperations } from './modules/SecurityOperations'
import { SystemHealth } from './modules/SystemHealth'
import { SupportTickets } from './modules/SupportTickets'
import { FeatureFlags } from './modules/FeatureFlags'
import { PlatformAnnouncements } from './modules/PlatformAnnouncements'
import { GrowthAttribution } from './modules/GrowthAttribution'
import { AdminRbac } from './modules/AdminRbac'

export function App() {
  const [session, setSession] = useState(null)
  const [adminProfile, setAdminProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentModule, setCurrentModule] = useState('command-center')
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)
  const [dbLatency, setDbLatency] = useState(null)

  // Verify Supabase session and load admin identity
  async function checkAuth() {
    setLoading(true)
    try {
      const { data: authData, error: sessionErr } = await supabase.auth.getSession()
      if (sessionErr || !authData?.session) {
        setSession(null)
        setAdminProfile(null)
        return
      }

      // Check if user token is actually valid and not expired
      const { data: userData, error: userError } = await supabase.auth.getUser()
      if (userError || !userData?.user) {
        // Try to refresh token
        const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession()
        if (refreshErr || !refreshed?.session) {
          await supabase.auth.signOut().catch(() => {})
          setSession(null)
          setAdminProfile(null)
          return
        }
        setSession(refreshed.session)
      } else {
        setSession(authData.session)
      }

      try {
        const res = await ownerApi('admins.list')
        const myAdmin = res.admins?.find(a => a.user_id === authData.session.user.id)
        setAdminProfile(myAdmin || { role: 'owner', email: authData.session.user.email })
      } catch (err) {
        if (err.status === 401) {
          await supabase.auth.signOut().catch(() => {})
          setSession(null)
          setAdminProfile(null)
          return
        }
        setAdminProfile({ role: 'owner', email: authData.session.user.email })
      }
    } catch (err) {
      console.error('Auth verification error:', err)
      setSession(null)
      setAdminProfile(null)
    } finally {
      setLoading(false)
    }
  }

  async function pingHealth() {
    try {
      const res = await ownerApi('health.check')
      if (res?.databaseLatencyMs !== undefined) {
        setDbLatency(res.databaseLatencyMs)
      }
    } catch (_) {}
  }

  useEffect(() => {
    checkAuth()

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (!newSession) setAdminProfile(null)
    })

    const latencyInterval = setInterval(pingHealth, 30000)
    return () => {
      authListener?.subscription?.unsubscribe()
      clearInterval(latencyInterval)
    }
  }, [])

  useEffect(() => {
    if (session) {
      pingHealth()
    }
  }, [session])

  async function handleLogout() {
    await supabase.auth.signOut()
    setSession(null)
    setAdminProfile(null)
  }

  function handleRefresh() {
    setIsRefreshing(true)
    setRefreshKey(k => k + 1)
    pingHealth()
    setTimeout(() => setIsRefreshing(false), 500)
  }

  // Greeting helper
  function getGreeting() {
    const hour = new Date().getHours()
    if (hour < 12) return 'Good morning'
    if (hour < 17) return 'Good afternoon'
    return 'Good evening'
  }

  const adminName = adminProfile?.email
    ? adminProfile.email.split('@')[0].replace(/[^a-zA-Z]/g, ' ')
    : 'Admin'
  const capitalizedName = adminName.charAt(0).toUpperCase() + adminName.slice(1)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F0F2F5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-7 h-7 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin"></div>
          <span className="text-xs text-slate-500 font-medium">Loading Paper5...</span>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginModal onLoginSuccess={() => checkAuth()} />
  }

  return (
    <div className="min-h-screen bg-[#F0F2F5] text-slate-900 flex flex-col font-sans">
      {/* Top Floating Header with Center Pill Nav */}
      <Header
        currentModule={currentModule}
        onSelectModule={setCurrentModule}
        adminProfile={adminProfile}
        onLogout={handleLogout}
        onRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        dbLatency={dbLatency}
      />

      {/* Sub-header Banner (Like "Good morning, Elena") */}
      <div className="max-w-[1720px] w-full mx-auto px-6 sm:px-8 lg:px-10 pt-6 pb-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 font-mono">
            Paper5 Platform • {new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-1">
            {getGreeting()}, {capitalizedName}
          </h1>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCommandPaletteOpen(true)}
            className="btn-primary !rounded-full !px-4 !py-1.5 text-xs font-medium shadow-sm hover:shadow"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Action</span>
          </button>
        </div>
      </div>

      {/* Main Content Viewport */}
      <main className="max-w-[1720px] w-full mx-auto px-6 sm:px-8 lg:px-10 py-4 pb-12 flex-1" key={refreshKey}>
        {currentModule === 'command-center' && (
          <CommandCenter onNavigate={setCurrentModule} />
        )}
        {currentModule === 'users' && <UserManagement />}
        {currentModule === 'workspaces' && <WorkspaceManagement />}
        {currentModule === 'billing' && <BillingSubscriptions />}
        {currentModule === 'analytics' && <ProductAnalytics />}
        {currentModule === 'security' && <SecurityOperations />}
        {currentModule === 'health' && <SystemHealth />}
        {currentModule === 'support' && <SupportTickets />}
        {currentModule === 'flags' && <FeatureFlags />}
        {currentModule === 'announcements' && <PlatformAnnouncements />}
        {currentModule === 'growth' && <GrowthAttribution />}
        {currentModule === 'rbac' && <AdminRbac currentAdmin={adminProfile} />}
      </main>

      {/* Global Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onNavigate={setCurrentModule}
      />
    </div>
  )
}
