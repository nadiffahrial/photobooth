import React, { useState, useEffect, useRef, useCallback } from 'react';
import QRCode from 'qrcode';
import { render3StripCanvas } from '../utils/stripRenderer';
import { STRIP_THEMES } from './ThemeSelector';
import { isStaticHost, localSavePhoto } from '../utils/localStore';

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
  const [networkInfo, setNetworkInfo] = useState(null);
  const [hostMode, setHostMode] = useState('wifi'); // 'wifi' | 'origin' | 'custom'
  const [customBaseUrl, setCustomBaseUrl] = useState('');
  const canvasRef = useRef(null);

  useEffect(() => {
    if (initialTheme) setCurrentTheme(initialTheme);
  }, [initialTheme]);

  useEffect(() => {
    if (initialPhoto) {
      setPhotoInfo(initialPhoto);
    }
  }, [initialPhoto]);

  // Fetch server network info (local IP, Wi-Fi URL)
  useEffect(() => {
    let isMounted = true;
    const fetchNetworkInfo = async () => {
      try {
        const res = await fetch('/api/network-info');
        if (!res.ok) return;
        const data = await res.json();
        if (isMounted) {
          setNetworkInfo(data);
          // If on localhost or 127.0.0.1, default to Wi-Fi LAN IP so phones can reach it
          const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
          setHostMode(isLocal && data.localIp && data.localIp !== '127.0.0.1' ? 'wifi' : 'origin');
        }
      } catch {
        // Fallback gracefully
      }
    };

    if (isOpen) {
      fetchNetworkInfo();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  // Render canvas whenever modal opens or theme changes
  useEffect(() => {
    if (isOpen && canvasRef.current && frames && frames.length > 0) {
      render3StripCanvas(canvasRef.current, frames, currentTheme);
    }
  }, [isOpen, frames, currentTheme]);

  const getEffectiveBaseUrl = useCallback(() => {
    if (isStaticHost()) {
      return window.location.href.split('#')[0].split('?')[0];
    }
    if (hostMode === 'wifi' && networkInfo?.localIp && networkInfo.localIp !== '127.0.0.1') {
      return networkInfo.wifiUrl || `http://${networkInfo.localIp}:${networkInfo.port || 3000}`;
    }
    if (hostMode === 'custom') {
      const trimmed = (customBaseUrl || '').trim();
      if (trimmed) return trimmed;
    }
    return window.location.origin;
  }, [hostMode, networkInfo, customBaseUrl]);

  const generateQr = useCallback(async (photo) => {
    if (!photo) return;
    try {
      let fullUrl = '';
      if (isStaticHost()) {
        fullUrl = window.location.href.split('#')[0];
      } else {
        const baseUrl = getEffectiveBaseUrl().replace(/\/+$/, '');
        fullUrl = photo.name ? `${baseUrl}/download/${encodeURIComponent(photo.name)}` : baseUrl;
      }
      setDownloadUrl(fullUrl);

      const qrData = await QRCode.toDataURL(fullUrl, {
        width: 280,
        margin: 2,
        color: {
          dark: '#120c22',
          light: '#ffffff'
        },
        errorCorrectionLevel: 'H'
      });
      setQrCodeUrl(qrData);
    } catch (err) {
      console.error('[QR Code Generation Error]:', err);
    }
  }, [getEffectiveBaseUrl]);

  // Re-generate QR whenever relevant variables change
  useEffect(() => {
    if (photoInfo) {
      generateQr(photoInfo);
    }
  }, [photoInfo, generateQr]);

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

      const filename = `strip_${newThemeId}_${Date.now()}.png`;
      let savedPhoto = null;

      if (isStaticHost()) {
        savedPhoto = await localSavePhoto(blob, filename);
      } else {
        try {
          const formData = new FormData();
          formData.append('photo', blob, filename);

          const res = await fetch('/api/photos', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'Gagal memperbarui soft file.');
          savedPhoto = data.photo;
        } catch {
          savedPhoto = await localSavePhoto(blob, filename);
        }
      }

      setPhotoInfo(savedPhoto);
      await generateQr(savedPhoto);
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
      .then(() => showToast('Tautan soft file berhasil disalin! 📋'))
      .catch(() => showToast('Gagal menyalin tautan.'));
  };

  const activeThemeObj = STRIP_THEMES.find((t) => t.id === currentTheme) || STRIP_THEMES[0];
  const detectedIp = networkInfo?.localIp || '192.168.1.10';

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content modal-softfile">
        <div className="modal-drag-handle" />

        <div className="modal-header">
          <div>
            <span className="softfile-eyebrow">
              🎉 SESI FOTO SELESAI · SOFT FILE SIAP
            </span>
            <h3 className="modal-title">Strip 3 Foto &amp; QR Code</h3>
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
                <span className="qr-tag">📲 SCAN &amp; UNDUH KE HP</span>
                <h4>Ambil Soft File Foto</h4>
              </div>

              {/* Target Access Host Selector (Solusi Scan HP) */}
              <div className="qr-host-control">
                <span className="qr-host-title">Akses Jaringan:</span>
                {isStaticHost() ? (
                  <div className="qr-host-pills">
                    <span className="qr-pill is-active" style={{ cursor: 'default' }}>
                      🌐 GitHub Pages Online
                    </span>
                  </div>
                ) : (
                  <div className="qr-host-pills">
                    <button
                      type="button"
                      className={`qr-pill ${hostMode === 'wifi' ? 'is-active' : ''}`}
                      onClick={() => setHostMode('wifi')}
                      title="Gunakan alamat IP Wi-Fi komputer photobooth agar dapat dibuka di HP"
                    >
                      <span>📶 Wi-Fi ({detectedIp})</span>
                    </button>
                    <button
                      type="button"
                      className={`qr-pill ${hostMode === 'origin' ? 'is-active' : ''}`}
                      onClick={() => setHostMode('origin')}
                      title="Gunakan alamat browser saat ini"
                    >
                      <span>💻 {window.location.host}</span>
                    </button>
                    <button
                      type="button"
                      className={`qr-pill ${hostMode === 'custom' ? 'is-active' : ''}`}
                      onClick={() => setHostMode('custom')}
                      title="Gunakan URL Tunnel / Domain publik kustom"
                    >
                      <span>🌐 Custom</span>
                    </button>
                  </div>
                )}

                {!isStaticHost() && hostMode === 'custom' && (
                  <div className="qr-custom-input-box">
                    <input
                      type="url"
                      className="qr-custom-input"
                      placeholder="Masukkan https://tunnel-anda.lhr.life atau URL publik"
                      value={customBaseUrl}
                      onChange={(e) => setCustomBaseUrl(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {/* QR Code Canvas / Image */}
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

              {/* Wi-Fi Guide Notice */}
              <div className="qr-guide-box">
                <span className="qr-guide-icon">{isStaticHost() ? '🌐' : '💡'}</span>
                <p className="qr-guide-text">
                  {isStaticHost() ? (
                    <>
                      <strong>Mode GitHub Pages:</strong> Soft file disimpan di browser. Scan QR code untuk membuka Photobooth di HP Anda, atau klik tombol <strong>Unduh ke Perangkat Ini (PNG)</strong> untuk menyimpan foto langsung.
                    </>
                  ) : (
                    <>
                      <strong>Penting:</strong> Pastikan HP Anda terhubung ke <strong>Wi-Fi yang sama</strong> ({detectedIp.replace(/\.\d+$/, '.*')}) dengan komputer photobooth agar soft file dapat langsung diakses &amp; diunduh.
                    </>
                  )}
                </p>
              </div>

              {/* Download URL row with Copy & Open buttons */}
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
                    title="Salin tautan unduhan"
                  >
                    📋 Salin
                  </button>
                  <a
                    href={downloadUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-open-url"
                    title="Buka halaman unduh di tab baru"
                  >
                    🔗 Buka
                  </a>
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
