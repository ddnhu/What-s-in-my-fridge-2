import { renderCameraScreen } from './src/components/camera-screen.js';
import { renderGalleryScreen } from './src/components/gallery-screen.js';

const app = document.getElementById('app');
const photos = [];

function showCamera() {
  renderCameraScreen(app, { photos, onNavigateToGallery: showGallery });
}

function showGallery() {
  renderGalleryScreen(app, { photos, onBack: showCamera });
}

showCamera();
