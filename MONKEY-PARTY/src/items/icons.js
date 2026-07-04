/**
 * Procedural item icons: getItemIcon(itemId, size) paints the ItemDef.icon
 * description {bg, glyph, fg} onto a 2D canvas and returns a data URL.
 *
 * Lives in src/ (browser-only, needs the DOM canvas). Results are cached
 * per itemId:size.
 */

import { items } from '#shared/registries.js';

/** @type {Map<string, string>} itemId:size -> data URL */
const cache = new Map();

/* ------------------------------------------------------------------ */
/* Glyph painters                                                      */
/* ------------------------------------------------------------------ */
/* Every painter draws into a normalized 100x100 box centered at (50,50)
 * with ctx.fillStyle / strokeStyle already set to the fg color.          */

function paintDice2(ctx) {
  // Two overlapping rounded dice.
  const die = (x, y, r) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(r);
    roundedRect(ctx, -16, -16, 32, 32, 6);
    ctx.fill();
    ctx.restore();
  };
  ctx.globalAlpha = 0.55;
  die(38, 42, -0.25);
  ctx.globalAlpha = 1;
  die(60, 58, 0.2);
  // Pips on the front die (contrast via destination cutouts).
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (const [px, py] of [[52, 50], [60, 58], [68, 66]]) {
    ctx.beginPath();
    ctx.arc(px, py, 3.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function paintBanana(ctx) {
  // Crescent banana with a stem nub.
  ctx.beginPath();
  ctx.moveTo(24, 34);
  ctx.quadraticCurveTo(38, 78, 78, 62);
  ctx.quadraticCurveTo(80, 72, 70, 78);
  ctx.quadraticCurveTo(30, 90, 16, 44);
  ctx.quadraticCurveTo(18, 34, 24, 34);
  ctx.fill();
  ctx.fillRect(22, 28, 8, 10);
}

function paintCoconut(ctx) {
  ctx.beginPath();
  ctx.arc(50, 52, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (const [px, py] of [[42, 44], [58, 44], [50, 58]]) {
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Cracked-open sliver.
  ctx.beginPath();
  ctx.arc(50, 52, 32, -0.5, 0.6);
  ctx.lineWidth = 4;
  ctx.stroke();
}

function paintPeel(ctx) {
  // A splayed banana peel: three petals from a center.
  const petal = (angle) => {
    ctx.save();
    ctx.translate(50, 58);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-10, -26, 0, -40);
    ctx.quadraticCurveTo(10, -26, 0, 0);
    ctx.fill();
    ctx.restore();
  };
  petal(-0.8);
  petal(0);
  petal(0.8);
  ctx.beginPath();
  ctx.arc(50, 60, 9, 0, Math.PI * 2);
  ctx.fill();
}

function paintTotem(ctx) {
  // Stacked totem blocks with cutout eyes.
  roundedRect(ctx, 32, 22, 36, 24, 5);
  ctx.fill();
  roundedRect(ctx, 28, 50, 44, 20, 5);
  ctx.fill();
  roundedRect(ctx, 36, 74, 28, 12, 4);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(42, 33, 4, 0, Math.PI * 2);
  ctx.arc(58, 33, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(40, 56, 20, 4);
  ctx.restore();
}

function paintMask(ctx) {
  // Tribal mask: oval with eye holes and chin stripes.
  ctx.beginPath();
  ctx.ellipse(50, 52, 24, 32, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(41, 44, 6, 8, 0.2, 0, Math.PI * 2);
  ctx.ellipse(59, 44, 6, 8, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(44, 64, 12, 3);
  ctx.fillRect(44, 70, 12, 3);
  ctx.restore();
}

function paintGorilla(ctx) {
  // Gorilla head: big circle, ears, cutout face.
  ctx.beginPath();
  ctx.arc(30, 40, 10, 0, Math.PI * 2);
  ctx.arc(70, 40, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(50, 50, 26, 0, Math.PI * 2);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.ellipse(50, 60, 14, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(42, 44, 4, 0, Math.PI * 2);
  ctx.arc(58, 44, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintGhost(ctx) {
  // Classic ghost: dome + wavy skirt + cutout eyes.
  ctx.beginPath();
  ctx.arc(50, 44, 24, Math.PI, 0);
  ctx.lineTo(74, 76);
  for (let i = 0; i < 4; i += 1) {
    ctx.quadraticCurveTo(68 - i * 12, i % 2 === 0 ? 68 : 84, 62 - i * 12, 76);
  }
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(42, 44, 4.5, 0, Math.PI * 2);
  ctx.arc(58, 44, 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintCoupon(ctx) {
  // Ticket with notches and a % mark.
  ctx.save();
  ctx.translate(50, 52);
  ctx.rotate(-0.18);
  roundedRect(ctx, -30, -16, 60, 32, 5);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(-30, 0, 6, 0, Math.PI * 2);
  ctx.arc(30, 0, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(-12, -6, 5, 0, Math.PI * 2);
  ctx.arc(12, 6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-16, 8, 32, 3); // slash of the %
  ctx.restore();
}

function paintCurse(ctx) {
  // Cursed die: rounded square with a skull-ish cutout.
  ctx.save();
  ctx.translate(50, 52);
  ctx.rotate(0.3);
  roundedRect(ctx, -22, -22, 44, 44, 8);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(-8, -6, 5, 0, Math.PI * 2);
  ctx.arc(8, -6, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(-8, 6, 16, 4);
  ctx.fillRect(-6, 12, 3, 5);
  ctx.fillRect(3, 12, 3, 5);
  ctx.restore();
}

function paintMagnet(ctx) {
  // Horseshoe magnet.
  ctx.lineWidth = 14;
  ctx.beginPath();
  ctx.arc(50, 46, 20, Math.PI, 0);
  ctx.lineTo(70, 74);
  ctx.moveTo(30, 46);
  ctx.lineTo(30, 74);
  ctx.stroke();
  // Pole tips.
  ctx.fillRect(23, 66, 14, 12);
  ctx.fillRect(63, 66, 14, 12);
}

function paintBox(ctx) {
  // Isometric-ish crate with a ? cutout.
  roundedRect(ctx, 26, 30, 48, 44, 6);
  ctx.fill();
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(50, 46, 9, Math.PI * 0.9, Math.PI * 2.2);
  ctx.stroke();
  ctx.fillRect(47, 56, 6, 7);
  ctx.beginPath();
  ctx.arc(50, 69, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function paintTicket(ctx) {
  // Golden ticket with a star cutout.
  ctx.save();
  ctx.translate(50, 52);
  ctx.rotate(0.14);
  roundedRect(ctx, -32, -18, 64, 36, 4);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  starPath(ctx, 0, 0, 12, 5);
  ctx.fill();
  ctx.fillRect(-30, -18, 3, 36);
  ctx.fillRect(27, -18, 3, 36);
  ctx.restore();
}

function paintShell(ctx) {
  // Spiral snail shell.
  ctx.lineWidth = 8;
  ctx.beginPath();
  let radius = 24;
  let angle = -Math.PI / 2;
  ctx.moveTo(50 + Math.cos(angle) * radius, 54 + Math.sin(angle) * radius);
  for (let i = 0; i < 40; i += 1) {
    angle += 0.28;
    radius *= 0.94;
    ctx.lineTo(50 + Math.cos(angle) * radius, 54 + Math.sin(angle) * radius);
  }
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(50, 54, 30, -0.4, 1.2);
  ctx.lineWidth = 5;
  ctx.stroke();
}

function paintQuestion(ctx) {
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(50, 42, 14, Math.PI * 0.9, Math.PI * 2.2);
  ctx.stroke();
  ctx.fillRect(46, 58, 8, 10);
  ctx.beginPath();
  ctx.arc(50, 78, 5, 0, Math.PI * 2);
  ctx.fill();
}

const GLYPHS = {
  dice2: paintDice2,
  banana: paintBanana,
  coconut: paintCoconut,
  peel: paintPeel,
  totem: paintTotem,
  mask: paintMask,
  gorilla: paintGorilla,
  ghost: paintGhost,
  coupon: paintCoupon,
  curse: paintCurse,
  magnet: paintMagnet,
  box: paintBox,
  ticket: paintTicket,
  shell: paintShell,
  question: paintQuestion,
};

/* ------------------------------------------------------------------ */
/* Shared path helpers                                                 */
/* ------------------------------------------------------------------ */

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function starPath(ctx, cx, cy, outer, points) {
  const inner = outer * 0.45;
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

/**
 * Paint (or fetch from cache) the icon for an item.
 *
 * @param {string} itemId Registered ItemDef id (unknown ids get a fallback icon).
 * @param {number} [size] Square icon size in px (default 64).
 * @returns {string} PNG data URL.
 */
export function getItemIcon(itemId, size = 64) {
  const key = `${itemId}:${size}`;
  const cached = cache.get(key);
  if (cached) return cached;

  const def = items.get(itemId);
  const icon = def?.icon ?? { bg: '#334155', glyph: 'question', fg: '#e2e8f0' };

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const scale = size / 100;
  ctx.scale(scale, scale);

  // Background: rounded tile with a soft radial highlight.
  roundedRect(ctx, 2, 2, 96, 96, 18);
  ctx.fillStyle = icon.bg;
  ctx.fill();
  const glow = ctx.createRadialGradient(38, 32, 6, 50, 50, 70);
  glow.addColorStop(0, 'rgba(255,255,255,0.28)');
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  roundedRect(ctx, 2, 2, 96, 96, 18);
  ctx.fillStyle = glow;
  ctx.fill();

  // Glyph.
  ctx.fillStyle = icon.fg;
  ctx.strokeStyle = icon.fg;
  const paint = GLYPHS[icon.glyph] ?? GLYPHS.question;
  paint(ctx);

  const url = canvas.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

export default getItemIcon;
