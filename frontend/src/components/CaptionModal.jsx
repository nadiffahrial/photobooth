import React from 'react';

export default function CaptionModal({ isOpen, onClose, caption, showToast }) {
  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(caption).then(() => {
      showToast('Caption disalin ke clipboard! 📋');
    }).catch(() => {
      showToast('Gagal menyalin caption.');
    });
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        <div className="modal-drag-handle" />
        <div className="modal-header">
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
              ✨ CAPTION OTOMATIS AI
            </span>
            <h3 className="modal-title" style={{ marginTop: '2px' }}>Rekomendasi Caption</h3>
          </div>
          <button className="close-btn" type="button" onClick={onClose}>×</button>
        </div>

        <div style={{
          background: 'var(--paper-soft)',
          padding: '18px',
          borderRadius: '16px',
          border: '1px dashed rgba(123, 60, 255, 0.3)',
          fontSize: '1rem',
          lineHeight: '1.6',
          margin: '12px 0 20px',
          color: 'var(--ink)'
        }}>
          {caption || 'Membuat caption estetik dengan AI…'}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Tutup
          </button>
          <button type="button" className="btn-primary" onClick={handleCopy}>
            📋 Salin Caption
          </button>
        </div>
      </div>
    </div>
  );
}

