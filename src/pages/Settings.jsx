import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { Navigate } from 'react-router-dom'
import { useWorkspace } from '../lib/WorkspaceContext'
import { useAuth } from '../lib/AuthContext'
import {
  subscribeWorkspaceMembers,
  subscribeInvites,
  updateWorkspaceSettings,
  changeMemberRole,
  removeMember,
  cancelInvite,
  createInvite,
  updateMemberPermissions
} from '../lib/workspaces'

import Breadcrumbs from '../components/Breadcrumbs'
import NavTabs from '../components/NavTabs'
import UserMenu from '../components/UserMenu'
import PricingModal from '../components/PricingModal'
import InvoicesModal from '../components/InvoicesModal'
import './Dashboard.css'
import './Settings.css'
import CapacityBanner from '../components/CapacityBanner'
import { checkMemberCapacity } from '../lib/plans'
import AlertModal from '../components/ui/AlertModal'
import ConfirmModal from '../components/ui/ConfirmModal'
import DeleteWorkspaceModal from '../components/ui/DeleteWorkspaceModal'
import {
  TEAM_SIZE_OPTIONS,
  WORKFLOWS,
  getRecommendedWorkflow,
  getUnlockedWorkflowsForPlan,
  isWorkflowUnlocked,
  getWorkflowById
} from '../lib/workflows'

function SettingsIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  )
}

function BillingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="5" width="20" height="14" rx="2" ry="2"/>
      <line x1="2" y1="10" x2="22" y2="10"/>
    </svg>
  )
}

function UsersIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
    </svg>
  )
}

function ShieldIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"></line>
      <line x1="8" y1="12" x2="21" y2="12"></line>
      <line x1="8" y1="18" x2="21" y2="18"></line>
      <line x1="3" y1="6" x2="3.01" y2="6"></line>
      <line x1="3" y1="12" x2="3.01" y2="12"></line>
      <line x1="3" y1="18" x2="3.01" y2="18"></line>
    </svg>
  )
}

function CodeIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"></polyline>
      <polyline points="8 6 2 12 8 18"></polyline>
    </svg>
  )
}

function WarningIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
      <line x1="12" y1="9" x2="12" y2="13"/>
      <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
  )
}

