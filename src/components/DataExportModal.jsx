import React, { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { subscribeUserWorkspaces } from '../lib/workspaces'

export default function DataExportModal({ isOpen, onClose, currentWorkspaceId, currentUser }) {
  const [workspaces, setWorkspaces] = useState([])
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState(currentWorkspaceId || '')
  const [exportType, setExportType] = useState('data') // 'data' | 'audit'
  
  // Data Sections Checkboxes
  const [sections, setSections] = useState({
    tasks: true,
    sprints: true,
    meetings: true,
    members: true,
    integrations: true
  })

  // Audit Options
  const [auditFormat, setAuditFormat] = useState('pdf') // 'pdf' | 'csv'

  const [generating, setGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (currentWorkspaceId) setSelectedWorkspaceId(currentWorkspaceId)
  }, [currentWorkspaceId])

  useEffect(() => {
    const uid = currentUser?.id || currentUser?.uid
    if (!uid) return
    return subscribeUserWorkspaces(uid, (list) => {
      const adminWorkspaces = list.filter(w => w.role === 'owner' || w.role === 'admin')
      setWorkspaces(adminWorkspaces)
      if (!selectedWorkspaceId && adminWorkspaces.length > 0) {
        setSelectedWorkspaceId(adminWorkspaces[0].workspaceId)
      }
    })
  }, [currentUser, selectedWorkspaceId])

  if (!isOpen) return null

  const handleToggleSection = (key) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }))
  }

  const selectedWsName = workspaces.find(w => w.workspaceId === selectedWorkspaceId)?.name || 'Workspace'

  const handleGenerateExport = async () => {
    if (!selectedWorkspaceId) {
      setErrorMsg('Please select a workspace to export.')
      return
    }
    setErrorMsg('')
    setGenerating(true)

    try {
      if (exportType === 'data') {
        await generateDataPdfReport()
      } else {
        await generateAuditReport()
      }
      onClose()
    } catch (err) {
      console.error('Export Generation Failed:', err)
      setErrorMsg(err.message || 'Failed to generate export report.')
    } finally {
      setGenerating(false)
    }
  }

  const generateDataPdfReport = async () => {
    // Fetch checked workspace data
    const fetchPromises = []

    // Always fetch workspace info
    fetchPromises.push(supabase.from('workspaces').select('*').eq('id', selectedWorkspaceId).maybeSingle())

    // 1. Tasks & Deadlines
    if (sections.tasks) {
      fetchPromises.push(supabase.from('deadlines').select('*').eq('workspace_id', selectedWorkspaceId))
    } else fetchPromises.push(Promise.resolve({ data: [] }))

    // 2. Sprints
    if (sections.sprints) {
      fetchPromises.push(supabase.from('sprints').select('*').eq('workspace_id', selectedWorkspaceId))
    } else fetchPromises.push(Promise.resolve({ data: [] }))

    // 3. Meetings
    if (sections.meetings) {
      fetchPromises.push(supabase.from('meetings').select('*').eq('workspace_id', selectedWorkspaceId).catch(() => ({ data: [] })))
    } else fetchPromises.push(Promise.resolve({ data: [] }))

    // 4. Members
    if (sections.members) {
      fetchPromises.push(supabase.from('workspace_members').select('*, users(email, full_name)').eq('workspace_id', selectedWorkspaceId))
    } else fetchPromises.push(Promise.resolve({ data: [] }))

    // 5. Integrations
    if (sections.integrations) {
      fetchPromises.push(supabase.from('integrations_config').select('*').eq('workspace_id', selectedWorkspaceId).maybeSingle())
    } else fetchPromises.push(Promise.resolve({ data: null }))

    const [wsRes, tasksRes, sprintsRes, meetingsRes, membersRes, integrationsRes] = await Promise.all(fetchPromises)

    const ws = wsRes.data || { name: selectedWsName }
    const tasks = tasksRes.data || []
    const sprints = sprintsRes.data || []
    const meetings = meetingsRes.data || []
    const members = membersRes.data || []
    const integrations = integrationsRes.data || {}

    // Open print window for PDF generation
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      throw new Error('Pop-up blocked. Please allow pop-ups for paper5.co to generate the PDF report.')
    }

    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>SprintOS Data Export - ${ws.name}</title>
          <style>
            @page { size: A4; margin: 15mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 10px; line-height: 1.5; }
            .header-bar { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #10b981; padding-bottom: 12px; margin-bottom: 20px; }
            .logo { font-size: 22px; font-weight: 800; color: #10b981; letter-spacing: -0.02em; }
            .report-title { font-size: 16px; font-weight: 700; color: #1f2937; text-align: right; }
            .meta-box { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 16px; margin-bottom: 24px; display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 12px; }
            .meta-item strong { color: #4b5563; }
            .section-title { font-size: 14px; font-weight: 700; color: #111827; background: #ecfdf5; border-left: 4px solid #10b981; padding: 8px 12px; margin: 24px 0 12px 0; border-radius: 4px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
            th, td { border: 1px solid #e5e7eb; padding: 7px 10px; text-align: left; }
            th { background: #f3f4f6; font-weight: 700; color: #374151; }
            tr:nth-child(even) { background: #fbfbfb; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; text-transform: uppercase; }
            .badge-done { background: #dcfce7; color: #15803d; }
            .badge-progress { background: #dbeafe; color: #1e40af; }
            .badge-blocked { background: #fee2e2; color: #b91c1c; }
            .badge-todo { background: #f3f4f6; color: #4b5563; }
            .footer { margin-top: 40px; border-top: 1px solid #e5e7eb; padding-top: 12px; font-size: 10px; color: #9ca3af; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header-bar">
            <div class="logo">Paper5™ | SprintOS™</div>
            <div class="report-title">Workspace Data Export Report</div>
          </div>

          <div class="meta-box">
            <div class="meta-item"><strong>Workspace:</strong> ${ws.name || selectedWsName}</div>
            <div class="meta-item"><strong>Export Date:</strong> ${reportDate}</div>
            <div class="meta-item"><strong>Generated By:</strong> ${currentUser?.email || 'Admin'}</div>
            <div class="meta-item"><strong>Active Methodology:</strong> ${ws.settings?.agile_workflow || 'Scrum'}</div>
          </div>

          ${sections.members ? `
            <div class="section-title">👥 Team Roster & Role Permissions (${members.length})</div>
            <table>
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th>Email Address</th>
                  <th>Role</th>
                  <th>Joined Date</th>
                </tr>
              </thead>
              <tbody>
                ${members.length === 0 ? '<tr><td colspan="4">No members found.</td></tr>' : members.map(m => `
                  <tr>
                    <td><strong>${m.users?.full_name || 'Member'}</strong></td>
                    <td>${m.users?.email || 'N/A'}</td>
                    <td><span class="badge" style="background:#e0e7ff;color:#3730a3">${m.role}</span></td>
                    <td>${m.joined_at ? new Date(m.joined_at).toLocaleDateString() : 'N/A'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          ${sections.tasks ? `
            <div class="section-title">📋 Tasks & Deadlines (${tasks.length})</div>
            <table>
              <thead>
                <tr>
                  <th>Title / Task</th>
                  <th>Assignee</th>
                  <th>Status</th>
                  <th>Due Date</th>
                </tr>
              </thead>
              <tbody>
                ${tasks.length === 0 ? '<tr><td colspan="4">No tasks found in this workspace.</td></tr>' : tasks.map(t => `
                  <tr>
                    <td><strong>${t.title}</strong></td>
                    <td>${t.assigneeEmail || t.assignee_email || 'Unassigned'}</td>
                    <td><span class="badge badge-${t.status === 'done' ? 'done' : t.status === 'blocked' ? 'blocked' : 'progress'}">${t.status}</span></td>
                    <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : 'No Deadline'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          ${sections.sprints ? `
            <div class="section-title">⚡ Sprint History & Scope (${sprints.length})</div>
            <table>
              <thead>
                <tr>
                  <th>Sprint Number</th>
                  <th>Status</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th>Goal</th>
                </tr>
              </thead>
              <tbody>
                ${sprints.length === 0 ? '<tr><td colspan="5">No sprint records found.</td></tr>' : sprints.map(s => `
                  <tr>
                    <td><strong>Sprint ${s.number}</strong></td>
                    <td><span class="badge badge-${s.status === 'completed' ? 'done' : 'progress'}">${s.status}</span></td>
                    <td>${s.startDate ? new Date(s.startDate).toLocaleDateString() : 'N/A'}</td>
                    <td>${s.endDate ? new Date(s.endDate).toLocaleDateString() : 'N/A'}</td>
                    <td>${s.goal || 'No sprint goal set'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          ${sections.meetings ? `
            <div class="section-title">📝 Meeting Notes & Syncs (${meetings.length})</div>
            <table>
              <thead>
                <tr>
                  <th>Meeting Title</th>
                  <th>Date</th>
                  <th>Created By</th>
                  <th>Notes Summary</th>
                </tr>
              </thead>
              <tbody>
                ${meetings.length === 0 ? '<tr><td colspan="4">No meeting notes recorded.</td></tr>' : meetings.map(m => `
                  <tr>
                    <td><strong>${m.title || 'Meeting Sync'}</strong></td>
                    <td>${m.created_at ? new Date(m.created_at).toLocaleDateString() : 'N/A'}</td>
                    <td>${m.created_by || 'Workspace Member'}</td>
                    <td>${m.summary || m.content || 'Notes attached'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          ` : ''}

          ${sections.integrations ? `
            <div class="section-title">🔌 Connected Stack Integrations</div>
            <table>
              <thead>
                <tr>
                  <th>Integration Service</th>
                  <th>Status</th>
                  <th>Connected Details</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>GitHub Repository Sync</strong></td>
                  <td>${integrations.github_connected ? '<span class="badge badge-done">Connected</span>' : '<span class="badge badge-todo">Not Configured</span>'}</td>
                  <td>${integrations.github_repo || 'No repo set'}</td>
                </tr>
                <tr>
                  <td><strong>Discord Alert Webhook</strong></td>
                  <td>${integrations.discord_webhook_url ? '<span class="badge badge-done">Active</span>' : '<span class="badge badge-todo">Inactive</span>'}</td>
                  <td>${integrations.discord_webhook_url ? 'Webhook Endpoint Armed' : 'N/A'}</td>
                </tr>
                <tr>
                  <td><strong>1-Click API REST Webhooks</strong></td>
                  <td>${integrations.api_enabled ? '<span class="badge badge-done">Enabled (Scale)</span>' : '<span class="badge badge-todo">Disabled</span>'}</td>
                  <td>${integrations.api_key ? 'Live Key Generated' : 'N/A'}</td>
                </tr>
              </tbody>
            </table>
          ` : ''}

          <div class="footer">
            Confidential Document · Paper5™ | SprintOS™ Data Ownership Export · © ${new Date().getFullYear()} Paper5. All rights reserved.
          </div>

          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 800);
            }
          </script>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  const generateAuditReport = async () => {
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('workspace_id', selectedWorkspaceId)
      .order('created_at', { ascending: false })

    if (error) throw error
    if (!data || data.length === 0) {
      throw new Error('No audit log records found for the selected workspace.')
    }

    if (auditFormat === 'csv') {
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
      a.download = `audit_report_${selectedWsName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${new Date().toISOString().slice(0,10)}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      return
    }

    // PDF Audit Report
    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      throw new Error('Pop-up blocked. Please allow pop-ups for paper5.co to generate the PDF audit report.')
    }

    const reportDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

    const htmlContent = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Audit Logs PDF Report - ${selectedWsName}</title>
          <style>
            @page { size: A4; margin: 12mm; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111827; margin: 0; padding: 10px; font-size: 11px; }
            .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #ef4444; padding-bottom: 8px; margin-bottom: 16px; }
            .brand { font-size: 20px; font-weight: 800; color: #dc2626; }
            .title { font-size: 15px; font-weight: 700; text-align: right; }
            .meta { background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; }
            table { width: 100%; border-collapse: collapse; font-size: 10px; }
            th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
            th { background: #fee2e2; color: #991b1b; font-weight: 700; }
            tr:nth-child(even) { background: #fcfcfc; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 3px; font-size: 9px; font-weight: 700; text-transform: uppercase; background: #e5e7eb; color: #374151; }
            .footer { margin-top: 30px; border-top: 1px solid #e5e7eb; padding-top: 8px; font-size: 9px; color: #9ca3af; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">SprintOS Security Audit Log</div>
            <div class="title">Official Activity Trail Report</div>
          </div>
          <div class="meta">
            <div><strong>Workspace:</strong> ${selectedWsName}</div>
            <div><strong>Total Log Entries:</strong> ${data.length}</div>
            <div><strong>Export Date:</strong> ${reportDate}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 130px;">Timestamp</th>
                <th>Action</th>
                <th>Resource Target</th>
                <th>Actor ID</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(row => `
                <tr>
                  <td>${new Date(row.created_at).toLocaleString()}</td>
                  <td><span class="badge">${row.action}</span></td>
                  <td><strong>${row.resource || 'N/A'}</strong></td>
                  <td>${row.actor_id || 'System'}</td>
                  <td>${JSON.stringify(row.metadata || {})}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="footer">
            CONFIDENTIAL SECURITY REPORT · Paper5™ | SprintOS™ Compliance Engine · Generated on ${reportDate}
          </div>
          <script>
            window.onload = () => {
              window.print();
              setTimeout(() => window.close(), 800);
            }
          </script>
        </body>
      </html>
    `

    printWindow.document.write(htmlContent)
    printWindow.document.close()
  }

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0, 0, 0, 0.65)',
      backdropFilter: 'blur(6px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '20px'
    }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-layer-1, #ffffff)',
        color: 'var(--text-primary, #111827)',
        borderRadius: '14px',
        border: '1px solid var(--border-bright, rgba(16, 185, 129, 0.3))',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
        width: '100%',
        maxWidth: '560px',
        overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-subtle, #e5e7eb)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-layer-2, #f9fafb)'
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>
              📄 Download PDF & Data Reports
            </h2>
            <p style={{ margin: '2px 0 0 0', fontSize: '13px', color: 'var(--text-secondary, #6b7280)' }}>
              Select target workspace and customize your export details.
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '22px', 
              color: 'var(--text-tertiary)', 
              cursor: 'pointer' 
            }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px' }}>

          {/* 1. Target Workspace Selector */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              1. Select Workspace to Export:
            </label>
            <select
              value={selectedWorkspaceId}
              onChange={(e) => setSelectedWorkspaceId(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border-bright, #d1d5db)',
                background: 'var(--bg-layer-1, #ffffff)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                fontWeight: 600
              }}
            >
              {workspaces.map(w => (
                <option key={w.workspaceId} value={w.workspaceId}>
                  {w.name} ({w.role.toUpperCase()})
                </option>
              ))}
            </select>
          </div>

          {/* 2. Export Mode Tabs */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', display: 'block' }}>
              2. Export Report Category:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setExportType('data')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: exportType === 'data' ? '2px solid #10b981' : '1px solid var(--border-subtle)',
                  background: exportType === 'data' ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-layer-2)',
                  color: exportType === 'data' ? '#10b981' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                📑 Workspace Data PDF
              </button>
              <button
                type="button"
                onClick={() => setExportType('audit')}
                style={{
                  padding: '10px',
                  borderRadius: '8px',
                  border: exportType === 'audit' ? '2px solid #ef4444' : '1px solid var(--border-subtle)',
                  background: exportType === 'audit' ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-layer-2)',
                  color: exportType === 'audit' ? '#ef4444' : 'var(--text-secondary)',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: 'pointer'
                }}
              >
                📋 Audit Trails Report
              </button>
            </div>
          </div>

          {/* 3. Modular Section Checkboxes for Data PDF */}
          {exportType === 'data' ? (
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                3. Choose Data Sections to Include in PDF:
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', background: 'var(--bg-layer-2)', padding: '14px', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sections.tasks} onChange={() => handleToggleSection('tasks')} />
                  📋 Tasks & Deadlines
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sections.sprints} onChange={() => handleToggleSection('sprints')} />
                  ⚡ Sprint History
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sections.meetings} onChange={() => handleToggleSection('meetings')} />
                  📝 Meeting Notes
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={sections.members} onChange={() => handleToggleSection('members')} />
                  👥 Team Roster & Roles
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer', gridColumn: 'span 2' }}>
                  <input type="checkbox" checked={sections.integrations} onChange={() => handleToggleSection('integrations')} />
                  🔌 Integrations & Webhook Config
                </label>
              </div>
            </div>
          ) : (
            <div>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px', display: 'block' }}>
                3. Select Audit Export Format:
              </label>
              <div style={{ display: 'flex', gap: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="radio" name="auditFmt" checked={auditFormat === 'pdf'} onChange={() => setAuditFormat('pdf')} />
                  PDF Document (Printable)
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                  <input type="radio" name="auditFmt" checked={auditFormat === 'csv'} onChange={() => setAuditFormat('csv')} />
                  CSV Spreadsheet
                </label>
              </div>
            </div>
          )}

          {errorMsg && (
            <div style={{ marginTop: '16px', padding: '10px 12px', background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '13px' }}>
              {errorMsg}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-subtle, #e5e7eb)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          background: 'var(--bg-layer-2, #f9fafb)'
        }}>
          <button 
            type="button"
            className="btn-ghost"
            onClick={onClose}
            disabled={generating}
          >
            Cancel
          </button>
          <button 
            type="button"
            className="btn-primary"
            onClick={handleGenerateExport}
            disabled={generating || !selectedWorkspaceId}
          >
            {generating ? 'Generating PDF...' : '⬇ Export PDF Report'}
          </button>
        </div>
      </div>
    </div>
  )
}
