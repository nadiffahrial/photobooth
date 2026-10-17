const elements = {
    startCamera: document.querySelector('#startCamera'),
    cameraPreview: document.querySelector('#cameraPreview'),
    cameraStage: document.querySelector('#cameraStage'),
    cameraPlaceholder: document.querySelector('#cameraPlaceholder'),
    cameraStatus: document.querySelector('#cameraStatus'),
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
    copyCaptionBtn: document.querySelector('#copyCaptionBtn')
};

let stream = null;
let facingMode = 'user';
let toastTimer = null;
let autoCaptureTimer = null;
let autoCountdown = 5;
let isCapturing = false;

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
    elements.startCamera.querySelector('span:first-child').textContent = active ? 'Kamera aktif · foto otomatis' : 'Mulai foto otomatis';
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
        elements.cameraStatus.textContent = 'Kamera aktif · foto otomatis 5 detik';
        setCameraControls(true);
        elements.startCamera.querySelector('span:first-child').textContent = 'Kamera aktif';
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

async function capturePhoto() {
    if (!stream || isCapturing) return;

    isCapturing = true;
    const canvas = document.querySelector('#captureCanvas');
    const videoWidth = elements.cameraPreview.videoWidth || 1280;
    const videoHeight = elements.cameraPreview.videoHeight || 960;
    canvas.width = videoWidth;
    canvas.height = videoHeight;
    const context = canvas.getContext('2d');

    context.save();
    if (facingMode === 'user') {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
    }
    context.drawImage(elements.cameraPreview, 0, 0, canvas.width, canvas.height);
    context.restore();

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png', 0.96));
    if (!blob) {
        showToast('Foto tidak dapat dibuat.');
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
