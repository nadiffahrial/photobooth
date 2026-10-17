const elements = {
    startCamera: document.querySelector('#startCamera'),
    cameraPreview: document.querySelector('#cameraPreview'),
    cameraStage: document.querySelector('#cameraStage'),
    cameraPlaceholder: document.querySelector('#cameraPlaceholder'),
    cameraStatus: document.querySelector('#cameraStatus'),
    burstStatus: document.querySelector('#burstStatus'),
    autoTimer: document.querySelector('#autoTimer'),
    autoTimerValue: document.querySelector('#autoTimerValue'),
    capturePhoto: document.querySelector('#capturePhoto'),
    flipCamera: document.querySelector('#flipCamera'),
    stopCamera: document.querySelector('#stopCamera'),
    galleryGrid: document.querySelector('#galleryGrid'),
    refreshGallery: document.querySelector('#refreshGallery'),
    frameOptions: [...document.querySelectorAll('.frame-option')],
    toast: document.querySelector('#toast'),
    getAiPose: document.querySelector('#getAiPose'),
    aiPoseBox: document.querySelector('#aiPoseBox'),
    aiPoseText: document.querySelector('#aiPoseText'),
    closePoseBox: document.querySelector('#closePoseBox'),
    aiCaptionModal: document.querySelector('#aiCaptionModal'),
    captionText: document.querySelector('#captionText'),
    closeCaptionModal: document.querySelector('#closeCaptionModal'),
    copyCaptionBtn: document.querySelector('#copyCaptionBtn'),
    // Mode Switcher
    modeSingle: document.querySelector('#modeSingle'),
    modeStrip: document.querySelector('#modeStrip'),
    // 3-Strip Builder Modal
    openStripFromGallery: document.querySelector('#openStripFromGallery'),
    stripModal: document.querySelector('#stripModal'),
    closeStripModal: document.querySelector('#closeStripModal'),
    stripThemePicker: document.querySelector('#stripThemePicker'),
    themeChips: [...document.querySelectorAll('.theme-chip')],
    stripCanvas: document.querySelector('#stripCanvas'),
    saveStripToGallery: document.querySelector('#saveStripToGallery'),
    downloadStripBtn: document.querySelector('#downloadStripBtn')
};

let stream = null;
let facingMode = 'user';
let toastTimer = null;
let autoCaptureTimer = null;
let autoCountdown = 5;
let isCapturing = false;

// 3-Strip Builder State
let captureMode = 'single'; // 'single' | 'strip'
let currentStripTheme = 'film-noir';
let stripFrames = []; // Holds 3 image/canvas elements

function showToast(message) {
    clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add('show');
    toastTimer = setTimeout(() => elements.toast.classList.remove('show'), 3200);
}

function setCameraControls(active) {
    elements.capturePhoto.disabled = !active;
    elements.flipCamera.disabled = !active;
    elements.stopCamera.disabled = !active;
    if (elements.startCamera) {
        const textSpan = elements.startCamera.querySelector('span:first-child');
        if (textSpan) {
            textSpan.textContent = active 
                ? (captureMode === 'strip' ? 'Kamera aktif · Mode Strip 3 Foto' : 'Kamera aktif · foto otomatis') 
                : 'Mulai foto otomatis';
        }
    }
}

function stopCamera() {
    clearInterval(autoCaptureTimer);
    autoCaptureTimer = null;
    autoCountdown = 5;
    elements.autoTimer.hidden = true;
    elements.autoTimerValue.textContent = '5';
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }
    elements.cameraPreview.srcObject = null;
    elements.cameraStage.classList.remove('is-active');
    elements.cameraStatus.textContent = 'Kamera tidak aktif';
    setCameraControls(false);
}

function updateAutoCountdown() {
    elements.autoTimerValue.textContent = String(autoCountdown);
}

function startAutoCapture() {
    clearInterval(autoCaptureTimer);
    if (captureMode === 'strip') {
        elements.autoTimer.hidden = true;
        return; // Auto-capture paused in strip mode
    }
    autoCountdown = 5;
    updateAutoCountdown();
    elements.autoTimer.hidden = false;
    autoCaptureTimer = setInterval(() => {
        if (!stream || isCapturing) return;

        autoCountdown -= 1;
        if (autoCountdown <= 0) {
            autoCountdown = 5;
            capturePhoto();
        }
        updateAutoCountdown();
    }, 1000);
}

