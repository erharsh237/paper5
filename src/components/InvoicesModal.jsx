import { useState } from 'react'
import './InvoicesModal.css'
import AlertModal from './ui/AlertModal'

export default function InvoicesModal({ isOpen, onClose, currentPlanId }) {
  const [alertMessage, setAlertMessage] = useState(null)
  if (!isOpen) return null

  const getPlanName = (id) => {
    if (id === 'team') return 'Team Plan'
    if (id === 'scale') return 'Scale Plan'
    return 'Starter Plan'
  }

  const activePlanName = getPlanName(currentPlanId)
  const formattedDate = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
  const invoiceId = `INV-${(currentPlanId || 'FREE').toUpperCase()}-2026-001`

  const invoices = [
    {
      id: invoiceId,
      date: formattedDate,
      plan: `${activePlanName} (Launch Special)`,
      amount: '$0.00',
      status: 'Paid'
    }
  ]

  const handleDownloadInvoice = (inv) => {
    const invoiceText = `=====================================================
            SprintOS™ Official Tax Invoice / Receipt
=====================================================
Invoice Number : ${inv.id}
Date           : ${inv.date}
Plan           : ${inv.plan}
Amount Paid    : ${inv.amount} (100% Unlocked during Launch)
Payment Status : ${inv.status}
Issuer         : Paper5 / SprintOS Technologies
=====================================================
Thank you for subscribing to SprintOS™!
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
          <h2>Billing History</h2>
          <p>View and download past invoices for your active workspace plan.</p>
        </div>

        <div className="invoices-table-container">
          <table className="invoices-table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Date</th>
                <th>Plan</th>
                <th>Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td><code style={{ fontSize: '12px', fontWeight: 600 }}>{inv.id}</code></td>
                  <td>{inv.date}</td>
                  <td>{inv.plan}</td>
                  <td><strong>{inv.amount}</strong></td>
                  <td>
                    <span className="invoice-status-paid" style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', padding: '4px 10px', borderRadius: '100px', fontSize: '12px', fontWeight: 600 }}>
                      {inv.status}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-ghost btn-sm" onClick={() => handleDownloadInvoice(inv)}>
                      Download Receipt
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
