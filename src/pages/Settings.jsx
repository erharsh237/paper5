import { useState, useEffect, useMemo } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Navigate, Link } from 'react-router-dom'
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
  updateMemberPermissions,
  deleteWorkspace
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
import DataExportModal from '../components/DataExportModal'
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
  const { workspaceId, workspace, isAdmin, isOwner, canManageSettings } = useWorkspace()
  const { user, userData, updateUserData } = useAuth()
  
  const [activeTab, setActiveTab] = useState('general')
  const [alertMessage, setAlertMessage] = useState(null)
  const [isDeleteWorkspaceModalOpen, setIsDeleteWorkspaceModalOpen] = useState(false)
  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [editingPermissionsMemberId, setEditingPermissionsMemberId] = useState(null)
  
  const [workspaceName, setWorkspaceName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [nameSuccess, setNameSuccess] = useState(false)
  
  const [wsSettings, setWsSettings] = useState({
    save_data: true,
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
    if (e?.preventDefault) e.preventDefault()
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

  const handleToggleSaveData = async (checked) => {
    const nextSettings = { ...(workspace?.settings || {}), ...wsSettings, save_data: checked }
    setWsSettings(nextSettings)
    try {
      await updateWorkspaceSettings(workspaceId, { settings: nextSettings })
      setAlertMessage(checked ? 'Cloud persistence enabled.' : 'Zero-data retention mode activated.')
    } catch (err) {
      console.error('Failed to update save_data setting:', err)
      setWsSettings(prev => ({ ...prev, save_data: !checked }))
      setAlertMessage('Failed to update persistence setting.')
    }
  }

  const handleToggleStrictPasswords = async (checked) => {
    const nextSettings = { ...(workspace?.settings || {}), ...wsSettings, strict_passwords: checked }
    setWsSettings(nextSettings)
    try {
      await updateWorkspaceSettings(workspaceId, { settings: nextSettings })
      setAlertMessage(checked ? 'Strict password complexity enabled.' : 'Standard password policy restored.')
    } catch (err) {
      console.error('Failed to update strict_passwords:', err)
      setWsSettings(prev => ({ ...prev, strict_passwords: !checked }))
      setAlertMessage('Failed to update password policy.')
    }
  }

  const handleToggleStrictAuditing = async (checked) => {
    const nextSettings = { ...(workspace?.settings || {}), ...wsSettings, strict_auditing: checked }
    setWsSettings(nextSettings)
    try {
      await updateWorkspaceSettings(workspaceId, { settings: nextSettings })
      setAlertMessage(checked ? 'Strict audit logging armed.' : 'Audit logging set to standard.')
    } catch (err) {
      console.error('Failed to update strict_auditing:', err)
      setWsSettings(prev => ({ ...prev, strict_auditing: !checked }))
      setAlertMessage('Failed to update auditing policy.')
    }
  }
  
  const fetchApiKeys = async () => {
    let dbKeys = []
    try {
      const { data, error } = await supabase.from('api_keys')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
      if (!error && Array.isArray(data)) dbKeys = data
    } catch (_) {}

    const settingsKeys = Array.isArray(workspace?.settings?.api_keys) ? workspace.settings.api_keys : []
    
    // Combine DB keys and workspace settings keys, deduplicating by id
    const combined = [...dbKeys]
    for (const sk of settingsKeys) {
      if (!combined.some(k => k.id === sk.id)) {
        combined.push(sk)
      }
    }
    setApiKeys(combined)
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
      
      let newRecord = null
      try {
        const { data, error } = await supabase.from('api_keys').insert({
          workspace_id: workspaceId,
          name: 'New API Key',
          token_hash: tokenHash,
          created_by: user?.id
        }).select().maybeSingle()
        if (!error && data) newRecord = data
      } catch (_) {}
      
      if (!newRecord) {
        newRecord = {
          id: 'key_' + Math.random().toString(36).substring(2, 9),
          workspace_id: workspaceId,
          name: 'New API Key',
          token_hash: tokenHash,
          masked: rawToken.substring(0, 12) + '••••••••' + rawToken.slice(-4),
          created_at: new Date().toISOString()
        }
      }

      // Persist to workspace settings so key list is guaranteed across page reloads
      const currentSaved = Array.isArray(workspace?.settings?.api_keys) ? workspace.settings.api_keys : []
      const updatedSaved = [newRecord, ...currentSaved.filter(k => k.id !== newRecord.id)]
      await updateWorkspaceSettings(workspaceId, {
        settings: { ...(workspace?.settings || {}), api_keys: updatedSaved }
      }).catch(() => {})

      setApiKeys(prev => [newRecord, ...prev.filter(k => k.id !== newRecord.id)])
      setNewApiKey(rawToken)
      setShowNewApiKey(true)
    } catch (err) {
      console.error('generateApiKey error:', err)
      setAlertMessage('Failed to generate API Key')
    }
  }

  const revokeApiKey = async (id) => {
    try {
      try {
        await supabase.from('api_keys').delete().eq('id', id).eq('workspace_id', workspaceId)
      } catch (_) {}

      const currentSaved = Array.isArray(workspace?.settings?.api_keys) ? workspace.settings.api_keys : []
      const updatedSaved = currentSaved.filter(k => k.id !== id)
      await updateWorkspaceSettings(workspaceId, {
        settings: { ...(workspace?.settings || {}), api_keys: updatedSaved }
      }).catch(() => {})

      setApiKeys(prev => prev.filter(k => k.id !== id))
      setNewApiKey(null)
      setShowNewApiKey(false)
      setAlertMessage('API Key revoked successfully.')
    } catch (err) {
      setAlertMessage('Failed to revoke API Key: ' + err.message)
    }
  }

  const saveKeyName = async (id) => {
    try {
      try {
        await supabase.from('api_keys').update({ name: editingKeyName }).eq('id', id).eq('workspace_id', workspaceId)
      } catch (_) {}

      const currentSaved = Array.isArray(workspace?.settings?.api_keys) ? workspace.settings.api_keys : []
      const updatedSaved = currentSaved.map(k => k.id === id ? { ...k, name: editingKeyName } : k)
      await updateWorkspaceSettings(workspaceId, {
        settings: { ...(workspace?.settings || {}), api_keys: updatedSaved }
      }).catch(() => {})

      setApiKeys(prev => prev.map(k => k.id === id ? { ...k, name: editingKeyName } : k))
      setEditingKeyId(null)
    } catch (err) {
      setAlertMessage('Failed to update API Key name')
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
  
  const wsSettingsHash = JSON.stringify(workspace?.settings || {})
  useEffect(() => {
    if (workspace && workspace.settings) {
      setWsSettings(prev => ({ ...prev, ...workspace.settings }))
    }
  }, [wsSettingsHash])

  
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('member')
  const [invitePassword, setInvitePassword] = useState('')
  const [inviteSendEmail, setInviteSendEmail] = useState(true)

  const handleEmailChange = (e) => {
    setInviteEmail(e.target.value)
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
  const [lastCreatedInvite, setLastCreatedInvite] = useState(null)
  
  const [isPricingModalOpen, setIsPricingModalOpen] = useState(false)
  const [isInvoicesModalOpen, setIsInvoicesModalOpen] = useState(false)
  const [isCancelMembershipModalOpen, setIsCancelMembershipModalOpen] = useState(false)
  const [cancellingMembership, setCancellingMembership] = useState(false)

  const handleConfirmCancelMembership = async () => {
    setCancellingMembership(true)
    try {
      const now = new Date()
      const issueDate = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      const expDate = new Date(now)
      expDate.setMonth(expDate.getMonth() + 1)
      const expiryDate = expDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })

      const newInvoice = {
        id: `INV-STARTER-MONTHLY-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        invoiceNumber: `INV-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        date: issueDate,
        rawDate: now.toISOString(),
        expiryDate,
        cycle: 'Monthly (1 Month)',
        plan: 'Starter Plan (Free)',
        planId: 'free',
        changeType: 'Plan Downgrade / Cancellation',
        amount: '$0.00',
        status: 'Paid',
        workspaceName: workspace?.name || 'Workspace'
      }

      const existingInvoices = Array.isArray(workspace?.settings?.invoices) ? workspace.settings.invoices : []
      const updatedInvoices = [newInvoice, ...existingInvoices]

      const updatedSettings = {
        ...(workspace?.settings || {}),
        invoices: updatedInvoices
      }

      await updateWorkspaceSettings(workspaceId, {
        billing_plan_id: 'free',
        billing_status: 'cancelled',
        settings: updatedSettings
      })
      if (typeof updateUserData === 'function') {
        try {
          await updateUserData({ billing_plan_id: 'free', billing_status: 'cancelled' })
        } catch (e) {
          console.warn('Optional updateUserData call skipped:', e)
        }
      }
      setIsCancelMembershipModalOpen(false)
      setAlertMessage('Workspace membership has been cancelled. Your workspace has reverted to the free Starter Tier, and tax receipt has been generated.')
    } catch (err) {
      console.error('Membership cancellation error:', err)
      setAlertMessage('Failed to cancel membership: ' + (err?.message || 'Please try again.'))
    } finally {
      setCancellingMembership(false)
    }
  }

  const AVAILABLE_PERMISSIONS = [
    { 
      id: 'sprints_and_tasks', 
      label: 'Manage Sprints & Tasks',
      keys: ['sprints.manage', 'deadlines.manage', 'sprints_and_tasks']
    },
    { 
      id: 'meetings.manage', 
      label: 'Manage Meeting Notes',
      keys: ['meetings.manage']
    },
    { 
      id: 'settings_and_roles', 
      label: 'Manage Settings & Roles',
      keys: ['teamSettings.manage', 'roles.manage', 'settings_and_roles']
    }
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

  const isAdminOrOwner = isAdmin || isOwner || canManageSettings

  useEffect(() => {
    if (activeTab === 'developer' && isAdminOrOwner) {
      fetchApiKeys()
    }
  }, [activeTab, workspaceId, isAdminOrOwner])
  
  const planId = workspace?.billing_plan_id || workspace?.billing?.planId || 'free'
  const maxMembers = (planId === 'free' || planId === 'starter') ? 3 : planId === 'team' ? 7 : 'unlimited'

  const activeMemberEmails = useMemo(() => {
    return new Set(members.map(m => (m.email || m.users?.email || m.user?.email || '').trim().toLowerCase()).filter(Boolean))
  }, [members])

  const activePendingInvites = useMemo(() => {
    return invites.filter(i => {
      const email = (i.email || '').trim().toLowerCase()
      return email && !activeMemberEmails.has(email)
    })
  }, [invites, activeMemberEmails])

  const usedSeats = members.length + activePendingInvites.length
  const isSeatLimitReached = typeof maxMembers === 'number' && usedSeats >= maxMembers

  // Automatically clean up stale pending invites for members who have already joined
  useEffect(() => {
    if (!workspaceId || invites.length === 0) return
    const memberEmails = new Set(members.map(m => (m.email || m.users?.email || m.user?.email || '').trim().toLowerCase()).filter(Boolean))
    invites.forEach(inv => {
      const invEmail = (inv.email || '').trim().toLowerCase()
      if (invEmail && memberEmails.has(invEmail)) {
        cancelInvite(workspaceId, inv.id, inv.email).catch(() => {})
      }
    })
  }, [workspaceId, members, invites])

  if (!isAdmin && !isOwner && !canManageSettings) {
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

    const cleanE = inviteEmail.trim().toLowerCase()
    if (!cleanE) return

    // 1. Prevent inviting someone who is already an active member
    if (activeMemberEmails.has(cleanE)) {
      setInviteError(`${inviteEmail.trim()} is already an active member of this workspace.`)
      return
    }

    // 2. Prevent duplicate pending invites
    if (activePendingInvites.some(i => (i.email || '').trim().toLowerCase() === cleanE)) {
      setInviteError(`An active invitation has already been sent to ${inviteEmail.trim()}.`)
      return
    }

    // 3. Seat capacity check
    const capacity = checkMemberCapacity(planId, usedSeats)
    if (capacity.overCapacity || (typeof maxMembers === 'number' && usedSeats >= maxMembers)) {
      setInviteError(`Seat limit reached (${maxMembers} seats max for the ${planId.toUpperCase()} plan). Please upgrade to invite more members.`)
      return
    }

    setInviting(true)
    try {
      const res = await createInvite(workspaceId, inviteEmail, inviteRole, inviteRole === 'member' ? invitePermissions : [], invitePassword, inviteSendEmail)
      
      setInvites(prev => {
        const filtered = (prev || []).filter(i => (i.email || '').toLowerCase().trim() !== cleanE)
        return [...filtered, {
          id: res?.id || 'inv_' + Date.now(),
          workspace_id: workspaceId,
          email: cleanE,
          role: inviteRole,
          permissions: inviteRole === 'member' ? invitePermissions : [],
          created_at: new Date().toISOString()
        }]
      })

      setInviteEmail('')
      setInvitePassword('')
      setInviteSendEmail(true)
    } catch (err) {
      setInviteError(err?.message || 'Unable to dispatch the invitation email. Please try again.')
    } finally {
      setInviting(false)
    }
  }

  const toggleInvitePermission = (permId) => {
    const ap = AVAILABLE_PERMISSIONS.find(p => p.id === permId)
    const keys = ap ? ap.keys : [permId]
    setInvitePermissions(prev => {
      const hasAny = keys.some(k => prev.includes(k))
      return hasAny ? prev.filter(p => !keys.includes(p)) : Array.from(new Set([...prev, ...keys]))
    });
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
    if (!isAdminOrOwner) {
      setAlertMessage('Access denied: You do not have permission to modify member roles.')
      return
    }
    if (currentRole === 'owner' || newRole === 'owner') {
      setAlertMessage('Access violation: Workspace ownership is unique and cannot be modified.')
      return
    }
    const cleanRole = newRole === 'admin' ? 'admin' : 'member'
    try {
      await changeMemberRole(workspaceId, memberUid, cleanRole)
      setMembers(prev => prev.map(m => (m.id === memberUid || m.user_id === memberUid) ? { ...m, role: cleanRole } : m))
      setAlertMessage(`Member role updated to ${cleanRole === 'admin' ? 'Admin' : 'Member'}.`)
    } catch (err) {
      setAlertMessage('Failed to change member role. Please try again.')
    }
  }

  const handleRemoveMember = (memberUid, role, memberEmail) => {
    if (role === 'owner') {
      setAlertMessage('Access violation: The primary workspace owner cannot be removed.')
      return
    }
    if (role === 'admin' && !isOwner) {
      setAlertMessage('Access violation: Only the workspace owner can remove administrators.')
      return
    }
    openConfirm({
      title: 'Remove Member',
      message: 'Are you sure you want to remove this member from the workspace? If this is their only workspace, their account will be deactivated until added back or a plan is purchased.',
      confirmText: 'Remove Member',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm()
        try {
          const resp = await fetch('/api/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: memberUid, email: memberEmail, workspaceId, fullDelete: false })
          })
          const json = await resp.json()
          if (!resp.ok) throw new Error(json.error || 'Failed to remove member')
          
          setAlertMessage(json.accountPurged 
            ? `Member removed. Because they had no other workspaces, their account has been deactivated.`
            : `Member removed from workspace.`
          )
          setMembers(prev => prev.filter(x => x.id !== memberUid && x.user_id !== memberUid))
        } catch (err) {
          console.warn('Remove member fallback:', err)
          try {
            await removeMember(workspaceId, memberUid)
            setMembers(prev => prev.filter(x => x.id !== memberUid && x.user_id !== memberUid))
          } catch (_) {
            setAlertMessage('Unable to process member removal. Please try again.')
          }
        }
      }
    })
  }

  const handleApproveUserDeletion = (member) => {
    openConfirm({
      title: 'Approve Account Deletion',
      message: `Are you sure you want to approve account deletion for ${member.name || member.email}? This will permanently delete their account and personal data across the workspace.`,
      confirmText: 'Delete User Account',
      variant: 'danger',
      onConfirm: async () => {
        closeConfirm()
        try {
          const resp = await fetch('/api/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: member.id || member.user_id, email: member.email, workspaceId, fullDelete: true })
          })
          const json = await resp.json()
          if (!resp.ok) throw new Error(json.error || 'Failed to delete user')
          
          setAlertMessage(`Account for ${member.email} has been permanently deleted.`)
          setMembers(prev => prev.filter(x => x.id !== member.id && x.user_id !== member.id))
        } catch (err) {
          setAlertMessage('Failed to delete account: ' + err.message)
        }
      }
    })
  }

  const handleRejectUserDeletion = async (member) => {
    try {
      const resp = await fetch('/api/request-account-deletion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject', userId: member.id, email: member.email, workspaceId })
      })
      const json = await resp.json()
      if (!resp.ok) throw new Error(json.error || 'Failed to reject request')
      setAlertMessage(`Deletion request for ${member.email} dismissed.`)
    } catch (err) {
      setAlertMessage('Failed to dismiss request: ' + err.message)
    }
  }

  const handleExportData = async () => {
    setExporting(true)
    try {
      const [
        wsRes,
        membersRes,
        deadlinesRes,
        sprintsRes,
        meetingsRes,
        integrationsRes
      ] = await Promise.all([
        supabase.from('workspaces').select('*').eq('id', workspaceId).maybeSingle(),
        supabase.from('workspace_members').select('*, users(email, full_name)').eq('workspace_id', workspaceId),
        supabase.from('deadlines').select('*').eq('workspace_id', workspaceId),
        supabase.from('sprints').select('*').eq('workspace_id', workspaceId),
        supabase.from('meetings').select('*').eq('workspace_id', workspaceId).catch(() => ({ data: [] })),
        supabase.from('integrations_config').select('*').eq('workspace_id', workspaceId).maybeSingle()
      ])

      const fullExport = {
        app: 'SprintOS by Paper5™',
        version: '1.0.0',
        exported_at: new Date().toISOString(),
        exported_by: user?.email || user?.uid,
        workspace: wsRes.data || workspace,
        members: (membersRes.data || []).map(m => ({
          user_id: m.user_id,
          role: m.role,
          email: m.users?.email,
          full_name: m.users?.full_name,
          joined_at: m.joined_at
        })),
        tasks_and_deadlines: deadlinesRes.data || [],
        sprints: sprintsRes.data || [],
        meeting_notes: meetingsRes?.data || [],
        integrations: integrationsRes?.data || {},
      }
      
      const blob = new Blob([JSON.stringify(fullExport, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const wsSlug = (workspace?.name || 'sprintos').toLowerCase().replace(/[^a-z0-9]/g, '_')
      a.download = `sprintos_full_export_${wsSlug}_${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setAlertMessage('Complete workspace data export successfully generated and downloaded!')
    } catch (err) {
      console.error('Data export error:', err)
      setAlertMessage('Data export failed: ' + (err.message || 'Unable to fetch workspace data.'))
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
      await deleteWorkspace(workspaceId)
      window.location.href = '/workspace'
    } catch (err) {
      console.error('Workspace deletion error:', err)
      setAlertMessage(`Unable to delete workspace: ${err?.message || 'Database foreign key constraint or permission error'}`)
      setDeleting(false)
    }
  }

  const handleSelectPlan = async (newPlanId) => {
    try {
      const prevPlan = planId || 'free'
      const cycle = workspace?.billing_interval || 'monthly'
      const now = new Date()
      const issueDate = now.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
      const expDate = new Date(now)
      if (cycle === 'annual') expDate.setFullYear(expDate.getFullYear() + 1)
      else expDate.setMonth(expDate.getMonth() + 1)
      const expiryDate = expDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })

      const getPlanTitle = (id) => {
        const c = (id || '').toLowerCase()
        if (c === 'team') return 'Team Plan'
        if (c === 'scale') return 'Scale Plan'
        return 'Starter Plan'
      }

      const getPlanPrice = () => {
        return '₹0'
      }

      const planName = getPlanTitle(newPlanId)
      const isUpgrade = (newPlanId === 'scale' && prevPlan !== 'scale') || (newPlanId === 'team' && (prevPlan === 'free' || prevPlan === 'starter'))
      const changeType = prevPlan === newPlanId ? 'Plan Renewal' : (isUpgrade ? 'Plan Upgrade' : 'Plan Downgrade')

      const newInvoice = {
        id: `INV-${newPlanId.toUpperCase()}-${cycle.toUpperCase()}-${now.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        invoiceNumber: `INV-${now.getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`,
        date: issueDate,
        rawDate: now.toISOString(),
        expiryDate,
        cycle: cycle === 'annual' ? 'Annual (12 Months)' : 'Monthly (1 Month)',
        plan: `${planName} (${cycle === 'annual' ? 'Annual' : 'Monthly'})`,
        planId: newPlanId,
        changeType,
        amount: getPlanPrice(newPlanId, cycle),
        status: 'Paid',
        workspaceName: workspace?.name || 'Workspace'
      }

      const existingInvoices = Array.isArray(workspace?.settings?.invoices) ? workspace.settings.invoices : []
      const updatedInvoices = [newInvoice, ...existingInvoices]

      const updatedSettings = {
        ...(workspace?.settings || {}),
        invoices: updatedInvoices
      }

      await updateWorkspaceSettings(workspaceId, { 
        billing_plan_id: newPlanId,
        settings: updatedSettings
      })

      setIsPricingModalOpen(false)
      setAlertMessage(`Workspace plan successfully updated to ${planName}! Tax Invoice ${newInvoice.id} added to Billing History.`)
    } catch (err) {
      console.error(err)
      setAlertMessage('Failed to update workspace plan. Please try again.')
    }
  }

  return (
    <div className="dash-root">
      <nav className="dash-sticky-nav">
        <div className="dash-container dash-nav-inner">
          <Link to={`/${workspaceId}`} className="dash-nav-brand">
            <span className="dash-logo-name">SprintOS</span>
            <span className="dash-env-tag">{(workspace?.name || 'TEST').toUpperCase()}</span>
          </Link>

          <NavTabs />

          <div className="dash-nav-actions">
            <UserMenu />
          </div>
        </div>
      </nav>

      <main className="dash-container" style={{ maxWidth: '1000px', padding: '32px 32px 64px' }}>
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
            <button 
              className={`settings-nav-item ${activeTab === 'members' ? 'settings-nav-item--active' : ''}`}
              onClick={() => setActiveTab('members')}
            >
              <UsersIcon />
              <span className="tooltip">Members</span>
            </button>
            {isOwner && (
              <>
                <button 
                  className={`settings-nav-item ${activeTab === 'billing' ? 'settings-nav-item--active' : ''}`}
                  onClick={() => setActiveTab('billing')}
                >
                  <BillingIcon />
                  <span className="tooltip">Billing & Payments</span>
                </button>
                <button 
                  className={`settings-nav-item ${activeTab === 'developer' ? 'settings-nav-item--active' : ''}`}
                  onClick={() => setActiveTab('developer')}
                >
                  <CodeIcon />
                  <span className="tooltip">Developer</span>
                </button>
                <button 
                  className={`settings-nav-item ${activeTab === 'security' ? 'settings-nav-item--active' : ''}`}
                  onClick={() => setActiveTab('security')}
                >
                  <ShieldIcon />
                  <span className="tooltip">Security</span>
                </button>
                <button 
                  className={`settings-nav-item settings-nav-item--danger ${activeTab === 'danger' ? 'settings-nav-item--active' : ''}`}
                  onClick={() => setActiveTab('danger')}
                >
                  <WarningIcon />
                  <span className="tooltip">Danger Zone</span>
                </button>
              </>
            )}
          </aside>

          {/* Main Content Area */}
          <div className="settings-content-area">
            {activeTab === 'general' && (
              <div className="settings-section">
                <h2>Workspace General</h2>
                <form onSubmit={handleSaveName} className="settings-form" style={{ marginTop: '20px' }}>
                  <div className="form-group" style={{ marginBottom: '20px' }}>
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

                    {/* Data Export & Backup Section */}
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '32px 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', background: 'var(--bg-panel)', padding: '20px', borderRadius: '10px', border: '1px solid var(--border)' }}>
                      <div style={{ flex: '1 1 300px' }}>
                        <h3 style={{ margin: '0 0 4px 0', fontSize: '15px', color: 'var(--text-primary)' }}>Data Ownership & Complete PDF Reports</h3>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          Download printable PDF reports and structured data exports for any workspace. Select custom sections including tasks, sprints, meeting notes, and team roster.
                        </p>
                      </div>
                      <button className="btn-primary" onClick={() => setIsExportModalOpen(true)}>
                        📄 Export PDF & Data Reports
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {activeTab === 'security' && isOwner && (
              <div className="settings-section">
                <h2>Security & Auditing</h2>
                <form onSubmit={handleSaveAdvancedSettings} className="settings-form" style={{ marginTop: '20px' }}>
                  

                  <div style={{ padding: '16px', background: 'var(--bg-layer-2)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0' }}>💾 Save Data to Cloud Database</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>
                          {wsSettings.save_data !== false 
                            ? 'Cloud Persistence Active: Workspace items, sprints, and settings are securely stored in the PostgreSQL database.' 
                            : '🔒 Zero-Data Retention Mode Active: Workspace data is kept in browser memory only and will not be stored in the database.'}
                        </p>
                      </div>
                      <label className="toggle-switch">
                        <input type="checkbox" checked={wsSettings.save_data !== false} onChange={e => handleToggleSaveData(e.target.checked)} />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>

                    <div style={{ 
                      padding: '8px 10px', 
                      borderRadius: '6px', 
                      fontSize: '11px', 
                      lineHeight: 1.4,
                      background: wsSettings.save_data !== false ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                      color: wsSettings.save_data !== false ? '#047857' : '#b91c1c',
                      border: wsSettings.save_data !== false ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)'
                    }}>
                      <strong>Disclaimer:</strong> {wsSettings.save_data !== false 
                        ? 'Workspace data is encrypted and backed up daily in our secure cloud database. While automated snapshots and point-in-time recovery are maintained, administrators remain responsible for maintaining local offline backups via Workspace Settings → Export.'
                        : 'Data is stored solely in volatile browser session memory. Closing your tab, clearing cache, or logging out will permanently erase workspace data. Neither Paper5™ nor SprintOS™ will be held responsible or liable for any data loss resulting from Zero-Data Retention Mode.'}
                    </div>
                  </div>

                  <div style={{ padding: '16px', background: 'var(--bg-layer-2)', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0' }}>Strict Password Complexity</h4>
                        <p style={{ margin: 0, fontSize: '12px', color: 'var(--text-secondary)' }}>Mandate 12+ characters and symbols for all users resetting their passwords.</p>
                      </div>
                      <label className="toggle-switch">
                        <input type="checkbox" checked={!!wsSettings.strict_passwords} onChange={e => handleToggleStrictPasswords(e.target.checked)} />
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
                        <input type="checkbox" checked={!!wsSettings.strict_auditing} onChange={e => handleToggleStrictAuditing(e.target.checked)} />
                        <span className="toggle-slider"></span>
                      </label>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button type="submit" className="btn-primary" disabled={savingSettings}>{savingSettings ? 'Saving...' : 'Save Security Policies'}</button>
                    <button type="button" className="btn-ghost" onClick={() => setIsExportModalOpen(true)}>
                      📑 Export Audit Report (PDF / CSV)
                    </button>
                  </div>
                </form>
              </div>
            )}

            {activeTab === 'developer' && isOwner && (
              <div className="settings-section">
                <h2>Developer & API Access</h2>
                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                  Generate API Keys to integrate external CI/CD pipelines, custom scripts, or third-party apps directly with your workspace.
                </p>

                {newApiKey && (
                  <div style={{ position: 'relative', padding: '16px', background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '8px', marginBottom: '24px' }}>
                    <button
                      type="button"
                      onClick={() => setNewApiKey(null)}
                      style={{ position: 'absolute', top: '12px', right: '12px', background: 'transparent', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--text-secondary, #6b7280)', lineHeight: 1 }}
                      title="Dismiss"
                    >
                      &times;
                    </button>
                    <h4 style={{ margin: '0 0 8px 0', color: 'var(--accent-signal)' }}>API Key Generated</h4>
                    <p style={{ margin: '0 0 12px 0', fontSize: '12px' }}>Please copy this key now. For security reasons, you will not be able to see it again after leaving or dismissing.</p>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <code style={{ flex: 1, padding: '12px', background: 'var(--bg-panel)', borderRadius: '4px', border: '1px dashed var(--accent-signal)', color: 'var(--text-primary)', fontFamily: 'monospace', fontWeight: 600, fontSize: '13px', wordBreak: 'break-all' }}>
                        {showNewApiKey ? newApiKey : 'sk_live_' + '•'.repeat(Math.max(20, newApiKey.length - 8))}
                      </code>
                      <button type="button" className="btn-ghost" onClick={() => setShowNewApiKey(!showNewApiKey)} style={{ padding: '8px', color: 'var(--text-secondary)' }} title={showNewApiKey ? 'Hide Key' : 'Reveal Key'}>
                        {showNewApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                      <button 
                        type="button" 
                        className="btn-primary btn-sm" 
                        onClick={() => {
                          navigator.clipboard.writeText(newApiKey)
                          setAlertMessage('API Key copied to clipboard!')
                        }}
                        style={{ padding: '8px 14px', whiteSpace: 'nowrap' }}
                      >
                        📋 Copy Key
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

            {activeTab === 'billing' && isOwner && (
              <div className="settings-section">
                <h2>Billing & Subscription</h2>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--surface-2, #EEF0F9)', padding: '18px 20px', borderRadius: '12px', border: '1px solid var(--border-soft, #EAECF6)' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 800, color: 'var(--text, #1C1D2B)', fontSize: '15px' }}>
                        {planId === 'team' ? 'Team Plan' : planId === 'scale' ? 'Scale Plan' : 'Starter Plan (Launch Special)'}
                      </span>
                      <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', padding: '2px 8px', borderRadius: '100px', fontWeight: 700 }}>
                        Active
                      </span>
                    </div>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted, #6E7091)' }}>
                      Billing Cycle: <strong style={{ color: 'var(--text, #1C1D2B)' }}>{(workspace?.billing_interval === 'annual' ? 'Annual' : 'Monthly')}</strong> · Expiry / Next Renewal: <strong style={{ color: 'var(--accent, #4F46E5)' }}>{new Date(Date.now() + ((workspace?.billing_interval === 'annual' ? 365 : 30) * 24 * 60 * 60 * 1000)).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })}</strong>
                    </p>
                  </div>
                  <div>
                    <button className="dash-btn-accent" style={{ padding: '7px 14px', fontSize: '12.5px' }} onClick={() => setIsPricingModalOpen(true)}>
                      Change Plan
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
                  <div style={{ 
                    padding: '16px', 
                    border: (planId === 'team' || planId === 'scale') ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid var(--border-subtle)', 
                    borderRadius: '8px', 
                    background: (planId === 'team' || planId === 'scale') ? 'rgba(239, 68, 68, 0.03)' : 'var(--bg-layer-2)' 
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', color: (planId === 'team' || planId === 'scale') ? 'var(--accent-critical, #ef4444)' : 'var(--text-primary)' }}>
                          Cancel Membership
                        </h4>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                          {(planId === 'team' || planId === 'scale')
                            ? 'Downgrade workspace tier and cancel subscription membership.' 
                            : 'You are currently on the Free Starter Tier. No active paid subscription to cancel.'}
                        </p>
                      </div>
                      {(planId === 'team' || planId === 'scale') ? (
                        <button 
                          className="btn-ghost btn-sm" 
                          style={{ color: 'var(--accent-critical, #ef4444)', borderColor: 'rgba(239, 68, 68, 0.4)' }}
                          onClick={() => setIsCancelMembershipModalOpen(true)}
                        >
                          Cancel Membership
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', background: 'var(--bg-panel)', border: '1px solid var(--border)', padding: '6px 12px', borderRadius: '6px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          Free Starter Active
                        </span>
                      )}
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
                  count={members.length + invites.length} 
                  limit={checkMemberCapacity(planId, members.length + invites.length).limit} 
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
                
                {/* Deletion Requests Alert Banner */}
                {(() => {
                  const deletionRequests = workspace?.settings?.deletion_requests || {}
                  const pendingDeletionCount = Object.keys(deletionRequests).length
                  if (pendingDeletionCount === 0) return null
                  return (
                    <div style={{
                      marginBottom: '16px',
                      padding: '12px 16px',
                      borderRadius: '8px',
                      background: '#FEF2F2',
                      border: '1px solid #FECACA',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      color: '#DC2626',
                      fontSize: '13px',
                      fontWeight: 600
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>⚠️</span>
                        <span>{pendingDeletionCount} member{pendingDeletionCount !== 1 ? 's have' : ' has'} requested account deletion. Review and approve below.</span>
                      </div>
                    </div>
                  )
                })()}

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
                    {members.map(m => {
                      const deletionRequests = workspace?.settings?.deletion_requests || {}
                      const hasDeletionRequest = !!(
                        deletionRequests[m.id] || 
                        deletionRequests[m.email?.toLowerCase()]
                      )

                      return (
                        <tr key={m.id}>
                          {/* Checkbox removed from Members row */}
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                              <div style={{ fontWeight: 500, fontSize: '13px', color: 'var(--text-primary)' }}>
                                {m.displayLabel || m.email || ('Member (' + (m.id || '').slice(0, 6) + ')')}
                              </div>
                              {hasDeletionRequest && (
                                <span style={{ fontSize: '10.5px', fontWeight: 700, background: '#FEE2E2', color: '#DC2626', padding: '1px 8px', borderRadius: '100px', border: '1px solid #FCA5A5' }}>
                                  Deletion Requested ⚠️
                                </span>
                              )}
                            </div>
                            {m.fullName && m.email && (
                              <div style={{ fontSize: '11px', color: 'var(--text-tertiary)', marginTop: '2px' }}>{m.email}</div>
                            )}
                            {m.id === user?.uid && <span style={{ fontSize: '10px', color: 'var(--text-tertiary)', marginLeft: '6px' }}>(You)</span>}
                          </td>
                          <td>
                            {m.role === 'owner' ? (
                              <span style={{
                                fontSize: '11.5px',
                                fontWeight: 700,
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: 'rgba(79, 70, 229, 0.1)',
                                color: 'var(--accent, #4F46E5)',
                                border: '1px solid rgba(79, 70, 229, 0.25)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}>
                                👑 Owner
                              </span>
                            ) : (
                                <select
                                value={m.role}
                                onChange={(e) => handleRoleChange(m.id || m.user_id, m.role, e.target.value)}
                                disabled={!isAdminOrOwner}
                                style={{
                                  background: 'var(--bg-inset)',
                                  color: 'var(--text-primary)',
                                  border: '1px solid var(--border)',
                                  padding: '4px 8px',
                                  borderRadius: '4px',
                                  cursor: isAdminOrOwner ? 'pointer' : 'not-allowed',
                                  opacity: isAdminOrOwner ? 1 : 0.7
                                }}
                                title={isAdminOrOwner ? 'Change member role' : 'You do not have permission to change member roles'}
                              >
                                <option value="admin">Admin</option>
                                <option value="member">Member</option>
                              </select>
                            )}
                          </td>
                          <td>
                            {['owner', 'admin'].includes(m.role) ? (
                              <span style={{ fontSize: '11px', fontWeight: 600, padding: '3px 10px', borderRadius: '100px', background: 'rgba(16,185,129,0.1)', color: '#059669', border: '1px solid rgba(16,185,129,0.2)' }}>
                                Full access
                              </span>
                            ) : (
                              <div style={{ position: 'relative', display: 'inline-block' }}>
                                {/* Pill Button */}
                                {(() => {
                                  const activeCustomPermsCount = AVAILABLE_PERMISSIONS.filter(ap =>
                                    ap.keys.some(k => (m.permissions || []).includes(k))
                                  ).length
                                  return (
                                    <button
                                      type="button"
                                      disabled={!isAdminOrOwner}
                                      onClick={() => setEditingPermissionsMemberId(editingPermissionsMemberId === m.id ? null : m.id)}
                                      style={{
                                        fontSize: '11.5px',
                                        fontWeight: 600,
                                        padding: '4px 10px',
                                        borderRadius: '100px',
                                        background: activeCustomPermsCount > 0 ? 'var(--accent-dim, #E8E6FB)' : 'var(--surface-2, #EEF0F9)',
                                        color: activeCustomPermsCount > 0 ? 'var(--accent, #4F46E5)' : 'var(--text-secondary, #6E7091)',
                                        border: '1px solid var(--border-soft, #EAECF6)',
                                        cursor: isAdminOrOwner ? 'pointer' : 'default',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                      }}
                                      title="Click to view & edit permissions"
                                    >
                                      <span>{activeCustomPermsCount > 0 ? `${activeCustomPermsCount} Custom Perms` : 'View tasks'}</span>
                                      {isAdminOrOwner && <span style={{ fontSize: '9px', opacity: 0.7 }}>▼</span>}
                                    </button>
                                  )
                                })()}

                                {/* Permissions Dropdown Popover */}
                                {editingPermissionsMemberId === m.id && isAdminOrOwner && (
                                  <div style={{
                                    position: 'absolute',
                                    top: 'calc(100% + 6px)',
                                    left: 0,
                                    zIndex: 100,
                                    background: 'var(--surface, #FFFFFF)',
                                    border: '1px solid var(--border-soft, #EAECF6)',
                                    borderRadius: '12px',
                                    padding: '14px',
                                    boxShadow: '0 8px 24px rgba(30,32,80,0.15)',
                                    minWidth: '240px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px'
                                  }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-soft, #EAECF6)', paddingBottom: '6px' }}>
                                      <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text, #1C1D2B)' }}>Edit Permissions</span>
                                      <span style={{ fontSize: '11px', color: 'var(--muted, #6E7091)' }}>{m.displayLabel || m.email}</span>
                                    </div>

                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      {AVAILABLE_PERMISSIONS.map(ap => {
                                        const currentPerms = m.permissions || []
                                        const hasPerm = ap.keys.some(k => currentPerms.includes(k)) || currentPerms.includes(ap.id)
                                        return (
                                          <label key={ap.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text, #1C1D2B)', cursor: 'pointer' }}>
                                            <input
                                              type="checkbox"
                                              checked={hasPerm}
                                              onChange={async (e) => {
                                                const nextPerms = e.target.checked
                                                  ? Array.from(new Set([...currentPerms, ...ap.keys, ap.id]))
                                                  : currentPerms.filter(p => !ap.keys.includes(p) && p !== ap.id)
                                                
                                                // Optimistic local update
                                                setMembers(prev => prev.map(member => member.id === m.id ? { ...member, permissions: nextPerms } : member))
                                                
                                                // Save to serverless API
                                                await updateMemberPermissions(workspaceId, m.id || m.userId, nextPerms, m.email)
                                              }}
                                            />
                                            <span>{ap.label}</span>
                                          </label>
                                        )
                                      })}
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => setEditingPermissionsMemberId(null)}
                                      style={{
                                        marginTop: '4px',
                                        padding: '6px 12px',
                                        borderRadius: '6px',
                                        background: 'var(--accent, #4F46E5)',
                                        color: '#FFFFFF',
                                        border: 'none',
                                        fontSize: '11.5px',
                                        fontWeight: 700,
                                        cursor: 'pointer'
                                      }}
                                    >
                                      Done
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td>
                            {hasDeletionRequest ? (
                              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <button
                                  type="button"
                                  className="btn-danger btn-sm"
                                  style={{
                                    background: '#DC2626',
                                    color: '#FFFFFF',
                                    border: 'none',
                                    borderRadius: '6px',
                                    padding: '5px 10px',
                                    fontSize: '11.5px',
                                    fontWeight: 700,
                                    cursor: 'pointer'
                                  }}
                                  disabled={!isAdminOrOwner}
                                  onClick={() => handleApproveUserDeletion(m)}
                                  title="Approve and permanently delete user account"
                                >
                                  Approve & Delete
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost btn-sm"
                                  style={{ padding: '4px 8px', fontSize: '11.5px' }}
                                  disabled={!isAdminOrOwner}
                                  onClick={() => handleRejectUserDeletion(m)}
                                  title="Dismiss deletion request"
                                >
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <button
                                className="btn-ghost btn-sm"
                                style={{ color: 'var(--accent-critical)' }}
                                disabled={m.role === 'owner' || (m.role === 'admin' && !isOwner) || m.id === user?.uid || !isAdminOrOwner}
                                onClick={() => handleRemoveMember(m.id || m.user_id, m.role, m.email)}
                              >
                                Remove
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {isAdminOrOwner && (
                  <div className="invite-box" style={{ marginTop: '24px' }}>
                    {isSeatLimitReached ? (
                      <div style={{
                        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
                        border: '1px solid rgba(79, 70, 229, 0.2)',
                        borderRadius: '10px',
                        padding: '18px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '16px'
                      }}>
                        <div style={{ flex: '1 1 300px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '15px' }}>🔒</span>
                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--text, #1E293B)' }}>
                              All {maxMembers} Seats Used
                            </h4>
                            <span style={{
                              fontSize: '11px',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#DC2626',
                              padding: '2px 8px',
                              borderRadius: '6px'
                            }}>
                              {usedSeats} / {maxMembers} filled
                            </span>
                          </div>
                          <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary, #64748B)', lineHeight: 1.5 }}>
                            You have used all {maxMembers} seats available on your current <strong>{planId.toUpperCase()}</strong> plan ({members.length} active member{members.length !== 1 ? 's' : ''}{activePendingInvites.length > 0 ? `, ${activePendingInvites.length} pending invite${activePendingInvites.length !== 1 ? 's' : ''}` : ''}). To invite more team members, please upgrade your plan or free up a seat by canceling a pending invite or removing a member.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="dash-btn-accent"
                          onClick={() => setIsPricingModalOpen(true)}
                          style={{
                            padding: '9px 18px',
                            fontSize: '13px',
                            fontWeight: 700,
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            cursor: 'pointer'
                          }}
                        >
                          <span>⚡</span> Upgrade Plan
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3>Invite Member</h3>
                        <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '12px' }}>
                          You have used {usedSeats} of {maxMembers} seats available on your current plan ({members.length} active member{members.length !== 1 ? 's' : ''}{activePendingInvites.length > 0 ? `, ${activePendingInvites.length} pending invite${activePendingInvites.length !== 1 ? 's' : ''}` : ''}).
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
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                              <input type="checkbox" checked={inviteSendEmail} onChange={e => setInviteSendEmail(e.target.checked)} />
                              Send official email invitation link with 1-click workspace join button
                            </label>
                          </div>

                          <button type="submit" className="btn-primary" disabled={inviting} style={{ alignSelf: 'flex-start' }}>
                            {inviting ? 'Sending...' : 'Create & Send Invite'}
                          </button>
                        </form>
                        
                        {inviteRole === 'member' && (
                          <div style={{ marginTop: '12px', padding: '12px', border: '1px solid var(--border-subtle)', borderRadius: '6px', background: 'var(--bg-layer-1)' }}>
                            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>Permissions</label>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                              {AVAILABLE_PERMISSIONS.map(ap => {
                                const isChecked = ap.keys.some(k => invitePermissions.includes(k)) || invitePermissions.includes(ap.id)
                                return (
                                  <label key={ap.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text, #1C1D2B)', cursor: 'pointer' }}>
                                    <input type="checkbox" checked={isChecked} onChange={() => toggleInvitePermission(ap.id)} />
                                    {ap.label}
                                  </label>
                                )
                              })}
                            </div>
                          </div>
                        )}
                        
                        {inviteError && <div className="form-error" style={{ marginTop: '12px' }}>{inviteError}</div>}
                      </>
                    )}

                    {activePendingInvites.length > 0 && (
                      <div style={{ marginTop: '24px' }}>
                        <h4 style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '8px', textTransform: 'uppercase' }}>Pending Invites</h4>
                        <table className="members-table">
                          <tbody>
                            {activePendingInvites.map(inv => (
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
                                    {inv.role === 'member' && (() => {
                                      const activePerms = AVAILABLE_PERMISSIONS.filter(ap =>
                                        ap.keys.some(k => (inv.permissions || []).includes(k)) ||
                                        (inv.permissions || []).includes(ap.id)
                                      )
                                      if (activePerms.length === 0) {
                                        return (
                                          <span style={{ fontSize: '11px', color: 'var(--text-secondary, #6E7091)' }}>
                                            View tasks
                                          </span>
                                        )
                                      }
                                      return activePerms.map(ap => (
                                        <span
                                          key={ap.id}
                                          style={{
                                            fontSize: '10.5px',
                                            fontWeight: 600,
                                            background: 'var(--accent-dim, #E8E6FB)',
                                            padding: '2px 8px',
                                            borderRadius: '6px',
                                            color: 'var(--accent, #4F46E5)'
                                          }}
                                        >
                                          {ap.label}
                                        </span>
                                      ))
                                    })()}
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
                                      const targetEmail = (inv.email || '').toLowerCase().trim()
                                      setInvites(prev => prev.filter(i => i.id !== inv.id && (i.email || '').toLowerCase().trim() !== targetEmail))
                                      try {
                                        await cancelInvite(workspaceId, inv.id, inv.email)
                                      } catch (err) {
                                        console.error('Cancel invite error:', err)
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
                    <p style={{ margin: '0 0 4px 0', fontWeight: 500, color: 'var(--text-primary)' }}>Export Workspace Data (PDF / Reports)</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>Download formatted PDF reports and data backups for any workspace you manage.</p>
                  </div>
                  <div>
                    <button className="btn-ghost" onClick={() => setIsExportModalOpen(true)}>
                      📄 Export PDF
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
        workspace={workspace}
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
      <DataExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentWorkspaceId={workspaceId}
        currentUser={user}
      />
      <CancelMembershipModal
        isOpen={isCancelMembershipModalOpen}
        onClose={() => setIsCancelMembershipModalOpen(false)}
        onConfirmCancel={handleConfirmCancelMembership}
        loading={cancellingMembership}
      />
    </div>
  )
}

function CancelMembershipModal({ isOpen, onClose, onConfirmCancel, loading }) {
  const [disclaimerChecked, setDisclaimerChecked] = useState(false)

  useEffect(() => {
    if (!isOpen) setDisclaimerChecked(false)
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div 
      className="modal-overlay" 
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 99999,
        padding: '20px'
      }}
    >
      <div 
        className="modal-card" 
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '28px',
          maxWidth: '480px',
          width: '100%',
          boxShadow: '0 20px 45px -10px rgba(0, 0, 0, 0.2)',
          border: '1px solid #fee2e2'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#991b1b' }}>
            Cancel Workspace Membership
          </h3>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#6b7280', fontSize: '18px' }}>✕</button>
        </div>

        {/* Disclaimer Box */}
        <div style={{
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '10px',
          padding: '14px 16px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#7f1d1d',
          lineHeight: '1.5'
        }}>
          <strong>Disclaimer & Service Terms:</strong>
          <p style={{ margin: '6px 0 0 0' }}>
            By cancelling your workspace membership/subscription, your workspace will revert to the limited Starter Tier at the end of your billing cycle. You will lose access to team seat extensions, advanced velocity risk analytics, locked sprint scope control, and premium API integrations.
          </p>
        </div>

        {/* Mandatory Checkbox (Default Unchecked) */}
        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          fontSize: '13px',
          color: '#374151',
          cursor: 'pointer',
          marginBottom: '24px',
          fontWeight: 500,
          userSelect: 'none'
        }}>
          <input 
            type="checkbox" 
            checked={disclaimerChecked} 
            onChange={(e) => setDisclaimerChecked(e.target.checked)}
            style={{ marginTop: '2px', cursor: 'pointer', width: '16px', height: '16px', accentColor: '#dc2626' }}
          />
          <span>I understand that cancelling will downgrade my workspace and restrict premium features.</span>
        </label>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
          <button 
            type="button" 
            className="btn-ghost" 
            onClick={onClose}
            style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #e5e7eb', background: '#ffffff', color: '#374151', fontWeight: 600, cursor: 'pointer' }}
          >
            Keep Membership
          </button>
          <button 
            type="button" 
            onClick={() => onConfirmCancel()} 
            disabled={!disclaimerChecked || loading}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: 'none',
              background: disclaimerChecked ? '#dc2626' : '#e5e7eb',
              color: disclaimerChecked ? '#ffffff' : '#9ca3af',
              fontWeight: 700,
              cursor: disclaimerChecked ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s, color 0.2s'
            }}
          >
            {loading ? 'Cancelling...' : 'Confirm & Cancel Membership'}
          </button>
        </div>
      </div>
    </div>
  )
}
