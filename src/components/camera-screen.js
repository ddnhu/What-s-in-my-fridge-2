export function renderCameraScreen(container, { photos, onNavigateToGallery }) {
  container.innerHTML = `
    <section class="camera-screen" aria-label="Camera capture">
      <div class="preview-area">
        <video class="camera-video" autoplay playsinline muted></video>
        <img class="camera-still" alt="" aria-hidden="true" />
        <canvas class="camera-canvas" hidden></canvas>
        <div class="preview-message">
          <p class="preview-label">Camera preview</p>
          <p class="preview-sublabel">Tap allow to enable camera</p>
        </div>
      </div>
      <div class="controls">
        <button class="btn-library" type="button" aria-label="Open fridge">
          <img src="src/components/icons/fridge.svg" width="52" height="52" alt="" aria-hidden="true" />
          <span class="fridge-badge" hidden></span>
        </button>
        <button class="btn-capture" type="button" aria-label="Capture photo"></button>
        <button class="btn-retake" type="button" disabled aria-label="Retake photo">
          <img src="src/components/icons/retake.svg" width="56" height="56" alt="" aria-hidden="true" />
        </button>
      </div>
    </section>
  `;

  const video      = container.querySelector('.camera-video');
  const still      = container.querySelector('.camera-still');
  const canvas     = container.querySelector('.camera-canvas');
  const captureBtn = container.querySelector('.btn-capture');
  const retakeBtn  = container.querySelector('.btn-retake');
  const fridgeBtn  = container.querySelector('.btn-library');
  const badge      = container.querySelector('.fridge-badge');
  const message    = container.querySelector('.preview-message');
  const previewArea = container.querySelector('.preview-area');

  let stream = null;

  // --- badge ---

  function updateBadge() {
    badge.textContent = photos.length > 99 ? '99' : photos.length;
    badge.hidden = photos.length === 0;
  }
  updateBadge();

  // --- camera start ---

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    // Use `ideal` so the constraint is preferred but not required — more reliable on mobile
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }
    })
      .then(s => {
        stream = s;
        video.srcObject = stream;
        // play() is required on some mobile browsers after srcObject is set
        return video.play();
      })
      .then(() => {
        video.classList.add('active');
        message.hidden = true;
      })
      .catch(() => {
        // Permission denied or no camera — placeholder message stays visible
      });
  }

  startCamera();

  // --- capture ---

  captureBtn.addEventListener('click', () => {
    if (!stream || video.readyState < 2) return; // not ready yet

    canvas.width  = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    photos.push(dataUrl);

    // Freeze the preview on the captured frame
    still.src = dataUrl;
    still.classList.add('active');
    video.classList.remove('active');

    // Enable retake
    retakeBtn.disabled = false;

    // Flash
    const flash = document.createElement('div');
    flash.className = 'capture-flash';
    previewArea.appendChild(flash);
    setTimeout(() => flash.remove(), 400);

    // Fly to fridge
    flyToFridge(dataUrl, previewArea, fridgeBtn, updateBadge);
  });

  // --- retake ---

  retakeBtn.addEventListener('click', () => {
    still.classList.remove('active');
    still.src = '';
    video.classList.add('active');
    retakeBtn.disabled = true;
  });

  // --- navigate to gallery ---

  fridgeBtn.addEventListener('click', () => {
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    onNavigateToGallery();
  });
}

// --- fly animation ---

function flyToFridge(dataUrl, previewArea, fridgeBtn, onComplete) {
  const previewRect = previewArea.getBoundingClientRect();
  const fridgeRect  = fridgeBtn.getBoundingClientRect();

  const img = document.createElement('img');
  img.src = dataUrl;
  Object.assign(img.style, {
    position:     'fixed',
    left:         previewRect.left + 'px',
    top:          previewRect.top + 'px',
    width:        previewRect.width + 'px',
    height:       previewRect.height + 'px',
    borderRadius: '24px',
    objectFit:    'cover',
    pointerEvents:'none',
    zIndex:       '100',
  });
  document.body.appendChild(img);

  const dx = (fridgeRect.left + fridgeRect.width  / 2) - (previewRect.left + previewRect.width  / 2);
  const dy = (fridgeRect.top  + fridgeRect.height / 2) - (previewRect.top  + previewRect.height / 2);

  img.animate(
    [
      { transform: 'translate(0, 0) scale(1)',          opacity: 1   },
      { transform: `translate(${dx}px, ${dy}px) scale(0.08)`, opacity: 0.7 },
    ],
    { duration: 550, easing: 'cubic-bezier(0.4, 0, 1, 1)', fill: 'forwards' }
  ).onfinish = () => {
    img.remove();
    onComplete();
  };
}
