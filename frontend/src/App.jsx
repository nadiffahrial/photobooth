import React, { useState, useEffect } from 'react';
import CameraView from './components/CameraView';
import GalleryView from './components/GalleryView';
import ThemeSelector from './components/ThemeSelector';
import SoftFileModal from './components/SoftFileModal';
import AuthScreen from './components/AuthScreen';
import AdminPanel from './components/AdminPanel';
import { getDeviceInfo } from './utils/deviceDetector';

export default function App() {
  const [deviceInfo, setDeviceInfo] = useState(getDeviceInfo);
  const [user, setUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [toast, setToast] = useState('');
  const [toastTimer, setToastTimer] = useState(null);

  // Photobooth Step Flow: 'theme' -> 'camera'
  const [currentStep, setCurrentStep] = useState('theme');
  const [selectedTheme, setSelectedTheme] = useState('haru-pastel');

  // Modals & Soft File Session Result
  const [isSoftFileModalOpen, setIsSoftFileModalOpen] = useState(false);
  const [sessionResult, setSessionResult] = useState(null);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  const showToast = (msg) => {
    clearTimeout(toastTimer);
    setToast(msg);
    const t = setTimeout(() => setToast(''), 3400);
    setToastTimer(t);
  };

  const checkUser = async () => {
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' });
      const data = await res.json();
      if (data.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setAuthChecked(true);
    }
  };

  const loadPhotos = async () => {
    try {
      const res = await fetch('/api/photos', { credentials: 'include' });
      const data = await res.json();
      setPhotos(data.photos || []);
    } catch {
      showToast('Gagal memuat foto galeri.');
    }
  };

  useEffect(() => {
    checkUser();
    loadPhotos();

    const info = getDeviceInfo();
    setDeviceInfo(info);
    document.documentElement.setAttribute('data-device', info.deviceType);
    document.documentElement.setAttribute('data-platform', info.isMobile ? 'mobile' : 'desktop');

    const handleResize = () => {
      const updated = getDeviceInfo();
      setDeviceInfo(updated);
      document.documentElement.setAttribute('data-device', updated.deviceType);
      document.documentElement.setAttribute('data-platform', updated.isMobile ? 'mobile' : 'desktop');
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
      setUser(null);
      showToast('Berhasil keluar.');
      loadPhotos();
    } catch {
      showToast('Gagal keluar.');
    }
  };

  const handleDeletePhoto = async (filename) => {
    if (!window.confirm('Hapus foto ini?')) return;
    try {
      const res = await fetch(`/api/photos/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal menghapus foto.');
      showToast('Foto berhasil dihapus.');
      loadPhotos();
    } catch (err) {
      showToast(err.message);
    }
  };

  // Callback when 3-pose burst completes in CameraView
  const handleStripComplete = (result) => {
    setSessionResult(result);
    setIsSoftFileModalOpen(true);
  };

  // Build strip from existing gallery photos
  const handleCreateStripFromGallery = async () => {
    if (photos.length === 0) {
      showToast('Belum ada foto di galeri. Ambil foto terlebih dahulu!');
      return;
    }

    let selected = photos.slice(0, 3);
    while (selected.length < 3) {
      selected.push(selected[0]);
    }

    showToast('Memuat foto untuk strip 3 vertikal…');
    try {
      const loadedImages = await Promise.all(
        selected.map((p) => {
          return new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = () => resolve(img);
            img.src = p.url;
          });
        })
      );
      setSessionResult({
        frames: loadedImages,
        theme: selectedTheme,
        photo: { name: selected[0].name, url: selected[0].url }
      });
      setIsSoftFileModalOpen(true);
    } catch {
      showToast('Gagal memproses gambar dari galeri.');
    }
  };

  if (!authChecked) {
    return (
      <div className="auth-gate-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div style={{ textAlign: 'center', color: '#94a3b8' }}>
          <div className="btn-spinner" style={{ width: 36, height: 36, margin: '0 auto 16px', borderTopColor: '#6366f1' }} />
          <p style={{ fontSize: '0.95rem', letterSpacing: '0.05em' }}>MEMERIKSA SESI MASUK…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app-shell auth-view">
        <AuthScreen
          onAuthSuccess={(u) => {
            setUser(u);
            loadPhotos();
          }}
          showToast={showToast}
          deviceInfo={deviceInfo}
        />
        {toast && <div className="toast-msg">{toast}</div>}
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        <div className="brand-group">
          <a href="/" className="brand">
            <div className="brand-symbol">✦</div>
            <span className="brand-title">Snap Studio</span>
            <span className="brand-tech">Dark Mode</span>
          </a>
          <span className={`device-indicator-pill ${deviceInfo.deviceType}`} title={`Perangkat terdeteksi: ${deviceInfo.deviceName}`}>
            {deviceInfo.isIOS ? '🍎 iOS' : deviceInfo.isAndroid ? '🤖 Android' : '💻 Desktop'}
          </span>
        </div>

        <div className="topbar-actions">
          <div className="user-badge">
            <span>{user.display_name || user.username}</span>
            <span className={`badge-role ${user.role}`}>{user.role}</span>
          </div>
          {user.role === 'admin' && (
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setIsAdminPanelOpen(true)}
              style={{ color: '#f87171', borderColor: '#7f1d1d' }}
            >
              🛡️ Panel Admin
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={handleLogout}>
            Keluar
          </button>
        </div>
      </header>

      {/* Main Photobooth Flow */}
      <main>
        {currentStep === 'theme' ? (
          /* STEP 1: PILIH MODEL BORDER STRIP TERLEBIH DAHULU */
          <ThemeSelector
            selectedTheme={selectedTheme}
            onSelectTheme={setSelectedTheme}
            onProceedToCamera={() => {
              setCurrentStep('camera');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        ) : (
          /* STEP 2: DIARAHKAN KE TAKE FOTO DENGAN BORDER TERPILIH */
          <section className="studio-grid">
            <div className="hero-text">
              <div className="step-indicator-bar" style={{ marginBottom: '16px' }}>
                <div className="step-item is-done" onClick={() => setCurrentStep('theme')} style={{ cursor: 'pointer' }}>
                  <span className="step-number">✓</span>
                  <span className="step-label">Desain Terpilih</span>
                </div>
                <div className="step-connector" />
                <div className="step-item is-active">
                  <span className="step-number">2</span>
                  <span className="step-label">Take Foto (3 Pose)</span>
                </div>
                <div className="step-connector" />
                <div className="step-item">
                  <span className="step-number">3</span>
                  <span className="step-label">QR Code</span>
                </div>
              </div>

              <p className="eyebrow">
                {user ? `HALO, ${(user.display_name || user.username).toUpperCase()}` : 'STUDIO PHOTOBOOTH DARK EDITION'}
              </p>
              <h1>
                Bersiap di Depan Kamera,<br />
                <em>senyum</em> terbaikmu!
              </h1>
              <p className="intro">
                Klik tombol <strong>Take Foto</strong> untuk memulai countdown 3 pose berturut-turut. Setelah sesi berakhir, soft file siap diunduh via <strong>QR Code</strong> ke HP kamu!
              </p>

              <div className="hero-btn-row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setCurrentStep('theme')}
                >
                  <span>↺ Ganti Desain Strip</span>
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={handleCreateStripFromGallery}
                >
                  <span>🎞️ Buat Strip dari Galeri</span>
                </button>
              </div>
            </div>

            <CameraView
              deviceInfo={deviceInfo}
              selectedTheme={selectedTheme}
              onChangeTheme={() => setCurrentStep('theme')}
              onPhotoSaved={loadPhotos}
              onStripComplete={handleStripComplete}
              showToast={showToast}
            />
          </section>
        )}

        {/* Gallery Section without AI Caption */}
        <GalleryView
          photos={photos}
          onDeletePhoto={handleDeletePhoto}
          onCreateStripFromGallery={handleCreateStripFromGallery}
        />
      </main>

      {/* STEP 3: MODAL SOFT FILE BERBENTUK QR CODE (MUNCUL OTOMATIS KETIKA SESI FOTO BERAKHIR) */}
      <SoftFileModal
        isOpen={isSoftFileModalOpen}
        onClose={() => setIsSoftFileModalOpen(false)}
        frames={sessionResult?.frames || []}
        initialTheme={sessionResult?.theme || selectedTheme}
        initialPhoto={sessionResult?.photo}
        onSaved={loadPhotos}
        onRestartSession={() => {
          setCurrentStep('theme');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        showToast={showToast}
      />

      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        showToast={showToast}
      />

      {/* Toast Alert */}
      {toast && <div className="toast-msg">{toast}</div>}
    </div>
  );
}
