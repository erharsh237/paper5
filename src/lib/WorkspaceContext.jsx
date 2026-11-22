import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import NotFound from '../pages/NotFound';
import { getPlanLimits, formatPlanBadge } from './plans';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { workspaceId } = useParams();
  const { user } = useAuth();
  const [workspace, setWorkspace] = useState(null);
  const [workspaceRole, setWorkspaceRole] = useState(null);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [workspaceError, setWorkspaceError] = useState(null);
  const [ownerBilling, setOwnerBilling] = useState(null);
  const [aalLevel, setAalLevel] = useState('aal1');
  const [totalSeatsUsed, setTotalSeatsUsed] = useState(0);
  const [maxAllowedMembers, setMaxAllowedMembers] = useState(3);
  
  useEffect(() => {
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      if (data?.currentLevel) setAalLevel(data.currentLevel)
    })
  }, [user])

  useEffect(() => {
    if (!workspace || !workspace.settings) return;
    const timeoutMinutes = workspace.settings.session_timeout;
    if (!timeoutMinutes || timeoutMinutes <= 0) return;

    let timeoutId;
    const resetTimer = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        await supabase.auth.signOut();
        window.location.reload();
      }, timeoutMinutes * 60 * 1000);
    };

    resetTimer();
    const events = ['mousemove', 'keydown', 'scroll', 'click'];
    events.forEach(e => window.addEventListener(e, resetTimer));

    return () => {
      clearTimeout(timeoutId);
      events.forEach(e => window.removeEventListener(e, resetTimer));
    };
  }, [workspace]);


  const [userPermissions, setUserPermissions] = useState([])

  useEffect(() => {
    if (!user || !workspaceId) {
      setWorkspace(null);
      setWorkspaceRole(null);
      setUserPermissions([]);
      setLoadingWorkspace(false);
      return;
    }

    setLoadingWorkspace(true);
    setWorkspaceError(null);

    let checkedInvitesOnce = false

    const fetchAll = async () => {
      try {
        // Step 1: Accept any pending invites once on mount via serverless API (uses service role key to bypass RLS)
        if (user?.email && !checkedInvitesOnce) {
          checkedInvitesOnce = true
          try {
            await fetch('/api/accept-invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: user.email, userId: user.id, workspaceId })
            })
          } catch (apiErr) {
            console.warn('WorkspaceContext accept-invite notice:', apiErr)
          }
        }

        // Step 2: Query workspace + membership. Use service bypass API for workspace data
        const [wsResult, memberResult] = await Promise.all([
          supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
          supabase.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle()
        ])

        // Step 3: If workspace still null due to RLS, try fetching it via the service API
        let wsData = wsResult?.data
        if (!wsData && !wsResult?.error) {
          try {
            const resp = await fetch('/api/accept-invite', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: user.email, userId: user.id, workspaceId, fetchWorkspace: true })
            })
            const json = await resp.json()
            if (json?.workspace) wsData = json.workspace
          } catch (_) {}
        }

        if (wsData) {
          setWorkspace(wsData)
          setWorkspaceError(null)
          try {
            localStorage.setItem('current_workspace_id', workspaceId)
            sessionStorage.setItem('current_workspace_id', workspaceId)
          } catch (_) {}
        } else if (wsResult?.error) {
          setWorkspaceError(wsResult.error.message)
        } else {
          setWorkspace(null)
          setWorkspaceError('Workspace not found')
        }

        let myRole = memberResult?.data?.role || null
        let myPerms = []

        // Extract direct permissions from workspace settings
        if (wsData?.settings?.member_permissions) {
          if (wsData.settings.member_permissions[user.id] !== undefined) {
            myPerms = wsData.settings.member_permissions[user.id] || []
          } else if (user.email && wsData.settings.member_permissions[user.email.toLowerCase()] !== undefined) {
            myPerms = wsData.settings.member_permissions[user.email.toLowerCase()] || []
          }
        }

        // Query serverless API (POST) to ensure accurate enriched permissions and verify membership
        let seatCount = 0
        try {
          const memResp = await fetch(`/api/workspace-members?workspaceId=${encodeURIComponent(workspaceId)}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'fetch_members', workspaceId })
          })
          if (memResp.ok) {
            const memJson = await memResp.json()
            const memberList = memJson?.members || []
            seatCount = memberList.length
            const myMember = memberList.find(m => m.id === user.id || m.userId === user.id || (m.email && user.email && m.email.toLowerCase() === user.email.toLowerCase()))
            if (myMember) {
              myRole = myMember.role || myRole || 'member'
              if (Array.isArray(myMember.permissions)) {
                myPerms = myMember.permissions
              }
            }
          }
        } catch (_) {}

        // Fetch pending invites to add to total seats count
        try {
          const { data: invList } = await supabase.from('invites').select('id').eq('workspace_id', workspaceId)
          seatCount += (invList || []).length
        } catch (_) {}

        setTotalSeatsUsed(seatCount)
        const currentPlan = wsData?.billing_plan_id || wsData?.billing?.planId || wsData?.plan || 'pro'
        const planLimits = getPlanLimits(currentPlan)
        setMaxAllowedMembers(planLimits.maxMembers)

        // Fallback 1: If user is workspace owner directly
        if (!myRole && wsData && (wsData.owner_id === user.id || wsData.created_by === user.id)) {
          myRole = 'owner'
        }

        if (myRole) {
          setWorkspaceRole(myRole)
          setUserPermissions(myPerms)
        } else {
          setWorkspaceRole(null)
          setUserPermissions([])
          if (wsData) {
            setWorkspaceError('Access revoked: You are not a member of this workspace.')
          }
          try {
            if (localStorage.getItem('current_workspace_id') === workspaceId) {
              localStorage.removeItem('current_workspace_id')
            }
            if (sessionStorage.getItem('current_workspace_id') === workspaceId) {
              sessionStorage.removeItem('current_workspace_id')
            }
            localStorage.removeItem(`workspace_cache_${workspaceId}`)
          } catch (_) {}
        }
      } catch (err) {
        console.error('WorkspaceContext fetchAll error:', err)
        setWorkspaceError(err?.message || 'Error loading workspace')
      } finally {
        setLoadingWorkspace(false)
      }
    }

    const channelW = supabase.channel(`public:workspaces:id=eq.${workspaceId}:ws:${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` }, (payload) => {
        if (payload?.eventType === 'DELETE') {
          setWorkspace(null)
          setWorkspaceRole(null)
          setWorkspaceError('Workspace has been deleted.')
          try {
            localStorage.removeItem('current_workspace_id')
            sessionStorage.removeItem('current_workspace_id')
            localStorage.removeItem(`workspace_cache_${workspaceId}`)
          } catch (_) {}
        } else {
          fetchAll()
        }
      })
      .subscribe()

    const channelM = supabase.channel(`public:workspace_members:workspace_id=eq.${workspaceId}:ws:${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        if (payload?.eventType === 'DELETE' && (!payload?.old?.user_id || payload?.old?.user_id === user.id)) {
          setWorkspaceRole(null)
          setWorkspaceError('Access revoked: You are no longer a member of this workspace.')
          try {
            localStorage.removeItem('current_workspace_id')
            sessionStorage.removeItem('current_workspace_id')
            localStorage.removeItem(`workspace_cache_${workspaceId}`)
          } catch (_) {}
        }
        fetchAll()
      })
      .subscribe()

    const onDataSync = () => fetchAll()
    const onWorkspaceDeleted = (e) => {
      const delId = e?.detail?.workspaceId
      if (!delId || delId === workspaceId) {
        setWorkspace(null)
        setWorkspaceRole(null)
        setWorkspaceError('Workspace has been deleted.')
        try {
          localStorage.removeItem('current_workspace_id')
          sessionStorage.removeItem('current_workspace_id')
          localStorage.removeItem(`workspace_cache_${workspaceId}`)
        } catch (_) {}
      }
    }

    const onAccessRevoked = (e) => {
      const revWsId = e?.detail?.workspaceId
      if (!revWsId || revWsId === workspaceId) {
        setWorkspaceRole(null)
        setWorkspaceError('Access to this workspace has been revoked.')
        try {
          localStorage.removeItem('current_workspace_id')
          sessionStorage.removeItem('current_workspace_id')
          localStorage.removeItem(`workspace_cache_${workspaceId}`)
        } catch (_) {}
      }
    }

    const onStorageSync = (e) => {
      if (e?.key?.startsWith('sprintos:')) {
        fetchAll()
      }
    }
    const onVisibilityOrFocus = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchAll()
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('sprintos:data-sync', onDataSync)
      window.addEventListener('sprintos:workspace-deleted', onWorkspaceDeleted)
      window.addEventListener('sprintos:access-revoked', onAccessRevoked)
      window.addEventListener('sprintos:permissions-updated', onDataSync)
      window.addEventListener('sprintos:deadlines-updated', onDataSync)
      window.addEventListener('storage', onStorageSync)
      window.addEventListener('focus', onVisibilityOrFocus)
      window.addEventListener('online', onVisibilityOrFocus)
      document.addEventListener('visibilitychange', onVisibilityOrFocus)
    }

    // Resilient background sync heartbeat (active while tab is open, Realtime WebSocket handles live changes)
    const heartbeatTimer = setInterval(() => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchAll()
      }
    }, 60000)

    fetchAll()

    return () => {
      supabase.removeChannel(channelW)
      supabase.removeChannel(channelM)
      clearInterval(heartbeatTimer)
      if (typeof window !== 'undefined') {
        window.removeEventListener('sprintos:data-sync', onDataSync)
        window.removeEventListener('sprintos:workspace-deleted', onWorkspaceDeleted)
        window.removeEventListener('sprintos:access-revoked', onAccessRevoked)
        window.removeEventListener('sprintos:permissions-updated', onDataSync)
        window.removeEventListener('sprintos:deadlines-updated', onDataSync)
        window.removeEventListener('storage', onStorageSync)
        window.removeEventListener('focus', onVisibilityOrFocus)
        window.removeEventListener('online', onVisibilityOrFocus)
        document.removeEventListener('visibilitychange', onVisibilityOrFocus)
      }
    }
  }, [user, workspaceId]);

  // Track live workspace presence for team awareness & admin dashboard
  const [onlineUsers, setOnlineUsers] = useState([])
  const [onlineUserIds, setOnlineUserIds] = useState(new Set())

  useEffect(() => {
    if (!supabase || !workspaceId || !user) return

    const channelName = `p5-workspace-presence-${workspaceId}`
    
    // Safely remove any existing channel with the same topic before re-registering
    try {
      const existing = supabase.getChannels().find(
        (ch) => ch.topic === `realtime:${channelName}` || ch.topic === channelName
      )
      if (existing) {
        existing.untrack()
        supabase.removeChannel(existing)
      }
    } catch (_) {}

    const channel = supabase.channel(channelName, {
      config: { presence: { key: user.id } }
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        try {
          const state = channel.presenceState()
          const uniqueUsersMap = new Map()
          const lookupIds = new Set()

          Object.keys(state).forEach((k) => {
            ;(state[k] || []).forEach((p) => {
              const primaryKey = p.userId || p.email
              if (primaryKey && !uniqueUsersMap.has(primaryKey)) {
                uniqueUsersMap.set(primaryKey, {
                  userId: p.userId,
                  email: (p.email || '').toLowerCase().trim(),
                  name: p.name || 'Workspace Member',
                  avatarUrl: p.avatarUrl || null,
                  role: p.role || 'Member',
                  onlineAt: p.onlineAt || new Date().toISOString()
                })
              }
              if (p.userId) lookupIds.add(p.userId)
              if (p.email) lookupIds.add(p.email.toLowerCase().trim())
            })
          })

          const list = Array.from(uniqueUsersMap.values())
          const currentUserEmail = (user.email || '').toLowerCase().trim()
          if (!uniqueUsersMap.has(user.id) && (!currentUserEmail || !uniqueUsersMap.has(currentUserEmail))) {
            list.unshift({
              userId: user.id,
              email: currentUserEmail,
              name: user.displayName || user.email?.split('@')[0] || 'You',
              avatarUrl: user.photoURL || null,
              role: workspaceRole || 'Owner',
              onlineAt: new Date().toISOString(),
              isCurrent: true
            })
            lookupIds.add(user.id)
            if (currentUserEmail) lookupIds.add(currentUserEmail)
          }

          setOnlineUsers(list)
          setOnlineUserIds(lookupIds)
        } catch (err) {
          console.warn('Presence sync error:', err)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try {
            await channel.track({
              userId: user.id,
              email: (user.email || '').toLowerCase().trim(),
              name: user.displayName || user.email?.split('@')[0] || 'Member',
              role: workspaceRole || 'Member',
              onlineAt: new Date().toISOString()
            })
          } catch (e) {
            console.warn('Workspace presence track notice:', e)
          }
        }
      })

    return () => {
      try {
        channel.untrack()
        supabase.removeChannel(channel)
      } catch (_) {}
    }
  }, [workspaceId, user, workspaceRole])

  useEffect(() => {
    if (!workspace?.created_by) {
      setOwnerBilling(null);
      return;
    }

    const fetchOwner = async () => {
      const { data, error } = await supabase.from('users').select('*').eq('id', workspace.created_by).maybeSingle();
      if (data) {
        setOwnerBilling({
          planId: data.billing_plan_id || 'pro',
          createdAt: data.created_at
        });
      }
    };

    const channel = supabase.channel(`public:users:id=eq.${workspace.created_by}:ws_owner:${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users', filter: `id=eq.${workspace.created_by}` }, payload => {
        fetchOwner();
      })
      .subscribe();

    fetchOwner();

    return () => supabase.removeChannel(channel);
  }, [workspace?.created_by]);

  // Paper5 provides a Free Forever plan for Starter tier — no artificial 7-day lockout
  let isLocked = false;
  if (ownerBilling && ownerBilling.billing_status === 'suspended') {
    isLocked = true;
  }

  // Derive effective workspace plan: checks workspace record, owner tier, and user profile
  const planId = useMemo(() => {
    const rawWsPlan = (workspace?.plan || workspace?.billing_plan_id || workspace?.billing?.planId || '').toLowerCase().trim()
    if (['pro', 'scale', 'enterprise'].includes(rawWsPlan)) return 'pro'
    if (rawWsPlan === 'team') return 'team'
    if (rawWsPlan === 'starter' || rawWsPlan === 'free') return 'starter'

    const ownerPlan = (ownerBilling?.planId || '').toLowerCase().trim()
    if (['pro', 'scale', 'enterprise'].includes(ownerPlan)) return 'pro'
    if (ownerPlan === 'team') return 'team'
    if (ownerPlan === 'starter' || ownerPlan === 'free') return 'starter'

    return rawWsPlan || 'starter'
  }, [workspace?.plan, workspace?.billing_plan_id, workspace?.billing?.planId, ownerBilling?.planId])

  const planBadge = formatPlanBadge(planId)
  const isCapacityFrozen = typeof maxAllowedMembers === 'number' && maxAllowedMembers !== Infinity && totalSeatsUsed > maxAllowedMembers
  const capacityDetails = {
    totalSeatsUsed,
    maxAllowedMembers,
    excessCount: Math.max(0, totalSeatsUsed - (typeof maxAllowedMembers === 'number' ? maxAllowedMembers : 0)),
    planId: planBadge
  }

  const isAdminOrOwner = workspaceRole === 'admin' || workspaceRole === 'owner'

  const hasPermission = (permission) => {
    if (isCapacityFrozen) return false // When capacity is exceeded, permissions are frozen
    if (isAdminOrOwner) return true
    if (!permission) return true
    const perms = Array.isArray(userPermissions) ? userPermissions : []
    if (permission === 'deadlines.manage' || permission === 'deadlines.create' || permission === 'tasks.create' || permission === 'sprints.manage') {
      return perms.includes('sprints_and_tasks') || perms.includes('deadlines.manage') || perms.includes('sprints.manage') || perms.includes('deadlines.create') || perms.includes('tasks.create')
    }
    if (permission === 'meetings.manage') {
      return perms.includes('meetings.manage')
    }
    if (permission === 'teamSettings.manage' || permission === 'roles.manage' || permission === 'settings.manage' || permission === 'settings_and_roles') {
      return perms.includes('settings_and_roles') || perms.includes('teamSettings.manage') || perms.includes('roles.manage')
    }
    return perms.includes(permission)
  }

  const canAddKanbanItems = !isCapacityFrozen && (hasPermission('deadlines.manage') || hasPermission('deadlines.create'))
  const canManageSettings = isAdminOrOwner || hasPermission('settings_and_roles') || hasPermission('teamSettings.manage') || hasPermission('roles.manage')
  const canManageMeetingNotes = !isCapacityFrozen && (isAdminOrOwner || hasPermission('meetings.manage'))

  const updateWorkspacePlan = async (newPlanId) => {
    if (!workspaceId) return
    try {
      const { updateWorkspaceSettings } = await import('./workspaces')
      await updateWorkspaceSettings(workspaceId, {
        plan: newPlanId,
        billing_plan_id: newPlanId
      })
      setWorkspace(prev => prev ? { ...prev, plan: newPlanId, billing_plan_id: newPlanId } : prev)
      const limits = getPlanLimits(newPlanId)
      setMaxAllowedMembers(limits.maxMembers)
    } catch (err) {
      console.error('Failed to update workspace plan:', err)
      throw err
    }
  }

  const value = {
    workspaceId,
    workspace: workspace ? { ...workspace, plan: planId, billing_plan_id: planId } : null,
    workspaceRole,
    userPermissions,
    loadingWorkspace,
    workspaceError,
    planId,
    planBadge,
    isAdmin: isAdminOrOwner,
    isOwner: workspaceRole === 'owner',
    hasPermission,
    canAddKanbanItems,
    canManageSettings,
    canManageMeetingNotes,
    isLocked,
    isCapacityFrozen,
    capacityDetails,
    onlineUsers,
    onlineUserIds,
    onlineCount: Math.max(1, onlineUsers.length),
    is2FABlocked: false,
    updateWorkspacePlan,
  }

  if (!loadingWorkspace && (!workspace || !workspaceRole)) {
    const isDeleted = !workspace
    const title = isDeleted ? 'Workspace Unavailable' : 'Access Revoked'
    const message = isDeleted 
      ? 'This workspace has been permanently deleted or is no longer available. All access has been revoked.'
      : 'Your access to this workspace has been revoked by an administrator or the workspace owner.'

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg, #FAFAFC)',
        padding: '24px',
        fontFamily: 'inherit',
        color: 'var(--text, #1C1D2B)'
      }}>
        <div style={{
          maxWidth: '480px',
          width: '100%',
          background: '#ffffff',
          borderRadius: '16px',
          padding: '36px 28px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.08)',
          border: '1px solid rgba(0, 0, 0, 0.06)'
        }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            margin: '0 auto 18px'
          }}>
            🔒
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', letterSpacing: '-0.02em', color: '#111827' }}>
            {title}
          </h2>
          <p style={{ fontSize: '14px', color: '#6B7280', lineHeight: 1.6, margin: '0 0 24px 0' }}>
            {message}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.removeItem('current_workspace_id')
                  sessionStorage.removeItem('current_workspace_id')
                } catch (_) {}
                window.location.href = '/workspace?picker=true'
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: '8px',
                background: '#09090b',
                color: '#ffffff',
                fontSize: '14px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Choose Another Workspace
            </button>
            <button
              type="button"
              onClick={async () => {
                try {
                  localStorage.clear()
                  sessionStorage.clear()
                  await supabase.auth.signOut()
                } catch (_) {}
                window.location.href = '/login'
              }}
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '8px',
                background: 'transparent',
                color: '#6B7280',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                cursor: 'pointer'
              }}
            >
              Sign out securely
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
