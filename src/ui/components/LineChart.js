/**
 * LineChart — minimal canvas line chart used by the Stats screens.
 * Single line, axes, gridlines. ~120 lines, no dependencies.
 *
 * Usage:
 *   drawLineChart(canvas, [{ t: 0, dps: 12 }, ...], {
 *     xKey: 't', yKey: 'dps',
 *     xLabel: 'Time (s)', yLabel: 'DPS',
 *     color: '#e8a020',
 *     padding: { top:14, right:14, bottom:34, left:48 }
 *   });
 */

export function drawLineChart(canvas, data, opts = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.getBoundingClientRect();
  if (canvas.width !== r.width * dpr || canvas.height !== r.height * dpr) {
    canvas.width = r.width * dpr;
    canvas.height = r.height * dpr;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = r.width, H = r.height;
  ctx.clearRect(0, 0, W, H);

  const xKey = opts.xKey || 't';
  const yKey = opts.yKey || 'dps';
  const color = opts.color || '#e8a020';
  const muted = '#5a4838';
  const text = '#8a7a6a';
  const pad = Object.assign({ top: 14, right: 14, bottom: 32, left: 46 }, opts.padding || {});

  const x0 = pad.left, x1 = W - pad.right;
  const y0 = H - pad.bottom, y1 = pad.top;

  // Frame
  ctx.strokeStyle = muted;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0);
  ctx.stroke();

  if (!data || data.length === 0) {
    ctx.fillStyle = text;
    ctx.font = '12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(opts.emptyLabel || 'No data yet', (x0 + x1) / 2, (y0 + y1) / 2);
    return;
  }

  // Range
  let xMin = Infinity, xMax = -Infinity, yMin = 0, yMax = -Infinity;
  for (const d of data) {
    const x = d[xKey], y = d[yKey];
    if (x < xMin) xMin = x;
    if (x > xMax) xMax = x;
    if (y > yMax) yMax = y;
  }
  if (xMax === xMin) xMax = xMin + 1;
  if (yMax === 0) yMax = 1;

  const sx = (v) => x0 + (v - xMin) * (x1 - x0) / (xMax - xMin);
  const sy = (v) => y0 - (v - yMin) * (y0 - y1) / (yMax - yMin);

  // Gridlines + Y labels
  ctx.fillStyle = text;
  ctx.font = '10px JetBrains Mono, monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const v = yMin + (yMax - yMin) * (i / gridCount);
    const py = sy(v);
    ctx.strokeStyle = i === 0 ? muted : 'rgba(90,72,56,0.45)';
    ctx.beginPath(); ctx.moveTo(x0, py); ctx.lineTo(x1, py); ctx.stroke();
    ctx.fillText(formatNumber(v), x0 - 6, py);
  }
  // X labels (3 ticks)
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= 3; i++) {
    const v = xMin + (xMax - xMin) * (i / 3);
    const px = sx(v);
    ctx.fillText(`${Math.round(v)}s`, px, y0 + 6);
  }

  // Line
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (let i = 0; i < data.length; i++) {
    const px = sx(data[i][xKey]);
    const py = sy(data[i][yKey]);
    if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
  }
  ctx.stroke();

  // Filled gradient under line
  ctx.lineTo(sx(data[data.length - 1][xKey]), y0);
  ctx.lineTo(sx(data[0][xKey]), y0);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, y1, 0, y0);
  grad.addColorStop(0, hexToRgba(color, 0.3));
  grad.addColorStop(1, hexToRgba(color, 0.02));
  ctx.fillStyle = grad;
  ctx.fill();

  // Title
  if (opts.title) {
    ctx.fillStyle = '#e8a020';
    ctx.font = 'bold 12px Inter, system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(opts.title, x0, 0);
  }
}

function formatNumber(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  if (Math.abs(n) < 1) return n.toFixed(2);
  return Math.round(n).toString();
}

function hexToRgba(hex, alpha) {
  const m = hex.match(/^#([0-9a-f]{6})$/i);
  if (!m) return `rgba(232,160,32,${alpha})`;
  const v = parseInt(m[1], 16);
  return `rgba(${(v >> 16) & 0xff},${(v >> 8) & 0xff},${v & 0xff},${alpha})`;
}
