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

    const fetchAll = async () => {
      // Step 1: Accept any pending invites via serverless API (uses service role key to bypass RLS)
      if (user?.email) {
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
        supabase.from('workspace_members').select('role, permissions').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle()
      ])

      // Step 3: If workspace still null due to RLS, try fetching it via the service API
      let wsData = wsResult.data
      if (!wsData && !wsResult.error) {
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
      } else if (wsResult.error) {
        setWorkspaceError(wsResult.error.message)
      } else {
        setWorkspace(null)
        setWorkspaceError('Workspace not found')
      }

      if (memberResult?.data) {
        setWorkspaceRole(memberResult.data.role)
        setUserPermissions(Array.isArray(memberResult.data.permissions) ? memberResult.data.permissions : [])
      } else if (wsData) {
        // Fallback: workspace exists but membership row not visible yet — grant member access
        setWorkspaceRole('member')
        setUserPermissions([])
      } else {
        setWorkspaceRole(null)
        setUserPermissions([])
      }

      // Query serverless API to ensure accurate enriched permissions
      try {
        const memResp = await fetch(`/api/workspace-members?workspaceId=${encodeURIComponent(workspaceId)}`)
        if (memResp.ok) {
          const memJson = await memResp.json()
          const myMember = (memJson?.members || []).find(m => m.id === user.id || m.email?.toLowerCase() === user.email?.toLowerCase())
          if (myMember) {
            if (myMember.role) setWorkspaceRole(myMember.role)
            if (Array.isArray(myMember.permissions)) setUserPermissions(myMember.permissions)
          }
        }
      } catch (_) {}

      setLoadingWorkspace(false)
    }

    const channelW = supabase.channel(`public:workspaces:id=eq.${workspaceId}:ws:${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspaces', filter: `id=eq.${workspaceId}` }, () => fetchAll())
      .subscribe()

    const channelM = supabase.channel(`public:workspace_members:workspace_id=eq.${workspaceId}_user_id=eq.${user.id}:ws:${Math.random().toString(36).substring(7)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'workspace_members', filter: `workspace_id=eq.${workspaceId}` }, (payload) => {
        if (payload.new && payload.new.user_id === user.id) fetchAll()
      })
      .subscribe()

    fetchAll()

    return () => {
      supabase.removeChannel(channelW)
      supabase.removeChannel(channelM)
    }
  }, [user, workspaceId]);

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

  const isAdminOrOwner = workspaceRole === 'admin' || workspaceRole === 'owner'

  const hasPermission = (permission) => {
    if (isAdminOrOwner) return true
    if (!permission) return true
    const perms = Array.isArray(userPermissions) ? userPermissions : []
    if (permission === 'deadlines.manage' || permission === 'deadlines.create' || permission === 'tasks.create' || permission === 'sprints.manage') {
      return perms.includes('sprints_and_tasks') || perms.includes('deadlines.manage') || perms.includes('sprints.manage') || perms.includes('deadlines.create') || perms.includes('tasks.create')
    }
    if (permission === 'meetings.manage') {
      return perms.includes('meetings.manage')
    }
    if (permission === 'teamSettings.manage' || permission === 'roles.manage' || permission === 'settings.manage') {
      return perms.includes('settings_and_roles') || perms.includes('teamSettings.manage') || perms.includes('roles.manage')
    }
    return perms.includes(permission)
  }

  const canAddKanbanItems = hasPermission('deadlines.manage') || hasPermission('deadlines.create')

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
    isLocked,
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