async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
        if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            showToast('Kamera di HP membutuhkan koneksi HTTPS. Buka alamat dengan https://');
        } else {
            showToast('Kamera tidak didukung di browser ini.');
        }
        return;
    }

    try {
        elements.startCamera.disabled = true;
        elements.startCamera.querySelector('span:first-child').textContent = 'Mengaktifkan…';
        stopCamera();

        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: facingMode }, width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false
            });
        } catch (e1) {
            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: { facingMode: { ideal: facingMode } },
                    audio: false
                });
            } catch (e2) {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false
                });
            }
        }

        elements.cameraPreview.srcObject = stream;
        await elements.cameraPreview.play();
        elements.cameraStage.classList.add('is-active');
        if (facingMode === 'environment') {
            elements.cameraStage.classList.add('is-back-camera');
        } else {
            elements.cameraStage.classList.remove('is-back-camera');
        }
        elements.cameraStatus.textContent = captureMode === 'strip' 
            ? 'Kamera aktif · Siap untuk strip 3 foto' 
            : 'Kamera aktif · foto otomatis 5 detik';
        setCameraControls(true);
        startAutoCapture();
    } catch (error) {
        console.error(error);
        showToast('Tidak dapat membuka kamera. Pastikan izin kamera sudah diaktifkan.');
        elements.cameraStatus.textContent = 'Akses kamera diblokir';
        setCameraControls(false);
    } finally {
        elements.startCamera.disabled = false;
    }
}

function triggerFlash() {
    const flash = document.createElement('div');
    flash.style.position = 'absolute';
    flash.style.inset = '0';
    flash.style.background = '#ffffff';
    flash.style.opacity = '0.9';
    flash.style.zIndex = '15';
    flash.style.pointerEvents = 'none';
    flash.style.transition = 'opacity 0.22s ease-out';
    elements.cameraStage.appendChild(flash);
    requestAnimationFrame(() => {
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 250);
    });
}

function grabCurrentVideoFrame() {
    const canvas = document.createElement('canvas');
    const vw = elements.cameraPreview.videoWidth || 1280;
    const vh = elements.cameraPreview.videoHeight || 960;
    canvas.width = vw;
    canvas.height = vh;
    const ctx = canvas.getContext('2d');
    ctx.save();
    if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
    }
    ctx.drawImage(elements.cameraPreview, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    return canvas;
}

// Single photo capture
async function capturePhoto() {
    if (!stream || isCapturing) return;

    if (captureMode === 'strip') {
        await capture3StripSequence();
        return;
    }

    isCapturing = true;
    triggerFlash();
    const canvas = grabCurrentVideoFrame();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.96));
    if (!blob) {
        showToast('Foto tidak dapat dibuat.');
        isCapturing = false;
        return;
    }

    const formData = new FormData();
    formData.append('photo', blob, 'capture.png');
    elements.capturePhoto.disabled = true;
    elements.capturePhoto.setAttribute('aria-label', 'Mengambil foto');

    try {
        const response = await fetch('/api/photos', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Gagal menyimpan foto.');
        showToast('Foto berhasil diambil!');
        await loadPhotos();
    } catch (error) {
        showToast(error.message);
    } finally {
        isCapturing = false;
        elements.capturePhoto.disabled = false;
        elements.capturePhoto.setAttribute('aria-label', 'Ambil foto');
    }
}

// 3-Strip Sequential Burst Mode
async function capture3StripSequence() {
    if (!stream || isCapturing) return;
    isCapturing = true;
    setCameraControls(false);

    const frames = [];
    elements.autoTimer.hidden = false;

    try {
        for (let pose = 1; pose <= 3; pose++) {
            // 3-second countdown for each pose
            for (let c = 3; c >= 1; c--) {
                elements.autoTimer.innerHTML = `<span>Pose ${pose} dari 3</span><strong style="font-size:1.8rem;">${c}</strong>`;
                elements.cameraStatus.textContent = `Pose ${pose}/3: Bersiap... (${c}s)`;
                await new Promise(r => setTimeout(r, 1000));
            }

            elements.autoTimer.innerHTML = `<span>Pose ${pose} dari 3</span><strong style="font-size:1.4rem;">📸 SMILE!</strong>`;
            triggerFlash();
            const frame = grabCurrentVideoFrame();
            frames.push(frame);

            if (pose < 3) {
                elements.cameraStatus.textContent = `Pose ${pose} selesai! Ganti gaya berikutnya...`;
                await new Promise(r => setTimeout(r, 800));
            }
        }

        stripFrames = frames;
        elements.autoTimer.hidden = true;
        elements.cameraStatus.textContent = '3 Pose selesai diambil!';
        showToast('3 Pose berhasil diambil! Pilih tema strip favoritmu ✨');

        // Open Strip Modal & Render
        openStripModal();
    } catch (err) {
        console.error(err);
        showToast('Terjadi kesalahan saat mengambil strip 3 foto.');
    } finally {
        isCapturing = false;
        setCameraControls(true);
    }
}

function openStripModal() {
    if (!stripFrames || stripFrames.length === 0) {
        showToast('Belum ada foto untuk strip. Ambil foto terlebih dahulu!');
        return;
    }
    elements.stripModal.hidden = false;
    render3StripCanvas(currentStripTheme);
}

function closeStripModal() {
    elements.stripModal.hidden = true;
}

