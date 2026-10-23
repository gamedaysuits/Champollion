import React, {useEffect, useRef} from 'react';

/**
 * The interlinear registers — rows of word strokes, each with its gloss
 * beneath: a text and its translation, line under line (the stela mark's
 * registers). The glosses come in out of place and slide under their words as
 * the page opens (~1.4 s, landing with the guardrails pop); a soft reading
 * lamp follows the pointer. A plain 2D canvas, decorative only (aria-hidden).
 *
 * Draws only while something changes and is idle otherwise; stops when off
 * screen; never mounts its loop on phones (≤720px) or under reduced motion
 * (there the strokes are drawn once, already aligned). The glass cards beside
 * it are cut out of the canvas (an evenodd clip), so no stroke runs under them.
 * The stroke colour is the accent, re-read when the theme flips.
 */
export default function Interlinear({className}) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || typeof window === 'undefined') return undefined;
    const narrow = window.matchMedia('(max-width: 720px)');
    if (narrow.matches) return undefined;
    const calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const hover = window.matchMedia('(hover: hover)').matches;
    const ctx = canvas.getContext('2d');
    if (!ctx) return undefined;

    const PITCH = 34;
    const GAP = 8;
    const RADIUS = 150;
    let w = 0;
    let h = 0;
    let rows = [];
    let cards = [];
    let frame = 0;
    let visible = true;
    const t0 = performance.now();
    const ptr = {x: 0, y: 0, s: 0, target: 0};
    let rgb = '63, 193, 192';
    let light = false;

    const readColour = () => {
      const v = getComputedStyle(canvas).getPropertyValue('--accent-rgb').trim();
      if (v) rgb = v;
      light = document.documentElement.getAttribute('data-theme') === 'light';
    };
    const rand = (seed) => () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const ease = (x) => 1 - Math.pow(1 - Math.min(1, Math.max(0, x)), 3);

    function size() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const c = canvas.getBoundingClientRect();
      cards = [...canvas.parentElement.querySelectorAll('[data-glass]')].map((el) => {
        const a = el.getBoundingClientRect();
        return {x: a.left - c.left, y: a.top - c.top, w: a.width, h: a.height};
      });
      const r = rand(42);
      rows = [];
      for (let y = PITCH / 2, i = 0; y < h; y += PITCH, i += 1) {
        const src = [];
        let x = -r() * 50;
        while (x < w + 40) {
          const len = 12 + r() * 54;
          src.push([x, len]);
          x += len + 10 + r() * 8;
        }
        const gl = src.map(([sx, sl]) => [sx + (r() - 0.5) * 4, Math.max(6, sl * (0.5 + r() * 0.7))]);
        rows.push({y, i, src, gl, dx: (r() - 0.5) * 44, dy: 3 + r() * 6});
      }
      kick();
    }

    function draw(now) {
      frame = 0;
      const el = calm ? 9 : (now - t0) / 1000;
      ptr.s += (ptr.target - ptr.s) * 0.12;
      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = 'round';
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, h);
      for (const k of cards) {
        if (ctx.roundRect) ctx.roundRect(k.x, k.y, k.w, k.h, 20);
        else ctx.rect(k.x, k.y, k.w, k.h);
      }
      ctx.clip('evenodd');
      let busy = Math.abs(ptr.target - ptr.s) > 0.002;
      const mid = rows.length / 2;
      // ink on paper needs a little more weight than light on ink
      const srcA = light ? 0.22 : 0.17;
      const glA = light ? 0.12 : 0.09;
      for (const r of rows) {
        const s = 1 - ease((el - 0.45 - Math.abs(r.i - mid) * 0.025) / 0.95);
        if (s > 0.001) busy = true;
        const lamp = (x) => (ptr.s > 0.002
          ? 1 + 1.6 * ptr.s * Math.exp(-((x - ptr.x) ** 2 + (r.y - ptr.y) ** 2) / (2 * RADIUS * RADIUS))
          : 1);
        ctx.lineWidth = 2;
        for (const [x, l] of r.src) {
          ctx.strokeStyle = `rgba(${rgb}, ${Math.min(0.5, srcA * lamp(x))})`;
          ctx.beginPath();
          ctx.moveTo(x, r.y);
          ctx.lineTo(x + l, r.y);
          ctx.stroke();
        }
        ctx.lineWidth = 1.5;
        for (const [x, l] of r.gl) {
          const gx = x + s * r.dx;
          const gy = r.y + GAP + s * r.dy;
          ctx.strokeStyle = `rgba(${rgb}, ${Math.min(0.35, glA * lamp(x))})`;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + l, gy);
          ctx.stroke();
        }
      }
      ctx.restore();
      if (busy && visible && !calm) kick();
    }
    function kick() {
      if (!frame) frame = requestAnimationFrame(draw);
    }

    readColour();
    const ro = new ResizeObserver(size);
    ro.observe(canvas);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) kick();
    });
    io.observe(canvas);
    const theme = new MutationObserver(() => {
      readColour();
      kick();
    });
    theme.observe(document.documentElement, {attributes: true, attributeFilter: ['data-theme']});

    const zone = canvas.closest('[data-lamp-zone]') || canvas.parentElement;
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      ptr.x = e.clientX - r.left;
      ptr.y = e.clientY - r.top;
      ptr.target = 1;
      kick();
    };
    const onLeave = () => {
      ptr.target = 0;
      kick();
    };
    if (!calm && hover) {
      zone.addEventListener('pointermove', onMove);
      zone.addEventListener('pointerleave', onLeave);
    }
    return () => {
      if (frame) cancelAnimationFrame(frame);
      ro.disconnect();
      io.disconnect();
      theme.disconnect();
      zone.removeEventListener('pointermove', onMove);
      zone.removeEventListener('pointerleave', onLeave);
    };
  }, []);

  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
