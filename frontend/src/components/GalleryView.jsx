import React from 'react';

export default function GalleryView({ photos = [], onDeletePhoto, onGenerateCaption, onCreateStripFromGallery }) {
  return (
    <section className="gallery-section">
      <div className="gallery-heading">
        <div>
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--muted)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
            GALERI FOTO SNAP STUDIO
          </span>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.6rem', marginTop: '2px' }}>
            Koleksi Terbaru ({photos.length})
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            className="btn-secondary"
            onClick={onCreateStripFromGallery}
            title="Susun 3 foto terbaru menjadi strip vertikal"
          >
            🎞️ Buat Strip 3 Foto ▻
          </button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--line)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '10px', opacity: 0.4 }}>✦</div>
          <p style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
            Belum ada foto. Aktifkan kamera di atas untuk mengambil foto pertama Anda!
          </p>
        </div>
      ) : (
        <div className="gallery-grid">
          {photos.map((p) => (
            <article key={p.name} className="photo-card">
              <img src={p.url} alt="Foto photobooth" className="photo-img" loading="lazy" />
              <div className="photo-actions">
                <a className="action-link" href={p.url} download>
                  Unduh
                </a>
                <button
                  type="button"
                  className="action-btn ai"
                  onClick={() => onGenerateCaption(p.name)}
                  title="Buat caption estetik dengan AI"
                >
                  ✨ AI Caption
                </button>
                <button
                  type="button"
                  className="action-btn danger"
                  onClick={() => onDeletePhoto(p.name)}
                  title="Hapus foto ini"
                >
                  Hapus
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