// Build Strip from existing gallery photos
async function buildStripFromGallery() {
    elements.openStripFromGallery.disabled = true;
    elements.openStripFromGallery.textContent = 'Memuat foto...';

    try {
        const response = await fetch('/api/photos');
        const data = await response.json();
        const photos = data.photos || [];

        if (photos.length === 0) {
            showToast('Belum ada foto di galeri. Ambil foto terlebih dahulu!');
            return;
        }

        // Pick up to 3 latest photos (duplicate if less than 3 so strip is always complete)
        let selectedPhotos = photos.slice(0, 3);
        while (selectedPhotos.length < 3) {
            selectedPhotos.push(selectedPhotos[0]);
        }

        // Load images asynchronously
        const loadedImgs = await Promise.all(selectedPhotos.map(p => {
            return new Promise((resolve) => {
                const img = new Image();
                img.crossOrigin = 'anonymous';
                img.onload = () => resolve(img);
                img.onerror = () => resolve(img);
                img.src = p.url;
            });
        }));

        stripFrames = loadedImgs;
        openStripModal();
        showToast('Strip 3 foto berhasil dimuat dari galeri!');
    } catch (err) {
        console.error(err);
        showToast('Gagal memuat foto dari galeri.');
    } finally {
        elements.openStripFromGallery.disabled = false;
        elements.openStripFromGallery.textContent = '🎞️ Buat Strip 3 Foto ▻';
    }
}

/* ==========================================================================
   Strip 3 Vertical Canvas Rendering Engine (6 Unique Themes)
   Dimensions: 800px x 1980px (Standard vertical photobooth strip)
   ========================================================================== */

function drawCoverImage(ctx, img, x, y, w, h, radius = 0) {
    if (!img) return;
    const imgW = img.videoWidth || img.naturalWidth || img.width || 1;
    const imgH = img.videoHeight || img.naturalHeight || img.height || 1;
    const srcRatio = imgW / imgH;
    const dstRatio = w / h;
    let sx, sy, sWidth, sHeight;

    if (srcRatio > dstRatio) {
        sHeight = imgH;
        sWidth = imgH * dstRatio;
        sx = (imgW - sWidth) / 2;
        sy = 0;
    } else {
        sWidth = imgW;
        sHeight = imgW / dstRatio;
        sx = 0;
        sy = (imgH - sHeight) / 2;
    }

    ctx.save();
    if (radius > 0) {
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(x, y, w, h, radius);
        } else {
            ctx.rect(x, y, w, h);
        }
        ctx.clip();
    }
    ctx.drawImage(img, sx, sy, sWidth, sHeight, x, y, w, h);
    ctx.restore();
}

function drawBarcode(ctx, x, y, width, height, color = '#ffffff') {
    ctx.save();
    ctx.fillStyle = color;
    const pattern = [3, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3, 1, 4, 2, 1, 3, 2, 1, 3, 4, 2, 1, 3];
    const totalUnits = pattern.reduce((a, b) => a + b, 0) + (pattern.length - 1);
    const unitWidth = width / totalUnits;
    let curX = x;
    pattern.forEach((weight, i) => {
        if (i % 2 === 0) {
            ctx.fillRect(curX, y, weight * unitWidth, height);
        }
        curX += (weight + 1) * unitWidth;
    });
    ctx.restore();
}

function drawSprocketHoles(ctx, totalH) {
    ctx.save();
    ctx.fillStyle = '#222226';
    ctx.strokeStyle = '#18181a';
    ctx.lineWidth = 1;
    const holeW = 20;
    const holeH = 14;
    const step = 34;
    for (let y = 20; y < totalH - 20; y += step) {
        // Left sprocket
        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(16, y, holeW, holeH, 4);
            ctx.roundRect(800 - 16 - holeW, y, holeW, holeH, 4);
        } else {
            ctx.rect(16, y, holeW, holeH);
            ctx.rect(800 - 16 - holeW, y, holeW, holeH);
        }
        ctx.fill();
        ctx.stroke();
    }
    ctx.restore();
}

function drawCornerBrackets(ctx, x, y, w, h, color, bracketLen = 26, thickness = 4) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = thickness;
    ctx.lineCap = 'square';
    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + bracketLen); ctx.lineTo(x, y); ctx.lineTo(x + bracketLen, y);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - bracketLen, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + bracketLen);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + h - bracketLen); ctx.lineTo(x, y + h); ctx.lineTo(x + bracketLen, y + h);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - bracketLen, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - bracketLen);
    ctx.stroke();
    ctx.restore();
}

function drawRubberStamp(ctx, cx, cy, radius, text, subtext, color = '#8B261E') {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-11 * Math.PI / 180);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 3;
    
    // Outer circle
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.stroke();
    
    // Inner dashed circle
    ctx.beginPath();
    ctx.setLineDash([4, 4]);
    ctx.arc(0, 0, radius - 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Text inside
    ctx.font = 'bold 13px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 0, -6);
    
    ctx.font = '9px "DM Sans", sans-serif';
    ctx.fillText(subtext, 0, 10);
    ctx.restore();
}

