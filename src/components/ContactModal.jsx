export default function ContactModal({ isOpen, onClose }) {
  if (!isOpen) return null

  return (
    <>
      <div 
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, backdropFilter: 'blur(4px)' }} 
        onClick={onClose}
      />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: 'var(--bg-layer)', padding: '32px', borderRadius: '12px', zIndex: 1001, width: '100%', maxWidth: '400px', border: '1px solid var(--border)', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '20px' }}>Contact Sales</h2>
        <form action="https://formspree.io/f/mwvgzpwa" method="POST" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Email</label>
            <input type="email" name="email" required style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-layer-2)', color: 'var(--text-primary)' }} placeholder="you@company.com" />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)' }}>Message</label>
            <textarea name="message" required rows="4" style={{ width: '100%', padding: '10px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'var(--bg-layer-2)', color: 'var(--text-primary)', resize: 'vertical' }} placeholder="How can we help you scale?"></textarea>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" className="btn-ghost" onClick={onClose} style={{ flex: 1, justifyContent: 'center' }}>Cancel</button>
            <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>Send Message</button>
          </div>
        </form>
      </div>
    </>
  )
}
