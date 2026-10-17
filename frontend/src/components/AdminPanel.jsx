import React, { useState, useEffect } from 'react';
import { isStaticHost } from '../utils/localStore';

export default function AdminPanel({ isOpen, onClose, showToast }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    if (isStaticHost()) {
      setUsers([
        { id: 1, username: 'admin', display_name: 'Administrator (Client Mode)', role: 'admin', photo_count: 0 }
      ]);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/admin/users', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal memuat pengguna.');
      setUsers(data.users || []);
    } catch (err) {
      showToast(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) fetchUsers();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRoleChange = async (userId, newRole) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal mengubah role.');
      showToast(data.message);
      fetchUsers();
    } catch (err) {
      showToast(err.message);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Yakin ingin menghapus akun ${username}? Semua fotonya akan terhapus!`)) return;

    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal menghapus pengguna.');
      showToast(data.message);
      fetchUsers();
    } catch (err) {
      showToast(err.message);
    }
  };

  return (
    <div className="modal-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-content" style={{ maxWidth: '640px' }}>
        <div className="modal-drag-handle" />
        <div className="modal-header">
          <div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#dc2626', textTransform: 'uppercase' }}>
              🛡️ PANEL KONTROL ADMIN
            </span>
            <h3 className="modal-title" style={{ marginTop: '2px' }}>Manajemen Pengguna & Role</h3>
          </div>
          <button className="close-btn" type="button" onClick={onClose}>×</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', maxHeight: '55vh' }}>
          {loading ? (
            <p style={{ textAlign: 'center', padding: '30px', color: 'var(--muted)' }}>Memuat data pengguna…</p>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--line)', textAlign: 'left', color: 'var(--muted)', fontSize: '0.72rem', textTransform: 'uppercase' }}>
                  <th style={{ padding: '8px 4px' }}>Pengguna</th>
                  <th style={{ padding: '8px 4px' }}>Role</th>
                  <th style={{ padding: '8px 4px' }}>Foto</th>
                  <th style={{ padding: '8px 4px', textAlign: 'right' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--line)' }}>
                    <td style={{ padding: '12px 4px' }}>
                      <strong style={{ display: 'block' }}>{u.display_name || u.username}</strong>
                      <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>@{u.username}</span>
                    </td>
                    <td style={{ padding: '12px 4px' }}>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        style={{
                          padding: '4px 8px',
                          borderRadius: '8px',
                          border: u.role === 'admin' ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(99, 102, 241, 0.4)',
                          fontSize: '0.8rem',
                          background: u.role === 'admin' ? 'rgba(239, 68, 68, 0.18)' : 'rgba(99, 102, 241, 0.18)',
                          color: u.role === 'admin' ? '#f87171' : '#818cf8',
                          fontWeight: 700
                        }}
                      >
                        <option value="user" style={{ background: '#181324', color: '#fff' }}>User</option>
                        <option value="admin" style={{ background: '#181324', color: '#f87171' }}>Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px 4px' }}>
                      <span style={{ fontWeight: 600 }}>{u.photo_count || 0}</span>
                    </td>
                    <td style={{ padding: '12px 4px', textAlign: 'right' }}>
                      <button
                        type="button"
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.35)',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          cursor: 'pointer',
                          fontWeight: 600
                        }}
                        onClick={() => handleDeleteUser(u.id, u.username)}
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ marginTop: '16px', textAlign: 'right' }}>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
}

