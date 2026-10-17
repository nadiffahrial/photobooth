import React, { useState } from 'react';

export default function AuthModal({ isOpen, onClose, onAuthSuccess, showToast }) {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      showToast('Harap isi username dan password.');
      return;
    }

    setLoading(true);
    const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
    const payload = isRegister ? { username, password, display_name: displayName } : { username, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Autentikasi gagal.');

      showToast(isRegister ? 'Registrasi berhasil! Selamat datang.' : `Selamat datang kembali, ${data.user.display_name}!`);
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      showToast(err.message || 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '420px' }}>
        <div className="modal-drag-handle" />
        <div className="modal-header">
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase' }}>
              AUTENTIKASI SNAP STUDIO
            </span>
            <h3 className="modal-title" style={{ marginTop: '2px' }}>
              {isRegister ? 'Daftar Akun Baru' : 'Masuk ke Akun'}
            </h3>
          </div>
          <button className="close-btn" type="button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
              Username
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Contoh: snapuser"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid var(--line)',
                fontFamily: 'inherit',
                fontSize: '0.9rem'
              }}
            />
          </div>

          {isRegister && (
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                Nama Tampilan (Opsional)
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Contoh: Jessica"
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: '1px solid var(--line)',
                  fontFamily: 'inherit',
                  fontSize: '0.9rem'
                }}
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 6 karakter"
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '12px',
                border: '1px solid var(--line)',
                fontFamily: 'inherit',
                fontSize: '0.9rem'
              }}
            />
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: '8px' }}
          >
            {loading ? 'Memproses…' : isRegister ? 'Daftar Sekarang' : 'Masuk Sekarang'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '18px', paddingTop: '14px', borderTop: '1px solid var(--line)' }}>
          <button
            type="button"
            style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Daftar gratis'}
          </button>
        </div>
      </div>
    </div>
  );
}

