import React, { useState, useEffect, useRef } from 'react';

export default function CameraView({ onPhotoSaved, onStripReady, showToast }) {
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [isActive, setIsActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMode, setCaptureMode] = useState('single'); // 'single' | 'strip'
  const [autoTimer, setAutoTimer] = useState(null);
  const [statusText, setStatusText] = useState('Kamera belum aktif');
  const [flash, setFlash] = useState(false);

  const videoRef = useRef(null);
  const autoTimerRef = useRef(null);

  const triggerFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 220);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Kamera tidak didukung di peramban ini.');
      return;
    }

    try {
      stopCamera();
      setStatusText('Mengaktifkan kamera…');
      let mediaStream;

      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false
        });
      } catch {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode } },
          audio: false
        });
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setIsActive(true);
      setStatusText(captureMode === 'strip' ? 'Mode Strip 3 Foto aktif' : 'Kamera aktif · Foto otomatis 5s');
    } catch (err) {
      console.error(err);
      showToast('Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.');
      setStatusText('Akses kamera ditolak');
    }
  };

  const stopCamera = () => {
    clearInterval(autoTimerRef.current);
    setAutoTimer(null);
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    setStatusText('Kamera tidak aktif');
  };

  const flipCamera = async () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    stopCamera();
    setTimeout(() => {
      startCamera();
    }, 100);
  };

  // Grab snapshot from video element
  const grabFrame = () => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 960;
    const ctx = canvas.getContext('2d');
    ctx.save();
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    return canvas;
  };

  // Single Photo Capture
  const handleSingleCapture = async () => {
    if (!isActive || isCapturing) return;
    setIsCapturing(true);
    triggerFlash();

    const canvas = grabFrame();
    if (!canvas) {
      setIsCapturing(false);
      return;
    }

    try {
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
      const formData = new FormData();
      formData.append('photo', blob, 'capture.png');

      const res = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal menyimpan foto.');

      showToast('Foto berhasil diambil! 📸');
      if (onPhotoSaved) onPhotoSaved();
    } catch (err) {
      showToast(err.message || 'Gagal menyimpan foto.');
    } finally {
      setIsCapturing(false);
    }
  };

  // 3-Strip Sequential Burst Capture
  const handleStripCapture = async () => {
    if (!isActive || isCapturing) return;
    setIsCapturing(true);
    const frames = [];

    try {
      for (let pose = 1; pose <= 3; pose++) {
        for (let count = 3; count >= 1; count--) {
          setAutoTimer({ label: `Pose ${pose}/3`, val: count });
          setStatusText(`Pose ${pose}/3: Bersiap... (${count}s)`);
          await new Promise((r) => setTimeout(r, 1000));
        }

        setAutoTimer({ label: `Pose ${pose}/3`, val: '📸 SMILE!' });
        triggerFlash();
        const frame = grabFrame();
        frames.push(frame);

        if (pose < 3) {
          setStatusText(`Pose ${pose} selesai! Ganti gaya berikutnya...`);
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      setAutoTimer(null);
      setStatusText('3 Pose berhasil diambil!');
      showToast('3 Pose berhasil diambil! Pilih tema strip favoritmu ✨');
      if (onStripReady) onStripReady(frames);
    } catch (err) {
      console.error(err);
      showToast('Terjadi kesalahan saat mengambil strip 3 foto.');
    } finally {
      setIsCapturing(false);
      setAutoTimer(null);
    }
  };

  const handleCaptureClick = () => {
    if (captureMode === 'strip') {
      handleStripCapture();
    } else {
      handleSingleCapture();
    }
  };

  // Auto-capture for single mode
  useEffect(() => {
    if (isActive && captureMode === 'single') {
      let count = 5;
      setAutoTimer({ label: 'Foto otomatis', val: count });
      autoTimerRef.current = setInterval(() => {
        count -= 1;
        if (count <= 0) {
          count = 5;
          handleSingleCapture();
        }
        setAutoTimer({ label: 'Foto otomatis', val: count });
      }, 1000);

      return () => {
        clearInterval(autoTimerRef.current);
      };
    } else {
      clearInterval(autoTimerRef.current);
      setAutoTimer(null);
    }
  }, [isActive, captureMode]);

  return (
    <div className="camera-card">
      <div className="camera-stage">
        {flash && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#ffffff',
              opacity: 0.9,
              zIndex: 20,
              pointerEvents: 'none',
              transition: 'opacity 0.2s ease-out'
            }}
          />
        )}

        <video
          ref={videoRef}
          className={`camera-video ${facingMode === 'environment' ? 'is-back' : ''}`}
          playsInline
          muted
          style={{ display: isActive ? 'block' : 'none' }}
        />

        {!isActive && (
          <div className="camera-placeholder">
            <div className="placeholder-icon">◉</div>
            <strong style={{ display: 'block', fontSize: '1.1rem', marginBottom: '4px' }}>
              Kamera belum aktif
            </strong>
            <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              Tekan tombol "Mulai Kamera" di samping untuk memulai.
            </span>
          </div>
        )}

        {isActive && (
          <div className="live-badge">
            <div className="live-dot" /> LIVE
          </div>
        )}

        {autoTimer && (
          <div className="auto-timer-overlay">
            <span>{autoTimer.label}</span>
            <strong>{autoTimer.val}</strong>
          </div>
        )}
      </div>

      <div className="mode-switch-wrapper">
        <button
          type="button"
          className={`mode-pill ${captureMode === 'single' ? 'is-active' : ''}`}
          onClick={() => {
            setCaptureMode('single');
            setStatusText('Kamera aktif · Foto otomatis 5s');
          }}
        >
          📸 Foto Satuan
        </button>
        <button
          type="button"
          className={`mode-pill ${captureMode === 'strip' ? 'is-active' : ''}`}
          onClick={() => {
            setCaptureMode('strip');
            setStatusText('Mode Strip 3 Foto (Tekan shutter untuk mulai)');
          }}
        >
          🎞️ Mode Strip 3 Foto
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px', fontSize: '0.75rem', color: 'var(--muted)' }}>
        <span>{statusText}</span>
        <span>{facingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang'}</span>
      </div>

      <div className="camera-controls-row">
        <button
          type="button"
          className="icon-btn"
          disabled={!isActive || isCapturing}
          onClick={flipCamera}
          title="Ganti kamera depan/belakang"
        >
          ↻
        </button>

        <button
          type="button"
          className="shutter-btn"
          disabled={!isActive || isCapturing}
          onClick={handleCaptureClick}
          title={captureMode === 'strip' ? 'Mulai sesi 3 pose' : 'Ambil foto'}
        >
          <div className="shutter-inner" />
        </button>

        <button
          type="button"
          className="icon-btn"
          disabled={!isActive}
          onClick={stopCamera}
          title="Matikan kamera"
        >
          ■
        </button>
      </div>

      <div style={{ marginTop: '12px' }}>
        {!isActive ? (
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={startCamera}
          >
            Aktifkan Kamera
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={stopCamera}
          >
            Hentikan Kamera
          </button>
        )}
      </div>
    </div>
  );
}

