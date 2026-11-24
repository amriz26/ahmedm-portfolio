(() => {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  /* ---------------- detection overlay ---------------- */
  const box = document.querySelector(".detector");
  const dClass = box.querySelector(".d-class");
  const dConf = box.querySelector(".d-conf");
  const hud = document.querySelector(".hud");
  const hudTarget = hud.querySelector(".hud-target");
  const hudCount = hud.querySelector(".hud-count");
  const hudTotal = hud.querySelector(".hud-total");
  const hudBar = hud.querySelector(".hud-bar span");

  const targets = [...document.querySelectorAll("[data-detect]")];
  const seen = new Set();
  hudTotal.textContent = targets.length;

  // stable pseudo-confidence per element, so it doesn't flicker
  const conf = new WeakMap();
  targets.forEach((el, i) => conf.set(el, (0.86 + ((i * 37) % 13) / 100).toFixed(2)));

  const SIZE = 28, PAD = 8;
  const cur = { x: -100, y: -100, w: SIZE, h: SIZE };
  const goal = { ...cur };
  let locked = null, mouse = { x: -100, y: -100 }, raf = 0;

  function aimAt(el) {
    if (el) {
      const r = el.getBoundingClientRect();
      goal.x = r.left - PAD; goal.y = r.top - PAD;
      goal.w = r.width + PAD * 2; goal.h = r.height + PAD * 2;
    } else {
      goal.x = mouse.x - SIZE / 2; goal.y = mouse.y - SIZE / 2;
      goal.w = SIZE; goal.h = SIZE;
    }
    box.classList.toggle("flip", goal.y < 70);
  }

  function frame() {
    const k = reduce ? 1 : 0.22;
    let moving = false;
    for (const key of ["x", "y", "w", "h"]) {
      const d = goal[key] - cur[key];
      cur[key] += d * k;
      if (Math.abs(d) > 0.3) moving = true; else cur[key] = goal[key];
    }
    box.style.transform = `translate(${cur.x}px, ${cur.y}px)`;
    box.style.width = cur.w + "px";
    box.style.height = cur.h + "px";
    raf = moving ? requestAnimationFrame(frame) : 0;
  }
  const kick = () => { if (!raf) raf = requestAnimationFrame(frame); };

  function lock(el) {
    if (el === locked) return;
    locked = el;
    box.classList.toggle("locked", !!el);
    if (el) {
      const label = el.dataset.detect;
      dClass.textContent = label;
      dConf.textContent = conf.get(el);
      hudTarget.textContent = label;
      if (!seen.has(el)) {
        seen.add(el);
        hudCount.textContent = seen.size;
        hudBar.style.width = (seen.size / targets.length) * 100 + "%";
        if (seen.size === targets.length) hud.classList.add("complete");
      }
    } else {
      hudTarget.textContent = "—";
    }
  }

  if (finePointer) {
    window.addEventListener("pointermove", (e) => {
      mouse = { x: e.clientX, y: e.clientY };
      box.classList.add("on");
      const el = e.target.closest?.("[data-detect]");
      lock(el && !el.classList.contains("dim") ? el : null);
      aimAt(locked); kick();
    }, { passive: true });
    document.addEventListener("pointerleave", () => { box.classList.remove("on"); lock(null); });
    // the page moves under a still cursor when scrolling, so re-check what's under it
    const recheck = () => {
      if (!box.classList.contains("on")) return;
      const under = document.elementFromPoint(mouse.x, mouse.y);
      const el = under?.closest?.("[data-detect]");
      lock(el && !el.classList.contains("dim") ? el : null);
      aimAt(locked); kick();
    };
    window.addEventListener("scroll", recheck, { passive: true });
    window.addEventListener("resize", recheck);
  } else {
    // touch: briefly frame whatever was tapped
    let t;
    document.addEventListener("pointerdown", (e) => {
      const el = e.target.closest?.("[data-detect]");
      if (!el) return;
      lock(el); aimAt(el);
      Object.assign(cur, goal); frame();
      box.classList.add("on");
      clearTimeout(t);
      t = setTimeout(() => { box.classList.remove("on"); lock(null); }, 1100);
    }, { passive: true });
    window.addEventListener("scroll", () => { if (locked) { aimAt(locked); Object.assign(cur, goal); frame(); } }, { passive: true });
    hud.querySelector(".hud-hint").innerHTML =
      'Tap anything on this page. It gets detected the way <a href="https://github.com/amriz26/AirMouse" target="_blank" rel="noopener">AirMouse</a> detects a hand.';
  }

  /* ---------------- experience accordion ---------------- */
  const countUp = (b) => {
    const end = +b.dataset.count;
    if (reduce || !end) return;
    const fmt = (n) => n.toLocaleString("en-US");
    const t0 = performance.now(), dur = 900;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      b.textContent = fmt(Math.round(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  document.querySelectorAll(".role").forEach((role) => {
    const btn = role.querySelector(".role-head");
    btn.addEventListener("click", () => {
      const open = !role.classList.contains("open");
      role.classList.toggle("open", open);
      btn.setAttribute("aria-expanded", open);
      if (open) role.querySelectorAll("[data-count]").forEach(countUp);
      // keep the detector glued to the row while it resizes
      if (locked) { const start = performance.now(); const follow = (t) => { aimAt(locked); kick(); if (t - start < 500) requestAnimationFrame(follow); }; requestAnimationFrame(follow); }
    });
  });

  /* ---------------- project filters ---------------- */
  const cards = [...document.querySelectorAll(".card")];
  document.querySelectorAll(".filter").forEach((f) => {
    f.addEventListener("click", () => {
      document.querySelectorAll(".filter").forEach((o) => { o.classList.toggle("active", o === f); o.setAttribute("aria-pressed", o === f); });
      const kind = f.dataset.filter;
      cards.forEach((c) => {
        const hide = kind !== "all" && c.dataset.kind !== kind;
        c.classList.toggle("dim", hide);
        c.setAttribute("aria-hidden", hide);
        c.querySelectorAll("a").forEach((a) => a.tabIndex = hide ? -1 : 0);
      });
    });
  });

  /* ---------------- AirMouse hand skeleton ---------------- */
  const viz = document.querySelector(".viz-hand");
  if (viz) {
    const g = viz.querySelector(".joints");
    const NS = "http://www.w3.org/2000/svg";
    // 21 landmarks, MediaPipe order, roughly an open right hand (viewBox 200x120)
    const base = [
      [100, 104], [86, 96], [76, 84], [68, 74], [60, 66],     // thumb
      [90, 70], [88, 52], [87, 41], [86, 31],                 // index
      [100, 68], [100, 48], [100, 36], [100, 25],             // middle
      [110, 70], [112, 52], [113, 41], [114, 32],             // ring
      [119, 75], [124, 60], [126, 51], [128, 43],             // pinky
    ];
    const bones = [[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
    const lines = bones.map(() => g.appendChild(document.createElementNS(NS, "line")));
    const dots = base.map((_, i) => {
      const c = g.appendChild(document.createElementNS(NS, "circle"));
      c.setAttribute("r", [4, 8, 12, 16, 20].includes(i) ? 2.4 : 1.8);
      if ([4, 8].includes(i)) c.classList.add("tip");
      return c;
    });
    const rect = g.appendChild(document.createElementNS(NS, "rect"));
    const label = g.appendChild(document.createElementNS(NS, "text"));

    let off = { x: 0, y: 0 }, aim = { x: 0, y: 0 }, t = 0, running = false;
    function draw() {
      t += 0.016;
      off.x += (aim.x - off.x) * 0.08; off.y += (aim.y - off.y) * 0.08;
      const sway = reduce ? 0 : Math.sin(t * 1.2) * 3;
      const pinch = reduce ? 0 : (Math.sin(t * 1.6) + 1) / 2; // 0 open, 1 pinched
      const pts = base.map(([x, y], i) => {
        let px = x + off.x + sway * (1 - y / 120), py = y + off.y;
        if (i >= 2 && i <= 4) { px += pinch * (i - 1) * 4.5; py -= pinch * (i - 1) * 3.2; }
        if (i >= 6 && i <= 8) { px -= pinch * (i - 5) * 1.2; py += pinch * (i - 5) * 6.5; }
        return [px, py];
      });
      bones.forEach(([a, b], k) => {
        lines[k].setAttribute("x1", pts[a][0]); lines[k].setAttribute("y1", pts[a][1]);
        lines[k].setAttribute("x2", pts[b][0]); lines[k].setAttribute("y2", pts[b][1]);
      });
      dots.forEach((d, i) => { d.setAttribute("cx", pts[i][0]); d.setAttribute("cy", pts[i][1]); });
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const x0 = Math.min(...xs) - 6, y0 = Math.min(...ys) - 6;
      rect.setAttribute("x", x0); rect.setAttribute("y", y0);
      rect.setAttribute("width", Math.max(...xs) - x0 + 6); rect.setAttribute("height", Math.max(...ys) - y0 + 6);
      label.setAttribute("x", x0); label.setAttribute("y", y0 - 3);
      label.textContent = pinch > 0.82 ? "hand · PINCH → click" : "hand · 0.97";
      if (running && !reduce) requestAnimationFrame(draw);
    }
    draw();
    if (!reduce) {
      new IntersectionObserver(([e]) => {
        const was = running; running = e.isIntersecting;
        if (running && !was) requestAnimationFrame(draw);
      }).observe(viz);
      viz.parentElement.addEventListener("pointermove", (e) => {
        const r = viz.getBoundingClientRect();
        aim.x = ((e.clientX - r.left) / r.width - 0.5) * 60;
        aim.y = ((e.clientY - r.top) / r.height - 0.5) * 24;
      });
      viz.parentElement.addEventListener("pointerleave", () => { aim = { x: 0, y: 0 }; });
    }
  }

  /* ---------------- reveal on scroll ---------------- */
  if (!reduce && "IntersectionObserver" in window) {
    const els = document.querySelectorAll(".section-head, .role, .card, .beyond-card, .now-card, .contact h2");
    els.forEach((el) => el.classList.add("reveal"));
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => { if (en.isIntersecting) {
        const el = en.target;
        el.classList.add("in"); io.unobserve(el);
        // hand transitions back to the element's own hover styles
        setTimeout(() => el.classList.remove("reveal", "in"), 800);
      } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    els.forEach((el) => io.observe(el));
  }
})();
