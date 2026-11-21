const layouts = {
  hero: [[0, 0, .68, 1], [.68, 0, .32, 1 / 3], [.68, 1 / 3, .32, 1 / 3], [.68, 2 / 3, .32, 1 / 3]],
  grid: [[0, 0, .5, .5], [.5, 0, .5, .5], [0, .5, .5, .5], [.5, .5, .5, .5]],
  full: [[0, 0, 1, 1]],
};

const grades = {
  vice: ['#ff9a53', '#ee438d', '#ffbd94'],
  neon: ['#f133cc', '#24eced', '#85ffff'],
  gold: ['#fff0ab', '#c88127', '#ffe0a1'],
  mono: ['#dedede', '#252525', '#f5f5f5'],
};

export function panelRects(canvas, layout) {
  const { width, height } = canvas;
  const edge = layout === 'full' ? 0 : Math.min(width, height) * .018;
  return layouts[layout].map(([x, y, w, h]) => ({
    x: edge + x * (width - edge), y: edge + y * (height - edge),
    w: w * (width - edge) - edge, h: h * (height - edge) - edge,
  }));
}

export function photoSize(panel, rect) {
  const { naturalWidth, naturalHeight } = panel.photo;
  const scale = Math.max(rect.w / naturalWidth, rect.h / naturalHeight) * panel.zoom;
  return { w: naturalWidth * scale, h: naturalHeight * scale };
}

function paintPanel(ctx, rect, panel, index, grade) {
  const { x, y, w, h } = rect;
  const [light, dark, accent] = grades[grade];
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = '#242031';
  ctx.fillRect(x, y, w, h);
  if (panel.photo) {
    const size = photoSize(panel, rect);
    if (grade === 'mono') ctx.filter = 'grayscale(1) contrast(1.45)';
    ctx.drawImage(panel.photo, x - (size.w - w) * panel.x, y - (size.h - h) * panel.y, size.w, size.h);
    ctx.filter = 'none';
  }
  const tint = ctx.createLinearGradient(x, y, x + w * .65, y + h);
  tint.addColorStop(0, light);
  tint.addColorStop(1, dark);
  ctx.fillStyle = tint;
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = .78;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
  if (!panel.photo) {
    ctx.font = `700 ${Math.min(w, h) * .065}px system-ui`;
    ctx.textAlign = 'center';
    ctx.fillStyle = accent;
    ctx.fillText(`+  ADD PHOTO ${index + 1}`, x + w / 2, y + h * .47);
  }
}

export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const unit = Math.min(w, h);
  const edge = state.layout === 'full' ? 0 : unit * .018;
  const accent = grades[state.grade][2];
  ctx.fillStyle = '#100d17';
  ctx.fillRect(0, 0, w, h);
  panelRects(canvas, state.layout).forEach((rect, i) => paintPanel(ctx, rect, state.panels[i], i, state.grade));

  const shade = ctx.createLinearGradient(0, h * .5, 0, h - edge);
  shade.addColorStop(0, '#12081800');
  shade.addColorStop(.6, '#100d1888');
  shade.addColorStop(1, '#100d18f2');
  if (state.grade === 'mono') ctx.filter = 'grayscale(1)';
  ctx.fillStyle = shade;
  ctx.fillRect(edge, h * .5, w - 2 * edge, h * .5 - edge);

  const left = edge + unit * .045;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.letterSpacing = `${unit * .003}px`;
  ctx.font = `800 ${unit * .017}px system-ui`;
  const badge = '✦  EST. 2026';
  const badgeWidth = ctx.measureText(badge).width + unit * .032;
  ctx.fillStyle = accent;
  ctx.fillRect(left, edge + unit * .035, badgeWidth, unit * .037);
  ctx.fillStyle = '#1a1020';
  ctx.fillText(badge, left + unit * .016, edge + unit * .06);

  const title = state.title.trim().toUpperCase();
  let size = unit * (w > h ? .195 : .148);
  ctx.letterSpacing = `${unit * .0018}px`;
  do {
    ctx.font = `900 ${size}px "Arial Black", system-ui, sans-serif`;
    size *= .96;
  } while (ctx.measureText(title).width > w - left * 2);
  ctx.lineJoin = 'round';
  ctx.lineWidth = unit * .009;
  ctx.strokeStyle = '#181020';
  ctx.shadowColor = '#100914';
  ctx.shadowBlur = unit * .018;
  const baseline = h - unit * .115;
  ctx.strokeText(title, left, baseline);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff4e8';
  ctx.fillText(title, left, baseline);
  ctx.font = `800 ${unit * .021}px system-ui`;
  ctx.letterSpacing = `${unit * .004}px`;
  ctx.fillStyle = accent;
  ctx.fillText(state.subtitle.trim().toUpperCase(), left, h - unit * .062, w - left * 2);
  ctx.fillRect(left, h - unit * .042, unit * .085, unit * .004);
  ctx.filter = 'none';
}
