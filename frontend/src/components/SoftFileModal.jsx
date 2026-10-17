import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { render3StripCanvas } from '../utils/stripRenderer';
import { STRIP_THEMES } from './ThemeSelector';

export default function SoftFileModal({
  isOpen,
  onClose,
  frames,
  initialTheme = 'haru-pastel',
  initialPhoto = null,
  onSaved,
  onRestartSession,
  showToast
}) {
  const [currentTheme, setCurrentTheme] = useState(initialTheme);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [photoInfo, setPhotoInfo] = useState(initialPhoto);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef(null);

  useEffect(() => {
    if (initialTheme) setCurrentTheme(initialTheme);
  }, [initialTheme]);

  useEffect(() => {
    if (initialPhoto) {
      setPhotoInfo(initialPhoto);
      generateQr(initialPhoto);
    }
  }, [initialPhoto]);

  // Render canvas whenever modal opens or theme changes
  useEffect(() => {
    if (isOpen && canvasRef.current && frames && frames.length > 0) {
      render3StripCanvas(canvasRef.current, frames, currentTheme);
    }
  }, [isOpen, frames, currentTheme]);

  const generateQr = async (photo) => {
    if (!photo || !photo.name) return;
    try {
      // Build full mobile-accessible landing URL
      const fullUrl = `${window.location.origin}/download/${encodeURIComponent(photo.name)}`;
      setDownloadUrl(fullUrl);

      const qrData = await QRCode.toDataURL(fullUrl, {
        width: 260,
        margin: 2,
        color: {
          dark: '#1e1035',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      });
      setQrCodeUrl(qrData);
    } catch (err) {
      console.error('[QR Code Generation Error]:', err);
    }
  };

  if (!isOpen) return null;

  // Handle switching theme from inside modal
  const handleThemeChange = async (newThemeId) => {
    if (newThemeId === currentTheme || isProcessing) return;
    setCurrentTheme(newThemeId);
    setIsProcessing(true);

    try {
      const canvas = canvasRef.current;
      if (!canvas) return;
      render3StripCanvas(canvas, frames, newThemeId);

      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
      if (!blob) throw new Error('Gagal memproses gambar strip.');

      const formData = new FormData();
      formData.append('photo', blob, `strip_${newThemeId}_${Date.now()}.png`);

      const res = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal memperbarui soft file.');

      setPhotoInfo(data.photo);
      await generateQr(data.photo);
      if (onSaved) onSaved();
      showToast('Desain diperbarui & QR Code baru siap! ✨');
    } catch (err) {
      showToast(err.message || 'Gagal mengganti desain.');
    } finally {
      setIsProcessing(false);
    }
  };

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
      a.download = `snap-studio-${currentTheme}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Soft file berhasil diunduh ke perangkat ini! 📥');
    }, 'image/png');
  };

  const handleCopyLink = () => {
    if (!downloadUrl) return;
    navigator.clipboard.writeText(downloadUrl)
      .then(() => showToast('Tautan soft file berhasil disalin ke clipboard! 📋'))
      .catch(() => showToast('Gagal menyalin tautan.'));
  };

  const activeThemeObj = STRIP_THEMES.find((t) => t.id === currentTheme) || STRIP_THEMES[0];

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content modal-softfile">
        <div className="modal-drag-handle" />

        <div className="modal-header">
          <div>
            <span className="softfile-eyebrow">
              🎉 SESI FOTO SELESAI · SOFT FILE SIAP
            </span>
            <h3 className="modal-title">Strip 3 Foto & QR Code</h3>
          </div>
          <button className="close-btn" type="button" onClick={onClose} title="Tutup">×</button>
        </div>

        {/* Change theme chip bar inside modal */}
        <div className="softfile-theme-bar">
          <span className="softfile-theme-label">Ganti Desain Frame:</span>
          <div className="softfile-chips-scroll">
            {STRIP_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`theme-chip ${currentTheme === t.id ? 'is-active' : ''}`}
                disabled={isProcessing}
                onClick={() => handleThemeChange(t.id)}
              >
                <span>{t.emoji}</span>
                <span>{t.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content Grid: Preview on Left, QR Code on Right */}
        <div className="softfile-grid">
          {/* Left: Strip Canvas Preview */}
          <div className="softfile-preview-pane">
            <div className="canvas-wrapper">
              <canvas ref={canvasRef} className="strip-preview-canvas" />
            </div>
            <div className="softfile-preview-badge">
              <span>{activeThemeObj.emoji} {activeThemeObj.name}</span>
            </div>
          </div>

          {/* Right: QR Code & Download Actions */}
          <div className="softfile-qr-pane">
            <div className="qr-card">
              <div className="qr-header">
                <span className="qr-tag">📲 SCAN & UNDUH KE HP</span>
                <h4>Ambil Soft File Foto</h4>
              </div>

              <div className="qr-image-box">
                {qrCodeUrl ? (
                  <img src={qrCodeUrl} alt="QR Code Soft File" className="qr-img" />
                ) : (
                  <div className="qr-placeholder">
                    <span className="spinner" />
                    <span>Menghasilkan QR Code…</span>
                  </div>
                )}
              </div>

              <p className="qr-instructions">
                Arahkan kamera smartphone Anda ke QR Code ini untuk langsung membuka &amp; mendownload soft file foto beresolusi tinggi ke galeri ponsel!
              </p>

              {downloadUrl && (
                <div className="qr-url-row">
                  <input
                    type="text"
                    readOnly
                    value={downloadUrl}
                    className="qr-url-input"
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    type="button"
                    className="btn-copy-url"
                    onClick={handleCopyLink}
                    title="Salin tautan"
                  >
                    📋 Salin
                  </button>
                </div>
              )}
            </div>

            <div className="softfile-actions">
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleDownload}
              >
                <span>📥 Unduh ke Perangkat Ini (PNG)</span>
              </button>

              <button
                type="button"
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  onClose();
                  if (onRestartSession) onRestartSession();
                }}
              >
                <span>🔄 Ambil Sesi Foto Baru (Pilih Desain Lain)</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
