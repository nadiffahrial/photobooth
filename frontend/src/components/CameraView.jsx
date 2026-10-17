import React, { useState, useEffect, useRef } from 'react';
import { render3StripCanvas } from '../utils/stripRenderer';
import { STRIP_THEMES } from './ThemeSelector';

// Web Audio API Synthesizers for Modern Photobooth Countdown & Shutter
function playBeep(frequency = 880, duration = 0.14) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch {}
}

function playShutterSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    [1200, 1600].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.05);
      gain.gain.setValueAtTime(0.28, ctx.currentTime + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.05 + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.05);
      osc.stop(ctx.currentTime + idx * 0.05 + 0.12);
    });
  } catch {}
}

export default function CameraView({
  selectedTheme = 'haru-pastel',
  onChangeTheme,
  onPhotoSaved,
  onStripComplete,
  showToast
}) {
  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [isActive, setIsActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [captureMode, setCaptureMode] = useState('strip'); // Default 'strip'
  const [autoTimer, setAutoTimer] = useState(null);
  const [statusText, setStatusText] = useState('Kamera belum aktif');
  const [flash, setFlash] = useState(false);

  const videoRef = useRef(null);
  const autoTimerRef = useRef(null);

  const activeThemeObj = STRIP_THEMES.find((t) => t.id === selectedTheme) || STRIP_THEMES[0];

  const triggerFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 260);
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
      setStatusText('Kamera aktif · Klik tombol Take Foto untuk mulai 3 pose!');
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

  // Single Photo Capture with Modern Countdown Overlay
  const handleSingleCapture = async () => {
    if (!isActive || isCapturing) return;
    setIsCapturing(true);

    try {
      for (let count = 3; count >= 1; count--) {
        setAutoTimer({ label: 'Foto Tunggal', val: count, poseIndex: 1, totalPoses: 1 });
        playBeep(count === 1 ? 1100 : count === 2 ? 880 : 700);
        setStatusText(`Bersiap foto dalam ${count} detik...`);
        await new Promise((r) => setTimeout(r, 1000));
      }

      setAutoTimer({ label: 'Foto Tunggal', val: '📸 SMILE!', poseIndex: 1, totalPoses: 1 });
      playShutterSound();
      triggerFlash();
      const canvas = grabFrame();
      if (!canvas) throw new Error('Foto tidak dapat dibuat.');

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
      setStatusText('Foto tersimpan! Siap untuk foto berikutnya.');
      if (onPhotoSaved) onPhotoSaved();
    } catch (err) {
      showToast(err.message || 'Gagal mengambil foto.');
    } finally {
      setIsCapturing(false);
      setAutoTimer(null);
    }
  };

  // 3-Strip Sequential Burst Capture with Modern HUD Countdown & Sounds
  const handleStripCapture = async () => {
    if (!isActive || isCapturing) return;
    setIsCapturing(true);
    const frames = [];

    try {
      for (let pose = 1; pose <= 3; pose++) {
        for (let count = 3; count >= 1; count--) {
          setAutoTimer({
            label: `Pose ${pose} dari 3`,
            val: count,
            poseIndex: pose,
            totalPoses: 3
          });
          playBeep(count === 1 ? 1150 : count === 2 ? 900 : 720);
          setStatusText(`Pose ${pose}/3: Bersiap bergaya... (${count}s)`);
          await new Promise((r) => setTimeout(r, 1000));
        }

        setAutoTimer({
          label: `Pose ${pose} dari 3`,
          val: '📸 SMILE!',
          poseIndex: pose,
          totalPoses: 3
        });
        playShutterSound();
        triggerFlash();
        const frame = grabFrame();
        frames.push(frame);

        if (pose < 3) {
          setAutoTimer({
            label: `Ganti Gaya Berikutnya!`,
            val: '✨ NEXT',
            poseIndex: pose,
            totalPoses: 3,
            isTransition: true
          });
          setStatusText(`Pose ${pose} selesai! Bersiap pose ${pose + 1}...`);
          await new Promise((r) => setTimeout(r, 900));
        }
      }

      setAutoTimer(null);
      setStatusText('3 Pose selesai diambil! Menyusun soft file strip…');

      // Render high-resolution strip canvas with the chosen theme
      const stripCanvas = document.createElement('canvas');
      render3StripCanvas(stripCanvas, frames, selectedTheme);

      // Convert to blob and upload as persistent soft file
      const blob = await new Promise((resolve) => stripCanvas.toBlob(resolve, 'image/png', 0.95));
      const formData = new FormData();
      formData.append('photo', blob, `strip_${selectedTheme}_${Date.now()}.png`);

      const res = await fetch('/api/photos', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Gagal menyimpan soft file strip.');

      showToast('3 Pose selesai! Soft file & QR code siap diunduh 🎉');
      if (onPhotoSaved) onPhotoSaved();

      if (onStripComplete) {
        onStripComplete({
          frames,
          theme: selectedTheme,
          photo: data.photo,
          canvasDataUrl: stripCanvas.toDataURL('image/png')
        });
      }
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Terjadi kesalahan saat memproses strip 3 foto.');
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

  // Auto-start camera when entering camera step if not already active
  useEffect(() => {
    if (!isActive) {
      startCamera();
    }
    return () => {
      clearInterval(autoTimerRef.current);
    };
  }, []);

  return (
    <div className="camera-card">
      {/* Active Theme Bar above Camera */}
      <div className="camera-theme-header">
        <div className="theme-current-badge">
          <span className="theme-current-dot" />
          <span className="theme-current-title">Desain Frame:</span>
          <strong>{activeThemeObj.emoji} {activeThemeObj.name}</strong>
        </div>
        {onChangeTheme && (
          <button
            type="button"
            className="btn-change-theme"
            onClick={onChangeTheme}
            title="Kembali ke pemilihan desain"
          >
            ↺ Ganti Desain
          </button>
        )}
      </div>

      <div className="camera-stage">
        {flash && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: '#ffffff',
              opacity: 0.95,
              zIndex: 50,
              pointerEvents: 'none',
              transition: 'opacity 0.25s ease-out'
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
              Kamera Belum Aktif
            </strong>
            <p style={{ fontSize: '0.82rem', color: 'var(--muted)', maxWidth: '280px', margin: '0 auto 16px' }}>
              Aktifkan kamera untuk mulai sesi foto 3 pose dengan desain <strong>{activeThemeObj.name}</strong>.
            </p>
            <button type="button" className="btn-primary" onClick={startCamera}>
              <span>Aktifkan Kamera Sekarang</span>
            </button>
          </div>
        )}

        <div className="live-pill">
          <span className={`live-dot ${isActive ? 'is-live' : ''}`} />
          <span>{isActive ? 'LIVE PREVIEW' : 'OFFLINE'}</span>
        </div>

        {/* COMPACT BOTTOM-DOCKED COUNTDOWN TIMER - UNOBSTRUCTIVE & MODERN */}
        {autoTimer && (
          <div className="compact-bottom-timer" role="status" aria-live="polite">
            <div className={`bottom-timer-pill ${autoTimer.val === '📸 SMILE!' ? 'is-smile' : ''} ${autoTimer.isTransition ? 'is-trans' : ''}`}>
              {/* Dial with Glowing Ring */}
              <div className="bottom-timer-dial">
                <svg className="bottom-dial-svg" viewBox="0 0 48 48">
                  <circle className="dial-circle-bg" cx="24" cy="24" r="20" />
                  <circle
                    className="dial-circle-progress"
                    cx="24"
                    cy="24"
                    r="20"
                    style={{
                      strokeDashoffset: typeof autoTimer.val === 'number'
                        ? (125.6 - (125.6 * (4 - autoTimer.val)) / 3)
                        : 0
                    }}
                  />
                </svg>
                <span className="bottom-dial-num" key={`${autoTimer.label}-${autoTimer.val}`}>
                  {typeof autoTimer.val === 'number' ? autoTimer.val : '📸'}
                </span>
              </div>

              {/* Info Column */}
              <div className="bottom-timer-info">
                <div className="bottom-timer-title-row">
                  <span className="bottom-timer-label">{autoTimer.label}</span>
                  {autoTimer.totalPoses > 1 && (
                    <span className="bottom-timer-dots">
                      <span className={`b-dot ${autoTimer.poseIndex >= 1 ? 'is-done' : ''}`} />
                      <span className={`b-dot ${autoTimer.poseIndex >= 2 ? 'is-done' : ''}`} />
                      <span className={`b-dot ${autoTimer.poseIndex >= 3 ? 'is-done' : ''}`} />
                    </span>
                  )}
                </div>
                <span className="bottom-timer-status">
                  {autoTimer.val === '📸 SMILE!'
                    ? 'Tahan pose & senyum! 📸'
                    : autoTimer.isTransition
                    ? 'Ganti gaya pose berikutnya! ✨'
                    : `Hitungan mundur ${autoTimer.val} detik...`}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Viewfinder brackets */}
        <div className="vf-bracket top-left" />
        <div className="vf-bracket top-right" />
        <div className="vf-bracket bottom-left" />
        <div className="vf-bracket bottom-right" />
      </div>

      {/* Camera Controls */}
      <div className="camera-meta-row">
        <span>● {statusText}</span>
        <span>{captureMode === 'strip' ? 'Mode 3-Strip (Pose 1-2-3)' : 'Foto Tunggal'}</span>
      </div>

      {/* Mode Switcher */}
      <div className="mode-segmented" style={{ marginBottom: '14px' }}>
        <button
          type="button"
          className={`mode-btn ${captureMode === 'strip' ? 'is-active' : ''}`}
          onClick={() => setCaptureMode('strip')}
        >
          🎞️ 3-Strip Photobooth
        </button>
        <button
          type="button"
          className={`mode-btn ${captureMode === 'single' ? 'is-active' : ''}`}
          onClick={() => setCaptureMode('single')}
        >
          📷 Foto Tunggal
        </button>
      </div>

      <div className="camera-shutter-row">
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
          className="btn-take-photo"
          disabled={!isActive || isCapturing}
          onClick={handleCaptureClick}
          title={captureMode === 'strip' ? 'Mulai sesi 3 pose' : 'Take Foto'}
        >
          <span className="take-photo-icon">📸</span>
          <span>
            {isCapturing
              ? 'Mengambil Pose…'
              : captureMode === 'strip'
              ? 'Take Foto (Mulai 3 Pose)'
              : 'Take Foto'}
          </span>
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
