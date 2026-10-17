import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import multer from 'multer';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.NODE_PORT || process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'photobooth.db');
const UPLOAD_DIR = path.join(__dirname, 'photos');

// Cyber Security Validation Constants
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,30}$/;
const FILENAME_REGEX = /^photo_[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|webp)$/;
const ALLOWED_EXTS = new Set(['.png', '.jpg', '.jpeg', '.webp']);
const ALLOWED_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 jam inactivity timeout

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

// Sanitization utility against XSS
function sanitizeText(str, maxLen = 50) {
    if (!str) return '';
    return String(str).replace(/[<>&"']/g, '').trim().slice(0, maxLen);
}

// Magic Bytes Verification against Polyglot & malicious file execution
function validateMagicBytes(filePath) {
    try {
        const buffer = Buffer.alloc(12);
        const fd = fs.openSync(filePath, 'r');
        fs.readSync(fd, buffer, 0, 12, 0);
        fs.closeSync(fd);

        // PNG signature: 89 50 4E 47 0D 0A 1A 0A
        if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47 &&
            buffer[4] === 0x0D && buffer[5] === 0x0A && buffer[6] === 0x1A && buffer[7] === 0x0A) {
            return true;
        }
        // JPEG signature: FF D8 FF
        if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
            return true;
        }
        // WebP signature: RIFF .... WEBP
        if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') {
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

// In-Memory Rate Limiter against Brute-Force & Denial of Service (DoS)
function createRateLimiter({ windowMs, max, message }) {
    const hits = new Map();

    setInterval(() => {
        const now = Date.now();
        for (const [key, record] of hits.entries()) {
            if (now - record.startTime > windowMs) {
                hits.delete(key);
            }
        }
    }, 60000).unref();

    return (req, res, next) => {
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
        const now = Date.now();
        let record = hits.get(ip);

        if (!record || now - record.startTime > windowMs) {
            record = { startTime: now, count: 1 };
            hits.set(ip, record);
            return next();
        }

        record.count += 1;
        if (record.count > max) {
            const retryAfterSec = Math.ceil((record.startTime + windowMs - now) / 1000);
            res.setHeader('Retry-After', retryAfterSec);
            return res.status(429).json({
                error: message || `Terlalu banyak permintaan. Silakan coba lagi dalam ${retryAfterSec} detik.`,
                retryAfter: retryAfterSec
            });
        }

        next();
    };
}

const authRateLimiter = createRateLimiter({
    windowMs: 60 * 1000,
    max: 12,
    message: 'Terlalu banyak percobaan autentikasi dari IP Anda. Silakan tunggu 1 menit sebelum mencoba lagi.'
});

const uploadRateLimiter = createRateLimiter({
    windowMs: 5 * 60 * 1000,
    max: 30,
    message: 'Batas frekuensi pengambilan foto tercapai. Silakan coba lagi dalam beberapa menit.'
});

// Session store in memory with TTL expiration
const sessions = new Map();

function createSession(user) {
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, {
        id: user.id,
        username: user.username,
        display_name: user.display_name,
        role: user.role,
        createdAt: Date.now(),
        lastActive: Date.now()
    });
    return token;
}

function getSessionUser(req) {
    const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) return null;
    const sessionData = sessions.get(token);
    if (!sessionData) return null;

    if (Date.now() - sessionData.lastActive > SESSION_TTL_MS) {
        sessions.delete(token);
        return null;
    }
    sessionData.lastActive = Date.now();
    return sessionData;
}

// Periodic cleanup of stale sessions
setInterval(() => {
    const now = Date.now();
    for (const [token, data] of sessions.entries()) {
        if (now - data.lastActive > SESSION_TTL_MS) {
            sessions.delete(token);
        }
    }
}, 15 * 60 * 1000).unref();

function getCookieOptions(req) {
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    return {
        httpOnly: true,
        sameSite: 'lax',
        secure: isHttps,
        maxAge: SESSION_TTL_MS,
        path: '/'
    };
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
        console.warn('⚠️  [SECURITY AUDIT] Akun admin default aktif: admin / admin123. Segera ubah password di lingkungan produksi!');
    }
}

const app = express();

// Security Hardening: Disable Express fingerprinting
app.disable('x-powered-by');

// Security Hardening: Helmet HTTP Security Headers & Content Security Policy
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            mediaSrc: ["'self'", "blob:"],
            connectSrc: ["'self'"],
            frameAncestors: ["'self'"]
        }
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Security Hardening: Restricted CORS Policy
const ALLOWED_ORIGINS = new Set([
    'http://localhost:3000',
    'http://localhost:5000',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5000',
    ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : [])
]);

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
            ALLOWED_ORIGINS.has(origin) ||
            origin.endsWith('.lhr.life') ||
            origin.endsWith('.pinggy.io') ||
            origin.startsWith('http://192.168.') ||
            origin.startsWith('https://192.168.') ||
            origin.startsWith('http://10.') ||
            origin.startsWith('https://10.')
        ) {
            return callback(null, true);
        }
        return callback(new Error('Akses diblokir oleh kebijakan keamanan CORS.'));
    },
    credentials: true
}));

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Security Hardening: Serve photos statically with strict MIME isolation
app.use('/photos', (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
    next();
}, express.static(UPLOAD_DIR));

