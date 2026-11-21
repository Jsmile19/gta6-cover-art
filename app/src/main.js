// Shared editor state for the live preview and PNG exports.
import { drawCover, panelRects, photoSize } from './cover.js';
import { runShot } from './shots.js';

const byId = (id) => document.getElementById(id);
const canvas = byId('cover');
const caption = byId('caption');
const subtitle = byId('subtitle');
const fileInput = byId('photo');
const panelSelect = byId('panel');
const zoom = byId('zoom');
const size = byId('size');
const status = byId('status');
const exportButtons = [byId('export'), byId('export-all')];

const newPanel = (photo = null) => ({ photo, x: .5, y: .5, zoom: 1 });
const state = { layout: 'hero', grade: 'vice', panels: Array.from({ length: 4 }, () => newPanel()) };
let active = 0;
let pickerPanel = 0;
let drag;

function redraw() {
  state.title = caption.value;
  state.subtitle = subtitle.value;
  drawCover(canvas, state);
}

function selectPanel(index) {
  active = index;
  panelSelect.value = index;
  const panel = state.panels[index];
  zoom.value = panel.zoom;
  byId('zoom-value').value = `${panel.zoom.toFixed(2)}×`;
  zoom.disabled = byId('fill').disabled = !panel.photo;
}

function setLayout(layout) {
  drag = null;
  state.layout = layout;
  const count = panelRects(canvas, layout).length;
  panelSelect.replaceChildren(...Array.from({ length: count }, (_, i) => new Option(`Panel ${i + 1}`, i)));
  selectPanel(Math.min(active, count - 1));
  updateChoices('layout');
  redraw();
}

function updateChoices(key) {
  document.querySelectorAll(`[data-${key}]`).forEach((button) => {
    button.setAttribute('aria-pressed', button.dataset[key] === state[key]);
  });
}

function setSize() {
  const [w, h] = size.value.split('x').map(Number);
  canvas.width = w;
  canvas.height = h;
  canvas.style.setProperty('--aspect', w / h);
  byId('dimensions').value = `${w} × ${h}`;
  redraw();
}

/** Loads an image from a local URL once it can be drawn. */
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

function choosePhoto(index) {
  selectPanel(index);
  pickerPanel = index;
  fileInput.click();
}

fileInput.addEventListener('change', async () => {
  const file = fileInput.files[0];
  if (!file) return;
  const index = pickerPanel;
  const url = URL.createObjectURL(file);
  fileInput.value = '';
  try {
    state.panels[index] = newPanel(await loadImage(url));
    selectPanel(active);
    status.textContent = '';
    redraw();
  } catch {
    status.textContent = 'Could not open that photo. Try a different image.';
  } finally {
    URL.revokeObjectURL(url);
  }
});

byId('choose').addEventListener('click', () => choosePhoto(active));
byId('fill').addEventListener('click', () => {
  const photo = state.panels[active].photo;
  state.panels = state.panels.map((panel, i) => i === active ? panel : { ...panel, photo });
  redraw();
});
panelSelect.addEventListener('change', () => selectPanel(Number(panelSelect.value)));
caption.addEventListener('input', redraw);
subtitle.addEventListener('input', redraw);
size.addEventListener('change', setSize);
byId('layouts').addEventListener('click', ({ target }) => {
  const button = target.closest('[data-layout]');
  if (button) setLayout(button.dataset.layout);
});
byId('grades').addEventListener('click', ({ target }) => {
  const button = target.closest('[data-grade]');
  if (!button) return;
  state.grade = button.dataset.grade;
  updateChoices('grade');
  redraw();
});

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
function setZoom(value) {
  state.panels[active].zoom = Math.round(clamp(value, 1, 4) * 100) / 100;
  selectPanel(active);
  redraw();
}
zoom.addEventListener('input', () => setZoom(Number(zoom.value)));

function point(event) {
  const bounds = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - bounds.left) * canvas.width / bounds.width,
    y: (event.clientY - bounds.top) * canvas.height / bounds.height,
  };
}

