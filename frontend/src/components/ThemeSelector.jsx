import React, { useState, useEffect, useCallback } from 'react';

export const STRIP_THEMES = [
  {
    id: 'haru-pastel',
    name: 'Haru Pastel Korea',
    emoji: '🌸',
    tag: 'Korean Aesthetic',
    desc: 'Warna ungu lilac lembut & pink pastel dengan hiasan kelopak sakura manis.',
    gradient: 'linear-gradient(135deg, #f5d0fe 0%, #e0e7ff 100%)',
    stripBg: 'linear-gradient(180deg, #f5d0fe 0%, #fae8ff 50%, #e0e7ff 100%)',
    badgeBg: '#f3e8ff',
    badgeColor: '#7e22ce',
    accentBorder: '#c084fc',
    decorTop: '🌸 HARU MEMORY 🌸',
    decorBottom: '✦ snap studio · 2026 ✦',
    textColor: '#7e22ce',
    frameBorder: '2px solid rgba(255, 255, 255, 0.95)',
    frameBg: 'linear-gradient(135deg, #faf5ff 0%, #f3e8ff 100%)',
    sprockets: false,
    stamp: false,
    cyber: false
  },
  {
    id: 'film-noir',
    name: 'Film Noir 35mm',
    emoji: '🎞️',
    tag: 'Classic 35mm',
    desc: 'Format film analog 35mm monokrom dengan lubang sprocket dan barcode otentik.',
    gradient: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
    stripBg: '#101013',
    badgeBg: '#27272a',
    badgeColor: '#f4f4f5',
    accentBorder: '#71717a',
    decorTop: '◆ KODAK SAFETY FILM 5063 ◆',
    decorBottom: '35MM FILM · ISO 400',
    textColor: '#d4af37',
    frameBorder: '1px solid #333338',
    frameBg: 'linear-gradient(135deg, #1f1f23 0%, #27272c 100%)',
    sprockets: true,
    stamp: false,
    cyber: false
  },
  {
    id: 'y2k-cyber',
    name: 'Y2K Cyber Neon',
    emoji: '⚡',
    tag: 'Cyberpunk Glow',
    desc: 'Latar ungu pekat dengan aksen grid futuristik, neon cyan elektrik & corner brackets.',
    gradient: 'linear-gradient(135deg, #09090b 0%, #311042 100%)',
    stripBg: 'linear-gradient(180deg, #09090b 0%, #1f0b33 100%)',
    badgeBg: 'rgba(6, 182, 212, 0.2)',
    badgeColor: '#06b6d4',
    accentBorder: '#00f0ff',
    decorTop: '⚡ // Y2K CYBER // ⚡',
    decorBottom: 'SNAP STUDIO · 2026',
    textColor: '#00f0ff',
    frameBorder: '2px solid #00f0ff',
    frameBg: 'linear-gradient(135deg, #150d24 0%, #22123d 100%)',
    sprockets: false,
    stamp: false,
    cyber: true
  },
  {
    id: 'vintage-retro',
    name: 'Vintage Sepia 1984',
    emoji: '📜',
    tag: 'Warm Vintage',
    desc: 'Kertas arsip antik bernuansa hangat dengan stempel rubber postmark & nuansa sepia.',
    gradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    stripBg: 'linear-gradient(180deg, #fef3c7 0%, #fde68a 100%)',
    badgeBg: '#fef3c7',
    badgeColor: '#92400e',
    accentBorder: '#d97706',
    decorTop: '✦ 1984 VINTAGE ARCHIVE ✦',
    decorBottom: 'SNAP STUDIO · MEMORIES',
    textColor: '#854d0e',
    frameBorder: '2px solid rgba(146, 64, 14, 0.45)',
    frameBg: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    sprockets: false,
    stamp: true,
    cyber: false
  },
  {
    id: 'minimal-luxury',
    name: 'Minimal Luxury',
    emoji: '🤍',
    tag: 'Modern Chic',
    desc: 'Desain monokrom minimalis modern dengan bingkai tipis elegan dan tipografi chic.',
    gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    stripBg: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
    badgeBg: '#e2e8f0',
    badgeColor: '#1e293b',
    accentBorder: '#94a3b8',
    decorTop: 'M I N I M A L · L U X U R Y',
    decorBottom: 'SNAP STUDIO · CHIC',
    textColor: '#0f172a',
    frameBorder: '1px solid #cbd5e1',
    frameBg: 'linear-gradient(135deg, #f8fafc 0%, #edf2f7 100%)',
    sprockets: false,
    stamp: false,
    cyber: false
  },
  {
    id: 'matcha-kawaii',
    name: 'Matcha Cute Club',
    emoji: '🍵',
    tag: 'Kawaii Vibe',
    desc: 'Warna hijau sage matcha ceria dengan stiker daun semanggi keberuntungan & ekspresi imut.',
    gradient: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
    stripBg: 'linear-gradient(180deg, #D4DEC9 0%, #C2CFB5 100%)',
    badgeBg: '#dcfce7',
    badgeColor: '#166534',
    accentBorder: '#22c55e',
    decorTop: 'matcha club 🍵 ☘️',
    decorBottom: 'best day ever! ( ˶ˆᗜˆ˵ )',
    textColor: '#344B30',
    frameBorder: '2px solid #ffffff',
    frameBg: 'linear-gradient(135deg, #f4f7f1 0%, #e8eee2 100%)',
    sprockets: false,
    stamp: false,
    cyber: false
  }
];