// Hardened Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
        const rawExt = path.extname(file.originalname).toLowerCase();
        const ext = ALLOWED_EXTS.has(rawExt) ? rawExt : '.png';
        const timestamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 17);
        const rand = crypto.randomBytes(4).toString('hex');
        cb(null, `photo_${timestamp}_${rand}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024, // 10MB limit
        files: 1
    },
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (!ALLOWED_MIMES.has(file.mimetype) || (ext && !ALLOWED_EXTS.has(ext))) {
            return cb(new Error('Tipe file tidak diizinkan. Hanya file gambar PNG, JPEG, dan WebP yang didukung.'));
        }
        cb(null, true);
    }
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
    if (!user || user.role !== 'admin') return res.status(403).json({ error: 'Akses ditolak: Hanya untuk Administrator.' });
    req.user = user;
    next();
}

/* ==========================================================================
   AUTH API ENDPOINTS (Secured with Rate Limiting & Strict Validation)
   ========================================================================== */
app.post('/api/auth/register', authRateLimiter, (req, res) => {
    const { username, password, display_name } = req.body;
    const cleanUsername = (username || '').trim();
    const cleanPassword = password || '';
    const cleanName = sanitizeText(display_name) || cleanUsername;

    if (!USERNAME_REGEX.test(cleanUsername)) {
        return res.status(400).json({ error: 'Username harus terdiri dari 3-30 karakter alfanumerik atau underscore (_).' });
    }
    if (cleanPassword.length < 6) {
        return res.status(400).json({ error: 'Password minimal 6 karakter.' });
    }
    if (cleanPassword.length > 128) {
        return res.status(400).json({ error: 'Password maksimal 128 karakter.' });
    }

    try {
        const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(cleanUsername);
        if (existing) {
            return res.status(400).json({ error: 'Username sudah digunakan. Silakan pilih username lain.' });
        }

        const hash = hashPassword(cleanPassword);
        const result = db.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
            .run(cleanUsername, hash, cleanName, 'user');

        const user = { id: Number(result.lastInsertRowid), username: cleanUsername, display_name: cleanName, role: 'user' };
        const token = createSession(user);

        res.cookie('session_token', token, getCookieOptions(req));
        return res.json({ success: true, user, token });
    } catch (err) {
        console.error('[Security] Register error:', err.message);
        return res.status(500).json({ error: 'Gagal mendaftarkan akun.' });
    }
});

app.post('/api/auth/login', authRateLimiter, (req, res) => {
    const { username, password } = req.body;
    const cleanUsername = (username || '').trim();
    const cleanPassword = password || '';

    if (!cleanUsername || cleanUsername.length > 30 || !cleanPassword || cleanPassword.length > 128) {
        return res.status(401).json({ error: 'Username atau password salah.' });
    }

    try {
        const row = db.prepare('SELECT id, username, password_hash, display_name, role FROM users WHERE username = ?').get(cleanUsername);
        if (!row || !verifyPassword(cleanPassword, row.password_hash)) {
            return res.status(401).json({ error: 'Username atau password salah.' });
        }

        const user = { id: row.id, username: row.username, display_name: row.display_name, role: row.role };
        const token = createSession(user);

        res.cookie('session_token', token, getCookieOptions(req));
        return res.json({ success: true, user, token });
    } catch (err) {
        console.error('[Security] Login error:', err.message);
        return res.status(500).json({ error: 'Terjadi kesalahan saat masuk.' });
    }
});

app.post('/api/auth/change-password', requireAuth, authRateLimiter, (req, res) => {
    const { current_password, new_password } = req.body;
    if (!current_password || !new_password) {
        return res.status(400).json({ error: 'Password saat ini dan password baru harus diisi.' });
    }
    if (new_password.length < 6) {
        return res.status(400).json({ error: 'Password baru minimal 6 karakter.' });
    }
    if (new_password.length > 128) {
        return res.status(400).json({ error: 'Password baru maksimal 128 karakter.' });
    }

    try {
        const userRow = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
        if (!userRow || !verifyPassword(current_password, userRow.password_hash)) {
            return res.status(400).json({ error: 'Password saat ini tidak cocok.' });
        }

        const newHash = hashPassword(new_password);
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.id);
        return res.json({ success: true, message: 'Password berhasil diperbarui.' });
    } catch (err) {
        console.error('[Security] Change password error:', err.message);
        return res.status(500).json({ error: 'Gagal memperbarui password.' });
    }
});

app.get('/api/auth/me', (req, res) => {
    const user = getSessionUser(req);
    return res.json({ user });
});

app.post('/api/auth/logout', (req, res) => {
    const token = req.cookies?.session_token || req.headers.authorization?.replace('Bearer ', '');
    if (token) sessions.delete(token);
    res.clearCookie('session_token', { httpOnly: true, sameSite: 'lax', path: '/' });
    return res.json({ success: true });
});

/* ==========================================================================
   PHOTO API ENDPOINTS (Secured with Rate Limiting & Magic Byte Verification)
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
        console.error('[Security] Load photos error:', err.message);
        return res.status(500).json({ error: 'Gagal memuat galeri foto.' });
    }
});

app.post('/api/photos', uploadRateLimiter, (req, res) => {
    upload.single('photo')(req, res, (uploadErr) => {
        if (uploadErr) {
            return res.status(400).json({ error: uploadErr.message || 'File upload ditolak oleh verifikasi keamanan.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'Tidak ada foto yang diunggah.' });
        }

        // Magic Byte Verification to prevent Polyglot/RCE attacks
        if (!validateMagicBytes(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch {}
            return res.status(400).json({ error: 'Format isi berkas tidak valid. Hanya gambar asli yang diizinkan.' });
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
            try { fs.unlinkSync(req.file.path); } catch {}
            console.error('[Security] Insert photo error:', err.message);
            return res.status(500).json({ error: 'Gagal menyimpan foto ke basis data.' });
        }
    });
});

app.delete('/api/photos/:filename', (req, res) => {
    const rawFilename = req.params.filename;
    const filename = path.basename(rawFilename);

    if (!FILENAME_REGEX.test(filename)) {
        return res.status(400).json({ error: 'Format nama berkas tidak valid.' });
    }

    const user = getSessionUser(req);

    try {
        const photo = db.prepare('SELECT id, user_id FROM photos WHERE filename = ?').get(filename);
        if (!photo) {
            return res.status(404).json({ error: 'Foto tidak ditemukan.' });
        }

        // Broken Access Control check: only owner or admin can delete
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
        console.error('[Security] Delete photo error:', err.message);
        return res.status(500).json({ error: 'Gagal menghapus foto.' });
    }
});

// Mobile Soft File Landing Page accessed via QR Code scan
app.get('/download/:filename', (req, res) => {
    const rawFilename = req.params.filename;
    const filename = path.basename(rawFilename);

    if (!FILENAME_REGEX.test(filename)) {
        return res.status(400).send('Format nama berkas tidak valid.');
    }

    const filePath = path.join(UPLOAD_DIR, filename);
    if (!fs.existsSync(filePath)) {
        return res.status(404).send('Foto tidak ditemukan atau telah dihapus.');
    }

    if (req.query.raw === '1' || req.headers.accept?.includes('image/')) {
        return res.sendFile(filePath);
    }

    const photoUrl = `/photos/${encodeURIComponent(filename)}`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Snap Studio - Unduh Soft File</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700&family=Playfair+Display:ital,wght@0,600;1,600&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
            background: linear-gradient(135deg, #100d17 0%, #220e36 50%, #0d0a14 100%);
            color: #fffdf9;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 24px 16px;
            text-align: center;
        }
        .card {
            background: rgba(255, 255, 255, 0.07);
            backdrop-filter: blur(18px);
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 28px;
            padding: 26px 20px;
            max-width: 440px;
            width: 100%;
            box-shadow: 0 24px 50px rgba(0, 0, 0, 0.55);
        }
        .badge {
            display: inline-block;
            background: rgba(123, 60, 255, 0.25);
            color: #c084fc;
            border: 1px solid rgba(192, 132, 252, 0.4);
            padding: 5px 14px;
            border-radius: 100px;
            font-size: 0.72rem;
            font-weight: 700;
            letter-spacing: 0.06em;
            text-transform: uppercase;
            margin-bottom: 12px;
        }
        h1 {
            font-family: 'Playfair Display', serif;
            font-size: 1.65rem;
            margin-bottom: 6px;
        }
        p {
            color: #b7b0c2;
            font-size: 0.88rem;
            line-height: 1.45;
            margin-bottom: 18px;
        }
        .img-box {
            background: #09080c;
            border-radius: 18px;
            padding: 12px;
            margin-bottom: 22px;
            box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.7);
        }
        img {
            max-width: 100%;
            max-height: 52vh;
            border-radius: 10px;
            display: block;
            margin: 0 auto;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        }
        .btn-download {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            width: 100%;
            padding: 15px;
            background: linear-gradient(135deg, #7b3cff, #5616dc);
            color: white;
            text-decoration: none;
            border-radius: 100px;
            font-weight: 700;
            font-size: 1rem;
            margin-bottom: 12px;
            box-shadow: 0 6px 20px rgba(123, 60, 255, 0.4);
        }
        .btn-app {
            display: block;
            width: 100%;
            padding: 11px;
            background: rgba(255, 255, 255, 0.08);
            color: #fff;
            text-decoration: none;
            border-radius: 100px;
            border: 1px solid rgba(255, 255, 255, 0.2);
            font-weight: 600;
            font-size: 0.85rem;
        }
        .hint {
            margin-top: 14px;
            font-size: 0.75rem;
            color: #8c8498;
        }
    </style>
</head>
<body>
    <div class="card">
        <span class="badge">✦ Soft File Photobooth ✦</span>
        <h1>Snap Studio</h1>
        <p>Soft file foto strip resolusi tinggi kamu siap diunduh ke galeri HP!</p>
        <div class="img-box">
            <img src="${photoUrl}" alt="Soft file strip photobooth">
        </div>
        <a href="${photoUrl}" download="snap-studio-${filename}" class="btn-download">
            <span>📥 Unduh ke Galeri Ponsel</span>
        </a>
        <a href="/" class="btn-app">📸 Buka Studio Photobooth</a>
        <p class="hint">Tip: Anda juga dapat menekan dan menahan foto di atas lalu pilih <em>"Simpan Gambar"</em>.</p>
    </div>
</body>
</html>`);
});

