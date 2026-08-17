import { useState } from 'react'
import './InvoicesModal.css'
import AlertModal from './ui/AlertModal'
import { Calendar, Download, ShieldCheck } from 'lucide-react'

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

  const activePlanName = getPlanName(currentPlanId)
  
  // Calculate issue date and dynamic expiry date based on plan type
  const issueDateObj = new Date()
  const formattedDate = issueDateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  
  const expiryDateObj = new Date(issueDateObj)
  if (billingCycle === 'annual') {
    expiryDateObj.setFullYear(expiryDateObj.getFullYear() + 1)
  } else {
    expiryDateObj.setMonth(expiryDateObj.getMonth() + 1)
  }
  const formattedExpiryDate = expiryDateObj.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })

  const invoiceId = `INV-${(currentPlanId || 'STARTER').toUpperCase()}-${billingCycle === 'annual' ? 'ANNUAL' : 'MONTHLY'}-2026-001`
  const cycleLabel = billingCycle === 'annual' ? 'Annual (12 Months)' : 'Monthly (1 Month)'

  const invoices = [
    {
      id: invoiceId,
      date: formattedDate,
      expiryDate: formattedExpiryDate,
      cycle: cycleLabel,
      plan: `${activePlanName} (${cycleLabel})`,
      amount: '$0.00',
      status: 'Paid'
    }
  ]

  const handleDownloadInvoice = (inv) => {
    const invoiceText = `=====================================================
            SprintOS™ Official Tax Invoice / Receipt
=====================================================
Invoice Number     : ${inv.id}
Issue Date         : ${inv.date}
Plan Name          : ${inv.plan}
Plan Billing Type  : ${inv.cycle}
Plan Valid From    : ${inv.date}
Plan Expiry Date   : ${inv.expiryDate} (Auto-calculated from ${billingCycle === 'annual' ? 'Annual / 1 Year' : 'Monthly / 1 Month'} Plan)
Amount Paid        : ${inv.amount} (100% Free Launch Access)
Payment Status     : ${inv.status}
Workspace Name     : ${workspace?.name || 'My Workspace'}
Issuer             : Paper5 / SprintOS Technologies
=====================================================
Thank you for building with SprintOS™!
`
    const blob = new Blob([invoiceText], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${inv.id}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    setAlertMessage(`Tax Invoice ${inv.id} downloaded successfully.`)
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
                View plan validity, calculated expiry dates, and download past invoices.
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
                <th>Plan &amp; Cycle</th>
                <th>Expiry Date</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td>
                    <code style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text, #1C1D2B)', background: 'var(--surface-2, #EEF0F9)', padding: '3px 6px', borderRadius: '4px' }}>
                      {inv.id}
                    </code>
                  </td>
                  <td>{inv.date}</td>
                  <td>
                    <div style={{ fontWeight: 700, color: 'var(--text, #1C1D2B)' }}>{activePlanName}</div>
                    <div style={{ fontSize: '11px', color: 'var(--muted, #6E7091)' }}>{inv.cycle}</div>
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
                      {inv.expiryDate}
                    </span>
                  </td>
                  <td><strong>{inv.amount}</strong></td>
                  <td>
                    <span className="invoice-status-paid" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 700, border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button 
                      className="btn-ghost btn-sm" 
                      onClick={() => handleDownloadInvoice(inv)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, padding: '6px 12px' }}
                    >
                      <Download size={13} />
                      <span>Download Receipt</span>
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
