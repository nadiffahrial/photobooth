import React, { useState, useEffect, useRef } from 'react';
import { render3StripCanvas } from '../utils/stripRenderer';

const THEMES = [
  { id: 'film-noir', label: '🎞️ Film Noir (35mm)' },
  { id: 'haru-pastel', label: '🌸 Haru Pastel (Korea)' },
  { id: 'y2k-cyber', label: '⚡ Y2K Cyber (Neon)' },
  { id: 'vintage-retro', label: '📜 Vintage Sepia' },
  { id: 'minimal-luxury', label: '🤍 Minimal Luxury' },
  { id: 'matcha-kawaii', label: '🍵 Matcha Cute' },
];

export default function StripModal({ isOpen, onClose, frames, onSaved, showToast }) {
  const [currentTheme, setCurrentTheme] = useState('film-noir');
  const [isSaving, setIsSaving] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (isOpen && canvasRef.current && frames.length > 0) {
      render3StripCanvas(canvasRef.current, frames, currentTheme);
    }
  }, [isOpen, frames, currentTheme]);

  if (!isOpen) return null;

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) {
        showToast('Gagal memproses gambar strip.');
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `snap-studio-strip-3-${currentTheme}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Strip 3 foto berhasil diunduh! 📥');
    }, 'image/png');
  };

  const handleSaveToGallery = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsSaving(true);

    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
      if (!blob) throw new Error('Gagal mengonversi strip.');

      const formData = new FormData();
      formData.append('photo', blob, `strip-3-${currentTheme}.png`);

      const res = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal menyimpan strip.');

      showToast('Strip 3 foto berhasil disimpan ke galeri! ☁️');
      if (onSaved) onSaved();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan strip.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content">
        <div className="modal-header">
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#7b3cff', textTransform: 'uppercase' }}>
              🎞️ Photobooth 3-Strip Builder
            </span>
            <h3 className="modal-title" style={{ marginTop: '2px' }}>Strip 3 Foto Vertikal</h3>
          </div>
          <button className="close-btn" type="button" onClick={onClose}>×</button>
        </div>

        <div style={{ marginBottom: '10px' }}>
          <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--muted)', display: 'block', marginBottom: '6px' }}>
            PILIH GAYA BORDER STRIP:
          </span>
          <div className="strip-theme-picker">
            {THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-chip ${currentTheme === t.id ? 'is-active' : ''}`}
                onClick={() => setCurrentTheme(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="strip-canvas-stage">
          <canvas ref={canvasRef} className="strip-preview-canvas" />
        </div>

        <div className="modal-footer">
          <button
            type="button"
            className="btn-secondary"
            disabled={isSaving}
            onClick={handleSaveToGallery}
          >
            {isSaving ? 'Menyimpan…' : '☁️ Simpan ke Galeri'}
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={handleDownload}
          >
            <span>Unduh Strip (PNG)</span>
            <span aria-hidden="true">↓</span>
          </button>
        </div>
      </div>
    </div>
  );
}