function hitTest({ x, y }) {
  return panelRects(canvas, state.layout).findIndex((r) =>
    x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || drag || document.body.classList.contains('shot-cover')) return;
  const start = point(event);
  const index = hitTest(start);
  if (index < 0) return;
  selectPanel(index);
  drag = { start, index, id: event.pointerId, clientX: event.clientX, clientY: event.clientY,
    ...state.panels[index], moved: false };
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove', (event) => {
  if (drag?.id !== event.pointerId) return;
  drag.moved ||= Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) > 4;
  if (!drag.moved || !drag.photo) return;
  const current = point(event);
  const rect = panelRects(canvas, state.layout)[drag.index];
  const panel = state.panels[drag.index];
  const photo = photoSize(panel, rect);
  if (photo.w - rect.w > .01) panel.x = clamp(drag.x - (current.x - drag.start.x) / (photo.w - rect.w), 0, 1);
  if (photo.h - rect.h > .01) panel.y = clamp(drag.y - (current.y - drag.start.y) / (photo.h - rect.h), 0, 1);
  redraw();
});
canvas.addEventListener('pointerup', (event) => {
  if (drag?.id !== event.pointerId) return;
  const { index, moved } = drag;
  drag = null;
  if (!moved) choosePhoto(index);
});
canvas.addEventListener('lostpointercapture', () => { drag = null; });
canvas.addEventListener('wheel', (event) => {
  if (document.body.classList.contains('shot-cover') || drag) return;
  const index = hitTest(point(event));
  if (index < 0 || !state.panels[index].photo) return;
  event.preventDefault();
  selectPanel(index);
  setZoom(state.panels[index].zoom + .1 * Math.sign(-event.deltaY));
}, { passive: false });

async function download(sizes) {
  exportButtons.forEach((button) => { button.disabled = true; });
  const snapshot = { ...state, panels: state.panels.map((panel) => ({ ...panel })) };
  const output = document.createElement('canvas');
  try {
    for (const dimensions of sizes) {
      [output.width, output.height] = dimensions.split('x').map(Number);
      drawCover(output, snapshot);
      const blob = await new Promise((resolve) => output.toBlob(resolve, 'image/png'));
      if (!blob) throw new Error('PNG encoding failed');
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `cover-${dimensions}.png`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    }
    status.textContent = sizes.length === 1 ? 'PNG download started.' : 'Three PNG downloads started.';
  } catch {
    status.textContent = 'Could not export the cover. Try again.';
  } finally {
    exportButtons.forEach((button) => { button.disabled = false; });
  }
}
exportButtons[0].addEventListener('click', () => download([size.value]));
exportButtons[1].addEventListener('click', () => download(Array.from(size.options, (option) => option.value)));

const query = new URLSearchParams(location.search);
if (Array.from(size.options).some((option) => option.value === query.get('size'))) size.value = query.get('size');
setSize();
setLayout(state.layout);
updateChoices('grade');
if (query.has('shot')) {
  runShot(query.get('shot'), query, async ({ sample, alternate, title, wide }) => {
    const [photo, detail] = await Promise.all([loadImage(sample), loadImage(alternate)]);
    state.panels = [
      newPanel(photo),
      { ...newPanel(detail), y: .28 },
      { ...newPanel(photo), zoom: 1.45, x: .75, y: .24 },
      { ...newPanel(detail), zoom: 1.6, x: .18, y: .73 },
    ];
    caption.value = title.slice(0, caption.maxLength);
    subtitle.value = sample.includes('pier') ? 'After hours on the coast' : 'Stories from the Ocean Drive';
    state.grade = wide ? 'gold' : sample.includes('boulevard') ? 'neon' : 'vice';
    updateChoices('grade');
    setLayout(wide ? 'full' : 'hero');
  }).catch(() => { status.textContent = 'Could not load the sample photos.'; });
}