function render3StripCanvas(theme = 'film-noir') {
    const canvas = elements.stripCanvas;
    if (!canvas) return;

    const W = 800;
    const H = 1980;
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const photoW = 680;
    const photoH = 510;
    const px = 60;
    const py = [140, 680, 1220]; // 3 positions

    // Fallback if less than 3 frames
    const f0 = stripFrames[0] || null;
    const f1 = stripFrames[1] || f0;
    const f2 = stripFrames[2] || f1;
    const frames = [f0, f1, f2];

    ctx.clearRect(0, 0, W, H);

    /* ----------------------------------------------------
       THEME 1: FILM NOIR (35mm Authentic Kodak Film Strip)
       ---------------------------------------------------- */
    if (theme === 'film-noir') {
        // Deep matte film black
        ctx.fillStyle = '#101013';
        ctx.fillRect(0, 0, W, H);

        // Sprocket perforations along edges
        drawSprocketHoles(ctx, H);

        // Header
        ctx.fillStyle = '#D4AF37';
        ctx.font = 'bold 17px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('◆ KODAK SAFETY FILM 5063 · 35MM · ISO 400 ◆', W / 2, 75);
        ctx.fillStyle = '#8B8B94';
        ctx.font = '12px "Courier New", monospace';
        ctx.fillText('SNAP STUDIO ARCHIVES · EXPOSURE 24+ · HIGH DEFINITION', W / 2, 98);

        // Frames & Film Markings
        frames.forEach((img, i) => {
            const y = py[i];
            // Frame label
            ctx.fillStyle = '#D4AF37';
            ctx.font = 'bold 15px "Courier New", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`0${i + 1} ▶  35MM FRAME`, px, y - 10);

            // Inner dark border
            ctx.fillStyle = '#1a1a1f';
            ctx.fillRect(px - 3, y - 3, photoW + 6, photoH + 6);

            // Draw Photo
            drawCoverImage(ctx, img, px, y, photoW, photoH, 0);

            // Frame edge stroke
            ctx.strokeStyle = '#2d2d34';
            ctx.lineWidth = 2;
            ctx.strokeRect(px, y, photoW, photoH);
        });

        // Footer: Orange LED Timestamp & Barcode
        const now = new Date();
        const dateStr = `'98  ${String(now.getMonth() + 1).padStart(2, '0')}  ${String(now.getDate()).padStart(2, '0')}  ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        
        ctx.save();
        ctx.fillStyle = '#FF7A00';
        ctx.shadowColor = '#FF5500';
        ctx.shadowBlur = 10;
        ctx.font = 'bold 28px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(dateStr, W / 2, 1795);
        ctx.restore();

        drawBarcode(ctx, 240, 1835, 320, 36, '#D4AF37');
        ctx.fillStyle = '#8A8A92';
        ctx.font = '12px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SN-35MM-NOIR-7702 · SNAP STUDIO KODAK REEL', W / 2, 1895);
    }

    /* ----------------------------------------------------
       THEME 2: HARU PASTEL (Korean Haru Film / Life Four Cuts)
       ---------------------------------------------------- */
    else if (theme === 'haru-pastel') {
        // Soft pastel gradient
        const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
        bgGrad.addColorStop(0, '#FFF0F3');
        bgGrad.addColorStop(0.5, '#FCE7EB');
        bgGrad.addColorStop(1, '#FDE2E4');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);

        // Header
        ctx.fillStyle = '#844365';
        ctx.font = 'bold 36px "DM Sans", -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('하루 필름 · HARU FILM', W / 2, 72);

        ctx.fillStyle = '#B36D8E';
        ctx.font = 'bold 13px "DM Sans", sans-serif';
        ctx.letterSpacing = '3px';
        ctx.fillText('♡ PRECIOUS MOMENTS TODAY ♡', W / 2, 98);

        // Polaroid Photo Cards
        frames.forEach((img, i) => {
            const y = py[i];
            const cardX = px - 12;
            const cardY = y - 12;
            const cardW = photoW + 24;
            const cardH = photoH + 24;

            // White polaroid background with soft shadow
            ctx.save();
            ctx.shadowColor = 'rgba(180, 120, 145, 0.22)';
            ctx.shadowBlur = 18;
            ctx.shadowOffsetY = 6;
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 18);
            else ctx.rect(cardX, cardY, cardW, cardH);
            ctx.fill();
            ctx.restore();

            // Photo inside
            drawCoverImage(ctx, img, px, y, photoW, photoH, 12);

            // Cute sparkles between frames
            if (i < 2) {
                ctx.fillStyle = '#C2829D';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('✧   ✦   ♡   ✦   ✧', W / 2, y + photoH + 20);
            }
        });

        // Footer
        ctx.fillStyle = '#783A59';
        ctx.font = 'bold 22px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('우리들의 가장 빛나는 순간들 ✨', W / 2, 1785);

        ctx.fillStyle = '#A36081';
        ctx.font = '13px "DM Sans", sans-serif';
        ctx.fillText('SNAP STUDIO SEOUL · 2026. 10. 17', W / 2, 1815);

        // Cute bow / ribbon doodle
        ctx.fillStyle = '#C2829D';
        ctx.font = '24px sans-serif';
        ctx.fillText('🎀 ♡ 🌸', W / 2, 1855);
    }

    /* ----------------------------------------------------
       THEME 3: Y2K CYBER (Neon Synthwave Cyberpunk)
       ---------------------------------------------------- */
    else if (theme === 'y2k-cyber') {
        // Deep cyber indigo
        const cyberGrad = ctx.createLinearGradient(0, 0, 0, H);
        cyberGrad.addColorStop(0, '#090514');
        cyberGrad.addColorStop(1, '#150A26');
        ctx.fillStyle = cyberGrad;
        ctx.fillRect(0, 0, W, H);

        // Cyber tech grid lines
        ctx.strokeStyle = '#1D0E38';
        ctx.lineWidth = 1;
        for (let gx = 0; gx < W; gx += 40) {
            ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke();
        }
        for (let gy = 0; gy < H; gy += 40) {
            ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke();
        }

        // Header
        ctx.save();
        ctx.fillStyle = '#00F0FF';
        ctx.shadowColor = '#00F0FF';
        ctx.shadowBlur = 12;
        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('// SNAP_CYBER_MATRIX_2000 //', W / 2, 68);
        ctx.restore();

        ctx.fillStyle = '#39FF14';
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('[STATUS: LIVE REC] ● 60FPS · ISO 800 · HD TECH', W / 2, 94);

        // Frames with neon brackets and tags
        frames.forEach((img, i) => {
            const y = py[i];

            // Cyan frame
            ctx.strokeStyle = '#00F0FF';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px, y, photoW, photoH);

            // Photo
            drawCoverImage(ctx, img, px, y, photoW, photoH, 4);

            // Corner brackets in hot magenta
            drawCornerBrackets(ctx, px - 6, y - 6, photoW + 12, photoH + 12, '#FF007F', 24, 4);

            // Camera Crosshairs
            ctx.strokeStyle = '#00F0FF';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(px + photoW / 2 - 12, y + photoH / 2); ctx.lineTo(px + photoW / 2 + 12, y + photoH / 2);
            ctx.moveTo(px + photoW / 2, y + photoH / 2 - 12); ctx.lineTo(px + photoW / 2, y + photoH / 2 + 12);
            ctx.stroke();

            // Cam tag
            ctx.fillStyle = '#39FF14';
            ctx.font = 'bold 13px "Courier New", monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`CAM_0${i + 1} [ACTIVE]`, px + 8, y + 22);
        });

        // Footer
        drawBarcode(ctx, 220, 1780, 360, 42, '#00F0FF');
        ctx.fillStyle = '#FF007F';
        ctx.font = 'bold 13px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SERIAL # 992-04-Y2K-NEON · SNAP TECH SYS', W / 2, 1845);

        ctx.fillStyle = '#39FF14';
        ctx.font = '12px "Courier New", monospace';
        ctx.fillText('[ARCHIVE PROTOCOL INITIALIZED // 2026]', W / 2, 1872);
    }

    /* ----------------------------------------------------
       THEME 4: VINTAGE RETRO (Antique Newspaper & Rubber Stamp)
       ---------------------------------------------------- */
    else if (theme === 'vintage-retro') {
        // Antique parchment cream
        ctx.fillStyle = '#F5EEDA';
        ctx.fillRect(0, 0, W, H);

        // Classic double borders
        ctx.strokeStyle = '#4A3423';
        ctx.lineWidth = 3;
        ctx.strokeRect(24, 24, W - 48, H - 48);
        ctx.lineWidth = 1;
        ctx.strokeRect(32, 32, W - 64, H - 64);

        // Newspaper Masthead
        ctx.fillStyle = '#342214';
        ctx.font = 'bold 36px "Playfair Display", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.fillText('THE DAILY SNAPSHOT', W / 2, 74);

        ctx.font = 'italic 15px Georgia, serif';
        ctx.fillStyle = '#5A3D28';
        ctx.fillText('~ ❦ Special Edition · Volume CXXVI · Est. 1926 ❦ ~', W / 2, 98);

        // Horizontal divider lines
        ctx.strokeStyle = '#4A3423';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(50, 114); ctx.lineTo(W - 50, 114);
        ctx.stroke();

        // Frames with captions
        const plateTitles = ['PLATE I. CANDID STUDY', 'PLATE II. MOMENT IN TIME', 'PLATE III. TIMELESS MEMORY'];
        frames.forEach((img, i) => {
            const y = py[i];

            // Cream matting border
            ctx.fillStyle = '#FFFDF7';
            ctx.fillRect(px - 8, y - 8, photoW + 16, photoH + 16);
            ctx.strokeStyle = '#5A3D28';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(px - 8, y - 8, photoW + 16, photoH + 16);

            // Photo
            drawCoverImage(ctx, img, px, y, photoW, photoH, 0);

            // Caption under photo
            ctx.font = 'italic 13px Georgia, serif';
            ctx.fillStyle = '#4A3423';
            ctx.textAlign = 'center';
            ctx.fillText(`— ${plateTitles[i]} —`, W / 2, y + photoH + 20);
        });

        // Footer: Stamp & Quote
        drawRubberStamp(ctx, 220, 1835, 54, 'CERTIFIED', 'SNAP STUDIO 1926', '#8B261E');

        ctx.font = 'italic 16px Georgia, serif';
        ctx.fillStyle = '#342214';
        ctx.textAlign = 'left';
        ctx.fillText('"Every picture tells a story', 310, 1815);
        ctx.fillText('that time cannot erase."', 310, 1838);

        ctx.font = 'bold 11px "DM Sans", sans-serif';
        ctx.fillStyle = '#7A5B42';
        ctx.fillText('ARCHIVED: SATURDAY, OCTOBER 17, 2026', 310, 1865);
    }

    /* ----------------------------------------------------
       THEME 5: MINIMAL LUXURY (High Fashion Editorial / Vogue)
       ---------------------------------------------------- */
    else if (theme === 'minimal-luxury') {
        // Pure crisp white
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, W, H);

        // Header
        ctx.fillStyle = '#111111';
        ctx.font = '36px "Playfair Display", Georgia, serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '10px';
        ctx.fillText('A T E L I E R', W / 2, 70);

        // Gold line divider
        ctx.strokeStyle = '#C5A059';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(W / 2 - 80, 88); ctx.lineTo(W / 2 + 80, 88);
        ctx.stroke();

        ctx.fillStyle = '#777777';
        ctx.font = '11px "DM Sans", sans-serif';
        ctx.letterSpacing = '4px';
        ctx.fillText('AUTUMN / WINTER COLLECTION · EDITION N° 03', W / 2, 108);

        // Minimalist Photos with Roman numerals
        const romans = ['I', 'II', 'III'];
        frames.forEach((img, i) => {
            const y = py[i];

            // 1px Hairline gray stroke
            ctx.strokeStyle = '#EEEEEE';
            ctx.lineWidth = 1;
            ctx.strokeRect(px, y, photoW, photoH);

            // Photo
            drawCoverImage(ctx, img, px, y, photoW, photoH, 0);

            // Roman numeral label
            ctx.fillStyle = '#A0A0A0';
            ctx.font = '15px "Playfair Display", Georgia, serif';
            ctx.textAlign = 'right';
            ctx.fillText(romans[i], px + photoW - 10, y + photoH - 12);
        });

        // Footer: Luxury Brand Lockup
        ctx.fillStyle = '#111111';
        ctx.font = '18px "Playfair Display", serif';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '6px';
        ctx.fillText('S N A P   S T U D I O', W / 2, 1795);

        ctx.fillStyle = '#999999';
        ctx.font = '11px "DM Sans", sans-serif';
        ctx.letterSpacing = '3px';
        ctx.fillText('PARIS · MILANO · NEW YORK · TOKYO', W / 2, 1822);

        ctx.fillStyle = '#C5A059';
        ctx.font = '10px "DM Sans", sans-serif';
        ctx.letterSpacing = '2px';
        ctx.fillText('✦ LIMITED EDITION 03 / 500 ✦', W / 2, 1850);
    }

    /* ----------------------------------------------------
       THEME 6: MATCHA KAWAII (Sage Green Aesthetic & Doodles)
       ---------------------------------------------------- */
    else if (theme === 'matcha-kawaii') {
        // Soft matcha milk green
        const matchaGrad = ctx.createLinearGradient(0, 0, 0, H);
        matchaGrad.addColorStop(0, '#D4DEC9');
        matchaGrad.addColorStop(1, '#C2CFB5');
        ctx.fillStyle = matchaGrad;
        ctx.fillRect(0, 0, W, H);

        // Header
        ctx.fillStyle = '#3B5237';
        ctx.font = 'bold 36px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('matcha club 🍵', W / 2, 72);

        ctx.fillStyle = '#55724F';
        ctx.font = 'bold 13px "DM Sans", sans-serif';
        ctx.fillText('🌿 fresh moments & sweet vibes ☘️', W / 2, 98);

        // Cream Backed Photos
        frames.forEach((img, i) => {
            const y = py[i];
            const cardX = px - 10;
            const cardY = y - 10;
            const cardW = photoW + 20;
            const cardH = photoH + 20;

            // Cream Card
            ctx.save();
            ctx.shadowColor = 'rgba(59, 82, 55, 0.16)';
            ctx.shadowBlur = 14;
            ctx.shadowOffsetY = 4;
            ctx.fillStyle = '#FFFDF7';
            ctx.beginPath();
            if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 20);
            else ctx.rect(cardX, cardY, cardW, cardH);
            ctx.fill();
            ctx.restore();

            // Photo
            drawCoverImage(ctx, img, px, y, photoW, photoH, 14);

            // Doodles
            if (i < 2) {
                ctx.fillStyle = '#4F6D4A';
                ctx.font = '16px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText('☘️   ♡   🌿   ♡   ☘️', W / 2, y + photoH + 18);
            }
        });

        // Footer
        ctx.fillStyle = '#344B30';
        ctx.font = 'bold 24px "DM Sans", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('best day ever! ( ˶ˆᗜˆ˵ ) 🍵', W / 2, 1785);

        ctx.fillStyle = '#516E4C';
        ctx.font = '13px "DM Sans", sans-serif';
        ctx.fillText('✦ snap studio · matcha edition · 2026 ✦', W / 2, 1815);

        ctx.font = '16px sans-serif';
        ctx.fillText('🍀 keep smiling & stay fresh 🍀', W / 2, 1845);
    }
}

// Download Strip as PNG
function downloadCurrentStrip() {
    if (!elements.stripCanvas) return;
    elements.stripCanvas.toBlob(blob => {
        if (!blob) {
            showToast('Gagal memproses gambar strip.');
            return;
        }
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `snap-studio-strip-3-${currentStripTheme}.png`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Strip 3 foto berhasil diunduh! 📥');
    }, 'image/png');
}

// Save Strip directly to user gallery
async function saveCurrentStripToGallery() {
    if (!elements.stripCanvas) return;
    elements.saveStripToGallery.disabled = true;
    elements.saveStripToGallery.textContent = 'Menyimpan...';

    try {
        const blob = await new Promise(resolve => elements.stripCanvas.toBlob(resolve, 'image/png', 0.95));
        if (!blob) throw new Error('Gagal mengonversi strip ke berkas gambar.');

        const formData = new FormData();
        formData.append('photo', blob, `strip-3-${currentStripTheme}.png`);

        const response = await fetch('/api/photos', { method: 'POST', body: formData });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'Gagal menyimpan strip ke galeri.');

        showToast('Strip 3 foto berhasil disimpan ke galeri Anda! ☁️');
        await loadPhotos();
    } catch (err) {
        console.error(err);
        showToast(err.message || 'Gagal menyimpan strip.');
    } finally {
        elements.saveStripToGallery.disabled = false;
        elements.saveStripToGallery.textContent = '☁️ Simpan ke Galeri';
    }
}

function createPhotoCard(photo) {
    const item = document.createElement('article');
    item.className = 'photo-item';
    item.innerHTML = `
        <img src="${photo.url}" alt="Foto hasil photobooth">
        <div class="photo-actions">
            <a class="photo-action" href="${photo.url}" download>Unduh</a>
            <button class="photo-action ai-btn" type="button" data-ai="${photo.name}" title="Buatkan Caption AI">✨ AI</button>
            <button class="photo-action danger" type="button" data-delete="${photo.name}">Hapus</button>
        </div>`;
    return item;
}

async function loadPhotos() {
    try {
        const response = await fetch('/api/photos');
        const result = await response.json();
        elements.galleryGrid.replaceChildren();
        if (!result.photos.length) {
            const empty = document.createElement('div');
            empty.className = 'empty-gallery';
            empty.innerHTML = '<span>✦</span><p>Foto pertama Anda akan muncul di sini.</p>';
            elements.galleryGrid.append(empty);
            return;
        }
        result.photos.forEach(photo => elements.galleryGrid.append(createPhotoCard(photo)));
    } catch (error) {
        showToast('Galeri tidak dapat dimuat.');
    }
}

async function deletePhoto(filename) {
    try {
        const response = await fetch(`/api/photos/${encodeURIComponent(filename)}`, { method: 'DELETE' });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Gagal menghapus foto.');
        await loadPhotos();
        showToast('Foto dihapus.');
    } catch (error) {
        showToast(error.message);
    }
}

async function requestAiPose() {
    if (!elements.aiPoseBox || !elements.aiPoseText) return;
    elements.getAiPose.disabled = true;
    elements.getAiPose.querySelector('span').textContent = '🤖 Berpikir...';
    try {
        const res = await fetch('/api/ai/pose');
        const data = await res.json();
        elements.aiPoseText.textContent = data.pose || 'Tersenyumlah lebar dan tunjukkan gaya terbaikmu!';
        elements.aiPoseBox.hidden = false;
    } catch (err) {
        showToast('Gagal memuat rekomendasi pose.');
    } finally {
        elements.getAiPose.disabled = false;
        elements.getAiPose.querySelector('span').textContent = '✨ Ide Pose AI';
    }
}

async function generateAiCaption(filename) {
    if (!elements.aiCaptionModal || !elements.captionText) return;
    elements.aiCaptionModal.hidden = false;
    elements.captionText.textContent = '🤖 Menyusun caption estetik dengan AI...';
    try {
        const res = await fetch(`/api/photos/${encodeURIComponent(filename)}/caption`, { method: 'POST' });
        const data = await res.json();
        elements.captionText.textContent = data.caption || 'Momen seru tak terlupakan di Snap Studio! ✨📸';
    } catch (err) {
        elements.captionText.textContent = 'Momen seru di Snap Studio! ✨📸 #SnapMoment';
    }
}

function copyCaptionToClipboard() {
    if (!elements.captionText) return;
    const text = elements.captionText.textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('Caption disalin ke clipboard! 📋');
    }).catch(() => {
        showToast('Gagal menyalin caption.');
    });
}

async function flipCameraDirection() {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    stopCamera();
    await startCamera();
}

function selectFrame(frame) {
    elements.cameraStage.dataset.frame = frame;
    elements.frameOptions.forEach(option => {
        const selected = option.dataset.frame === frame;
        option.classList.toggle('is-active', selected);
        option.setAttribute('aria-pressed', String(selected));
    });
}

// Mode switching
if (elements.modeSingle && elements.modeStrip) {
    elements.modeSingle.addEventListener('click', () => {
        captureMode = 'single';
        elements.modeSingle.classList.add('is-active');
        elements.modeSingle.setAttribute('aria-pressed', 'true');
        elements.modeStrip.classList.remove('is-active');
        elements.modeStrip.setAttribute('aria-pressed', 'false');
        if (elements.burstStatus) elements.burstStatus.textContent = '1080p · 30fps';
        if (stream) {
            elements.cameraStatus.textContent = 'Kamera aktif · foto otomatis 5 detik';
            startAutoCapture();
        }
    });

    elements.modeStrip.addEventListener('click', () => {
        captureMode = 'strip';
        elements.modeStrip.classList.add('is-active');
        elements.modeStrip.setAttribute('aria-pressed', 'true');
        elements.modeSingle.classList.remove('is-active');
        elements.modeSingle.setAttribute('aria-pressed', 'false');
        if (elements.burstStatus) elements.burstStatus.textContent = 'Mode: 3-Strip (Pose 1-2-3)';
        // Stop 5-second automatic capture in strip mode so user controls when to start the 3-pose burst
        clearInterval(autoCaptureTimer);
        elements.autoTimer.hidden = true;
        if (stream) {
            elements.cameraStatus.textContent = 'Kamera aktif · Tekan tombol kamera untuk mulai 3 pose!';
        }
    });
}

// Strip Theme Picker
if (elements.stripThemePicker) {
    elements.stripThemePicker.addEventListener('click', (e) => {
        const chip = e.target.closest('.theme-chip');
        if (!chip) return;
        elements.themeChips.forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');
        currentStripTheme = chip.dataset.theme;
        render3StripCanvas(currentStripTheme);
    });
}

// Strip Modal controls
if (elements.openStripFromGallery) {
    elements.openStripFromGallery.addEventListener('click', buildStripFromGallery);
}
if (elements.closeStripModal) {
    elements.closeStripModal.addEventListener('click', closeStripModal);
}
if (elements.stripModal) {
    elements.stripModal.addEventListener('click', (e) => {
        if (e.target === elements.stripModal) closeStripModal();
    });
}
if (elements.downloadStripBtn) {
    elements.downloadStripBtn.addEventListener('click', downloadCurrentStrip);
}
if (elements.saveStripToGallery) {
    elements.saveStripToGallery.addEventListener('click', saveCurrentStripToGallery);
}

// Existing Core Events
elements.startCamera.addEventListener('click', startCamera);
elements.capturePhoto.addEventListener('click', capturePhoto);
elements.flipCamera.addEventListener('click', flipCameraDirection);
elements.stopCamera.addEventListener('click', stopCamera);
elements.refreshGallery.addEventListener('click', loadPhotos);
elements.frameOptions.forEach(option => option.addEventListener('click', () => selectFrame(option.dataset.frame)));

if (elements.getAiPose) {
    elements.getAiPose.addEventListener('click', requestAiPose);
}
if (elements.closePoseBox) {
    elements.closePoseBox.addEventListener('click', () => {
        elements.aiPoseBox.hidden = true;
    });
}
if (elements.closeCaptionModal) {
    elements.closeCaptionModal.addEventListener('click', () => {
        elements.aiCaptionModal.hidden = true;
    });
}
if (elements.copyCaptionBtn) {
    elements.copyCaptionBtn.addEventListener('click', copyCaptionToClipboard);
}
if (elements.aiCaptionModal) {
    elements.aiCaptionModal.addEventListener('click', (e) => {
        if (e.target === elements.aiCaptionModal) {
            elements.aiCaptionModal.hidden = true;
        }
    });
}

elements.galleryGrid.addEventListener('click', event => {
    const deleteBtn = event.target.closest('[data-delete]');
    if (deleteBtn) {
        deletePhoto(deleteBtn.dataset.delete);
        return;
    }
    const aiBtn = event.target.closest('[data-ai]');
    if (aiBtn) {
        generateAiCaption(aiBtn.dataset.ai);
    }
});

window.addEventListener('beforeunload', stopCamera);
loadPhotos();
