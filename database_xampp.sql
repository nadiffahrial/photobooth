-- ==============================================================================
-- DATABASE PHOTOBOOTH UNTUK XAMPP (MySQL / MariaDB)
-- File ini dapat diimpor langsung via phpMyAdmin (http://localhost/phpmyadmin)
-- ==============================================================================

-- 1. Buat Database jika belum ada
CREATE DATABASE IF NOT EXISTS `photobooth_db`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `photobooth_db`;

-- 2. Buat Tabel Users
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `display_name` VARCHAR(100) DEFAULT NULL,
  `role` VARCHAR(20) NOT NULL DEFAULT 'user',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Buat Tabel Photos
CREATE TABLE IF NOT EXISTS `photos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT DEFAULT NULL,
  `filename` VARCHAR(255) NOT NULL UNIQUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_photos_user` (`user_id`),
  CONSTRAINT `fk_photos_users` FOREIGN KEY (`user_id`)
    REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Akun Administrator Bawaan (Username: admin | Password: admin123)
-- Hash password dibuat menggunakan algoritma standar scrypt yang aman
INSERT INTO `users` (`id`, `username`, `password_hash`, `display_name`, `role`)
VALUES (
  1,
  'admin',
  'scrypt:32768:8:1$23UACNiTVEzaRiVh$35564c966902b310f43f46a4a6569ceac6247aa05c4972d0ee6b3962fd976d71cf855f7fbabed9d46e69318b11ac22cdec2ea3cd72f7a035fab3301bc5f64877',
  'Administrator',
  'admin'
)
ON DUPLICATE KEY UPDATE `role` = 'admin';

