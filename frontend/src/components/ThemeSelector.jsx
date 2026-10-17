import React from 'react';

export const STRIP_THEMES = [
  {
    id: 'haru-pastel',
    name: 'Haru Pastel Korea',
    emoji: '🌸',
    tag: 'Korean Aesthetic',
    desc: 'Warna ungu lilac lembut & pink pastel dengan hiasan kelopak sakura manis.',
    gradient: 'linear-gradient(135deg, #f5d0fe 0%, #e0e7ff 100%)',
    badgeBg: '#f3e8ff',
    badgeColor: '#7e22ce',
    accentBorder: '#c084fc'
  },
  {
    id: 'film-noir',
    name: 'Film Noir 35mm',
    emoji: '🎞️',
    tag: 'Classic 35mm',
    desc: 'Format film analog 35mm monokrom dengan lubang sprocket dan barcode otentik.',
    gradient: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
    badgeBg: '#27272a',
    badgeColor: '#f4f4f5',
    accentBorder: '#71717a'
  },
  {
    id: 'y2k-cyber',
    name: 'Y2K Cyber Neon',
    emoji: '⚡',
    tag: 'Cyberpunk Glow',
    desc: 'Latar ungu pekat dengan aksen grid futuristik, neon cyan elektrik & corner brackets.',
    gradient: 'linear-gradient(135deg, #09090b 0%, #311042 100%)',
    badgeBg: 'rgba(6, 182, 212, 0.2)',
    badgeColor: '#06b6d4',
    accentBorder: '#00f0ff'
  },
  {
    id: 'vintage-retro',
    name: 'Vintage Sepia 1984',
    emoji: '📜',
    tag: 'Warm Vintage',
    desc: 'Kertas arsip antik bernuansa hangat dengan stempel rubber postmark & corner photo mounts.',
    gradient: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
    badgeBg: '#fef3c7',
    badgeColor: '#92400e',
    accentBorder: '#d97706'
  },
  {
    id: 'minimal-luxury',
    name: 'Minimal Luxury',
    emoji: '🤍',
    tag: 'Modern Chic',
    desc: 'Desain monokrom minimalis modern dengan bingkai tipis elegan dan tipografi chic.',
    gradient: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
    badgeBg: '#e2e8f0',
    badgeColor: '#1e293b',
    accentBorder: '#94a3b8'
  },
  {
    id: 'matcha-kawaii',
    name: 'Matcha Cute Club',
    emoji: '🍵',
    tag: 'Kawaii Vibe',
    desc: 'Warna hijau sage matcha ceria dengan stiker daun semanggi keberuntungan & ekspresi imut.',
    gradient: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
    badgeBg: '#dcfce7',
    badgeColor: '#166534',
    accentBorder: '#22c55e'
  }
];

export default function ThemeSelector({ selectedTheme, onSelectTheme, onProceedToCamera }) {
  return (
    <div className="theme-selector-section">
      <div className="step-indicator-bar">
        <div className="step-item is-active">
          <span className="step-number">1</span>
          <span className="step-label">Pilih Desain Strip</span>
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

      <div className="theme-selector-header">
        <div>
          <span className="section-eyebrow">LANGKAH 1 DARI 3</span>
          <h2 className="section-title">Pilih Model Border Strip Favoritmu</h2>
          <p className="section-desc">
            Pilih salah satu dari 6 tema strip vertikal di bawah ini sebelum memulai sesi foto di depan kamera.
          </p>
        </div>
      </div>

      <div className="theme-card-grid">
        {STRIP_THEMES.map((theme) => {
          const isSelected = selectedTheme === theme.id;
          return (
            <div
              key={theme.id}
              className={`theme-card ${isSelected ? 'is-selected' : ''}`}
              onClick={() => onSelectTheme(theme.id)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onSelectTheme(theme.id)}
            >
              <div
                className="theme-card-banner"
                style={{ background: theme.gradient }}
              >
                <div className="theme-card-strip-mockup">
                  <div className="mockup-frame" />
                  <div className="mockup-frame" />
                  <div className="mockup-frame" />
                </div>
                <span className="theme-emoji-badge">{theme.emoji}</span>
              </div>

              <div className="theme-card-body">
                <div className="theme-tag-row">
                  <span
                    className="theme-tag"
                    style={{ background: theme.badgeBg, color: theme.badgeColor }}
                  >
                    {theme.tag}
                  </span>
                  {isSelected && <span className="selected-badge">✓ Terpilih</span>}
                </div>
                <h3 className="theme-card-name">{theme.name}</h3>
                <p className="theme-card-desc">{theme.desc}</p>
              </div>

              <div className="theme-card-footer">
                <button
                  type="button"
                  className={`theme-select-btn ${isSelected ? 'is-active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectTheme(theme.id);
                  }}
                >
                  {isSelected ? '✓ Desain Aktif' : 'Pilih Desain'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="theme-proceed-dock">
        <div className="theme-selected-summary">
          <span>Desain Terpilih:</span>
          <strong>
            {STRIP_THEMES.find((t) => t.id === selectedTheme)?.emoji}{' '}
            {STRIP_THEMES.find((t) => t.id === selectedTheme)?.name}
          </strong>
        </div>
        <button
          type="button"
          className="btn-proceed-camera"
          onClick={onProceedToCamera}
        >
          <span>Lanjut ke Kamera & Take Foto</span>
          <span className="btn-arrow">📸 ➔</span>
        </button>
      </div>
    </div>
  );
}
