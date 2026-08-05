import { useState } from 'react'
import './InvoicesModal.css'
import AlertModal from './ui/AlertModal'

export default function InvoicesModal({ isOpen, onClose, currentPlanId }) {
  const [alertMessage, setAlertMessage] = useState(null)
  if (!isOpen) return null

  const getPlanName = (id) => {
    if (id === 'team') return 'Team'
    if (id === 'scale') return 'Scale'
    return 'Starter (Free)'
  }

  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })

  const mockInvoices = []

  return (
    <div className="invoices-modal-overlay" onClick={onClose}>
      <div className="invoices-modal-content" onClick={e => e.stopPropagation()}>
        <button className="invoices-modal-close" onClick={onClose}>&times;</button>
        
        <div className="invoices-modal-header">
          <h2>Billing History</h2>
          <p>View and download past invoices.</p>
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
              {mockInvoices.length > 0 ? mockInvoices.map((inv) => (
                <tr key={inv.id}>
                  <td>{inv.id}</td>
                  <td>{inv.date}</td>
                  <td>{inv.plan}</td>
                  <td>{inv.amount}</td>
                  <td>
                    <span className="invoice-status-paid">{inv.status}</span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn-ghost btn-sm">
                      Download
                    </button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                    No invoices yet — your billing history will appear here once payments are made.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <AlertModal message={alertMessage} onClose={() => setAlertMessage(null)} />
    </div>
  )
}
