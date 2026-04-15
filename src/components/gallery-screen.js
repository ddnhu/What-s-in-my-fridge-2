export function renderGalleryScreen(container, { photos, onBack }) {
  container.innerHTML = `
    <section class="gallery-screen">
      <header class="gallery-header">
        <button class="btn-back" type="button" aria-label="Back to camera">
          <svg width="11" height="18" viewBox="0 0 11 18" fill="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 2L2 9L9 16" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <span>Back</span>
        </button>
      </header>
      <div class="gallery-grid">
        ${photos.length === 0
          ? '<p class="gallery-empty">No photos captured yet.</p>'
          : photos.map((src, i) => `<img class="gallery-photo" src="${src}" alt="Captured photo ${i + 1}" />`).join('')
        }
      </div>
    </section>
  `;

  container.querySelector('.btn-back').addEventListener('click', onBack);
}