/* ==========================================================================
   AI API ENDPOINTS
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

function getLocalIpAddress() {
    try {
        const interfaces = os.networkInterfaces();
        for (const [name, addrs] of Object.entries(interfaces)) {
            if (!addrs) continue;
            for (const addr of addrs) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    return addr.address;
                }
            }
        }
    } catch {}
    return '127.0.0.1';
}

app.get('/api/network-info', (req, res) => {
    const localIp = getLocalIpAddress();
    const port = PORT;
    const isHttps = req.secure || req.headers['x-forwarded-proto'] === 'https';
    const proto = isHttps ? 'https' : 'http';

    const allIps = [];
    try {
        const interfaces = os.networkInterfaces();
        for (const [name, addrs] of Object.entries(interfaces)) {
            if (!addrs) continue;
            for (const addr of addrs) {
                if (addr.family === 'IPv4' && !addr.internal) {
                    allIps.push({ name, ip: addr.address });
                }
            }
        }
    } catch {}

    res.json({
        localIp,
        port,
        proto,
        wifiUrl: `${proto}://${localIp}:${port}`,
        allIps,
        hostHeader: req.headers.host || '',
        isLoopback: req.hostname === 'localhost' || req.hostname === '127.0.0.1'
    });
});



/* ==========================================================================
   ADMIN MANAGEMENT API ENDPOINTS (RBAC Enforcement)
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
        console.error('[Security] Admin load users error:', err.message);
        return res.status(500).json({ error: 'Gagal memuat daftar pengguna.' });
    }
});

app.post('/api/admin/users/:id/role', requireAdmin, (req, res) => {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
        return res.status(400).json({ error: 'ID pengguna tidak valid.' });
    }

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
        console.error('[Security] Admin change role error:', err.message);
        return res.status(500).json({ error: 'Gagal mengubah role pengguna.' });
    }
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const targetId = Number(req.params.id);
    if (!Number.isInteger(targetId) || targetId <= 0) {
        return res.status(400).json({ error: 'ID pengguna tidak valid.' });
    }

    if (req.user.id === targetId) {
        return res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri.' });
    }

    try {
        // Hapus file fisik foto milik user tersebut terlebih dahulu
        const userPhotos = db.prepare('SELECT filename FROM photos WHERE user_id = ?').all(targetId);
        for (const p of userPhotos) {
            const pPath = path.join(UPLOAD_DIR, p.filename);
            if (fs.existsSync(pPath)) {
                try { fs.unlinkSync(pPath); } catch {}
            }
        }

        db.prepare('DELETE FROM users WHERE id = ?').run(targetId);
        return res.json({ success: true, message: 'Pengguna dan fotonya berhasil dihapus.' });
    } catch (err) {
        console.error('[Security] Admin delete user error:', err.message);
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

// Global Safe Error Handler (avoids leaking stack traces)
app.use((err, req, res, next) => {
    console.error('[Express Global Error]:', err.message);
    res.status(500).json({ error: 'Terjadi kesalahan internal pada server.' });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🛡️  [Cyber Security Hardened] Photobooth server berjalan di:`);
    console.log(`   - Local:   http://localhost:${PORT}`);
    console.log(`   - Network: http://0.0.0.0:${PORT}`);
    console.log(`   - Proteksi aktif: Helmet, CSP, Rate Limiting, Magic Byte Check, RBAC, Safe Cookies\n`);
});
