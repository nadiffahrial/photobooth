import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.NODE_PORT || process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'photobooth.db');
const UPLOAD_DIR = path.join(__dirname, 'photos');

if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Initialize SQLite database
const db = new DatabaseSync(DB_PATH);

// Create tables if not exists
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        display_name TEXT,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS photos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        filename TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_photos_user ON photos(user_id);
`);

// Password utilities (100% compatible with Werkzeug scrypt format)
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const N = 32768, r = 8, p = 1;
    const derived = crypto.scryptSync(password, salt, 64, { N, r, p, maxmem: 128 * 1024 * 1024 }).toString('hex');
    return `scrypt:${N}:${r}:${p}$${salt}$${derived}`;
}

function verifyPassword(password, hashStr) {
    if (!hashStr || !hashStr.startsWith('scrypt:')) return false;
    try {
        const parts = hashStr.split('$');
        const method = parts[0];
        const salt = parts[1];
        const expectedHex = parts[2];
        const nums = method.split(':').slice(1).map(Number);
        const derived = crypto.scryptSync(password, salt, 64, {
            N: nums[0],
            r: nums[1],
            p: nums[2],
            maxmem: 128 * 1024 * 1024
        }).toString('hex');
        return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(expectedHex, 'hex'));
    } catch {
        return false;
    }
}

// Session store in memory
const sessions = new Map();

function createSession(user) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        createdAt: Date.now()
    });
    return token;
}

function getSessionUser(req) {
    const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;
    return sessions.get(token) || null;
}

// Ensure default admin user exists
const adminCheck = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');
if (!adminCheck) {
    const adminExists = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');
    if (adminExists) {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', adminExists.id);
    } else {
        const adminHash = hashPassword('admin123');
        db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
            .run('admin', adminHash, 'Administrator', 'admin');
        console.log('[Node] Akun admin default dibuat: admin / admin123');
    }
}

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve photos statically
app.use('/photos', express.static(UPLOAD_DIR));

// Multer storage for photo uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname) || '.png';
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 17);
        const rand = crypto.randomBytes(3).toString('hex');
        cb(null, `photo_${timestamp}_${rand}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 15 * 1024 * 1024 }
});

// Middleware for authentication
function requireAuth(req, res, next) {
    const user = getSessionUser(req);
    if (!user) return res.status(401).json({ error: 'Harap masuk terlebih dahulu.' });
    req.user = user;
    next();
}

function requireAdmin(req, res, next) {
    const user = getSessionUser(req);
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak: Hanya untuk Admin.' });
    req.user = user;
    next();
}

/* ==========================================================================
   AUTH API ENDPOINTS
   ========================================================================== */
app.post('/api/auth/register', (req, res) => {
    const { username, password, display_name } = req.body;
    const cleanUsername = (username || '').trim();
    const cleanPassword = password || '';
    const cleanName = (display_name || '').trim() || cleanUsername;

    if (!cleanUsername || cleanUsername.length < 3) {
        return res.status(400).json({ error: 'Username minimal 3 karakter.' });
    }
    if (cleanPassword.length < 6) {
        return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    }

    try {
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
        if (existing) {
            return res.status(400).json({ error: 'Username sudah digunakan.' });
        }

        const hash = hashPassword(cleanPassword);
        const result = db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
            .run(cleanUsername, hash, cleanName, 'user');

        const user = { id: Number(result.lastInsertRowid), username: cleanUsername, display_name: cleanName, role: 'user' };
        const token = createSession(user);

        res.cookie('session_token', token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
        return res.json({ success: true, user, token });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Gagal mendaftarkan akun.' });
    }
});

app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body;
    const cleanUsername = (username || '').trim();

    try {
        const row = db.prepare('SELECT id, username, password_hash, display_name, role FROM users WHERE username = ?').get(cleanUsername);
        if (!row || !verifyPassword(password || '', row.password_hash)) {
            return res.status(401).json({ error: 'Username atau password salah.' });
        }

        const user = { id: row.id, username: row.username, display_name: row.display_name, role: row.role };
        const token = createSession(user);

        res.cookie('session_token', token, { httpOnly: true, maxAge: 7 * 24 * 3600 * 1000 });
        return res.json({ success: true, user, token });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Terjadi kesalahan saat masuk.' });
    }
});

app.get('/api/auth/me', (req, res) => {
    const user = getSessionUser(req);
    return res.json({ user });
});

app.post('/api/auth/logout', (req, res) => {
    const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    if (token) sessions.delete(token);
    res.clearCookie('session_token');
    return res.json({ success: true });
});

/* ==========================================================================
   PHOTO API ENDPOINTS
   ========================================================================== */
app.get('/api/photos', (req, res) => {
    const user = getSessionUser(req);
    try {
        let rows;
        if (user && user.role === 'admin') {
            rows = db.prepare(`
                SELECT p.filename, p.created_at, p.user_id, u.username, u.display_name
                FROM photos p
                LEFT JOIN users u ON p.user_id = u.id
                ORDER BY p.created_at DESC
            `).all();
        } else if (user) {
            rows = db.prepare(`
                SELECT filename, created_at, user_id
                FROM photos
                WHERE user_id = ? OR user_id IS NULL
                ORDER BY created_at DESC
            `).all(user.id);
        } else {
            rows = db.prepare(`
                SELECT filename, created_at, user_id
                FROM photos
                ORDER BY created_at DESC
            `).all();
        }

        const photos = rows.map(r => ({
            name: r.filename,
            url: `/photos/${encodeURIComponent(r.filename)}`,
            created_at: r.created_at,
            user_id: r.user_id,
            owner: r.display_name || r.username || 'Tamu'
        }));

        return res.json({ photos });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Gagal memuat galeri foto.' });
    }
});

