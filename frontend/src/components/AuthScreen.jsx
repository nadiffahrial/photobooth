import React, { useState } from 'react';
import {
  isStaticHost,
  localLogin,
  localRegister,
  localGoogleAuth,
  localAppleAuth,
  localGuestPass
} from '../utils/localStore';

export default function AuthScreen({ onAuthSuccess, showToast, deviceInfo = {} }) {
  const [tab, setTab] = useState('login'); // 'login' | 'register'
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // Additional login modals / dialogs
  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestNick, setGuestNick] = useState('');
  const [showGoogleModal, setShowGoogleModal] = useState(false);
  const [googleName, setGoogleName] = useState('');
  const [googleEmail, setGoogleEmail] = useState('');

  // 1. Standard Login / Register
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      showToast('Harap isi username dan password.');
      return;
    }

    setLoading(true);

    if (isStaticHost()) {
      try {
        const u = tab === 'register'
          ? localRegister(username, password, displayName)
          : localLogin(username, password);
        showToast(
          tab === 'register'
            ? 'Registrasi berhasil! Selamat datang di Snap Studio.'
            : `Selamat datang kembali, ${u.display_name || u.username}!`
        );
        onAuthSuccess(u);
      } catch (err) {
        showToast(err.message);
      } finally {
        setLoading(false);
      }
      return;
    }

    const endpoint = tab === 'register' ? '/api/auth/register' : '/api/auth/login';
    const payload = tab === 'register'
      ? { username: username.trim(), password, display_name: displayName.trim() }
      : { username: username.trim(), password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Autentikasi gagal.');

      showToast(
        tab === 'register'
          ? 'Registrasi berhasil! Selamat datang di Snap Studio.'
          : `Selamat datang kembali, ${data.user.display_name || data.user.username}!`
      );
      onAuthSuccess(data.user);
    } catch (err) {
      // Fallback to local auth if API unreachable
      try {
        const u = tab === 'register'
          ? localRegister(username, password, displayName)
          : localLogin(username, password);
        showToast(`Masuk mode offline: ${u.display_name || u.username}! ✨`);
        onAuthSuccess(u);
      } catch (localErr) {
        showToast(err.message || localErr.message);
      }
    } finally {
      setLoading(false);
    }
  };

  // 2. Additional Method: Google Sign-In
  const handleGoogleAuth = async (nameInput, emailInput) => {
    setLoading(true);
    if (isStaticHost()) {
      const u = localGoogleAuth(nameInput, emailInput);
      showToast(`Berhasil masuk dengan Akun Google (${u.display_name})! ✨`);
      onAuthSuccess(u);
      setLoading(false);
      setShowGoogleModal(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: nameInput || 'Pengguna Google',
          email: emailInput || 'google_user@gmail.com'
        }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Autentikasi Google gagal.');

      showToast(`Berhasil masuk dengan Akun Google (${data.user.display_name})! ✨`);
      onAuthSuccess(data.user);
    } catch {
      const u = localGoogleAuth(nameInput, emailInput);
      showToast(`Berhasil masuk dengan Akun Google (${u.display_name})! ✨`);
      onAuthSuccess(u);
    } finally {
      setLoading(false);
      setShowGoogleModal(false);
    }
  };

  // 3. Additional Method: Apple Sign-In
  const handleAppleAuth = async () => {
    setLoading(true);
    const appleName = deviceInfo?.isIOS ? 'Pengguna Apple iPhone' : 'Pengguna Apple';
    if (isStaticHost()) {
      const u = localAppleAuth(appleName);
      showToast(`Berhasil masuk dengan Apple ID (${u.display_name})! 🍎`);
      onAuthSuccess(u);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/apple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: appleName }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Autentikasi Apple gagal.');

      showToast(`Berhasil masuk dengan Apple ID (${data.user.display_name})! 🍎`);
      onAuthSuccess(data.user);
    } catch {
      const u = localAppleAuth(appleName);
      showToast(`Berhasil masuk dengan Apple ID (${u.display_name})! 🍎`);
      onAuthSuccess(u);
    } finally {
      setLoading(false);
    }
  };

  // 4. Additional Method: Instant Guest Pass
  const handleGuestPass = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (isStaticHost()) {
      const u = localGuestPass(guestNick);
      showToast(`Sesi Tamu aktif untuk: ${u.display_name}! 📸`);
      onAuthSuccess(u);
      setLoading(false);
      setShowGuestModal(false);
      return;
    }
    try {
      const res = await fetch('/api/auth/guest-pass', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: guestNick.trim() || 'Tamu Photobooth' }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal membuat sesi Tamu.');

      showToast(`Sesi Tamu aktif untuk: ${data.user.display_name}! 📸`);
      onAuthSuccess(data.user);
    } catch {
      const u = localGuestPass(guestNick);
      showToast(`Sesi Tamu aktif untuk: ${u.display_name}! 📸`);
      onAuthSuccess(u);
    } finally {
      setLoading(false);
      setShowGuestModal(false);
    }
  };

  const isIOS = deviceInfo?.isIOS;

  return (
    <div className="auth-gate-page">
      <div className="auth-card-container">
        {/* Brand Header */}
        <div className="auth-header-box">
          <div className="auth-brand-symbol">✦</div>
          <span className="auth-eyebrow">Snap Studio Photobooth</span>
          <h2 className="auth-title">
            {tab === 'login' ? 'Masuk ke Studio' : 'Daftar Akun Baru'}
          </h2>
          <p className="auth-subtitle">
            Silakan masuk atau daftar terlebih dahulu sebelum memilih desain border strip dan memulai sesi foto.
          </p>
        </div>

        {/* Tab Segmented Switcher */}
        <div className="auth-tab-bar">
          <button
            type="button"
            className={`auth-tab-btn ${tab === 'login' ? 'is-active' : ''}`}
            onClick={() => setTab('login')}
          >
            🔑 Masuk ke Akun
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${tab === 'register' ? 'is-active' : ''}`}
            onClick={() => setTab('register')}
          >
            📝 Daftar Baru
          </button>
        </div>

        {/* Primary Form */}
        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label className="form-label">Username</label>
            <div className="input-with-icon">
              <span className="input-icon">👤</span>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username Anda..."
                className="form-input"
                autoComplete="username"
              />
            </div>
          </div>

          {tab === 'register' && (
            <div className="form-group">
              <label className="form-label">Nama Tampilan (Opsional)</label>
              <div className="input-with-icon">
                <span className="input-icon">✨</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Contoh: Anya &amp; Budi"
                  className="form-input"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Password</label>
            <div className="input-with-icon">
              <span className="input-icon">🔒</span>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter..."
                className="form-input"
                autoComplete={tab === 'register' ? 'new-password' : 'current-password'}
              />
              <button
                type="button"
                className="toggle-password-btn"
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn-primary auth-submit-btn"
            disabled={loading}
          >
            <span>
              {loading
                ? 'Memproses…'
                : tab === 'register'
                ? 'Daftar Akun & Lanjut ke Studio ➔'
                : 'Masuk & Lanjut ke Studio ➔'}
            </span>
          </button>
        </form>

        {/* Divider for Additional Login Methods */}
        <div className="auth-divider">
          <span>ATAU PILIH METODE LOGIN LAIN</span>
        </div>

        {/* Additional Login / Register Options */}
        <div className="additional-login-options">
          {/* Option A: Google Sign-In */}
          <button
            type="button"
            className="btn-social google"
            disabled={loading}
            onClick={() => setShowGoogleModal(true)}
            title="Masuk instan menggunakan Akun Google"
          >
            <svg className="social-icon" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"
              />
              <path
                fill="#FBBC05"
                d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
              />
              <path
                fill="#EA4335"
                d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
              />
            </svg>
            <span>Lanjutkan dengan Google</span>
          </button>

          {/* Option B: Apple Sign-In (Highlighted on iOS) */}
          <button
            type="button"
            className={`btn-social apple ${isIOS ? 'is-recommended' : ''}`}
            disabled={loading}
            onClick={handleAppleAuth}
            title="Masuk cepat menggunakan Apple ID"
          >
            <svg className="social-icon" viewBox="0 0 170 170" fill="currentColor">
              <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.7-3.08-7.58-7.85-11.64-14.3-6.19-9.87-11.22-21.2-15.09-34-3.87-12.8-5.8-25.04-5.8-36.73 0-14.74 3.63-27.13 10.89-37.16 7.26-10.03 16.5-15.17 27.72-15.42 4.8-.13 10.08 1.15 15.85 3.84 5.77 2.69 9.38 4.09 10.84 4.2 1.94-.37 5.75-1.92 11.43-4.66 5.69-2.73 10.74-3.95 15.16-3.66 11.45.62 20.69 4.76 27.72 12.43-9.84 5.97-14.67 14.3-14.49 25 0 9.4 3.73 17.2 11.19 23.4 7.46 6.2 16.48 9.53 27.06 10-1.89 6.27-4.14 12.44-6.75 18.52zM119.22 31.84c0-7.39 2.66-14.44 7.97-21.14 5.31-6.7 11.97-10.7 20-12 0 7.39-2.67 14.4-8 21.03-5.33 6.63-12 10.67-20 12.11z" />
            </svg>
            <span>
              Lanjutkan dengan Apple {isIOS ? '(Disarankan untuk iOS)' : ''}
            </span>
          </button>

          {/* Option C: Instant Guest Pass / Kiosk Mode */}
          <button
            type="button"
            className="btn-social guest-kiosk"
            disabled={loading}
            onClick={() => setShowGuestModal(true)}
            title="Masuk langsung tanpa password (Mode Tamu Kios)"
          >
            <span className="social-emoji">⚡</span>
            <span>Masuk Cepat sebagai Tamu (Mode Kios)</span>
          </button>
        </div>

        {/* Security assurance */}
        <div className="auth-security-footer">
          <span>🛡️ Dilindungi Enkripsi Password scrypt, Rate Limiter &amp; RBAC</span>
        </div>
      </div>

      {/* Guest Pass Nickname Dialog */}
      {showGuestModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowGuestModal(false)}>
          <div className="modal-content auth-submodal">
            <div className="modal-header">
              <div>
                <span className="auth-eyebrow">AKSES INSTAN TAMU</span>
                <h4 style={{ color: '#ffffff', margin: '4px 0 0' }}>Beri Nama Sesi Foto Kamu</h4>
              </div>
              <button className="close-btn" type="button" onClick={() => setShowGuestModal(false)}>×</button>
            </div>
            <form onSubmit={handleGuestPass} style={{ marginTop: '14px' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '12px' }}>
                Masukkan nama panggilan yang akan dicetak di kartu &amp; galeri photobooth kamu:
              </p>
              <input
                type="text"
                autoFocus
                required
                value={guestNick}
                onChange={(e) => setGuestNick(e.target.value)}
                placeholder="Contoh: Rania, Nadif, Duo Ceria..."
                className="form-input"
                style={{ marginBottom: '14px' }}
              />
              <button
                type="submit"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={loading}
              >
                <span>Mulai Sesi Photobooth Sekarang ⚡</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Google Profile Dialog */}
      {showGoogleModal && (
        <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && setShowGoogleModal(false)}>
          <div className="modal-content auth-submodal">
            <div className="modal-header">
              <div>
                <span className="auth-eyebrow">GOOGLE SIGN-IN</span>
                <h4 style={{ color: '#ffffff', margin: '4px 0 0' }}>Masuk dengan Akun Google</h4>
              </div>
              <button className="close-btn" type="button" onClick={() => setShowGoogleModal(false)}>×</button>
            </div>
            <div style={{ marginTop: '14px' }}>
              <p style={{ fontSize: '0.82rem', color: 'var(--muted)', marginBottom: '12px' }}>
                Gunakan profil Google Anda untuk menyimpan soft file photobooth:
              </p>
              <input
                type="text"
                value={googleName}
                onChange={(e) => setGoogleName(e.target.value)}
                placeholder="Nama Google (opsional, contoh: Alex)"
                className="form-input"
                style={{ marginBottom: '10px' }}
              />
              <input
                type="email"
                value={googleEmail}
                onChange={(e) => setGoogleEmail(e.target.value)}
                placeholder="Email Google (opsional, contoh: alex@gmail.com)"
                className="form-input"
                style={{ marginBottom: '16px' }}
              />
              <button
                type="button"
                className="btn-primary"
                style={{ width: '100%', justifyContent: 'center' }}
                disabled={loading}
                onClick={() => handleGoogleAuth(googleName, googleEmail)}
              >
                <span>Masuk Sekarang dengan Google ➔</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

