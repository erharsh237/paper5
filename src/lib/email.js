import emailjs from '@emailjs/browser'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

/**
 * Sends a deadline-assignment email via Vercel Serverless Resend API (or EmailJS fallback).
 */
export async function sendDeadlineEmail({
  toName, toEmail, title, description, dueDate, priority, assignedBy, appUrl, workspaceName
}) {
  if (!toEmail) return { skipped: true }

  // 1. Try Vercel Serverless Resend API (routed through verified domain on Vercel)
  try {
    const res = await fetch('/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'deadline',
        toName,
        toEmail,
        title,
        description,
        dueDate,
        priority,
        assignedBy,
        workspaceName,
        appUrl: appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://app.paper5.co')
      })
    })
    const json = await res.json()
    if (res.ok && json.success) {
      return { success: true, emailId: json.resendDetails?.id || json.emailId }
    }
  } catch (err) {
    console.warn('Serverless deadline email dispatch notice:', err)
  }

  // 2. EmailJS Client-side Fallback
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    return { skipped: true }
  }

  const params = {
    to_name: toName,
    to_email: toEmail,
    task_title: title,
    task_description: description || 'No additional details provided.',
    due_date: dueDate,
    priority: (priority || 'medium').toUpperCase(),
    assigned_by: assignedBy,
    app_url: appUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://app.paper5.co'),
  }

  return emailjs.send(SERVICE_ID, TEMPLATE_ID, params, { publicKey: PUBLIC_KEY })
}

export async function sendBlockerEmail({
  workspaceId,
  workspaceName,
  deadlineTitle,
  deadlineId,
  blockedBy,
  blockedByName,
  reason,
  category,
  description,
  helperEmails,
}) {
  try {
    const res = await fetch('/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'blocker',
        workspaceId,
        workspaceName,
        title: deadlineTitle,
        deadlineId,
        blockerUser: blockedByName || blockedBy,
        blockerReason: reason || description,
        category,
        helperEmails,
        toEmail: helperEmails?.[0] || 'support@paper5.co',
        appUrl: typeof window !== 'undefined' ? `${window.location.origin}/${workspaceId}` : `https://app.paper5.co/${workspaceId}`
      })
    })
    return await res.json()
  } catch (err) {
    console.warn('sendBlockerEmail API error:', err)
  }
}
