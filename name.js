/* Hero name as a field of landmark points.
   The letters are drawn to an offscreen canvas, filled pixels are sampled into
   points, nearby points are linked like a hand-landmark skeleton, and the
   cursor (or a finger) pushes them away before they spring back. */
(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const h1 = document.querySelector(".name-wrap h1");
  const canvas = document.querySelector(".name-canvas");
  if (!h1 || !canvas || reduce || !canvas.getContext) return;

  const ctx = canvas.getContext("2d");
  const root = document.documentElement;
  const MARGIN = 48;            // room around the letters for pushed points
  let pts = [], links = [], W = 0, H = 0, dpr = 1, radius = 90;
  let pointer = { x: -9999, y: -9999, active: false };
  let running = false, visible = true, raf = 0, settledFrames = 0;

  // exposed so the page's detection box can frame the push zone
  window.nameField = { radius: () => radius, active: () => pointer.active };

  function build() {
    const rect = h1.getBoundingClientRect();
    if (!rect.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.ceil(rect.width + MARGIN * 2);
    H = Math.ceil(rect.height + MARGIN * 2);
    canvas.style.left = -MARGIN + "px";
    canvas.style.top = -MARGIN + "px";
    canvas.style.width = W + "px";
    canvas.style.height = H + "px";
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);

    // draw the real heading's text with its real font into an offscreen canvas
    const cs = getComputedStyle(h1);
    const size = parseFloat(cs.fontSize);
    const lineH = parseFloat(cs.lineHeight) || size * 0.9;
    const off = document.createElement("canvas");
    off.width = W; off.height = H;
    const o = off.getContext("2d", { willReadFrequently: true });
    o.fillStyle = "#fff";
    o.font = `${cs.fontWeight} ${size}px ${cs.fontFamily}`;
    o.textBaseline = "middle";
    if ("letterSpacing" in o) o.letterSpacing = cs.letterSpacing;
    const lines = h1.innerText.split("\n").map((l) => l.trim()).filter(Boolean);
    lines.forEach((line, i) => o.fillText(line, MARGIN, MARGIN + lineH * (i + 0.5) + size * 0.04));

    // sample filled pixels on a grid, sized so the point count stays capped
    const data = o.getImageData(0, 0, W, H).data;
    const small = W < 520, cap = small ? 620 : 900;
    let filled = 0;
    for (let i = 3; i < data.length; i += 4 * 9) if (data[i] > 128) filled++;
    const step = Math.max(small ? 3 : 4, Math.round(Math.sqrt((filled * 9) / cap)));
    const next = [];
    for (let y = 0; y < H; y += step) {
      for (let x = 0; x < W; x += step) {
        if (data[(y * W + x) * 4 + 3] > 128) {
          const jx = (Math.random() - 0.5) * step * 0.5, jy = (Math.random() - 0.5) * step * 0.5;
          next.push({ hx: x + jx, hy: y + jy, x: 0, y: 0, vx: 0, vy: 0, r: (Math.random() < 0.12 ? 1.9 : 1.2) * (small ? 0.8 : 1) });
        }
      }
    }
    // first build: points drift in from slightly scattered positions
    next.forEach((p, i) => {
      const old = pts[i];
      if (old) { p.x = old.x; p.y = old.y; }
      else { p.x = p.hx + (Math.random() - 0.5) * 160; p.y = p.hy + (Math.random() - 0.5) * 90; }
    });
    pts = next;

    // link each point to its nearest neighbours (computed once, at rest)
    const maxD = step * 1.55, cell = maxD, grid = new Map();
    pts.forEach((p, i) => {
      const k = ((p.hx / cell) | 0) + "," + ((p.hy / cell) | 0);
      (grid.get(k) || grid.set(k, []).get(k)).push(i);
    });
    links = [];
    pts.forEach((p, i) => {
      const cx = (p.hx / cell) | 0, cy = (p.hy / cell) | 0, near = [];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        for (const j of grid.get(cx + dx + "," + (cy + dy)) || []) {
          if (j <= i) continue;
          const d = Math.hypot(pts[j].hx - p.hx, pts[j].hy - p.hy);
          if (d < maxD) near.push([d, j]);
        }
      }
      near.sort((a, b) => a[0] - b[0]).slice(0, 2).forEach(([, j]) => links.push(i, j));
    });

    radius = Math.max(60, Math.min(120, size * 0.95));
    root.classList.add("particles");
    wake();
  }

  function step() {
    const k = 0.055, damp = 0.84, R = radius, R2 = R * R;
    let energy = 0;
    for (const p of pts) {
      let ax = (p.hx - p.x) * k, ay = (p.hy - p.y) * k;
      if (pointer.active) {
        const dx = p.x - pointer.x, dy = p.y - pointer.y, d2 = dx * dx + dy * dy;
        if (d2 < R2 && d2 > 0.01) {
          const d = Math.sqrt(d2), f = (1 - d / R) * 7;
          ax += (dx / d) * f; ay += (dy / d) * f;
        }
      }
      p.vx = (p.vx + ax) * damp; p.vy = (p.vy + ay) * damp;
      p.x += p.vx; p.y += p.vy;
      energy += Math.abs(p.vx) + Math.abs(p.vy);
    }
    return energy / (pts.length || 1);
  }

  function draw() {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    // skeleton lines
    ctx.lineWidth = 0.6;
    ctx.strokeStyle = "rgba(255,255,255,.18)";
    ctx.beginPath();
    for (let i = 0; i < links.length; i += 2) {
      const a = pts[links[i]], b = pts[links[i + 1]];
      ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    // soft dark halo so the points read on the pale part of the banner
    ctx.fillStyle = "rgba(20,17,19,.16)";
    ctx.beginPath();
    for (const p of pts) { ctx.moveTo(p.x + p.r + 1, p.y); ctx.arc(p.x, p.y, p.r + 1, 0, Math.PI * 2); }
    ctx.fill();
    // landmarks: white at rest, pale ice when displaced
    for (const p of pts) {
      const off = Math.min(1, Math.hypot(p.x - p.hx, p.y - p.hy) / 30);
      ctx.fillStyle = off > 0.15 ? `rgba(184,207,211,${0.95 - off * 0.25})` : "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r + off * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function loop() {
    const e = step();
    draw();
    settledFrames = e < 0.02 && !pointer.active ? settledFrames + 1 : 0;
    if (visible && settledFrames < 30) raf = requestAnimationFrame(loop);
    else { running = false; raf = 0; }
  }
  function wake() {
    settledFrames = 0;
    if (!running && visible) { running = true; raf = requestAnimationFrame(loop); }
  }

  // pointer, in canvas coordinates
  function track(e) {
    const r = canvas.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    const inside = x > -radius && y > -radius && x < W + radius && y < H + radius;
    pointer = { x, y, active: inside };
    if (inside) wake();
  }
  window.addEventListener("pointermove", track, { passive: true });
  window.addEventListener("pointerdown", track, { passive: true });
  const release = () => { pointer.active = false; wake(); };
  window.addEventListener("pointerup", (e) => { if (e.pointerType !== "mouse") release(); }, { passive: true });
  window.addEventListener("pointercancel", release, { passive: true });
  document.addEventListener("pointerleave", release);

  // only animate while the hero is on screen
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible) wake();
  }).observe(canvas.closest(".hero") || canvas);

  // rebuild on resize (width changes only, so mobile URL-bar resizes don't thrash)
  let lastW = window.innerWidth, t;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(() => {
      if (window.innerWidth !== lastW || Math.min(window.devicePixelRatio || 1, 2) !== dpr) { lastW = window.innerWidth; build(); }
    }, 150);
  });

  (document.fonts ? document.fonts.ready : Promise.resolve()).then(build);
})();
