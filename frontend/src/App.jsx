import React, { useState, useEffect } from 'react';
import CameraView from './components/CameraView';
import GalleryView from './components/GalleryView';
import StripModal from './components/StripModal';
import AuthModal from './components/AuthModal';
import AdminPanel from './components/AdminPanel';
import CaptionModal from './components/CaptionModal';

export default function App() {
  const [user, setUser] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [toast, setToast] = useState('');
  const [toastTimer, setToastTimer] = useState(null);

  // Modals
  const [isStripModalOpen, setIsStripModalOpen] = useState(false);
  const [stripFrames, setStripFrames] = useState([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [isCaptionModalOpen, setIsCaptionModalOpen] = useState(false);
  const [currentCaption, setCurrentCaption] = useState('');

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

  const handleGenerateCaption = async (filename) => {
    setCurrentCaption('Menyusun caption estetik dengan AI… 🤖✨');
    setIsCaptionModalOpen(true);
    try {
      const res = await fetch(`/api/photos/${encodeURIComponent(filename)}/caption`, {
        method: 'POST',
        credentials: 'include'
      });
      const data = await res.json();
      setCurrentCaption(data.caption || 'Momen seru di Snap Studio! ✨📸 #SnapMoment');
    } catch {
      setCurrentCaption('Momen seru di Snap Studio! ✨📸 #SnapMoment');
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
      setStripFrames(loadedImages);
      setIsStripModalOpen(true);
    } catch {
      showToast('Gagal memproses gambar dari galeri.');
    }
  };

  return (
    <div className="app-shell">
      {/* Topbar */}
      <header className="topbar">
        <a href="/" className="brand">
          <div className="brand-symbol">✦</div>
          <span className="brand-title">Snap Studio</span>
          <span className="brand-tech">React + Node.js</span>
        </a>

        <div className="topbar-actions">
          {user ? (
            <>
              <div className="user-badge">
                <span>{user.display_name || user.username}</span>
                <span className={`badge-role ${user.role}`}>{user.role}</span>
              </div>
              {user.role === 'admin' && (
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsAdminPanelOpen(true)}
                  style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                >
                  🛡️ Panel Admin
                </button>
              )}
              <button type="button" className="btn-secondary" onClick={handleLogout}>
                Keluar
              </button>
            </>
          ) : (
            <>
              <div className="user-badge">
                <span>Tamu</span>
                <span className="badge-role guest">Guest</span>
              </div>
              <button
                type="button"
                className="btn-primary"
                onClick={() => setIsAuthModalOpen(true)}
              >
                Masuk / Daftar
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Hero & Camera Section */}
      <main>
        <section className="studio-grid">
          <div className="hero-text">
            <p className="eyebrow">
              {user ? `HALO, ${(user.display_name || user.username).toUpperCase()}` : 'STUDIO PHOTOBOOTH MODERN'}
            </p>
            <h1>
              Jadikan setiap<br />
              <em>momen</em> berkesan.
            </h1>
            <p className="intro">
              Ambil foto selfie satuan atau rekam <strong>Strip 3 Foto Vertikal</strong> bergaya photobooth Korea & 35mm dengan 6 tema unik!
            </p>

            <div className="hero-btn-row">
              <button
                type="button"
                className="btn-secondary"
                onClick={handleCreateStripFromGallery}
              >
                <span>🎞️ Buat Strip 3 Foto dari Galeri</span>
              </button>
            </div>
          </div>

          <CameraView
            onPhotoSaved={loadPhotos}
            onStripReady={(frames) => {
              setStripFrames(frames);
              setIsStripModalOpen(true);
            }}
            showToast={showToast}
          />
        </section>

        {/* Gallery Section */}
        <GalleryView
          photos={photos}
          onDeletePhoto={handleDeletePhoto}
          onGenerateCaption={handleGenerateCaption}
          onCreateStripFromGallery={handleCreateStripFromGallery}
        />
      </main>

      {/* Modals */}
      <StripModal
        isOpen={isStripModalOpen}
        onClose={() => setIsStripModalOpen(false)}
        frames={stripFrames}
        onSaved={loadPhotos}
        showToast={showToast}
      />

      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(u) => {
          setUser(u);
          loadPhotos();
        }}
        showToast={showToast}
      />

      <AdminPanel
        isOpen={isAdminPanelOpen}
        onClose={() => setIsAdminPanelOpen(false)}
        showToast={showToast}
      />

      <CaptionModal
        isOpen={isCaptionModalOpen}
        onClose={() => setIsCaptionModalOpen(false)}
        caption={currentCaption}
        showToast={showToast}
      />

      {/* Toast Alert */}
      {toast && <div className="toast-msg">{toast}</div>}
    </div>
  );
}

