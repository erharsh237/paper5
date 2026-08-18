import emailjs from '@emailjs/browser'

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

/**
 * Sends a deadline-assignment email via EmailJS (routed through your connected Gmail).
 * Requires an EmailJS template with matching variable names below.
 */
export async function sendDeadlineEmail({
  toName, toEmail, title, description, dueDate, priority, assignedBy, appUrl,
}) {
  if (!SERVICE_ID || !TEMPLATE_ID || !PUBLIC_KEY) {
    return { skipped: true }
  }

  const params = {
    to_name: toName,
    to_email: toEmail,
    task_title: title,
    task_description: description || 'No additional details provided.',
    due_date: dueDate,
    priority: priority.toUpperCase(),
    assigned_by: assignedBy,
    app_url: appUrl || window.location.origin,
  }

  return emailjs.send(SERVICE_ID, TEMPLATE_ID, params, { publicKey: PUBLIC_KEY })
}
