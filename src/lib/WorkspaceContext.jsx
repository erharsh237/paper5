import React, { createContext, useContext, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from './supabase';
import { useAuth } from './AuthContext';
import NotFound from '../pages/NotFound';

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
        const currentPlan = wsData?.billing_plan_id || wsData?.billing?.planId || 'free'
        const limit = (currentPlan === 'free' || currentPlan === 'starter') ? 3 : currentPlan === 'team' ? 7 : Infinity
        setMaxAllowedMembers(limit)

        // Fallback 1: If user is workspace owner directly
        if (!myRole && wsData && (wsData.owner_id === user.id || wsData.created_by === user.id)) {
          myRole = 'owner'
        }

        // Fallback 2: Default to member if user accepted invite or workspace data was loaded for user
        if (!myRole && wsData) {
          myRole = 'member'
        }

        if (myRole) {
          setWorkspaceRole(myRole)
          setUserPermissions(myPerms)
        } else {
          setWorkspaceRole(null)
          setUserPermissions([])
          if (wsData) {
            setWorkspaceError('Access denied: You are not a member of this workspace.')
          }
        }
      } catch (err) {
        console.error('WorkspaceContext fetchAll error:', err)
        setWorkspaceError(err?.message || 'Error loading workspace')
      } finally {
        setLoadingWorkspace(false)
      }
    }

    const channelW = supabase.channel(`public:workspaces:id=eq.${workspaceId}:ws:${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` }, () => fetchAll())
      .subscribe()

    const channelM = supabase.channel(`public:workspace_members:workspace_id=eq.${workspaceId}_user_id=eq.${user.id}:ws:${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` }, () => {
        fetchAll()
      })
      .subscribe()

    const onDataSync = () => fetchAll()
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
          planId: data.billing_plan_id || 'free',
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

  let isLocked = false;
  if (ownerBilling && ownerBilling.planId === 'free') {
    const createdAt = ownerBilling.createdAt ? new Date(ownerBilling.createdAt) : new Date(Date.now() - 1000);
    const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > 7) {
      isLocked = true;
    }
  }

  const planId = workspace?.billing_plan_id || workspace?.billing?.planId || 'free'
  const isCapacityFrozen = typeof maxAllowedMembers === 'number' && maxAllowedMembers !== Infinity && totalSeatsUsed > maxAllowedMembers
  const capacityDetails = {
    totalSeatsUsed,
    maxAllowedMembers,
    excessCount: Math.max(0, totalSeatsUsed - (typeof maxAllowedMembers === 'number' ? maxAllowedMembers : 0)),
    planId: planId.toUpperCase()
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

  const value = {
    workspaceId,
    workspace,
    workspaceRole,
    userPermissions,
    loadingWorkspace,
    workspaceError,
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
  }

  if (!loadingWorkspace && !workspace) {
    return <NotFound />
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
