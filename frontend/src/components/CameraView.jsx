import React, { useState, useEffect, useRef } from 'react';
import { render3StripCanvas } from '../utils/stripRenderer';
import { STRIP_THEMES } from './ThemeSelector';
import { isStaticHost, localSavePhoto } from '../utils/localStore';

// Web Audio API: Shared Singleton to prevent thread and memory leaks
let sharedAudioCtx = null;
function getAudioContext() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
      sharedAudioCtx = new AudioCtx();
    }
    if (sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch {
    return null;
  }
}

function playBeep(frequency = 880, duration = 0.14) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
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
    const ctx = getAudioContext();
    if (!ctx) return;
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
  deviceInfo = {},
  selectedTheme = 'haru-pastel',
  onChangeTheme,
  onPhotoSaved,
  onStripComplete,
  showToast
}) {
  const isMobileInitial = deviceInfo?.isMobile || (typeof window !== 'undefined' && window.innerWidth <= 768);

  const [stream, setStream] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const [isActive, setIsActive] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [autoTimer, setAutoTimer] = useState(null);
  const [statusText, setStatusText] = useState('Kamera belum aktif');
  const [flash, setFlash] = useState(false);

  // Dynamic Camera Ratio: 3:4 for Mobile (iOS & Android) | 4:3 for Desktop
  const [aspectRatioMode, setAspectRatioMode] = useState(isMobileInitial ? 'portrait' : 'landscape');

  const videoRef = useRef(null);
  const autoTimerRef = useRef(null);

  const activeThemeObj = STRIP_THEMES.find((t) => t.id === selectedTheme) || STRIP_THEMES[0];

  const triggerHaptic = (duration = 25) => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try { navigator.vibrate(duration); } catch {}
    }
  };

  const triggerFlash = () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 260);
  };

  // Start Camera with Dynamic Resolution and Aspect Ratio
  const startCamera = async (overrideFacing, overrideRatio) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Kamera tidak didukung di peramban ini.');
      return;
    }

    const currentFacing = overrideFacing || facingMode;
    const currentRatio = overrideRatio || aspectRatioMode;
    const isPortrait = currentRatio === 'portrait';

    try {
      stopCamera();
      setStatusText('Mengaktifkan kamera…');

      // Video constraints tailored per device & ratio
      const videoConstraints = {
        facingMode: { ideal: currentFacing },
        width: isPortrait ? { ideal: 1080 } : { ideal: 1920 },
        height: isPortrait ? { ideal: 1440 } : { ideal: 1440 },
        aspectRatio: isPortrait ? { ideal: 0.75 } : { ideal: 1.333333 }
      };

      let mediaStream;
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: false
        });
      } catch {
        // Fallback constraint if high-res fails
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: currentFacing } },
          audio: false
        });
      }

      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }
      setIsActive(true);
      setStatusText(
        isPortrait
          ? 'Kamera aktif · Rasio 3:4 Portrait (Mobile)'
          : 'Kamera aktif · Rasio 4:3 Landscape (Desktop)'
      );
    } catch (err) {
      console.error(err);
      const isIOS = deviceInfo?.isIOS;
      const errorMsg = isIOS
        ? 'Akses kamera ditolak. Di iOS Safari: Masuk ke Pengaturan > Safari > Kamera > Izinkan.'
        : 'Tidak dapat mengakses kamera. Pastikan izin kamera telah diberikan.';
      showToast(errorMsg);
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
    triggerHaptic(20);
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    setFacingMode(nextMode);
    await startCamera(nextMode, aspectRatioMode);
  };

  // Toggle Aspect Ratio manually between Portrait (3:4) and Landscape (4:3)
  const toggleAspectRatio = () => {
    triggerHaptic(15);
    const nextRatio = aspectRatioMode === 'portrait' ? 'landscape' : 'portrait';
    setAspectRatioMode(nextRatio);
    startCamera(facingMode, nextRatio);
    showToast(
      nextRatio === 'portrait'
        ? 'Rasio Kamera: 3:4 Portrait (Cocok untuk Mobile / Strip Vertikal) 📱'
        : 'Rasio Kamera: 4:3 Landscape (Cocok untuk Desktop / Layar Lebar) 💻'
    );
  };

  // Grab snapshot from video element matching the selected aspect ratio with RAM optimization
  const grabFrame = () => {
    const video = videoRef.current;
    if (!video) return null;

    const rawW = video.videoWidth || (aspectRatioMode === 'portrait' ? 1080 : 1440);
    const rawH = video.videoHeight || (aspectRatioMode === 'portrait' ? 1440 : 1080);

    // RAM Optimization: Cap dimensions to max 960px.
    // The photo slot in the vertical strip is 680x510, so 960px delivers crystal-clear retina rendering
    // while reducing uncompressed frame RAM by ~85% (from 33MB down to ~3MB).
    const maxDim = 960;
    let targetW = rawW;
    let targetH = rawH;
    if (rawW > maxDim || rawH > maxDim) {
      if (rawW >= rawH) {
        targetW = maxDim;
        targetH = Math.round((rawH / rawW) * maxDim);
      } else {
        targetH = maxDim;
        targetW = Math.round((rawW / rawH) * maxDim);
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    ctx.save();
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    return canvas;
  };

  // 3-Strip Sequential Burst Capture with Compact Bottom Timer & Sound
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
          triggerHaptic(15);
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
        triggerHaptic(40);
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
      const filename = `strip_${selectedTheme}_${Date.now()}.png`;

      // Free intermediate stripCanvas backing store memory immediately
      stripCanvas.width = 0;
      stripCanvas.height = 0;

      let savedPhoto = null;

      if (isStaticHost()) {
        savedPhoto = await localSavePhoto(blob, filename);
      } else {
        try {
          const formData = new FormData();
          formData.append('photo', blob, filename);
          const res = await fetch('/api/photos', {
            method: 'POST',
            body: formData,
            credentials: 'include'
          });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'Gagal menyimpan soft file strip.');
          savedPhoto = data.photo || { name: data.name, url: data.url };
        } catch {
          savedPhoto = await localSavePhoto(blob, filename);
        }
      }

      showToast('3 Pose selesai! Soft file & QR code siap diunduh 🎉');
      if (onPhotoSaved) onPhotoSaved();

      if (onStripComplete) {
        onStripComplete({
          frames,
          theme: selectedTheme,
          photo: savedPhoto
        });
      }
    } catch (err) {
      showToast(err.message || 'Gagal menyelesaikan sesi foto strip.');
    } finally {
      setIsCapturing(false);
      setAutoTimer(null);
    }
  };

  const handleCaptureClick = () => {
    triggerHaptic(20);
    handleStripCapture();
  };

  useEffect(() => {
    return () => {
      clearInterval(autoTimerRef.current);
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const isIOS = deviceInfo?.isIOS;
  const isMobile = deviceInfo?.isMobile || aspectRatioMode === 'portrait';

  return (
    <div className={`camera-card ${isMobile ? 'is-mobile-card' : ''} ${isIOS ? 'is-ios-card' : ''}`}>
      {/* Viewfinder Camera Stage with Dynamic Aspect Ratio */}
      <div className={`camera-stage ratio-${aspectRatioMode}`}>
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
          autoPlay
          muted
          webkit-playsinline="true"
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
            {isIOS && (
              <div className="ios-safari-tip">
                <span>💡 <strong>Tips iPhone / iPad:</strong> Ketuk 'Izinkan' (Allow) pada pop-up Safari jika meminta akses kamera.</span>
              </div>
            )}
            <button type="button" className="btn-primary" onClick={() => startCamera()}>
              <span>Aktifkan Kamera Sekarang</span>
            </button>
          </div>
        )}

        {/* Live Status Pill with Aspect Ratio & Device Tag */}
        <div className="live-pill">
          <span className={`live-dot ${isActive ? 'is-live' : ''}`} />
          <span>
            {isActive
              ? `LIVE · ${aspectRatioMode === 'portrait' ? '3:4' : '4:3'}`
              : 'OFFLINE'}
          </span>
        </div>

        {/* COMPACT BOTTOM-DOCKED COUNTDOWN TIMER (NON-OBSTRUCTIVE) */}
        {autoTimer && (
          <div className="compact-bottom-timer" role="status" aria-live="polite">
            <div className={`bottom-timer-pill ${autoTimer.val === '📸 SMILE!' ? 'is-smile' : ''} ${autoTimer.isTransition ? 'is-trans' : ''}`}>
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

      {/* Camera Meta Row with Aspect Ratio Toggle */}
      <div className="camera-meta-row">
        <span>● {statusText}</span>
        <div className="camera-meta-actions">
          <button
            type="button"
            className="ratio-toggle-btn"
            onClick={toggleAspectRatio}
            title="Ubah rasio kamera antara 3:4 (Portrait) dan 4:3 (Landscape)"
          >
            <span>📐 {aspectRatioMode === 'portrait' ? '3:4 Portrait' : '4:3 Widescreen'}</span>
          </button>
        </div>
      </div>

      {/* Shutter & Controls Row */}
      <div className="camera-shutter-row">
        <button
          type="button"
          className="icon-btn"
          disabled={!isActive || isCapturing}
          onClick={flipCamera}
          title="Ganti kamera depan/belakang (Flip)"
        >
          🔄
        </button>

        <button
          type="button"
          className="btn-take-photo"
          disabled={!isActive || isCapturing}
          onClick={handleCaptureClick}
          title="Mulai sesi 3 pose foto strip"
        >
          <span className="take-photo-icon">📸</span>
          <span>
            {isCapturing ? 'Mengambil Pose…' : 'Take Foto (3 Pose)'}
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

      {/* Power Action */}
      <div style={{ marginTop: '12px' }}>
        {!isActive ? (
          <button
            type="button"
            className="btn-primary"
            style={{ width: '100%', justifyContent: 'center' }}
            onClick={() => startCamera()}
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
