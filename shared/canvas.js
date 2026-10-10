/**
 * canvas.js - Shared canvas helpers for Tiny Worlds
 * High-DPI sizing and a delta-time animation loop.
 */

/** Size a canvas to its CSS box at device pixel ratio and reset the transform. */
function fitCanvas(canvas, ctx, width = canvas.clientWidth || window.innerWidth, height = canvas.clientHeight || window.innerHeight) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { width, height, dpr };
}

/** Full-window stage: keeps a canvas fitted on resize and reports its size. */
function createStage(canvas, onResize) {
  const ctx = canvas.getContext('2d');
  const stage = { canvas, ctx, width: 0, height: 0, dpr: 1 };
  const fit = () => {
    Object.assign(stage, fitCanvas(canvas, ctx, window.innerWidth, window.innerHeight));
    if (onResize) onResize(stage);
  };
  window.addEventListener('resize', fit);
  fit();
  return stage;
}

/** requestAnimationFrame loop passing (dt seconds, clamped, time seconds). */
function startLoop(frame) {
  let last = performance.now();
  const tick = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    frame(dt, now / 1000);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

const prefersReducedMotion = () =>
  window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
