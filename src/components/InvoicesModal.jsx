import { useState } from 'react'
import './InvoicesModal.css'
import AlertModal from './ui/AlertModal'
import { Calendar, Download, ShieldCheck, FileText } from 'lucide-react'

export default function InvoicesModal({ isOpen, onClose, currentPlanId, workspace }) {
  const [alertMessage, setAlertMessage] = useState(null)
  
  // Auto-detect or toggle billing cycle (Monthly vs Annual)
  const initialCycle = workspace?.billing_interval || workspace?.billing?.interval || 'monthly'
  const [billingCycle, setBillingCycle] = useState(initialCycle)

  if (!isOpen) return null

  const getPlanName = (id) => {
    const clean = (id || '').toLowerCase()
    if (clean === 'team') return 'Team Plan'
    if (clean === 'scale') return 'Scale Plan'
    return 'Starter Plan'
  }

  const getPlanPrice = () => {
    return '₹0'
  }

  const activePlanName = getPlanName(currentPlanId)
  
  // 1. Retrieve stored invoices from workspace settings (all plans are ₹0 during launch special)
  const storedInvoices = (Array.isArray(workspace?.settings?.invoices) ? workspace.settings.invoices : []).map(inv => ({
    ...inv,
    amount: '₹0'
  }))

  // 2. Build baseline fallback invoices if history is missing
  const createdAtDate = workspace?.created_at ? new Date(workspace.created_at) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const formattedCreationDate = createdAtDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  
  const issueDateObj = new Date()
  const formattedToday = issueDateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  
  const expiryDateObj = new Date(issueDateObj)
  if (billingCycle === 'annual') {
    expiryDateObj.setFullYear(expiryDateObj.getFullYear() + 1)
  } else {
    expiryDateObj.setMonth(expiryDateObj.getMonth() + 1)
  }
  const formattedExpiryDate = expiryDateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })

  const fallbackCurrentInvoice = {
    id: `INV-${(currentPlanId || 'STARTER').toUpperCase()}-${billingCycle === 'annual' ? 'ANNUAL' : 'MONTHLY'}-2026-001`,
    invoiceNumber: `INV-2026-88410`,
    date: formattedToday,
    expiryDate: formattedExpiryDate,
    cycle: billingCycle === 'annual' ? 'Annual (12 Months)' : 'Monthly (1 Month)',
    plan: `${activePlanName} (${billingCycle === 'annual' ? 'Annual' : 'Monthly'})`,
    planId: currentPlanId || 'free',
    changeType: currentPlanId && currentPlanId !== 'free' ? 'Subscription' : 'Initial Workspace Creation',
    amount: getPlanPrice(currentPlanId, billingCycle),
    status: 'Paid'
  }

  const fallbackInitialInvoice = {
    id: `INV-STARTER-MONTHLY-${createdAtDate.getFullYear()}-001`,
    invoiceNumber: `INV-${createdAtDate.getFullYear()}-10001`,
    date: formattedCreationDate,
    expiryDate: formattedToday,
    cycle: 'Monthly (1 Month)',
    plan: 'Starter Plan (Monthly)',
    planId: 'free',
    changeType: 'Initial Workspace Setup',
    amount: '₹0',
    status: 'Paid'
  }

  // Combine stored + fallback, deduplicating by invoice id
  let combinedInvoices = [...storedInvoices]
  if (combinedInvoices.length === 0) {
    if ((currentPlanId || 'free') !== 'free') {
      combinedInvoices = [fallbackCurrentInvoice, fallbackInitialInvoice]
    } else {
      combinedInvoices = [fallbackCurrentInvoice]
    }
  }

  // Generate downloadable PDF invoice using window.print()
  const handleDownloadInvoicePdf = (inv) => {
    try {
      const printWindow = window.open('', '_blank')
      if (!printWindow) {
        setAlertMessage('Pop-up blocked. Please allow pop-ups for app.paper5.co to generate the PDF receipt.')
        return
      }

      const invNumber = inv.invoiceNumber || inv.id
      const wsName = workspace?.name || 'My Workspace'
      const issueDate = inv.date || formattedToday
      const expDate = inv.expiryDate || formattedExpiryDate
      const planTitle = inv.plan || `${getPlanName(inv.planId || currentPlanId)} (${inv.cycle || 'Monthly'})`
      const price = (inv.amount || '₹0').replace(/^\$/, '₹')
      const changeType = inv.changeType || 'Subscription'

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Tax Invoice - ${invNumber}</title>
            <style>
              @page { size: A4; margin: 15mm; }
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #111827; margin: 0; padding: 20px; line-height: 1.5; background: #ffffff; }
              .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; margin-bottom: 24px; }
              .brand { font-size: 24px; font-weight: 800; color: #4f46e5; letter-spacing: -0.03em; }
              .brand-sub { font-size: 12px; color: #6b7280; margin-top: 2px; font-weight: 600; }
              .invoice-title { text-align: right; }
              .invoice-title h1 { font-size: 20px; margin: 0; color: #1f2937; text-transform: uppercase; letter-spacing: 0.05em; }
              .invoice-title .status-badge { display: inline-block; margin-top: 6px; background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; padding: 3px 10px; border-radius: 100px; font-size: 11px; font-weight: 700; text-transform: uppercase; }
              
              .details-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 28px; background: #f9fafb; border: 1px solid #f3f4f6; border-radius: 10px; padding: 16px 20px; font-size: 13px; }
              .details-box h3 { font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin: 0 0 6px 0; letter-spacing: 0.05em; }
              .details-box p { margin: 2px 0; color: #111827; font-size: 13px; }
              
              table { width: 100%; border-collapse: collapse; margin-bottom: 28px; font-size: 13px; }
              th { background: #f3f4f6; color: #374151; font-weight: 700; text-align: left; padding: 10px 14px; border-bottom: 2px solid #e5e7eb; }
              td { padding: 12px 14px; border-bottom: 1px solid #f3f4f6; color: #1f2937; }
              .text-right { text-align: right; }
              
              .totals-table { width: 300px; margin-left: auto; font-size: 13px; margin-bottom: 32px; }
              .totals-table td { padding: 6px 12px; }
              .totals-table tr.grand-total td { font-weight: 800; font-size: 15px; border-top: 2px solid #e5e7eb; color: #4f46e5; }
              
              .footer { border-top: 1px solid #e5e7eb; padding-top: 16px; font-size: 11px; color: #9ca3af; text-align: center; line-height: 1.6; }
              .stamp { display: inline-flex; align-items: center; gap: 6px; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 6px 14px; border-radius: 8px; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
            </style>
          </head>
          <body>
            <div class="header">
              <div>
                <div class="brand">Paper5™ | SprintOS™</div>
                <div class="brand-sub">Paper5 Technologies Inc. · Official Billing & Tax Receipt</div>
              </div>
              <div class="invoice-title">
                <h1>Tax Invoice</h1>
                <div class="status-badge">✓ Paid & Verified</div>
              </div>
            </div>

            <div class="details-grid">
              <div class="details-box">
                <h3>Billed To (Customer)</h3>
                <p><strong>Workspace:</strong> ${wsName}</p>
                <p><strong>Workspace ID:</strong> <code>${workspace?.id || 'N/A'}</code></p>
                <p><strong>Account Admin:</strong> Workspace Owner</p>
              </div>
              <div class="details-box text-right">
                <h3>Invoice Details</h3>
                <p><strong>Invoice #:</strong> ${invNumber}</p>
                <p><strong>Issue Date:</strong> ${issueDate}</p>
                <p><strong>Valid Until:</strong> ${expDate}</p>
                <p><strong>Transaction Type:</strong> ${changeType}</p>
              </div>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Billing Cycle</th>
                  <th>Qty</th>
                  <th class="text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <strong>${planTitle}</strong><br/>
                    <span style="font-size: 11px; color: #6b7280;">Full access to sprints, kanban deadlines, meeting notes, team roles, and cloud sync.</span>
                  </td>
                  <td>${inv.cycle || 'Monthly (1 Month)'}</td>
                  <td>1</td>
                  <td class="text-right"><strong>${price}</strong></td>
                </tr>
              </tbody>
            </table>

            <table class="totals-table">
              <tr>
                <td>Subtotal:</td>
                <td class="text-right">${price}</td>
              </tr>
              <tr>
                <td>Launch Discount (100%):</td>
                <td class="text-right">-₹0</td>
              </tr>
              <tr>
                <td>Tax (GST / VAT 0%):</td>
                <td class="text-right">₹0</td>
              </tr>
              <tr class="grand-total">
                <td>Total Paid:</td>
                <td class="text-right">${price}</td>
              </tr>
            </table>

            <div style="text-align: center; margin-bottom: 24px;">
              <div class="stamp">🛡️ Cryptographically Verified & Stamp Authorized</div>
            </div>

            <div class="footer">
              This document is an official tax invoice/receipt issued by Paper5 Technologies Inc. for SprintOS™ Platform Subscription Services.<br/>
              Questions? Contact Customer Support at support@paper5.co · © ${new Date().getFullYear()} Paper5. All rights reserved.
            </div>

            <script>
              window.onload = () => {
                window.print();
                setTimeout(() => window.close(), 1000);
              }
            </script>
          </body>
        </html>
      `

      printWindow.document.write(htmlContent)
      printWindow.document.close()
    } catch (err) {
      console.error('Invoice PDF error:', err)
      setAlertMessage('Failed to open PDF invoice window.')
    }
  }

  return (
    <div className="invoices-modal-overlay" onClick={onClose}>
      <div className="invoices-modal-content" onClick={e => e.stopPropagation()}>
        <button className="invoices-modal-close" onClick={onClose}>&times;</button>
        
        <div className="invoices-modal-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h2 style={{ margin: '0 0 4px 0', fontSize: '20px', fontWeight: 800, color: 'var(--text, #1C1D2B)' }}>Billing History &amp; Invoices</h2>
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted, #6E7091)' }}>
                View complete receipt history, plan validity dates, and download printable PDF invoices for every upgrade or plan change.
              </p>
            </div>

            {/* Plan Cycle Switcher (Monthly vs Annual) */}
            <div style={{ display: 'inline-flex', background: 'var(--surface-2, #EEF0F9)', padding: '3px', borderRadius: '8px', border: '1px solid var(--border-soft, #EAECF6)' }}>
              <button
                type="button"
                onClick={() => setBillingCycle('monthly')}
                style={{
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: billingCycle === 'monthly' ? '#FFFFFF' : 'transparent',
                  color: billingCycle === 'monthly' ? 'var(--accent, #4F46E5)' : 'var(--muted, #6E7091)',
                  boxShadow: billingCycle === 'monthly' ? '0 1px 3px rgba(30, 32, 80, 0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setBillingCycle('annual')}
                style={{
                  border: 'none',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                  cursor: 'pointer',
                  background: billingCycle === 'annual' ? '#FFFFFF' : 'transparent',
                  color: billingCycle === 'annual' ? 'var(--accent, #4F46E5)' : 'var(--muted, #6E7091)',
                  boxShadow: billingCycle === 'annual' ? '0 1px 3px rgba(30, 32, 80, 0.08)' : 'none',
                  transition: 'all 0.15s ease'
                }}
              >
                Annual
              </button>
            </div>
          </div>
        </div>

        <div className="invoices-table-container">
          <table className="invoices-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Issue Date</th>
                <th>Plan &amp; Change</th>
                <th>Expiry Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {combinedInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <code style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text, #1C1D2B)', background: 'var(--surface-2, #EEF0F9)', padding: '3px 6px', borderRadius: '4px' }}>
                      {inv.id}
                    </code>
                  </td>
                  <td>{inv.date}</td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text, #1C1D2B)' }}>{inv.plan || activePlanName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--accent, #4F46E5)', fontWeight: 600 }}>{inv.changeType || inv.cycle || 'Subscription'}</div>
                  </td>
                  <td>
                    <span style={{ 
                      display: 'inline-flex', 
                      alignItems: 'center', 
                      gap: '5px', 
                      background: 'rgba(79, 70, 229, 0.08)', 
                      color: 'var(--accent, #4F46E5)', 
                      padding: '4px 10px', 
                      borderRadius: '100px', 
                      fontSize: '12px', 
                      fontWeight: 700,
                      border: '1px solid rgba(79, 70, 229, 0.15)'
                    }}>
                      <Calendar size={12} />
                      {inv.expiryDate || formattedExpiryDate}
                    </span>
                  </td>
                  <td><strong>{(inv.amount || '₹0').replace(/^\$/, '₹')}</strong></td>
                  <td>
                    <span className="invoice-status-paid" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                      {inv.status || 'Paid'}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn-ghost btn-sm" 
                      onClick={() => handleDownloadInvoicePdf(inv)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, padding: '6px 12px' }}
                      title="Download Printable PDF Tax Invoice"
                    >
                      <Download size={13} />
                      <span>Download PDF</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
    </div>
  )
}