export default function Settings() {
  const { workspaceId, workspace, isAdmin, isOwner } = useWorkspace()
  const { user, userData } = useAuth()
  
  const [activeTab, setActiveTab] = useState('general')
  const [alertMessage, setAlertMessage] = useState(null)
  const [isDeleteWorkspaceModalOpen, setIsDeleteWorkspaceModalOpen] = useState(false)
  
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  
  const [workspaceName, setWorkspaceName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)
  
  const [wsSettings, setWsSettings] = useState({
    session_timeout: 60,
    timezone: 'UTC',
    date_format: 'MM/DD/YYYY',
    retention_days: 90,
    strict_auditing: false,
    strict_passwords: false
  })
  const [savingSettings, setSavingSettings] = useState(false)
  
  // API Keys
  const [apiKeys, setApiKeys] = useState([])
  const [newApiKey, setNewApiKey] = useState(null)
  const [showNewApiKey, setShowNewApiKey] = useState(false)
  const [editingKeyId, setEditingKeyId] = useState(null)
  const [editingKeyName, setEditingKeyName] = useState('')

  // ConfirmModal state — replaces all window.confirm / window.prompt
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'default',
    requiresTyping: null,
    onConfirm: null,
  })
  const openConfirm = (opts) => setConfirmModal({ isOpen: true, confirmText: 'Confirm', cancelText: 'Cancel', variant: 'default', requiresTyping: null, ...opts })
  const closeConfirm = () => setConfirmModal(prev => ({ ...prev, isOpen: false, onConfirm: null }))
  
  const handleSaveAdvancedSettings = async (e) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      await updateWorkspaceSettings(workspaceId, { settings: wsSettings })
      setAlertMessage('Settings saved successfully.')
    } catch (err) {
      setAlertMessage('Failed to save settings.')
    } finally {
      setSavingSettings(false)
    }
  }
  
  const fetchApiKeys = async () => {
    try {
      const { data, error } = await supabase.from('api_keys')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      if (!error && data) setApiKeys(data)
      else if (error) setAlertMessage('Failed to load API keys.')
    } catch (e) {
      setAlertMessage('Failed to load API keys.')
    }
  }

  const generateApiKey = async () => {
    try {
      const rawValues = new Uint32Array(8)
      window.crypto.getRandomValues(rawValues)
      const rawToken = 'sk_live_' + Array.from(rawValues, dec => dec.toString(16).padStart(8, '0')).join('')
      
      const encoder = new TextEncoder()
      const dataBuffer = encoder.encode(rawToken)
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', dataBuffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
      
      const { data, error } = await supabase.from('api_keys').insert({
        workspace_id: workspaceId,
        name: 'New API Key',
        token_hash: tokenHash,
        created_by: user.id
      }).select().single()
      
      if (error) throw error
      setApiKeys([data, ...apiKeys])
      setNewApiKey(rawToken)
      setShowNewApiKey(false)
    } catch (err) {
      setAlertMessage('Failed to generate API Key')
    }
  }

  const revokeApiKey = async (id) => {
    try {
      const { data, error } = await supabase.from('api_keys').delete().eq('id', id).eq('workspace_id', workspaceId).select()
      if (error) throw error
      if (!data || data.length === 0) {
        throw new Error('You do not have permission to delete this key, or it does not exist.')
      }
      setApiKeys(apiKeys.filter(k => k.id !== id))
    } catch (err) {
      setAlertMessage('Failed to revoke API Key: ' + err.message)
    }
  }

  const saveKeyName = async (id) => {
    try {
      const { data, error } = await supabase.from('api_keys').update({ name: editingKeyName }).eq('id', id).eq('workspace_id', workspaceId).select()
      if (error) throw error
      if (!data || data.length === 0) throw new Error('Update failed')
      setApiKeys(apiKeys.map(k => k.id === id ? { ...k, name: editingKeyName } : k))
      setEditingKeyId(null)
    } catch (err) {
      setAlertMessage('Failed to rename API Key')
    }
  }

  const handleDownloadBackup = () => {
    const data = {
      workspace: workspace,
      members: members,
      settings: wsSettings,
      exported_at: new Date().toISOString()
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `workspace_backup_${workspaceId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleDownloadAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      if (!data || data.length === 0) {
        setAlertMessage('No audit logs recorded for this workspace yet.')
        return
      }

      const headers = ['id', 'created_at', 'actor_id', 'action', 'resource', 'metadata']
      const csvRows = [
        headers.join(','),
        ...data.map(row => [
          row.id,
          `"${row.created_at || ''}"`,
          `"${row.actor_id || ''}"`,
          `"${row.action || ''}"`,
          `"${row.resource || ''}"`,
          `"${JSON.stringify(row.metadata || {}).replace(/"/g, '""')}"`
        ].join(','))
      ]
      
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `audit_report_${workspaceId}_${new Date().toISOString().slice(0,10)}.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Failed to export audit logs:', err)
      setAlertMessage('Failed to download audit report: ' + (err.message || 'Unknown error'))
    }
  }
  
  useEffect(() => {
    if (workspace && workspace.settings) {
      setWsSettings(prev => ({ ...prev, ...workspace.settings }))
    }
  }, [workspace])

  
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteSendEmail, setInviteSendEmail] = useState(true)

  const handleEmailChange = (e) => {
    const val = e.target.value
    setInviteEmail(val)
    if (val && !invitePassword) {
      // SEC-4: Use crypto.getRandomValues for invite passwords
      const arr = new Uint8Array(12)
      crypto.getRandomValues(arr)
      setInvitePassword(Array.from(arr, b => b.toString(16).padStart(2,'0')).join('').slice(0,12) + 'aA1!')
    } else if (!val) {
      setInvitePassword('')
    }
  }
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [generatedLink, setGeneratedLink] = useState('')
  const [billingLoading, setBillingLoading] = useState(false)

  const [exporting, setExporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [ownerCount, setOwnerCount] = useState(0)

  const [invitePermissions, setInvitePermissions] = useState([])
  const [selectedMembers, setSelectedMembers] = useState([])
  
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)
  const [isInvoicesModalOpen, setIsInvoicesModalOpen] = useState(false)

  const AVAILABLE_PERMISSIONS = [
    { id: 'sprints.manage', label: 'Manage Sprints' },
    { id: 'deadlines.manage', label: 'Manage Deadlines' },
    { id: 'meetings.manage', label: 'Manage Meetings' },
    { id: 'roles.manage', label: 'Manage Roles' },
    { id: 'teamSettings.manage', label: 'Manage Team Settings' },
    { id: 'onboarding.manage', label: 'Manage Onboarding' }
  ]

  useEffect(() => {
    if (workspace) setWorkspaceName(workspace.name || '')
  }, [workspace])

  useEffect(() => {
    if (workspaceId) {
      const unsub = subscribeWorkspaceMembers(workspaceId, (m) => {
        setMembers(m)
        setOwnerCount(m.filter(x => x.role === 'owner').length)
      })
      const unsubInvites = subscribeInvites(workspaceId, setInvites)
      return () => {
        unsub()
        unsubInvites()
      }
    }
  }, [workspaceId, user?.uid])

  const isAdminOrOwner = isAdmin || isOwner

  useEffect(() => {
    if (activeTab === 'developer' && isAdminOrOwner) {
      fetchApiKeys()
    }
  }, [activeTab, workspaceId, isAdminOrOwner])
  
  const planId = workspace?.billing_plan_id || workspace?.billing?.planId || 'free'
  const maxMembers = (planId === 'free' || planId === 'starter') ? 3 : planId === 'team' ? 7 : 'unlimited'

  if (isAdmin === false) {
    return <Navigate to={`/${workspaceId}`} replace />
  }

  const handleCancelSubscription = () => {
    openConfirm({
      title: 'Cancel Subscription',
      message: 'Are you sure you want to cancel your subscription? This will apply to all your workspaces and you will lose access to paid features.',
      confirmText: 'Yes, Cancel',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm()
        setBillingLoading(true)
        try {
          const { data, error } = await supabase.functions.invoke('cancel-razorpay-subscription')
          if (error) throw error
          if (data?.error) throw new Error(data.error)
          window.location.reload()
        } catch (err) {
          setAlertMessage('Failed to cancel subscription. Please try again.')
        } finally {
          setBillingLoading(false)
        }
      }
    })
  }

  const handleSaveName = async (e) => {
    e.preventDefault()
    if (!isAdminOrOwner) return
    setSavingName(true)
    try {
      await updateWorkspaceSettings(workspaceId, { name: workspaceName })
      setNameSuccess(true)
      setTimeout(() => setNameSuccess(false), 2000)
    } catch (err) {
      setAlertMessage('Failed to save workspace name. Please try again.')
    } finally {
      setSavingName(false)
    }
  }

  const handleCreateInvite = async (e) => {
    e.preventDefault()

    setInviteError('')
    setGeneratedLink('')

    const capacity = checkMemberCapacity(planId, members.length)
    if (capacity.overCapacity) {
      setInviteError(`Seat limit reached (${capacity.limit} members max for the ${planId} plan). Please upgrade to Scale to invite more members.`)
      return
    }

    setInviting(true)
    try {
      await createInvite(workspaceId, inviteEmail, inviteRole, inviteRole === 'member' ? invitePermissions : [], invitePassword, inviteSendEmail)
      setAlertMessage('Invitation successfully dispatched.')
      setInviteEmail('')
      setInvitePassword('')
      setInviteSendEmail(true)
    } catch (err) {
      setInviteError('Unable to dispatch the invitation email. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  const toggleInvitePermission = (permId) => {
    setInvitePermissions(prev => 
      prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
    );
  }

  const toggleMemberPermission = async (memberUid, currentPermissions, permId) => {
    const newPerms = (currentPermissions || []).includes(permId)
      ? (currentPermissions || []).filter(p => p !== permId)
      : [...(currentPermissions || []), permId];
    try {
      await updateMemberPermissions(workspaceId, memberUid, newPerms);
    } catch (err) {
      setAlertMessage('Failed to update member permissions');
    }
  }

  const handleBulkResend = () => {
    if (selectedMembers.length === 0) return
    openConfirm({
      title: 'Resend Credentials',
      message: `Resend credentials to ${selectedMembers.length} pending invite(s)? Each member will receive a new temporary password.`,
      confirmText: 'Resend',
      variant: 'warning',
      onConfirm: async () => {
        closeConfirm()
        for (const memberId of selectedMembers) {
          const inv = invites.find(i => i.id === memberId)
          if (inv && (inv.sent_count || 0) < 3) {
            try {
              const arr = new Uint8Array(12)
              crypto.getRandomValues(arr)
              const newPwd = Array.from(arr, b => b.toString(16).padStart(2,'0')).join('').slice(0,12) + 'aA1!'
              await createInvite(workspaceId, inv.email, inv.role, inv.permissions || [], newPwd, true)
            } catch (e) {
              setAlertMessage(`Failed to resend to ${inv.email}`)
            }
          }
        }
        setAlertMessage('Emails successfully dispatched to selected pending invites.')
        setSelectedMembers([])
      }
    })
  }

  const handleIndividualResend = (inv) => {
    if ((inv.sent_count || 0) >= 3) {
      setAlertMessage('Email limit reached for this user.')
      return
    }
    openConfirm({
      title: 'Resend Credentials',
      message: `Resend a new temporary password to ${inv.email}?`,
      confirmText: 'Resend',
      variant: 'warning',
      onConfirm: async () => {
        closeConfirm()
        try {
          const arr = new Uint8Array(12)
          crypto.getRandomValues(arr)
          const newPwd = Array.from(arr, b => b.toString(16).padStart(2,'0')).join('').slice(0,12) + 'aA1!'
          await createInvite(workspaceId, inv.email, inv.role, inv.permissions || [], newPwd, true)
          setAlertMessage(`Credentials resent successfully to ${inv.email}`)
        } catch (e) {
          setAlertMessage('Failed to resend email')
        }
      }
    })
  }

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedMembers(invites.filter(i => (i.sent_count || 0) < 3).map(i => i.id))
    } else {
      setSelectedMembers([])
    }
  }

  const handleRoleChange = async (memberUid, currentRole, newRole) => {
    if (currentRole === 'owner' && newRole !== 'owner' && ownerCount <= 1) {
      setAlertMessage('Access violation: Cannot demote the primary workspace owner.')
      return
    }
    try {
      await changeMemberRole(workspaceId, memberUid, newRole)
    } catch (err) {
      setAlertMessage('Failed to change member role. Please try again.')
    }
  }

  const handleRemoveMember = (memberUid, role) => {
    if (role === 'owner' && ownerCount <= 1) {
      setAlertMessage('Access violation: Cannot remove the primary workspace owner.')
      return
    }
    openConfirm({
      title: 'Remove Member',
      message: 'Are you sure you want to remove this member from the workspace? They will lose access immediately.',
      confirmText: 'Remove',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm()
        try {
          await removeMember(workspaceId, memberUid)
        } catch (err) {
          setAlertMessage('Unable to process member removal. Please try again.')
        }
      }
    })
  }

  const handleExportData = async () => {
    setExporting(true)
    try {
      const { data, error } = await supabase.functions.invoke('export-workspace-data', { body: { workspaceId } })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `workspace_export_${workspaceId}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setAlertMessage('Data export failed. Please verify your connection and try again.')
    } finally {
      setExporting(false)
    }
  }

  const handleDeleteWorkspace = () => {
    setIsDeleteWorkspaceModalOpen(true)
  }

  const handleConfirmDeleteWorkspace = async () => {
    setIsDeleteWorkspaceModalOpen(false)
    setDeleting(true)
    try {
      const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId)
      if (error) throw error
      window.location.href = '/'
    } catch (err) {
      setAlertMessage('System error: Unable to complete workspace deletion.')
      setDeleting(false)
    }
  }

  const handleSelectPlan = async (newPlanId) => {
    try {
      await updateWorkspaceSettings(workspaceId, { billing_plan_id: newPlanId })
      setSavedFlash(true)
      setTimeout(() => setSavedFlash(false), 3000)
      setIsPricingModalOpen(false)
      const planName = newPlanId.charAt(0).toUpperCase() + newPlanId.slice(1)
      setAlertMessage(`Workspace plan successfully updated to ${planName}! All existing data and team members are safely retained in your workspace.`)
    } catch (err) {
      console.error(err)
      setAlertMessage('Failed to update workspace plan. Please try again.')
    }
  }

  return (
    <div className="dash">
      <header className="dash-header">
        <div className="dash-header-inner">
          <div className="dash-brand">
            <span className="dash-brand-dot" />
            <span className="mono">Paper5 <span className="dash-brand-sub" style={{ whiteSpace: "nowrap" }}>{workspace?.name ? `| ${workspace.name}` : ''}</span></span>
          </div>
          <div className="dash-header-actions">
            <NavTabs />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="dash-body" style={{ maxWidth: '900px' }}>
        <div className="settings-layout">
          {/* Sidebar Nav */}
          <aside className="settings-sidebar">
            <button 
              className={`settings-nav-item ${activeTab === 'general' ? 'settings-nav-item--active' : ''}`}
              onClick={() => setActiveTab('general')}
            >
              <SettingsIcon />
              <span className="tooltip">General</span>
            </button>
            {isAdminOrOwner && (
              <>
                <button 
                  className={`settings-nav-item ${activeTab === 'security' ? 'settings-nav-item--active' : ''}`}
                  onClick={() => setActiveTab('security')}
                >
                  <ShieldIcon />
                  <span className="tooltip">Security</span>
                </button>
                <button 
                  className={`settings-nav-item ${activeTab === 'developer' ? 'settings-nav-item--active' : ''}`}
                  onClick={() => setActiveTab('developer')}
                >
                  <CodeIcon />
                  <span className="tooltip">Developer</span>
                </button>
                <button 
                  className={`settings-nav-item ${activeTab === 'billing' ? 'settings-nav-item--active' : ''}`}
                  onClick={() => setActiveTab('billing')}
                >
                  <BillingIcon />
                  <span className="tooltip">Billing</span>
                </button>
              </>
            )}
            <button 
              className={`settings-nav-item ${activeTab === 'members' ? 'settings-nav-item--active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              <UsersIcon />
              <span className="tooltip">Members</span>
            </button>
            
            {isOwner && (
              <button 
                className={`settings-nav-item settings-nav-item--danger ${activeTab === 'danger' ? 'settings-nav-item--active' : ''}`}
                onClick={() => setActiveTab('danger')}
              >
                <WarningIcon />
                <span className="tooltip">Danger Zone</span>
              </button>
            )}
          </aside>

          {/* Main Content Area */}
          <div className="settings-content-area">
            {activeTab === 'general' && (
              <div className="settings-section">
                <h2>Workspace General</h2>
                <form onSubmit={handleSaveName} className="settings-form" style={{ marginTop: '20px' }}>
                  <div className="form-group">
                    <label>Workspace Name</label>
                    <input
                      type="text"
                      value={workspaceName}
                      onChange={e => setWorkspaceName(e.target.value)}
                      disabled={!isAdminOrOwner}
                    />
                  </div>
                  {isAdminOrOwner && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button type="submit" className="btn-primary" disabled={savingName || !workspaceName.trim()}>
                        {savingName ? 'Saving...' : 'Save Workspace Name'}
                      </button>
                      {nameSuccess && <span style={{ color: 'var(--accent-signal)', fontSize: '13px' }}>Saved!</span>}
                    </div>
                  )}
                </form>

                {/* Agile Workflow & Team Size Section */}
                <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '32px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Agile Workflow & Team Alignment</h3>
                    <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
                      {isAdminOrOwner 
                        ? 'Configure your workspace methodology based on team size and process requirements.'
                        : 'Active workflow configured by workspace admins. Visible to all team members.'}
                    </p>
                  </div>
                  {!isAdminOrOwner && (
                    <span style={{ fontSize: '11px', background: 'var(--bg-layer-2)', color: 'var(--text-tertiary)', padding: '4px 10px', borderRadius: '100px', fontWeight: 600 }}>
                      🔒 Admin Only Edit
                    </span>
                  )}
                </div>

                <form onSubmit={handleSaveAdvancedSettings} className="settings-form" style={{ marginBottom: '32px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="form-group">
                      <label>Target Team Size</label>
                      <select 
                        value={wsSettings.team_size || '2-5'} 
                        disabled={!isAdminOrOwner}
                        onChange={e => {
                          const newSize = e.target.value
                          const rec = getRecommendedWorkflow(newSize)
                          const planId = workspace?.plan || workspace?.billing_plan_id || 'free'
                          const recId = (rec && isWorkflowUnlocked(rec.id, planId)) ? rec.id : (wsSettings.agile_workflow || 'scrum')
                          setWsSettings(prev => ({ ...prev, team_size: newSize, agile_workflow: recId }))
                        }}
                      >
                        {TEAM_SIZE_OPTIONS.map(opt => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-group">
                      <label>Active Agile Workflow</label>
                      <select 
                        value={wsSettings.agile_workflow || 'scrum'} 
                        disabled={!isAdminOrOwner}
                        onChange={e => setWsSettings(prev => ({ ...prev, agile_workflow: e.target.value }))}
                      >
                        {WORKFLOWS.map(wf => {
                          const planId = workspace?.plan || workspace?.billing_plan_id || 'free'
                          const unlocked = isWorkflowUnlocked(wf.id, planId)
                          return (
                            <option key={wf.id} value={wf.id} disabled={!unlocked}>
                              {wf.num}. {wf.name} ({wf.teamSizeLabel}) {!unlocked ? `🔒 [${planId === 'team' ? 'Scale Only' : 'Team/Scale Only'}]` : ''}
                            </option>
                          )
                        })}
                      </select>
                    </div>
                  </div>

                  {/* Active Workflow Card Details */}
                  {(() => {
                    const activeWf = getWorkflowById(wsSettings.agile_workflow || 'scrum')
                    return (
                      <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            ⚡ Active: {activeWf.name}
                          </span>
                          <span style={{ fontSize: '11px', background: 'var(--accent-dim)', color: 'var(--accent)', padding: '2px 10px', borderRadius: '100px', fontWeight: 600 }}>
                            {activeWf.badge}
                          </span>
                        </div>
                        <p style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                          {activeWf.description}
                        </p>
                        <div style={{ fontSize: '12px', color: 'var(--text-tertiary)', fontWeight: 600 }}>
                          Board Columns: {activeWf.columns.map(c => c.title).join(' ➔ ')}
                        </div>
                      </div>
                    )
                  })()}

                  {isAdminOrOwner && (
                    <div style={{ marginTop: '16px' }}>
                      <button type="submit" className="btn-primary" disabled={savingSettings}>
                        {savingSettings ? 'Saving Settings...' : 'Save Workflow & Preferences'}
                      </button>
                    </div>
                  )}
                </form>

                {isAdminOrOwner && (
                  <>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '32px 0' }} />
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>Localization & Preferences</h3>
                    <form onSubmit={handleSaveAdvancedSettings} className="settings-form">
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <div className="form-group">
                          <label>Default Timezone</label>
                          <select value={wsSettings.timezone} onChange={e => setWsSettings({...wsSettings, timezone: e.target.value})}>
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">Eastern Time (ET)</option>
                            <option value="America/Los_Angeles">Pacific Time (PT)</option>
                            <option value="Europe/London">London (GMT)</option>
                            <option value="Asia/Kolkata">India (IST)</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Date Format</label>
                          <select value={wsSettings.date_format} onChange={e => setWsSettings({...wsSettings, date_format: e.target.value})}>
                            <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                            <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                            <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                          </select>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
                        <div className="form-group">
                          <label>Session Idle Timeout</label>
                          <select value={wsSettings.session_timeout} onChange={e => setWsSettings({...wsSettings, session_timeout: parseInt(e.target.value)})}>
                            <option value={15}>15 Minutes</option>
                            <option value={60}>1 Hour</option>
                            <option value={1440}>24 Hours</option>
                            <option value={0}>Never</option>
                          </select>
                        </div>
                        <div className="form-group">
                          <label>Data Retention</label>
                          <select value={wsSettings.retention_days} onChange={e => setWsSettings({...wsSettings, retention_days: parseInt(e.target.value)})}>
                            <option value={30}>30 Days</option>
                            <option value={90}>90 Days</option>
                            <option value={365}>1 Year</option>
                            <option value={0}>Indefinitely</option>
                          </select>
                        </div>
                      </div>

                      <button type="submit" className="btn-ghost" disabled={savingSettings} style={{ marginTop: '16px' }}>{savingSettings ? 'Saving...' : 'Save Preferences'}</button>
                    </form>

                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '32px 0' }} />
                    
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--bg-layer-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                      <div>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '15px' }}>Workspace Backup</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Download a complete JSON dump of your workspace settings and members.</p>
                      </div>
                      <button className="btn-ghost" onClick={handleDownloadBackup}>Download JSON</button>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'security' && isAdminOrOwner && (
              <div className="settings-section">
                <h2>Security & Auditing</h2>
                <form onSubmit={handleSaveAdvancedSettings} className="settings-form" style={{ marginTop: '20px' }}>
                  

                  <div style={{ padding: '16px', background: 'var(--bg-layer-2)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0' }}>Strict Password Complexity</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Mandate 12+ characters and symbols for all users resetting their passwords.</p>
                      </div>
                      <label className="toggle-switch">
                        <input type="checkbox" checked={wsSettings.strict_passwords} onChange={e => setWsSettings({...wsSettings, strict_passwords: e.target.checked})} />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div style={{ padding: '16px', background: 'var(--bg-layer-2)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0' }}>Strict Auditing Mode</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Log every read and write action by all members in a tamper-proof audit trail.</p>
                      </div>
                      <label className="toggle-switch">
                        <input type="checkbox" checked={wsSettings.strict_auditing} onChange={e => setWsSettings({...wsSettings, strict_auditing: e.target.checked})} />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="submit" className="btn-primary" disabled={savingSettings}>{savingSettings ? 'Saving...' : 'Save Security Policies'}</button>
                    <button type="button" className="btn-ghost" onClick={handleDownloadAuditLogs}>
                      📥 Download Audit Report (CSV)
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'developer' && isAdminOrOwner && (
              <div className="settings-section">
                <h2>Developer & API Access</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  Generate API Keys to integrate external CI/CD pipelines, custom scripts, or third-party apps directly with your workspace.
                </p>

                {newApiKey && (
                  <div style={{ padding: '16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', marginBottom: '24px' }}>
                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent-signal)' }}>API Key Generated</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '12px' }}>Please copy this key now. For security reasons, you will not be able to see it again.</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ flex: 1, padding: '12px', background: 'var(--bg-layer-1)', borderRadius: '4px', border: '1px dashed var(--accent-signal)' }}>
                        {showNewApiKey ? newApiKey : 'sk_live_' + '•'.repeat(Math.max(20, newApiKey.length - 8))}
                      </code>
                      <button type="button" className="btn-ghost" onClick={() => setShowNewApiKey(!showNewApiKey)} style={{ padding: '8px', color: 'var(--text-secondary)' }}>
                        {showNewApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                <button className="btn-primary" onClick={generateApiKey}>Generate New API Key</button>

                <div style={{ marginTop: '32px' }}>
                  <h4 style={{ margin: '0 0 12px 0' }}>Active Keys</h4>
                  {apiKeys.length === 0 ? (
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>No API keys generated yet.</p>
                  ) : (
                    <table className="members-table">
                      <thead>
                        <tr>
                                                    <th>Name</th>
                          <th>Secret Key</th>
                          <th>Created</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                          {apiKeys.map((k, i) => (
                            <tr key={i}>
                              <td>
                                {editingKeyId === k.id ? (
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <input 
                                      type="text" 
                                      value={editingKeyName} 
                                      onChange={(e) => setEditingKeyName(e.target.value)}
                                      className="input-base"
                                      style={{ padding: '2px 8px', fontSize: '12px', height: '24px' }}
                                    />
                                    <button className="btn-primary btn-sm" style={{ padding: '0 8px', fontSize: '11px', height: '24px' }} onClick={() => saveKeyName(k.id)}>Save</button>
                                    <button className="btn-ghost btn-sm" style={{ padding: '0 8px', fontSize: '11px', height: '24px' }} onClick={() => setEditingKeyId(null)}>Cancel</button>
                                  </div>
                                ) : (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    {k.name}
                                    <button className="btn-ghost btn-sm" style={{ padding: '2px 6px', fontSize: '10px' }} onClick={() => { setEditingKeyId(k.id); setEditingKeyName(k.name); }}>Edit</button>
                                  </div>
                                )}
                              </td>
                              <td><code style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>sk_live_••••••••••••</code></td>
                              <td>{new Date(k.created_at).toLocaleDateString()}</td>
                              <td><span style={{ fontSize: '11px', background: 'var(--bg-layer-2)', padding: '2px 6px', borderRadius: '4px' }}>Active</span></td>
                              <td><button className="btn-ghost btn-sm" style={{ color: 'var(--accent-critical)' }} onClick={() => revokeApiKey(k.id)}>Revoke</button></td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'billing' && isAdminOrOwner && (
              <div className="settings-section">
                <h2>Billing & Subscription</h2>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-layer-2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: 500, color: 'var(--accent-signal, #0f9d63)' }}>
                      🎉 Launch Special Active: 100% Free Unrestricted Plan
                    </p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                      All workspace limits, member invites, and stack integrations are completely free.
                    </p>
                  </div>
                  <div>
                    <button className="btn-ghost btn-sm" onClick={() => setIsPricingModalOpen(true)}>
                      View Plan Details
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px' }}>
                  <div style={{ padding: '16px', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '14px' }}>Payment Method</h4>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Manage how you pay for this workspace.</p>
                      </div>
                      <button className="btn-ghost btn-sm" disabled title="Payment management coming soon">Update Method</button>
                    </div>
                  </div>
                  <div style={{ padding: '16px', border: '1px solid var(--border-subtle)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '14px' }}>Billing History</h4>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>View and download past invoices.</p>
                      </div>
                      <button className="btn-ghost btn-sm" onClick={() => setIsInvoicesModalOpen(true)}>View Invoices</button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'members' && (
              <div className="settings-section">
                <CapacityBanner 
                  planName={planId.toUpperCase()} 
                  type="members" 
                  count={members.length} 
                  limit={checkMemberCapacity(planId, members.length).limit} 
                  onUpgrade={() => setIsPricingModalOpen(true)} 
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h2 style={{ margin: 0 }}>Members</h2>
                  {selectedMembers.length > 0 && (
                    <button className="btn-primary btn-sm" onClick={handleBulkResend}>
                      Resend Emails ({selectedMembers.length})
                    </button>
                  )}
                </div>
                
                <table className="members-table">
                  <thead>
                    <tr>
                      {/* Checkbox removed from Members */}
                      <th>Email</th>
                      <th>Base Role</th>
                      <th>Permissions</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {members.map(m => (
                      <tr key={m.id}>
                        {/* Checkbox removed from Members row */}
                        <td>{m.email} {m.id === user?.uid && '(You)'}</td>
                        <td>
                          <select
                            value={m.role}
                            onChange={(e) => handleRoleChange(m.id, m.role, e.target.value)}
                            disabled={!isOwner || m.id === user?.uid}
                            style={{ background: 'var(--bg-inset)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '4px 8px', borderRadius: '4px' }}
                          >
                            <option value="owner">Owner</option>
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                          </select>
                        </td>
                        <td>
                          {['owner', 'admin'].includes(m.role) ? (
                            <span style={{ fontSize: '11px', fontWeight: 500, padding: '2px 6px', borderRadius: '4px', background: 'var(--bg-layer-2)', color: 'var(--text-tertiary)' }}>Superuser (All Permissions)</span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                              {AVAILABLE_PERMISSIONS.map(ap => {
                                const hasPerm = (m.permissions || []).includes(ap.id)
                                return (
                                  <label key={ap.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', background: hasPerm ? 'rgba(59, 130, 246, 0.1)' : 'transparent', color: hasPerm ? 'var(--accent-signal)' : 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px', cursor: 'pointer', border: hasPerm ? 'none' : '1px solid var(--border-subtle)' }}>
                                    <input 
                                      type="checkbox" 
                                      style={{ display: 'none' }}
                                      checked={hasPerm}
                                      onChange={() => toggleMemberPermission(m.id, m.permissions, ap.id)}
                                      disabled={!isAdminOrOwner}
                                    />
                                    {ap.label}
                                  </label>
                                )
                              })}
                            </div>
                          )}
                        </td>
                        <td>
                          <button
                            className="btn-ghost btn-sm"
                            style={{ color: 'var(--accent-critical)' }}
                            disabled={!isAdminOrOwner || m.id === user?.uid || (m.role === 'owner' && !isOwner)}
                            onClick={() => handleRemoveMember(m.id, m.role)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {isAdminOrOwner && (
                  <div className="invite-box">
                    <h3>Invite Member</h3>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                      You have used {members.length} of {maxMembers} seats available on your current plan.
                    </p>
                    <form onSubmit={handleCreateInvite} style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px' }}>
                      <div style={{ display: 'flex', gap: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <input
                            type="email"
                            placeholder="Email address"
                            value={inviteEmail}
                            onChange={handleEmailChange}
                            required
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-inset)', color: 'var(--text-primary)' }}
                          />
                        </div>
                        <div>
                          <select
                            value={inviteRole}
                            onChange={e => setInviteRole(e.target.value)}
                            style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--bg-inset)', color: 'var(--text-primary)' }}
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                          </select>
                        </div>
                      </div>
                      
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{ flex: 1, position: 'relative' }}>
                          <span style={{ position: 'absolute', top: '-8px', left: '8px', fontSize: '10px', background: 'var(--bg-layer-1)', padding: '0 4px', color: 'var(--text-secondary)' }}>Generated Password</span>
                          <input
                            type="text"
                            value={invitePassword || 'Enter email first...'}
                            readOnly
                            style={{ width: '100%', padding: '8px 12px', borderRadius: '4px', border: '1px dashed var(--border)', background: 'rgba(0,0,0,0.05)', color: invitePassword ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontFamily: invitePassword ? 'monospace' : 'inherit', fontStyle: invitePassword ? 'normal' : 'italic' }}
                          />
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                          <input type="checkbox" checked={inviteSendEmail} onChange={e => setInviteSendEmail(e.target.checked)} />
                          Send login details via email
                        </label>
                      </div>

                      <button type="submit" className="btn-primary" disabled={inviting} style={{ alignSelf: 'flex-start' }}>
                        {inviting ? 'Sending...' : 'Create & Send Invite'}
                      </button>
                    </form>
                    
                    {inviteRole === 'member' && (
                      <div style={{ marginTop: '12px', padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-layer-1)' }}>
                        <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Permissions</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {AVAILABLE_PERMISSIONS.map(ap => (
                            <label key={ap.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', cursor: 'pointer' }}>
                              <input type="checkbox" checked={invitePermissions.includes(ap.id)} onChange={() => toggleInvitePermission(ap.id)} />
                              {ap.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {inviteError && <div className="form-error" style={{ marginTop: '12px' }}>{inviteError}</div>}
                    
                    {generatedLink && (
                      <div style={{ marginTop: '16px', padding: '12px', background: 'rgba(34, 197, 94, 0.1)', border: '1px solid rgba(34, 197, 94, 0.3)', borderRadius: '6px' }}>
                        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-secondary)' }}>Invite sent successfully!</p>
                      </div>
                    )}

                    {invites.length > 0 && (
                      <div style={{ marginTop: '24px' }}>
                        <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Pending Invites</h4>
                        <table className="members-table">
                          <tbody>
                            {invites.map(inv => (
                              <tr key={inv.id}>
                                <td style={{ width: '40px' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={selectedMembers.includes(inv.id)}
                                    onChange={(e) => {
                                      if (e.target.checked) setSelectedMembers([...selectedMembers, inv.id])
                                      else setSelectedMembers(selectedMembers.filter(id => id !== inv.id))
                                    }}
                                  />
                                </td>
                                <td>{inv.email}</td>
                                <td><span style={{ fontSize: '11px', textTransform: 'uppercase', background: 'var(--bg-layer-2)', padding: '2px 6px', borderRadius: '4px' }}>{inv.role}</span></td>
                                <td>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                                    {inv.role === 'member' && (inv.permissions || []).map(p => {
                                      const pDef = AVAILABLE_PERMISSIONS.find(ap => ap.id === p);
                                      return <span key={p} style={{ fontSize: '10px', background: 'var(--bg-layer-2)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>{pDef ? pDef.label : p}</span>
                                    })}
                                  </div>
                                </td>
                                <td>
                                  <button className="btn-ghost btn-sm" onClick={() => openConfirm({
                                    title: 'Cancel Invite',
                                    message: `Cancel the pending invite for ${inv.email}? They will no longer be able to join.`,
                                    confirmText: 'Cancel Invite',
                                    variant: 'danger',
                                    onConfirm: async () => {
                                      closeConfirm()
                                      try {
                                        await cancelInvite(workspaceId, inv.id)
                                      } catch (err) {
                                        setAlertMessage('Failed to cancel invite. Please try again.')
                                      }
                                    }
                                  })}>Cancel</button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'danger' && isOwner && (
              <div className="settings-section" style={{ border: '1px solid var(--accent-critical)' }}>
                <h2 style={{ color: 'var(--accent-critical)' }}>Danger Zone</h2>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: 500, color: 'var(--text-primary)' }}>Export Workspace Data</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Download a complete JSON export of all your workspace data, including tasks, members, and sprints.</p>
                  </div>
                  <div>
                    <button className="btn-ghost" onClick={handleExportData} disabled={exporting}>
                      {exporting ? 'Exporting...' : 'Export JSON'}
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0' }}>
                  <div>
                    <p style={{ margin: '0 0 4px 0', fontWeight: 500, color: 'var(--text-primary)' }}>Delete Workspace</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Permanently delete this workspace and all its data. This action cannot be undone.</p>
                  </div>
                  <div>
                    <button className="btn-ghost" style={{ color: 'var(--accent-critical)' }} onClick={handleDeleteWorkspace} disabled={deleting}>
                      {deleting ? 'Deleting...' : 'Delete Workspace'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <PricingModal 
        isOpen={isPricingModalOpen} 
        onClose={() => setIsPricingModalOpen(false)} 
        currentPlan={planId}
        onSelectPlan={handleSelectPlan}
      />
      <InvoicesModal 
        isOpen={isInvoicesModalOpen} 
        onClose={() => setIsInvoicesModalOpen(false)} 
        currentPlanId={planId}
      />
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        message={confirmModal.message}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
        variant={confirmModal.variant}
        requiresTyping={confirmModal.requiresTyping}
        onConfirm={confirmModal.onConfirm}
        onCancel={closeConfirm}
      />
      <DeleteWorkspaceModal
        isOpen={isDeleteWorkspaceModalOpen}
        onClose={() => setIsDeleteWorkspaceModalOpen(false)}
        workspaceName={workspace?.name || 'Workspace'}
        memberCount={members?.length || 1}
        onConfirm={handleConfirmDeleteWorkspace}
      />
    </div>
  )
}