export default function ThemeSelector({ selectedTheme, onSelectTheme, onProceedToCamera }) {
  const initialIndex = STRIP_THEMES.findIndex((t) => t.id === selectedTheme);
  const [currentIndex, setCurrentIndex] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [touchStartX, setTouchStartX] = useState(null);

  // Sync external changes
  useEffect(() => {
    const idx = STRIP_THEMES.findIndex((t) => t.id === selectedTheme);
    if (idx >= 0 && idx !== currentIndex) {
      setCurrentIndex(idx);
    }
  }, [selectedTheme]);

  const selectIndex = useCallback(
    (index) => {
      const validIdx = (index + STRIP_THEMES.length) % STRIP_THEMES.length;
      setCurrentIndex(validIdx);
      onSelectTheme(STRIP_THEMES[validIdx].id);
    },
    [onSelectTheme]
  );

  const nextSlide = useCallback(() => {
    selectIndex(currentIndex + 1);
  }, [currentIndex, selectIndex]);

  const prevSlide = useCallback(() => {
    selectIndex(currentIndex - 1);
  }, [currentIndex, selectIndex]);

  // Keyboard navigation (ArrowLeft & ArrowRight)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') nextSlide();
      else if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextSlide, prevSlide]);

  // Touch Swipe for mobile devices
  const handleTouchStart = (e) => {
    setTouchStartX(e.targetTouches[0].clientX);
  };
  const handleTouchEnd = (e) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;
    if (diff > 45) {
      nextSlide();
    } else if (diff < -45) {
      prevSlide();
    }
    setTouchStartX(null);
  };

  // Optional auto-play slideshow timer
  useEffect(() => {
    if (!isAutoPlay) return;
    const timer = setInterval(() => {
      selectIndex(currentIndex + 1);
    }, 3500);
    return () => clearInterval(timer);
  }, [isAutoPlay, currentIndex, selectIndex]);

  const currentTheme = STRIP_THEMES[currentIndex] || STRIP_THEMES[0];

  return (
    <div className="theme-selector-section theme-slideshow-container">
      {/* Step Indicator */}
      <div className="step-indicator-bar">
        <div className="step-item is-active">
          <span className="step-number">1</span>
          <span className="step-label">Pilih Border Strip</span>
        </div>
        <div className="step-connector" />
        <div className="step-item">
          <span className="step-number">2</span>
          <span className="step-label">Take Foto (3 Pose)</span>
        </div>
        <div className="step-connector" />
        <div className="step-item">
          <span className="step-number">3</span>
          <span className="step-label">QR Code Soft File</span>
        </div>
      </div>

      {/* Header */}
      <div className="slideshow-header">
        <span className="section-eyebrow">LANGKAH 1 DARI 3 · SLIDESHOW DESAIN</span>
        <h2 className="section-title">Pilih Model Border Strip</h2>
        <p className="slideshow-subtitle">
          Geser tombol panah atau swipe untuk memilih gaya border strip photobooth favoritmu.
        </p>
      </div>

      {/* Quick Select Pill Chips */}
      <div className="slideshow-pills-bar">
        {STRIP_THEMES.map((theme, idx) => (
          <button
            key={theme.id}
            type="button"
            className={`slideshow-pill ${currentIndex === idx ? 'is-active' : ''}`}
            onClick={() => selectIndex(idx)}
          >
            <span>{theme.emoji}</span>
            <span>{theme.name.split(' ')[0]}</span>
          </button>
        ))}
      </div>

      {/* Main Slideshow Stage */}
      <div
        className="slideshow-stage"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Previous Button */}
        <button
          type="button"
          className="slide-nav-btn prev"
          onClick={prevSlide}
          aria-label="Desain Sebelumnya"
          title="Desain Sebelumnya (Tekan Panah Kiri)"
        >
          ❮
        </button>

        {/* Focused Slide Card */}
        <div className="slideshow-card">
          {/* Left: Realistic Vertical Strip Mockup */}
          <div className="slideshow-mockup-wrapper">
            <div
              className={`strip-mockup-realistic ${currentTheme.sprockets ? 'has-sprockets' : ''} ${currentTheme.cyber ? 'has-cyber' : ''}`}
              style={{
                background: currentTheme.stripBg,
                borderColor: currentTheme.accentBorder
              }}
            >
              {/* Sprockets for Film Noir */}
              {currentTheme.sprockets && (
                <>
                  <div className="sprocket-track left">
                    <span className="sp-hole" /><span className="sp-hole" /><span className="sp-hole" />
                    <span className="sp-hole" /><span className="sp-hole" /><span className="sp-hole" />
                  </div>
                  <div className="sprocket-track right">
                    <span className="sp-hole" /><span className="sp-hole" /><span className="sp-hole" />
                    <span className="sp-hole" /><span className="sp-hole" /><span className="sp-hole" />
                  </div>
                </>
              )}

              {/* Rubber Stamp for Vintage */}
              {currentTheme.stamp && (
                <div className="vintage-post-stamp">
                  <span>★ 1984 ★</span>
                  <small>ARCHIVE</small>
                </div>
              )}

              {/* Top Typography Decor */}
              <div
                className="strip-decor top"
                style={{ color: currentTheme.textColor }}
              >
                {currentTheme.decorTop}
              </div>

              {/* 3 Photo Frames Mockup */}
              <div className="strip-frames-col">
                {[1, 2, 3].map((num) => (
                  <div
                    key={num}
                    className="strip-photo-box"
                    style={{
                      border: currentTheme.frameBorder,
                      background: currentTheme.frameBg
                    }}
                  >
                    <span className="photo-box-icon">📷</span>
                    <span className="photo-box-label" style={{ color: currentTheme.textColor }}>
                      Pose {num}
                    </span>
                  </div>
                ))}
              </div>

              {/* Bottom Typography Decor */}
              <div
                className="strip-decor bottom"
                style={{ color: currentTheme.textColor }}
              >
                {currentTheme.decorBottom}
              </div>
            </div>
          </div>

          {/* Right: Theme Info & Actions */}
          <div className="slideshow-info-pane">
            <div className="slideshow-tag-row">
              <span
                className="theme-tag"
                style={{ background: currentTheme.badgeBg, color: currentTheme.badgeColor }}
              >
                {currentTheme.tag}
              </span>
              <span className="slideshow-counter">
                {currentIndex + 1} / {STRIP_THEMES.length}
              </span>
            </div>

            <h3 className="slideshow-theme-title">
              <span className="theme-title-emoji">{currentTheme.emoji}</span>
              <span>{currentTheme.name}</span>
            </h3>

            <p className="slideshow-theme-desc">{currentTheme.desc}</p>

            <div className="slideshow-controls-row">
              <button
                type="button"
                className={`btn-autoplay-toggle ${isAutoPlay ? 'is-playing' : ''}`}
                onClick={() => setIsAutoPlay(!isAutoPlay)}
                title="Putar preview slide otomatis"
              >
                <span>{isAutoPlay ? '⏸ Jeda Slide' : '▶ Auto Slide'}</span>
              </button>

              <span className="slideshow-hint">
                Tip: Geser kiri / kanan atau gunakan tombol ❮ ❯
              </span>
            </div>

            <div className="slideshow-action-dock">
              <button
                type="button"
                className="btn-proceed-camera"
                onClick={onProceedToCamera}
                title="Gunakan desain ini dan mulai sesi foto di kamera"
              >
                <span>Gunakan Desain Ini & Buka Kamera</span>
                <span className="btn-arrow">📸 ➔</span>
              </button>
            </div>
          </div>
        </div>

        {/* Next Button */}
        <button
          type="button"
          className="slide-nav-btn next"
          onClick={nextSlide}
          aria-label="Desain Berikutnya"
          title="Desain Berikutnya (Tekan Panah Kanan)"
        >
          ❯
        </button>
      </div>

      {/* Dots Pagination */}
      <div className="slideshow-dots-bar">
        {STRIP_THEMES.map((theme, idx) => (
          <button
            key={theme.id}
            type="button"
            className={`slideshow-dot ${currentIndex === idx ? 'is-active' : ''}`}
            onClick={() => selectIndex(idx)}
            aria-label={`Ke desain ${theme.name}`}
            title={theme.name}
          />
        ))}
      </div>
    </div>
  );
}
