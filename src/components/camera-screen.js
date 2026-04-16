export function renderCameraScreen(container, { photos, onNavigateToGallery }) {
  container.innerHTML = `
    <video class="camera-bg" autoplay playsinline muted></video>
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
        <button class="btn-retake" type="button" disabled aria-label="Retake photo">
          <img src="src/components/icons/retake.svg" width="63" height="63" alt="" aria-hidden="true" />
        </button>
        <button class="btn-capture" type="button" aria-label="Capture photo"></button>
        <button class="btn-library" type="button" aria-label="Open fridge">
          <img class="fridge-icon" src="src/components/icons/fridge-empty.svg" width="78" height="78" alt="" aria-hidden="true" />
          <span class="fridge-badge" hidden></span>
        </button>
      </div>
    </section>
  `;

  const bgVideo    = container.querySelector('.camera-bg');
  const video      = container.querySelector('.camera-video');
  const still      = container.querySelector('.camera-still');
  const canvas     = container.querySelector('.camera-canvas');
  const captureBtn = container.querySelector('.btn-capture');
  const retakeBtn  = container.querySelector('.btn-retake');
  const fridgeBtn  = container.querySelector('.btn-library');
  const badge      = container.querySelector('.fridge-badge');
  const fridgeIcon = container.querySelector('.fridge-icon');
  const message    = container.querySelector('.preview-message');
  const previewArea = container.querySelector('.preview-area');

  let stream = null;

  // --- fridge icon state ---
  // Thresholds are defined here so they are easy to update later
  const FRIDGE_STATES = [
    { min: 0,  max: 0,        file: 'fridge-empty.svg'  },
    { min: 1,  max: 8,        file: 'fridge-low.svg'    },
    { min: 9,  max: 16,       file: 'fridge-medium.svg' },
    { min: 17, max: Infinity, file: 'fridge-full.svg'   },
  ];

  function getFridgeIcon(count) {
    const state = FRIDGE_STATES.find(s => count >= s.min && count <= s.max);
    return `src/components/icons/${state.file}`;
  }

  function updateFridgeIcon() {
    const newSrc = getFridgeIcon(photos.length);
    if (fridgeIcon.getAttribute('src') === newSrc) return;
    fridgeIcon.src = newSrc;
    // Re-trigger the animation by removing the class, forcing reflow, then re-adding
    fridgeIcon.classList.remove('bouncing');
    void fridgeIcon.offsetWidth;
    fridgeIcon.classList.add('bouncing');
  }

  // --- badge ---

  function updateBadge() {
    badge.textContent = photos.length > 99 ? '99' : photos.length;
    badge.hidden = photos.length === 0;
  }

  function updateUI() {
    updateBadge();
    updateFridgeIcon();
  }

  updateUI();

  // --- camera start ---

  function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;

    navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: 'environment' } }
    })
      .then(s => {
        stream = s;
        // Same stream feeds both: the full-screen background and the contained preview
        bgVideo.srcObject = stream;
        video.srcObject = stream;
        return Promise.all([bgVideo.play(), video.play()]);
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
    if (!stream || video.readyState < 2) return;

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
    flyToFridge(dataUrl, previewArea, fridgeBtn, updateUI);
  });

  // --- retake ---

  retakeBtn.addEventListener('click', () => {
    photos.pop();
    still.classList.remove('active');
    still.src = '';
    video.classList.add('active');
    retakeBtn.disabled = true;
    updateUI();
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

  const previewCenterX = previewRect.left + previewRect.width  / 2;
  const previewCenterY = previewRect.top  + previewRect.height / 2;
  const fridgeCenterX  = fridgeRect.left  + fridgeRect.width   / 2;
  const fridgeCenterY  = fridgeRect.top   + fridgeRect.height  / 2;

  const dx = fridgeCenterX - previewCenterX;
  const dy = fridgeCenterY - previewCenterY;

  // Final scale so the image lands at 20×20px
  const finalScale = 8 / previewRect.width;

  const img = document.createElement('img');
  img.src = dataUrl;
  // Anchor the image by its centre so scale() always originates from the middle
  Object.assign(img.style, {
    position:      'fixed',
    left:          previewCenterX + 'px',
    top:           previewCenterY + 'px',
    width:         previewRect.width  + 'px',
    height:        previewRect.height + 'px',
    marginLeft:    (-previewRect.width  / 2) + 'px',
    marginTop:     (-previewRect.height / 2) + 'px',
    borderRadius:  '24px',
    objectFit:     'cover',
    pointerEvents: 'none',
    zIndex:        '9999',
  });
  document.body.appendChild(img);

  // Arc: lifts ~60px above the start, then swoops down to the fridge.
  // Per-keyframe easing: ease-out on the rise, ease-in on the descent.
  const arcLift = -60; // px upward from start

  img.animate(
    [
      {
        transform:    'translate(0px, 0px) scale(1)',
        borderRadius: '24px',
        offset:       0,
        easing:       'ease-out',
      },
      {
        transform:    `translate(${dx * 0.35}px, ${arcLift}px) scale(${finalScale * 6})`,
        borderRadius: '2px',
        offset:       0.3,
        easing:       'cubic-bezier(0.4, 0, 1, 1)',
      },
      {
        transform:    `translate(${dx}px, ${dy}px) scale(${finalScale})`,
        borderRadius: '2px',
        offset:       1,
      },
    ],
    { duration: 800, fill: 'forwards' }
  ).onfinish = () => {
    img.remove();
    onComplete();
  };
}
