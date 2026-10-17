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
  const [captureMode, setCaptureMode] = useState('strip'); // Default 'strip'
  const [autoTimer, setAutoTimer] = useState(null);
  const [statusText, setStatusText] = useState('Kamera belum aktif');
  const [flash, setFlash] = useState(false);

  // Dynamic Camera Ratio: 3:4 for Mobile (iOS & Android) | 4:3 for Desktop
  const [aspectRatioMode, setAspectRatioMode] = useState(isMobileInitial ? 'portrait' : 'landscape');

  // Ultra-Wide (0.5x) and Multi-Lens States
  const [activeLens, setActiveLens] = useState('1x'); // '0.5x' | '1x' | '2x'
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [zoomCapabilities, setZoomCapabilities] = useState(null);
  const [hasHardwareUltraWide, setHasHardwareUltraWide] = useState(false);

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
  const startCamera = async (overrideFacing, overrideDeviceId, overrideRatio) => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast('Kamera tidak didukung di peramban ini.');
      return;
    }

    const currentFacing = overrideFacing || facingMode;
    const currentDeviceId = overrideDeviceId !== undefined ? overrideDeviceId : selectedDeviceId;
    const currentRatio = overrideRatio || aspectRatioMode;
    const isPortrait = currentRatio === 'portrait';

    try {
      stopCamera();
      setStatusText('Mengaktifkan kamera…');

      // Video constraints tailored per device & ratio
      const videoConstraints = {
        facingMode: currentDeviceId ? undefined : { ideal: currentFacing },
        deviceId: currentDeviceId ? { exact: currentDeviceId } : undefined,
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

      // Check track capabilities for hardware zoom and ultra-wide
      const track = mediaStream.getVideoTracks()[0];
      if (track) {
        const capabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (capabilities.zoom) {
          setZoomCapabilities(capabilities.zoom);
          if (capabilities.zoom.min <= 0.7) {
            setHasHardwareUltraWide(true);
          }
        }
      }

      // Enumerate camera devices to detect multi-lenses (common on iPhone & Android)
      if (navigator.mediaDevices.enumerateDevices) {
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === 'videoinput');
          setAvailableCameras(videoInputs);
          const ultra = videoInputs.find((d) => /ultra|0\.5|wide-angle|superwide/i.test(d.label));
          if (ultra) {
            setHasHardwareUltraWide(true);
          }
        } catch {}
      }
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
    setSelectedDeviceId('');
    setActiveLens('1x');
    await startCamera(nextMode, '', aspectRatioMode);
  };

  // Ultra-Wide (0.5x) / 1x / 2x Lens Switcher
  const handleSelectLens = async (lens) => {
    triggerHaptic(20);
    setActiveLens(lens);

    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (!track) return;

    if (lens === '0.5x') {
      // 1. Check if hardware zoom <= 0.7 is supported (iOS 17+ / Android)
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.zoom && capabilities.zoom.min <= 0.7) {
        try {
          await track.applyConstraints({ advanced: [{ zoom: capabilities.zoom.min }] });
          showToast('Mode Ultra-Wide 0.5x aktif! 🌐');
          return;
        } catch {}
      }

      // 2. Check if a dedicated physical ultra-wide camera device exists
      const ultraDevice = availableCameras.find((d) => /ultra|0\.5|wide-angle|superwide/i.test(d.label));
      if (ultraDevice && ultraDevice.deviceId !== selectedDeviceId) {
        setSelectedDeviceId(ultraDevice.deviceId);
        setFacingMode('environment');
        await startCamera('environment', ultraDevice.deviceId, aspectRatioMode);
        showToast('Kamera Ultra-Wide fisik aktif! 🌐');
        return;
      }

      // 3. Fallback info
      showToast('Mode Bidang Pandang Lebar (Ultra-Wide) diaktifkan. 🌐');
    } else if (lens === '1x') {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.zoom) {
        try {
          await track.applyConstraints({ advanced: [{ zoom: 1.0 }] });
        } catch {}
      }
      if (selectedDeviceId) {
        setSelectedDeviceId('');
        await startCamera(facingMode, '', aspectRatioMode);
      }
      showToast('Kamera Standar 1x aktif.');
    } else if (lens === '2x') {
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.zoom && capabilities.zoom.max >= 2.0) {
        try {
          await track.applyConstraints({ advanced: [{ zoom: 2.0 }] });
          showToast('Telephoto Zoom 2x aktif! 🔍');
          return;
        } catch {}
      }
      showToast('Zoom 2x diaktifkan.');
    }
  };

  // Toggle Aspect Ratio manually between Portrait (3:4) and Landscape (4:3)
  const toggleAspectRatio = () => {
    triggerHaptic(15);
    const nextRatio = aspectRatioMode === 'portrait' ? 'landscape' : 'portrait';
    setAspectRatioMode(nextRatio);
    startCamera(facingMode, selectedDeviceId, nextRatio);
    showToast(
      nextRatio === 'portrait'
        ? 'Rasio Kamera: 3:4 Portrait (Cocok untuk Mobile / Strip Vertikal) 📱'
        : 'Rasio Kamera: 4:3 Landscape (Cocok untuk Desktop / Layar Lebar) 💻'
    );
  };

  // Grab snapshot from video element matching the selected aspect ratio
  const grabFrame = () => {
    const video = videoRef.current;
    if (!video) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || (aspectRatioMode === 'portrait' ? 1080 : 1440);
    canvas.height = video.videoHeight || (aspectRatioMode === 'portrait' ? 1440 : 1080);
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

  // Single Photo Capture with Compact Bottom Timer
  const handleSingleCapture = async () => {
    if (!isActive || isCapturing) return;
    setIsCapturing(true);

    try {
      for (let count = 3; count >= 1; count--) {
        setAutoTimer({ label: 'Foto Tunggal', val: count, poseIndex: 1, totalPoses: 1 });
        playBeep(count === 1 ? 1100 : count === 2 ? 880 : 700);
        triggerHaptic(15);
        setStatusText(`Bersiap foto dalam ${count} detik...`);
        await new Promise((r) => setTimeout(r, 1000));
      }

      setAutoTimer({ label: 'Foto Tunggal', val: '📸 SMILE!', poseIndex: 1, totalPoses: 1 });
      playShutterSound();
      triggerHaptic(40);
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
          photo: data.photo
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
    if (captureMode === 'strip') {
      handleStripCapture();
    } else {
      handleSingleCapture();
    }
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

        {/* FLOATING LENS SELECTOR BAR: 0.5x Ultra-Wide, 1x, 2x */}
        {isActive && (
          <div className="camera-lens-bar">
            <button
              type="button"
              className={`lens-chip ${activeLens === '0.5x' ? 'is-active' : ''}`}
              onClick={() => handleSelectLens('0.5x')}
              title="Gunakan Lensa Ultra-Wide (0.5x)"
            >
              <span>0.5x</span>
              <span className="lens-sub">WIDE</span>
            </button>
            <button
              type="button"
              className={`lens-chip ${activeLens === '1x' ? 'is-active' : ''}`}
              onClick={() => handleSelectLens('1x')}
              title="Kamera Standar (1x)"
            >
              <span>1x</span>
            </button>
            <button
              type="button"
              className={`lens-chip ${activeLens === '2x' ? 'is-active' : ''}`}
              onClick={() => handleSelectLens('2x')}
              title="Telephoto Zoom (2x)"
            >
              <span>2x</span>
            </button>
          </div>
        )}

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

      {/* Mode Switcher */}
      <div className="mode-segmented" style={{ marginBottom: '14px' }}>
        <button
          type="button"
          className={`mode-btn ${captureMode === 'strip' ? 'is-active' : ''}`}
          onClick={() => {
            triggerHaptic(15);
            setCaptureMode('strip');
          }}
        >
          🎞️ 3-Strip Photobooth
        </button>
        <button
          type="button"
          className={`mode-btn ${captureMode === 'single' ? 'is-active' : ''}`}
          onClick={() => {
            triggerHaptic(15);
            setCaptureMode('single');
          }}
        >
          📷 Foto Tunggal
        </button>
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
