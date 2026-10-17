/**
 * Client-Side Local Storage & IndexedDB Adapter for GitHub Pages / Static Hosting
 * Allows Snap Studio Photobooth to run 100% standalone without an active Node/Python backend.
 */

const DB_NAME = 'snap_studio_db';
const STORE_NAME = 'photos';
const DB_VERSION = 1;

export function isStaticHost() {
  if (typeof window === 'undefined') return false;
  return (
    window.location.hostname.endsWith('github.io') ||
    window.location.hostname.endsWith('surge.sh') ||
    window.location.hostname.endsWith('netlify.app') ||
    window.location.hostname.endsWith('vercel.app') ||
    window.location.protocol === 'file:'
  );
}

// Open IndexedDB database
function openDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      return reject(new Error('IndexedDB not supported'));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'name' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Convert Blob to Data URL
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// 1. User Auth Helpers
export function localCheckUser() {
  try {
    const raw = localStorage.getItem('snap_current_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function localLogin(username, password) {
  const cleanUser = (username || '').trim().toLowerCase();
  const rawList = localStorage.getItem('snap_registered_users') || '[]';
  const list = JSON.parse(rawList);
  const found = list.find((u) => u.username.toLowerCase() === cleanUser);

  if (found && found.password === password) {
    const user = {
      id: found.id,
      username: found.username,
      display_name: found.display_name,
      role: found.role || 'user'
    };
    localStorage.setItem('snap_current_user', JSON.stringify(user));
    return user;
  }

  // Allow admin demo login
  if (cleanUser === 'admin' && password === 'admin123') {
    const admin = { id: 999, username: 'admin', display_name: 'Administrator', role: 'admin' };
    localStorage.setItem('snap_current_user', JSON.stringify(admin));
    return admin;
  }

  throw new Error('Username atau password salah.');
}

export function localRegister(username, password, displayName) {
  const cleanUser = (username || '').trim();
  const rawList = localStorage.getItem('snap_registered_users') || '[]';
  const list = JSON.parse(rawList);

  if (list.some((u) => u.username.toLowerCase() === cleanUser.toLowerCase())) {
    throw new Error('Username sudah digunakan.');
  }

  const newUser = {
    id: Date.now(),
    username: cleanUser,
    password,
    display_name: displayName || cleanUser,
    role: 'user'
  };

  list.push(newUser);
  localStorage.setItem('snap_registered_users', JSON.stringify(list));

  const sessionUser = {
    id: newUser.id,
    username: newUser.username,
    display_name: newUser.display_name,
    role: 'user'
  };
  localStorage.setItem('snap_current_user', JSON.stringify(sessionUser));
  return sessionUser;
}

export function localGoogleAuth(name, email) {
  const cleanName = (name || '').trim() || 'Pengguna Google';
  const identifier = email ? email.split('@')[0] : `user_${Math.random().toString(36).slice(2, 6)}`;
  const user = {
    id: Date.now(),
    username: `g_${identifier}`,
    display_name: cleanName,
    role: 'user',
    method: 'google'
  };
  localStorage.setItem('snap_current_user', JSON.stringify(user));
  return user;
}

export function localAppleAuth(name) {
  const cleanName = (name || '').trim() || 'Pengguna Apple';
  const user = {
    id: Date.now(),
    username: `apple_${Math.random().toString(36).slice(2, 6)}`,
    display_name: cleanName,
    role: 'user',
    method: 'apple'
  };
  localStorage.setItem('snap_current_user', JSON.stringify(user));
  return user;
}

export function localGuestPass(nickname) {
  const cleanNick = (nickname || '').trim() || 'Tamu Photobooth';
  const user = {
    id: Date.now(),
    username: `guest_${Math.random().toString(36).slice(2, 6)}`,
    display_name: cleanNick,
    role: 'user',
    method: 'guest'
  };
  localStorage.setItem('snap_current_user', JSON.stringify(user));
  return user;
}

export function localLogout() {
  try {
    localStorage.removeItem('snap_current_user');
  } catch {}
}

// Active object URLs cache for automatic RAM cleanup
const activeObjectUrls = new Map();

export function revokePhotoUrl(filename) {
  if (activeObjectUrls.has(filename)) {
    try {
      URL.revokeObjectURL(activeObjectUrls.get(filename));
    } catch {}
    activeObjectUrls.delete(filename);
  }
}

export function revokeAllPhotoUrls() {
  for (const url of activeObjectUrls.values()) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
  activeObjectUrls.clear();
}

// 2. Photo Storage Helpers (Native Binary Blob IndexedDB for Minimal RAM)
export async function localSavePhoto(blob, filename) {
  const name = filename || `photo_${Date.now()}.png`;
  const user = localCheckUser();

  const photoRecord = {
    name,
    blob, // Store native binary Blob in IndexedDB (zero V8 string heap bloat)
    created_at: new Date().toISOString(),
    user_id: user ? user.id : null,
    owner: user ? (user.display_name || user.username) : 'Tamu'
  };

  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(photoRecord);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn('[localStore] IndexedDB save warning:', err);
  }

  // Recycle and create lightweight 50-byte Object URL pointer for UI
  revokePhotoUrl(name);
  const objectUrl = URL.createObjectURL(blob);
  activeObjectUrls.set(name, objectUrl);

  return {
    ...photoRecord,
    url: objectUrl
  };
}

export async function localGetPhotos() {
  const user = localCheckUser();
  try {
    const db = await openDB();
    const records = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    records.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const filtered = records.filter((p) => {
      if (user && user.role === 'admin') return true;
      if (user) return p.user_id === user.id || p.user_id === null;
      return true;
    });

    // Efficiently map records to Object URLs without memory duplication
    return filtered.map((p) => {
      if (p.blob instanceof Blob) {
        let url = activeObjectUrls.get(p.name);
        if (!url) {
          url = URL.createObjectURL(p.blob);
          activeObjectUrls.set(p.name, url);
        }
        return { ...p, url };
      }
      return p;
    });
  } catch {
    return [];
  }
}

export async function localDeletePhoto(filename) {
  revokePhotoUrl(filename);
  try {
    const db = await openDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(filename);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {}

  return true;
}

