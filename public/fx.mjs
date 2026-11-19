// Confetti and sparks drawn on one canvas above the page. Skipped when the system asks for less motion.
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const COLORS = {party: ['#ff3b55', '#a64dff', '#ffd25e', '#fdf8ee', '#1b1320'], purple: ['#a64dff', '#c993ff', '#7b2fe0', '#fdf8ee'], gold: ['#ffd25e', '#ffe9a8', '#fdf8ee']};
let canvas = null, ctx = null, parts = [], raf = 0;

function ensure() {
  if (canvas?.isConnected) return;
  canvas = document.createElement('canvas');
  canvas.className = 'fx-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  ctx = canvas.getContext('2d');
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function loop() {
  ctx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter(p => p.life > 0);
  for (const p of parts) {
    p.vy += p.g; p.vx *= p.drag; p.vy *= p.drag;
    p.x += p.vx; p.y += p.vy; p.rot += p.vr; p.life--;
    const fade = Math.min(1, p.life / 25);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    ctx.fillStyle = p.color;
    if (p.shape === 'suit') { ctx.font = `${p.size * 2.2}px Rubik, sans-serif`; ctx.textAlign = 'center'; ctx.fillText(p.glyph, 0, p.size); }
    else if (p.shape === 'spark') { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, 7); ctx.fill(); }
    else { ctx.scale(1, Math.cos(p.rot * 3)); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
    ctx.restore();
  }
  if (parts.length) raf = requestAnimationFrame(loop);
  else { raf = 0; canvas.remove(); }
}

function start() { if (!raf) { resize(); raf = requestAnimationFrame(loop); } }

export function confetti({x = innerWidth / 2, y = innerHeight * 0.4, count = 90, palette = 'party', spread = 1} = {}) {
  if (reduced()) return;
  ensure();
  const colors = COLORS[palette] || COLORS.party;
  for (let i = 0; i < count; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.1 * spread, v = 7 + Math.random() * 9;
    const suit = Math.random() < 0.12;
    parts.push({x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.32, drag: 0.985, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3,
      size: 7 + Math.random() * 7, life: 90 + Math.random() * 60, color: colors[i % colors.length],
      shape: suit ? 'suit' : 'paper', glyph: ['♥', '♠', '♦', '♣'][i % 4]});
  }
  start();
}

export function sparks(el, palette = 'gold', count = 22) {
  if (reduced() || !el) return;
  ensure();
  const r = el.getBoundingClientRect(), colors = COLORS[palette] || COLORS.gold;
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 6;
    parts.push({x: cx, y: cy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.06, drag: 0.94, rot: 0, vr: 0,
      size: 3 + Math.random() * 4, life: 34 + Math.random() * 20, color: colors[i % colors.length], shape: 'spark'});
  }
  start();
}

addEventListener('resize', () => { if (raf) resize(); });
