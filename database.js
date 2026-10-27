import { DatabaseSync } from 'node:sqlite';
import mysql from 'mysql2/promise';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, 'photobooth.db');

export let currentDbType = 'sqlite';
let sqliteDb = null;
let mysqlPool = null;

const MYSQL_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'photobooth_db',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true
};

function normalizeParams(params) {
    if (params === undefined || params === null) return [];
    if (Array.isArray(params)) return params;
    return [params];
}

export async function initDatabase({ hashPassword }) {
    const preference = (process.env.DB_TYPE || 'auto').toLowerCase();

    // 1. Coba koneksi ke MySQL XAMPP jika preference adalah 'mysql' atau 'auto'
    if (preference === 'mysql' || preference === 'auto') {
        try {
            console.log(`🔌 [DATABASE] Mencoba menghubungkan ke MySQL XAMPP (${MYSQL_CONFIG.host}:${MYSQL_CONFIG.port})...`);
            
            // Buat koneksi awal tanpa memilih database untuk memastikan database ada
            const initialConn = await mysql.createConnection({
                host: MYSQL_CONFIG.host,
                port: MYSQL_CONFIG.port,
                user: MYSQL_CONFIG.user,
                password: MYSQL_CONFIG.password,
                connectTimeout: 3000
            });

            await initialConn.query(
                `CREATE DATABASE IF NOT EXISTS \`${MYSQL_CONFIG.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`
            );
            await initialConn.end();

            // Buat connection pool ke database photobooth_db
            mysqlPool = mysql.createPool(MYSQL_CONFIG);

            // Buat tabel users jika belum ada
            await mysqlPool.query(`
                CREATE TABLE IF NOT EXISTS users (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    username VARCHAR(50) NOT NULL UNIQUE,
                    password_hash VARCHAR(255) NOT NULL,
                    display_name VARCHAR(100) DEFAULT NULL,
                    role VARCHAR(20) NOT NULL DEFAULT 'user',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            // Buat tabel photos jika belum ada
            await mysqlPool.query(`
                CREATE TABLE IF NOT EXISTS photos (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    user_id INT DEFAULT NULL,
                    filename VARCHAR(255) NOT NULL UNIQUE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_photos_user (user_id),
                    CONSTRAINT fk_photos_users FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
            `);

            // Pastikan akun admin bawaan ada
            const [adminRows] = await mysqlPool.query('SELECT id FROM users WHERE role = ? LIMIT 1', ['admin']);
            if (adminRows.length === 0) {
                const [adminByName] = await mysqlPool.query('SELECT id FROM users WHERE username = ?', ['admin']);
                if (adminByName.length > 0) {
                    await mysqlPool.query('UPDATE users SET role = ? WHERE id = ?', ['admin', adminByName[0].id]);
                } else {
                    const adminHash = hashPassword ? hashPassword('admin123') : 'scrypt:admin123';
                    await mysqlPool.query(
                        'INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)',
                        ['admin', adminHash, 'Administrator', 'admin']
                    );
                    console.warn('⚠️  [SECURITY AUDIT] Akun admin default aktif di MySQL: admin / admin123');
                }
            }

            currentDbType = 'mysql';
            console.log(`🐬 [DATABASE] Berhasil terhubung ke MySQL XAMPP! Database: ${MYSQL_CONFIG.database}`);
            return db;
        } catch (mysqlErr) {
            if (preference === 'mysql') {
                console.error(`❌ [DATABASE] Gagal terhubung ke MySQL XAMPP:`, mysqlErr.message);
                throw mysqlErr;
            }
            console.warn(`ℹ️  [DATABASE] MySQL XAMPP belum aktif (${mysqlErr.message}). Otomatis beralih ke SQLite lokal.`);
        }
    }

    // 2. Fallback / Default: SQLite lokal
    initSqlite({ hashPassword });
    return db;
}

function initSqlite({ hashPassword }) {
    sqliteDb = new DatabaseSync(DB_PATH);
    sqliteDb.exec(`
        PRAGMA journal_mode = WAL;
        PRAGMA synchronous = NORMAL;
        PRAGMA cache_size = -1000;
    `);

    sqliteDb.exec(`
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

    // Pastikan admin ada di SQLite
    const adminCheck = sqliteDb.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');
    if (!adminCheck) {
        const adminExists = sqliteDb.prepare('SELECT id FROM users WHERE username = ?').get('admin');
        if (adminExists) {
            sqliteDb.prepare('UPDATE users SET role = ? WHERE id = ?').run('admin', adminExists.id);
        } else {
            const adminHash = hashPassword ? hashPassword('admin123') : 'scrypt:admin123';
            sqliteDb.prepare('INSERT INTO users (username, password_hash, display_name, role) VALUES (?, ?, ?, ?)')
                .run('admin', adminHash, 'Administrator', 'admin');
            console.warn('⚠️  [SECURITY AUDIT] Akun admin default aktif di SQLite: admin / admin123');
        }
    }

    currentDbType = 'sqlite';
    console.log(`🪶 [DATABASE] Menggunakan SQLite lokal (${path.basename(DB_PATH)})`);
}

/**
 * Unified Database Interface
 */
export const db = {
    get type() {
        return currentDbType;
    },

    async get(sql, params = []) {
        const p = normalizeParams(params);
        if (currentDbType === 'mysql') {
            const [rows] = await mysqlPool.query(sql, p);
            return rows && rows.length > 0 ? rows[0] : null;
        } else {
            const row = sqliteDb.prepare(sql).get(...p);
            return row || null;
        }
    },

    async all(sql, params = []) {
        const p = normalizeParams(params);
        if (currentDbType === 'mysql') {
            const [rows] = await mysqlPool.query(sql, p);
            return rows || [];
        } else {
            return sqliteDb.prepare(sql).all(...p) || [];
        }
    },

    async run(sql, params = []) {
        const p = normalizeParams(params);
        if (currentDbType === 'mysql') {
            const [result] = await mysqlPool.query(sql, p);
            return {
                lastInsertRowid: Number(result.insertId),
                changes: Number(result.affectedRows)
            };
        } else {
            const info = sqliteDb.prepare(sql).run(...p);
            return {
                lastInsertRowid: Number(info.lastInsertRowid),
                changes: Number(info.changes)
            };
        }
    }
};

export default db;
