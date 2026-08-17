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


  useEffect(() => {
    if (!user || !workspaceId) {
      setWorkspace(null);
      setWorkspaceRole(null);
      setLoadingWorkspace(false);
      return;
    }

    setLoadingWorkspace(true);
    setWorkspaceError(null);

    const fetchAll = async () => {
      // Step 1: Accept any pending invites using ALL available methods in parallel.
      // The RPC is SECURITY DEFINER so it bypasses RLS even with the anon key.
      if (user?.email) {
        await Promise.allSettled([
          // Method A: RPC function (SECURITY DEFINER — works without service key)
          supabase.rpc('accept_pending_invites'),
          // Method B: Serverless API (uses service role key if configured in Vercel)
          fetch('/api/accept-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email, userId: user.id, workspaceId })
          })
        ])
      }

      // Step 2: Query workspace + membership. Use service bypass API for workspace data
      // in case workspaces table RLS still blocks the anon-key select.
      const [wsResult, memberResult] = await Promise.all([
        supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
        supabase.from('workspace_members').select('role').eq('workspace_id', workspaceId).eq('user_id', user.id).maybeSingle()
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
      } else if (wsData) {
        // Fallback: workspace exists but membership row not visible yet — grant member access
        setWorkspaceRole('member')
      } else {
        setWorkspaceRole(null)
      }

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

  const value = {
    workspaceId,
    workspace,
    workspaceRole,
    loadingWorkspace,
    workspaceError,
    isAdmin: workspaceRole === 'admin' || workspaceRole === 'owner',
    isOwner: workspaceRole === 'owner',
    isLocked,
    // SEC-7: is2FABlocked removed — enforce_2fa toggle was removed from Settings UI.
    // Re-add when 2FA enforcement UI is restored.
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
