/* Tentacle Shaper — 2D-вид на canvas: масштаб колесом, сдвиг мышью, щелчок. GPL v3. */
(function (TS) {
  'use strict';

  // opts: { bounds(): [x0,y0,x1,y1] в мм, draw(ctx, view), exag: число (растяжение по вертикали),
  //         onClick(wx, wy), onMove(wx, wy) }
  function View2D(canvas, opts) {
    this.c = canvas; this.ctx = canvas.getContext('2d'); this.o = opts;
    this.exag = opts.exag || 1;
    this.s = 1; this.ox = 0; this.oy = 0; this.fitted = false;
    var self = this, drag = null, moved = false;

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      var r = canvas.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
      var w = self.toWorld(mx, my), k = Math.exp(-e.deltaY * 0.0015);
      self.s *= k;
      self.ox = mx - w[0] * self.s; self.oy = my + w[1] * self.s * self.exag;
      self.redraw();
    }, { passive: false });
    canvas.addEventListener('mousedown', function (e) {
      drag = { x: e.clientX, y: e.clientY, ox: self.ox, oy: self.oy }; moved = false;
    });
    window.addEventListener('mousemove', function (e) {
      if (drag) {
        var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        if (moved) { self.ox = drag.ox + dx; self.oy = drag.oy + dy; self.redraw(); }
      }
    });
    canvas.addEventListener('mousemove', function (e) {
      if (!self.o.onMove) return;
      var r = canvas.getBoundingClientRect(), w = self.toWorld(e.clientX - r.left, e.clientY - r.top);
      self.o.onMove(w[0], w[1]);
    });
    window.addEventListener('mouseup', function (e) {
      if (drag && !moved && e.target === canvas && self.o.onClick) {
        var r = canvas.getBoundingClientRect(), w = self.toWorld(e.clientX - r.left, e.clientY - r.top);
        self.o.onClick(w[0], w[1]);
      }
      drag = null;
    });
    canvas.addEventListener('dblclick', function () { self.fit(); self.redraw(); });
  }

  View2D.prototype.toScreen = function (x, y) { return [this.ox + x * this.s, this.oy - y * this.s * this.exag]; };
  View2D.prototype.toWorld = function (sx, sy) { return [(sx - this.ox) / this.s, (this.oy - sy) / (this.s * this.exag)]; };

  View2D.prototype.size = function () {
    var r = this.c.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
    var w = Math.max(10, Math.round(r.width)), h = Math.max(10, Math.round(r.height));
    if (this.c.width !== Math.round(w * dpr) || this.c.height !== Math.round(h * dpr)) {
      this.c.width = Math.round(w * dpr); this.c.height = Math.round(h * dpr);
    }
    this.w = w; this.h = h; this.dpr = dpr;
  };

  View2D.prototype.fit = function () {
    this.size();
    var b = this.o.bounds(); if (!b) return;
    var pad = 28, bw = b[2] - b[0], bh = (b[3] - b[1]) * this.exag;
    this.s = Math.min((this.w - 2 * pad) / (bw || 1), (this.h - 2 * pad) / (bh || 1));
    this.ox = (this.w - bw * this.s) / 2 - b[0] * this.s;
    this.oy = (this.h + bh * this.s) / 2 + b[1] * this.s * this.exag;
    this.fitted = true;
  };

  View2D.prototype.redraw = function () {
    this.size();
    if (!this.fitted) this.fit();
    var ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.w, this.h);
    if (this.o.draw) this.o.draw(ctx, this);
  };

  // ---------- примитивы рисования (координаты в мм) ----------
  View2D.prototype.poly = function (pts, style, close) {
    if (!pts || pts.length < 2) return;
    var ctx = this.ctx; ctx.beginPath();
    for (var i = 0; i < pts.length; i++) {
      var p = this.toScreen(pts[i][0], pts[i][1]);
      if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
    }
    if (close) ctx.closePath();
    if (style.fill) { ctx.fillStyle = style.fill; ctx.fill(); }
    if (style.stroke) {
      ctx.strokeStyle = style.stroke; ctx.lineWidth = style.width || 1.5;
      ctx.setLineDash(style.dash || []); ctx.stroke(); ctx.setLineDash([]);
    }
  };

  View2D.prototype.dot = function (x, y, r, color, hollow) {
    var p = this.toScreen(x, y), ctx = this.ctx;
    ctx.beginPath(); ctx.arc(p[0], p[1], r || 3, 0, 2 * Math.PI);
    if (hollow) { ctx.fillStyle = '#fff'; ctx.fill(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.stroke(); }
    else { ctx.fillStyle = color; ctx.fill(); }
  };

  View2D.prototype.label = function (x, y, txt, color, align, dy) {
    var p = this.toScreen(x, y), ctx = this.ctx;
    ctx.font = '12px system-ui, -apple-system, "Segoe UI", sans-serif';
    ctx.fillStyle = color || '#555'; ctx.textAlign = align || 'center';
    ctx.fillText(txt, p[0], p[1] + (dy || 0));
  };

  // сетка 100 мм (или 10 мм, если крупно)
  View2D.prototype.grid = function () {
    var ctx = this.ctx, a = this.toWorld(0, this.h), b = this.toWorld(this.w, 0);
    var step = this.s * 100 < 25 ? 500 : (this.s * 10 > 30 ? 10 : 100);
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid') || '#e4e8ec';
    ctx.lineWidth = 1; ctx.beginPath();
    for (var x = Math.ceil(a[0] / step) * step; x <= b[0]; x += step) {
      var p = this.toScreen(x, 0); ctx.moveTo(Math.round(p[0]) + 0.5, 0); ctx.lineTo(Math.round(p[0]) + 0.5, this.h);
    }
    var ystep = step / (this.exag > 1.5 ? 5 : 1);
    for (var y = Math.ceil(a[1] / ystep) * ystep; y <= b[1]; y += ystep) {
      var q = this.toScreen(0, y); ctx.moveTo(0, Math.round(q[1]) + 0.5); ctx.lineTo(this.w, Math.round(q[1]) + 0.5);
    }
    ctx.stroke();
  };

  TS.View2D = View2D;
})(window.TS = window.TS || {});