app.post('/api/photos', upload.single('photo'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'Tidak ada foto yang diunggah.' });
    }

    const user = getSessionUser(req);
    const userId = user ? user.id : null;

    try {
        db.prepare('INSERT INTO photos (user_id, filename) VALUES (?, ?)')
            .run(userId, req.file.filename);

        return res.json({
            success: true,
            photo: {
                name: req.file.filename,
                url: `/photos/${encodeURIComponent(req.file.filename)}`
            }
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Gagal menyimpan foto ke database.' });
    }
});

app.delete('/api/photos/:filename', (req, res) => {
    const filename = path.basename(req.params.filename);
    const user = getSessionUser(req);

    try {
        const photo = db.prepare('SELECT id, user_id FROM photos WHERE filename = ?').get(filename);
        if (!photo) {
            return res.status(404).json({ error: 'Foto tidak ditemukan.' });
        }

        if (user && user.role !== 'admin' && photo.user_id && photo.user_id !== user.id) {
            return res.status(403).json({ error: 'Anda tidak memiliki hak untuk menghapus foto ini.' });
        }

        db.prepare('DELETE FROM photos WHERE filename = ?').run(filename);

        const filePath = path.join(UPLOAD_DIR, filename);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }

        return res.json({ success: true, message: 'Foto berhasil dihapus.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Gagal menghapus foto.' });
    }
});

/* ==========================================================================
   AI API ENDPOINTS (Google Gemini)
   ========================================================================== */
const DEFAULT_POSES = [
    'Pose "Finger Heart" Korea dengan senyum manis ke arah kamera! 🫰✨',
    'Pose "Peace Sign" klasik di dekat pipi sambil memiringkan kepala. ✌️😄',
    'Pose tangan menopang dagu (Thinking Model) dengan tatapan estetik. 🌸🤔',
    'Gaya kacamata imajiner dengan kedua tangan melingkar di mata! 👓😎',
    'Pose tertawa lepas candid menatap ke samping kamera! 📸😆',
    'Pose "Cat Paw" menggemaskan di samping wajah! 🐾🐱'
];

app.get('/api/ai/pose', async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        const randomPose = DEFAULT_POSES[Math.floor(Math.random() * DEFAULT_POSES.length)];
        return res.json({ pose: randomPose });
    }

    try {
        const prompt = 'Kamu adalah pengarah gaya fotografer photobooth Korea kekinian. Berikan 1 rekomendasi pose foto photobooth yang seru, aesthetic, dan mudah ditiru. Format respon: hanya 1 kalimat rekomendasi dengan 1-2 emoji ceria.';
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await geminiRes.json();
        const poseText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return res.json({ pose: poseText || DEFAULT_POSES[0] });
    } catch {
        const randomPose = DEFAULT_POSES[Math.floor(Math.random() * DEFAULT_POSES.length)];
        return res.json({ pose: randomPose });
    }
});

app.post('/api/photos/:filename/caption', async (req, res) => {
    const user = getSessionUser(req);
    const userName = user?.display_name || user?.username || 'Snap Studio';
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return res.json({ caption: `Momen seru tak terlupakan di Snap Studio bersama ${userName}! ✨📸 #Photobooth #SnapMoment` });
    }

    try {
        const prompt = `Kamu adalah asisten caption media sosial untuk photobooth Snap Studio. Buatkan 1 caption Instagram singkat (maksimal 2 kalimat) yang estetik, ceria, dan menarik untuk foto milik ${userName}. Sertakan 2 hashtag keren.`;
        const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await geminiRes.json();
        const captionText = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return res.json({ caption: captionText || `Momen bahagia di Snap Studio! ✨📸 #SnapMoment` });
    } catch {
        return res.json({ caption: `Momen bahagia di Snap Studio! ✨📸 #SnapMoment` });
    }
});

/* ==========================================================================
   ADMIN MANAGEMENT API ENDPOINTS
   ========================================================================== */
app.get('/api/admin/users', requireAdmin, (req, res) => {
    try {
        const users = db.prepare(`
            SELECT u.id, u.username, u.display_name, u.role, u.created_at, COUNT(p.id) AS photo_count
            FROM users u
            LEFT JOIN photos p ON u.id = p.user_id
            GROUP BY u.id
            ORDER BY u.created_at DESC
        `).all();
        return res.json({ users });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Gagal memuat daftar pengguna.' });
    }
});

app.post('/api/admin/users/:id/role', requireAdmin, (req, res) => {
    const targetId = Number(req.params.id);
    const { role } = req.body;
    if (!['admin', 'user'].includes(role)) {
        return res.status(400).json({ error: 'Role tidak valid.' });
    }

    if (req.user.id === targetId && role !== 'admin') {
        return res.status(400).json({ error: 'Anda tidak dapat mencabut role admin Anda sendiri.' });
    }

    try {
        db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, targetId);
        return res.json({ success: true, message: `Role berhasil diubah menjadi ${role}.` });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Gagal mengubah role pengguna.' });
    }
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const targetId = Number(req.params.id);
    if (req.user.id === targetId) {
        return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri.' });
    }

    try {
        db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
        return res.json({ success: true, message: 'Pengguna berhasil dihapus.' });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Gagal menghapus pengguna.' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', runtime: 'node.js', version: process.version });
});

// Production: serve React build if available
const DIST_PATH = path.join(__dirname, 'frontend', 'dist');
if (fs.existsSync(DIST_PATH)) {
    app.use(express.static(DIST_PATH));
    app.use((req, res) => {
        res.sendFile(path.join(DIST_PATH, 'index.html'));
    });
}

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 [Node.js + Express] Photobooth server berjalan di:`);
    console.log(`   - Local:   http://localhost:${PORT}`);
    console.log(`   - Network: http://0.0.0.0:${PORT}\n`);
});
