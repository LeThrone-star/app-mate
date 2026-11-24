/* =========================================================
   Plot — piano cartesiano su canvas con griglia, assi, pan e zoom
   ========================================================= */
(function () {
  'use strict';
  const { cssVar, fitCanvas } = window.App;

  function niceStep(pxPerUnit, target) {
    const raw = (target || 90) / pxPerUnit;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    const s = m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10;
    return { major: s * p, minor: s * p / (s === 2 ? 4 : 5) };
  }

  function fmtTick(v, step) {
    if (Math.abs(v) < step * 1e-6) return '0';
    const a = Math.abs(v);
    if (a >= 1e6 || a < 1e-4) {
      const [m, e] = v.toExponential(2).split('e');
      return `${+m}e${+e}`;
    }
    const dec = Math.max(0, -Math.floor(Math.log10(step) + 1e-9));
    return v.toFixed(dec).replace('-', '−');
  }

  class Plot {
    constructor(canvas, o) {
      o = o || {};
      this.canvas = canvas;
      this.cx = o.cx || 0; this.cy = o.cy || 0;
      this.sx = o.scale || o.sx || 50;           // pixel per unità (asse x)
      this.sy = o.scale || o.sy || this.sx;      // pixel per unità (asse y)
      this.lockAspect = o.lockAspect !== false && !o.sy;
      this.gridTarget = o.gridTarget || 90;
      this.xTickLabels = o.xTickLabels !== false;
      this.onDraw = o.onDraw || null;
      this.fixedView = o.fixedView || null;
      this.initialView = o.initialView || null;
      this.xLabel = o.xLabel || 'x';
      this.yLabel = o.yLabel || 'y';
      this.interactive = o.interactive !== false;
      this.dirty = true;
      this.st = fitCanvas(canvas, () => this.request());
      this.ctx = this.st.ctx;
      window.addEventListener('themechange', () => this.request());
      if (this.interactive) this._bindPanZoom();
      this._loop = this._loop.bind(this);
      requestAnimationFrame(this._loop);
    }
    get w() { return this.st.w; }
    get h() { return this.st.h; }
    toPx(x) { return this.w / 2 + (x - this.cx) * this.sx; }
    toPy(y) { return this.h / 2 - (y - this.cy) * this.sy; }
    toX(px) { return this.cx + (px - this.w / 2) / this.sx; }
    toY(py) { return this.cy - (py - this.h / 2) / this.sy; }
    get xmin() { return this.toX(0); }
    get xmax() { return this.toX(this.w); }
    get ymin() { return this.toY(this.h); }
    get ymax() { return this.toY(0); }

    setView(xmin, xmax, ymin, ymax) {
      this.cx = (xmin + xmax) / 2; this.cy = (ymin + ymax) / 2;
      const sx = this.w / (xmax - xmin), sy = this.h / (ymax - ymin);
      if (this.lockAspect) { this.sx = this.sy = Math.min(sx, sy); }
      else { this.sx = sx; this.sy = sy; }
      this.request();
    }
    request() { this.dirty = true; }
    _loop() {
      if (this.initialView && this.w > 0) { const v = this.initialView; this.initialView = null; this.setView(v[0], v[1], v[2], v[3]); }
      if (this.dirty && this.w > 0) {
        this.dirty = false;
        this.draw();
      }
      requestAnimationFrame(this._loop);
    }
    draw() {
      const ctx = this.ctx;
      if (this.fixedView) {
        const [x0, x1, y0, y1] = this.fixedView();
        this.cx = (x0 + x1) / 2; this.cy = (y0 + y1) / 2;
        const sx = this.w / (x1 - x0), sy = this.h / (y1 - y0);
        if (this.lockAspect) this.sx = this.sy = Math.min(sx, sy); else { this.sx = sx; this.sy = sy; }
      }
      ctx.clearRect(0, 0, this.w, this.h);
      ctx.fillStyle = cssVar('--canvas-bg');
      ctx.fillRect(0, 0, this.w, this.h);
      this.drawGrid();
      if (this.onDraw) this.onDraw(ctx, this);
    }

    zoomAt(px, py, factor, fx, fy) {
      const x = this.toX(px), y = this.toY(py);
      this.sx = Math.min(1e7, Math.max(1e-5, this.sx * (fx || factor)));
      this.sy = Math.min(1e7, Math.max(1e-5, this.sy * (fy || factor)));
      this.cx = x - (px - this.w / 2) / this.sx;
      this.cy = y + (py - this.h / 2) / this.sy;
      this.request();
      if (this.onViewChange) this.onViewChange();
    }

    _bindPanZoom() {
      const c = this.canvas;
      const pts = new Map();
      let last = null, pinch = null;
      this.isPanning = false;
      c.addEventListener('wheel', e => {
        e.preventDefault();
        const r = c.getBoundingClientRect();
        this.zoomAt(e.clientX - r.left, e.clientY - r.top, Math.exp(-e.deltaY * 0.0015));
      }, { passive: false });
      c.addEventListener('pointerdown', e => {
        if (this.onPointerDown && this.onPointerDown(e) === true) return;
        c.setPointerCapture(e.pointerId);
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 1) { last = { x: e.clientX, y: e.clientY }; this.isPanning = true; }
        if (pts.size === 2) {
          const [a, b] = [...pts.values()];
          pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
        }
      });
      c.addEventListener('pointermove', e => {
        if (!pts.has(e.pointerId)) { if (this.onHover) this.onHover(e); return; }
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pts.size === 2 && pinch) {
          const [a, b] = [...pts.values()];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          const r = c.getBoundingClientRect();
          this.zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, d / pinch.d);
          pinch.d = d;
        } else if (pts.size === 1 && last) {
          this.cx -= (e.clientX - last.x) / this.sx;
          this.cy += (e.clientY - last.y) / this.sy;
          last = { x: e.clientX, y: e.clientY };
          this.request();
          if (this.onViewChange) this.onViewChange();
        }
      });
      const up = e => {
        pts.delete(e.pointerId);
        if (pts.size < 2) pinch = null;
        if (pts.size === 1) { const [a] = [...pts.values()]; last = { x: a.x, y: a.y }; }
        if (pts.size === 0) { last = null; this.isPanning = false; }
      };
      c.addEventListener('pointerup', up);
      c.addEventListener('pointercancel', up);
      c.addEventListener('pointerleave', e => { if (this.onLeave && !pts.size) this.onLeave(e); });
    }

    drawGrid() {
      const ctx = this.ctx, w = this.w, h = this.h;
      const stx = niceStep(this.sx, this.gridTarget), sty = niceStep(this.sy, this.gridTarget);
      const font = '12px ' + getComputedStyle(document.body).fontFamily;
      ctx.lineWidth = 1;
      // griglia secondaria
      ctx.strokeStyle = cssVar('--grid-minor');
      ctx.beginPath();
      for (let x = Math.ceil(this.xmin / stx.minor) * stx.minor; x <= this.xmax; x += stx.minor) {
        const px = Math.round(this.toPx(x)) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      for (let y = Math.ceil(this.ymin / sty.minor) * sty.minor; y <= this.ymax; y += sty.minor) {
        const py = Math.round(this.toPy(y)) + 0.5; ctx.moveTo(0, py); ctx.lineTo(w, py);
      }
      ctx.stroke();
      // griglia principale
      ctx.strokeStyle = cssVar('--grid-major');
      ctx.beginPath();
      for (let x = Math.ceil(this.xmin / stx.major) * stx.major; x <= this.xmax; x += stx.major) {
        const px = Math.round(this.toPx(x)) + 0.5; ctx.moveTo(px, 0); ctx.lineTo(px, h);
      }
      for (let y = Math.ceil(this.ymin / sty.major) * sty.major; y <= this.ymax; y += sty.major) {
        const py = Math.round(this.toPy(y)) + 0.5; ctx.moveTo(0, py); ctx.lineTo(w, py);
      }
      ctx.stroke();
      // assi
      const ax = this.toPy(0), ay = this.toPx(0);
      ctx.strokeStyle = cssVar('--axis');
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (ax >= 0 && ax <= h) { ctx.moveTo(0, Math.round(ax) + 0.5); ctx.lineTo(w, Math.round(ax) + 0.5); }
      if (ay >= 0 && ay <= w) { ctx.moveTo(Math.round(ay) + 0.5, 0); ctx.lineTo(Math.round(ay) + 0.5, h); }
      ctx.stroke();
      // etichette
      ctx.font = font;
      ctx.fillStyle = cssVar('--muted');
      const labelY = Math.min(h - 6, Math.max(14, ax + 15));
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      const bg = cssVar('--canvas-bg');
      for (let x = Math.ceil(this.xmin / stx.major) * stx.major; this.xTickLabels && x <= this.xmax; x += stx.major) {
        if (Math.abs(x) < stx.major * 1e-6) continue;
        const px = this.toPx(x), t = fmtTick(x, stx.major);
        ctx.fillStyle = bg; const tw = ctx.measureText(t).width;
        ctx.fillRect(px - tw / 2 - 2, labelY - 11, tw + 4, 14);
        ctx.fillStyle = cssVar('--muted'); ctx.fillText(t, px, labelY);
      }
      const labelX = Math.min(w - 6, Math.max(6, ay - 6));
      const alignRight = ay - 6 > 30;
      ctx.textAlign = alignRight ? 'right' : 'left'; ctx.textBaseline = 'middle';
      for (let y = Math.ceil(this.ymin / sty.major) * sty.major; y <= this.ymax; y += sty.major) {
        if (Math.abs(y) < sty.major * 1e-6) continue;
        const py = this.toPy(y), t = fmtTick(y, sty.major);
        const tw = ctx.measureText(t).width;
        const lx = alignRight ? labelX : Math.max(6, labelX);
        ctx.fillStyle = bg;
        ctx.fillRect(alignRight ? lx - tw - 2 : lx - 2, py - 7, tw + 4, 14);
        ctx.fillStyle = cssVar('--muted'); ctx.fillText(t, lx, py);
      }
      if (ax >= 0 && ax <= h && ay >= 0 && ay <= w) {
        ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText('0', ay - 5, ax + 4);
      }
      // nomi degli assi
      ctx.font = 'italic 600 13px ' + getComputedStyle(document.body).fontFamily;
      ctx.fillStyle = cssVar('--axis');
      if (ax >= 0 && ax <= h) { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(this.xLabel, w - 6, ax - 4); }
      if (ay >= 0 && ay <= w) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(this.yLabel, ay + 6, 6); }
    }

    /** Disegna y = f(x) con gestione delle discontinuità. */
    drawFunction(f, color, width, dash, xFrom, xTo) {
      const ctx = this.ctx;
      const step = 1;
      const p0 = xFrom != null ? Math.max(-2, this.toPx(xFrom)) : -2;
      const p1 = xTo != null ? Math.min(this.w + 2, this.toPx(xTo)) : this.w + 2;
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = width || 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      let pen = false, prev = null;
      const H = this.h;
      for (let px = p0; px <= p1 + 1e-9; px += step) {
        const x = this.toX(px);
        let y;
        try { y = f(x); } catch (e) { y = NaN; }
        if (typeof y !== 'number' || !isFinite(y)) { pen = false; prev = null; continue; }
        const py = this.toPy(y);
        if (pen && prev !== null && Math.abs(py - prev) > H * 0.5) {
          const ym = f(this.toX(px - step / 2));
          const pm = this.toPy(ym);
          if (!isFinite(ym) || pm < Math.min(py, prev) - 2 || pm > Math.max(py, prev) + 2) pen = false;
        }
        const cpy = Math.max(-1e4, Math.min(1e4, py));
        if (pen) ctx.lineTo(px, cpy); else { ctx.moveTo(px, cpy); pen = true; }
        prev = py;
      }
      ctx.stroke();
      ctx.restore();
    }

    /** Disegna x = g(y). */
    drawFunctionY(g, color, width, dash) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = width || 2.5; ctx.lineJoin = 'round';
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath();
      let pen = false, prev = null;
      for (let py = -2; py <= this.h + 2; py += 1) {
        const y = this.toY(py);
        let x;
        try { x = g(y); } catch (e) { x = NaN; }
        if (!isFinite(x)) { pen = false; prev = null; continue; }
        const px = this.toPx(x);
        if (pen && prev !== null && Math.abs(px - prev) > this.w * 0.5) {
          const xm = g(this.toY(py - 0.5)), pm = this.toPx(xm);
          if (!isFinite(xm) || pm < Math.min(px, prev) - 2 || pm > Math.max(px, prev) + 2) pen = false;
        }
        const cpx = Math.max(-1e4, Math.min(1e4, px));
        if (pen) ctx.lineTo(cpx, py); else { ctx.moveTo(cpx, py); pen = true; }
        prev = px;
      }
      ctx.stroke();
      ctx.restore();
    }

    point(x, y, color, r, hollow) {
      const ctx = this.ctx, px = this.toPx(x), py = this.toPy(y);
      ctx.save();
      ctx.beginPath(); ctx.arc(px, py, r || 5, 0, Math.PI * 2);
      if (hollow) {
        ctx.fillStyle = cssVar('--canvas-bg'); ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = color; ctx.stroke();
      } else { ctx.fillStyle = color; ctx.fill(); }
      ctx.restore();
    }
    line(x1, y1, x2, y2, color, width, dash) {
      const ctx = this.ctx;
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = width || 2;
      if (dash) ctx.setLineDash(dash);
      ctx.beginPath(); ctx.moveTo(this.toPx(x1), this.toPy(y1)); ctx.lineTo(this.toPx(x2), this.toPy(y2)); ctx.stroke();
      ctx.restore();
    }
    /** Retta infinita passante per (x0,y0) con pendenza m. */
    infiniteLine(x0, y0, m, color, width, dash) {
      const a = this.xmin - 1, b = this.xmax + 1;
      this.line(a, y0 + m * (a - x0), b, y0 + m * (b - x0), color, width, dash);
    }
    label(text, x, y, color, dx, dy, align) {
      const ctx = this.ctx;
      ctx.save();
      ctx.font = '600 13px ' + getComputedStyle(document.body).fontFamily;
      const px = this.toPx(x) + (dx || 8), py = this.toPy(y) + (dy || -10);
      ctx.textAlign = align || 'left'; ctx.textBaseline = 'middle';
      const tw = ctx.measureText(text).width;
      const bx = align === 'right' ? px - tw - 4 : align === 'center' ? px - tw / 2 - 4 : px - 4;
      ctx.fillStyle = cssVar('--surface');
      ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.roundRect ? ctx.roundRect(bx, py - 10, tw + 8, 20, 5) : ctx.rect(bx, py - 10, tw + 8, 20); ctx.fill();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color || cssVar('--text');
      ctx.fillText(text, px, py);
      ctx.restore();
    }
  }

  Plot.niceStep = niceStep;
  window.Plot = Plot;
})();
