/* Tentacle Shaper — правка доски мышью и клавишами, отмена, привязки как в Shape3D.
 * Правим: контур (вид сверху), рокер — низ стрингера (вид сбоку), толщину (вид сбоку, режим «Толщина»),
 * сечения (когда сечение стоит точно на заданном).
 * Верх стрингера «привязан» к низу: при правке рокера толщина сохраняется и доска гнётся целиком.
 * Внутри — сантиметры (как в файле), на экране — мм. GPL v3.
 */
(function (TS) {
  'use strict';

  function E(board, apexIdx) {
    this.b = board; this.a = apexIdx;
    this.undo = []; this.redo = [];
    this.sel = null;          // {key, i, kind}
    this.dirty = false;
    this._baseThickness();
  }

  // ---------- база для «привязки» верха к низу ----------
  E.prototype._baseThickness = function () {
    var b = this.b;
    this.bot0 = cp(b.strbot); this.zb0 = b.strbot.byX(2); this.zd0 = b.strdeck.byX(2);
    this.deck0 = cp(b.strdeck);
    this.diffB = b.thickDiff ? cp(b.thickDiff) : null;
    this._diff0();
  };
  // функция толщины «до правок» (смещается вместе с прямой правкой верха)
  E.prototype._diff0 = function () {
    this.diff0 = this.diffB ? new TS.Curve(this.diffB.P, this.diffB.T1, this.diffB.T2).byX(2) : null;
  };

  // ---------- кривые и их ключи ----------
  E.prototype.curve = function (key) {
    var b = this.b;
    if (key === 'otl') return b.otl;
    if (key === 'bot') return b.strbot;
    if (key === 'deck') return b.strdeck;
    if (key === 'thick') return b.thickDiff;
    if (key.indexOf('slice:') === 0) return b.slices[+key.slice(6)];
    return null;
  };

  function cp(c) {
    var o = { P: c.P.map(function (p) { return p.slice(); }), T1: c.T1.map(function (p) { return p.slice(); }), T2: c.T2.map(function (p) { return p.slice(); }) };
    if (c.ctype) o.ctype = c.ctype.slice(); if (c.ttype) o.ttype = c.ttype.slice(); if (c.free) o.free = c.free.slice();
    return o;
  }
  E.prototype.snapshot = function () {
    var b = this.b;
    return { otl: cp(b.otl), bot: cp(b.strbot), deck: cp(b.strdeck), thick: b.thickDiff ? cp(b.thickDiff) : null,
             slices: b.slices.map(function (c) { return { c: c, d: cp(c) }; }), deck0: cp(this.deck0), bot0: cp(this.bot0), diffB: this.diffB ? cp(this.diffB) : null, L: b.length,
             top: Object.keys(b.top).map(function (k) { return [k, cp(b.top[k].curve)]; }),
             side: Object.keys(b.side).map(function (k) { return [k, cp(b.side[k].curve)]; }) };
  };
  E.prototype.restore = function (s) {
    var b = this.b;
    TS.copyCurveInto(s.otl, b.otl); TS.copyCurveInto(s.bot, b.strbot); TS.copyCurveInto(s.deck, b.strdeck);
    if (s.thick && b.thickDiff) TS.copyCurveInto(s.thick, b.thickDiff);
    b.slices = s.slices.map(function (o) { TS.copyCurveInto(o.d, o.c); return o.c; });
    this.deck0 = cp(s.deck0); this.diffB = s.diffB ? cp(s.diffB) : null; this._diff0();
    if (s.L) b.length = s.L;
    (s.top || []).forEach(function (t) { if (b.top[t[0]]) TS.copyCurveInto(t[1], b.top[t[0]].curve); });
    (s.side || []).forEach(function (t) { if (b.side[t[0]]) TS.copyCurveInto(t[1], b.side[t[0]].curve); });
    this.bot0 = cp(s.bot0); this.zb0 = new TS.Curve(this.bot0.P, this.bot0.T1, this.bot0.T2).byX(2);
    this.sync();
  };
  E.prototype.begin = function () { this.undo.push(this.snapshot()); if (this.undo.length > 200) this.undo.shift(); this.redo = []; };
  E.prototype.doUndo = function () { if (!this.undo.length) return false; this.redo.push(this.snapshot()); this.restore(this.undo.pop()); this.dirty = true; this.everEdited = true; return true; };
  E.prototype.doRedo = function () { if (!this.redo.length) return false; this.undo.push(this.snapshot()); this.restore(this.redo.pop()); this.dirty = true; this.everEdited = true; return true; };

  // копии кривых, которые Shape3D хранит дважды
  E.prototype.sync = function () {
    var b = this.b;
    if (b.top[this.a]) TS.copyCurveInto(b.otl, b.top[this.a].curve);
    if (b.side[0]) TS.copyCurveInto(b.strbot, b.side[0].curve);
    var last = b.slices[0].P.length - 1;
    if (b.side[last]) TS.copyCurveInto(b.strdeck, b.side[last].curve);
  };

  // ---------- верх стрингера = низ + толщина ----------
  // Верх меняется на ту же величину, что низ (плюс правка толщины): deck = deck0 + Δ(x).
  // Без правок верх остаётся точно как в файле; ошибка приближения растёт только с размером правки.
  E.prototype.regenDeck = function () {
    var b = this.b, self = this, L = b.length;
    var zb = b.strbot.byX(2);
    var sb = b.strbot.sample(600), arc = [0];
    for (var i = 1; i < sb.length; i++) arc.push(arc[i - 1] + Math.hypot(sb[i][0] - sb[i - 1][0], sb[i][2] - sb[i - 1][2]));
    var S = arc[arc.length - 1], xs = sb.map(function (p) { return p[0]; });
    var diffNow = b.thickDiff ? b.thickDiff.byX(2) : null;
    var Sd = b.thickDiff ? b.thickDiff.P[b.thickDiff.P.length - 1][0] : 1;
    function delta(x) {
      var d = zb(x) - self.zb0(x);
      if (diffNow) { var s = TS.interp1(x, xs, arc) / S * Sd; d += diffNow(s) - self.diff0(s); }
      return d;
    }
    var d0 = this.deck0, d = b.strdeck, n = d.P.length, e = 0.02;
    function slope(x) { var a = Math.max(0, x - e), c = Math.min(L, x + e); return (delta(c) - delta(a)) / (c - a); }
    for (var k = 0; k < n; k++) {
      var x = d0.P[k][0], dz = delta(x), m = slope(x);
      d.P[k][0] = x; d.P[k][2] = d0.P[k][2] + dz;
      d.T1[k][0] = d0.T1[k][0]; d.T1[k][2] = d0.T1[k][2] + dz + m * (d0.T1[k][0] - x);
      d.T2[k][0] = d0.T2[k][0]; d.T2[k][2] = d0.T2[k][2] + dz + m * (d0.T2[k][0] - x);
    }
    // точность приближения (мм) — для проверки
    var zd0 = this.zd0, zz = d.byX(2), err = 0;
    for (var q = 0; q <= 300; q++) { var xq = L * q / 300; err = Math.max(err, Math.abs(zz(xq) - (zd0(xq) + delta(xq)))); }
    this.deckFitErr = err * 10;
  };

  // сечения подгоняются под контур и стрингер (форма сечения сохраняется)
  E.prototype.renormSlices = function () {
    var b = this.b, a = this.a;
    var W = b.otl.byX(1), zb = b.strbot.byX(2), zd = b.strdeck.byX(2);
    b.slices.forEach(function (s) {
      var x = s.P[0][0], n = s.P.length;
      var yA = s.P[a][1], z0 = s.P[0][2], z1 = s.P[n - 1][2];
      var ky = yA > 1e-6 ? W(x) / yA : 1, nb = zb(x), nd = zd(x), kz = (z1 - z0) ? (nd - nb) / (z1 - z0) : 1;
      [s.P, s.T1, s.T2].forEach(function (A) {
        A.forEach(function (p) { p[1] *= ky; p[2] = nb + (p[2] - z0) * kz; });
      });
    });
  };

  // ---------- перемещение точки ----------
  // key, i, kind: какая точка; u, v — новые координаты в плоскости вида (см); alt — без сглаживания
  E.prototype.move = function (key, i, kind, u, v, alt) {
    var c = this.curve(key); if (!c) return;
    if (key === 'deck') {
      // верх стрингера правится напрямую: смещаем и «базу» привязки, и кривую толщины на ту же величину,
      // чтобы следующая правка рокера сохранила новую толщину
      var before = cp(c);
      if (kind === 'P') u = c.P[i][0];               // точки верха двигаются только по высоте
      this._move('deck', i, kind, u, v, alt);
      var self = this, d0 = this.deck0, df = this.b.thickDiff, dB = this.diffB;
      ['P', 'T1', 'T2'].forEach(function (g) {
        for (var k = 0; k < c[g].length; k++) {
          var dx = c[g][k][0] - before[g][k][0], dz = c[g][k][2] - before[g][k][2];
          if (!dx && !dz) continue;
          d0[g][k][0] += dx; d0[g][k][2] += dz;
          if (df && df[g][k]) { df[g][k][2] += dz; dB[g][k][2] += dz; }
        }
      });
      this._diff0();
      this.sync(); this.dirty = true; this.everEdited = true;
      return;
    }
    this._move(key, i, kind, u, v, alt);
  };
  E.prototype._move = function (key, i, kind, u, v, alt) {
    var c = this.curve(key); if (!c) return;
    var b = this.b, L = b.length, n = c.P.length;
    var slice = key.indexOf('slice:') === 0;
    var iu = slice ? 1 : 0, iv = (key === 'otl') ? 1 : 2;   // сверху: x,y; сбоку: x,z; сечение: y,z
    var P = c.P[i];

    if (kind === 'P') {
      var nu = u, nv = v;
      if (!slice) {
        if (i === 0) nu = 0;
        if (i === n - 1) nu = (key === 'thick') ? P[0] : L;
        if (i > 0) nu = Math.max(nu, c.P[i - 1][0] + 0.05);
        if (i < n - 1) nu = Math.min(nu, c.P[i + 1][0] - 0.05);
        if (key === 'otl') nv = Math.max(0, nv);
      } else {
        if (i === 0 || i === n - 1) return;            // центр дна и дека — на стрингере
        if (i === this.a) nu = P[1];                    // апекс — по контуру
        nu = Math.max(0, nu);
      }
      var du = nu - P[iu], dv = nv - P[iv];
      [c.P[i], c.T1[i], c.T2[i]].forEach(function (p) { p[iu] += du; p[iv] += dv; });
    } else {
      var H = kind === 'T1' ? c.T1[i] : c.T2[i], O = kind === 'T1' ? c.T2[i] : c.T1[i];
      var hasO = (kind === 'T1' && i < n - 1) || (kind === 'T2' && i > 0);
      // были ли касательные на одной прямой (гладкая точка)
      var smooth = false, axis = c.ttype && c.ttype[i] === 16, free = c.free && c.free[i];
      if (hasO && !free) {
        var ax = H[iu] - P[iu], ay = H[iv] - P[iv], bx = O[iu] - P[iu], by = O[iv] - P[iv];
        var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
        smooth = la > 1e-6 && lb > 1e-6 && (ax * bx + ay * by) / (la * lb) < -0.9998;
      }
      var nu2 = u, nv2 = v;
      if (!slice) {
        if (kind === 'T1') nu2 = Math.min(nu2, P[0] - 0.01); else nu2 = Math.max(nu2, P[0] + 0.01);
      }
      if (slice && i === 0 && kind === 'T2' && Math.abs(H[2] - P[2]) < 1e-6) nv2 = P[2];          // дно в центре горизонтально
      if (slice && i === n - 1 && kind === 'T1' && Math.abs(H[2] - P[2]) < 1e-6) nv2 = P[2];      // дек в центре горизонтально
      if (axis) { if (slice) nu2 = P[iu]; else nv2 = P[iv]; }
      H[iu] = nu2; H[iv] = nv2;
      if (smooth && !alt) {
        var dx = H[iu] - P[iu], dy = H[iv] - P[iv], l = Math.hypot(dx, dy);
        var lo = Math.hypot(O[iu] - P[iu], O[iv] - P[iv]);
        if (l > 1e-9) { O[iu] = P[iu] - dx / l * lo; O[iv] = P[iv] - dy / l * lo; }
      }
    }
    if (key === 'bot' || key === 'thick') this.regenDeck();
    if (key === 'deck') return;
    this.sync();
    this.dirty = true; this.everEdited = true;
  };

  // точки для рисования/выбора в виде: [{key,i,kind,u,v}] (см)
  E.prototype.handles = function (key) {
    var c = this.curve(key); if (!c) return [];
    var slice = key.indexOf('slice:') === 0, iu = slice ? 1 : 0, iv = (key === 'otl') ? 1 : 2;
    var out = [], n = c.P.length;
    for (var i = 0; i < n; i++) {
      out.push({ key: key, i: i, kind: 'P', u: c.P[i][iu], v: c.P[i][iv] });
      if (i > 0) out.push({ key: key, i: i, kind: 'T1', u: c.T1[i][iu], v: c.T1[i][iv], pu: c.P[i][iu], pv: c.P[i][iv] });
      if (i < n - 1) out.push({ key: key, i: i, kind: 'T2', u: c.T2[i][iu], v: c.T2[i][iv], pu: c.P[i][iu], pv: c.P[i][iv] });
    }
    return out;
  };

  E.prototype.value = function (sel) {
    var c = this.curve(sel.key), slice = sel.key.indexOf('slice:') === 0;
    var p = sel.kind === 'P' ? c.P[sel.i] : (sel.kind === 'T1' ? c.T1[sel.i] : c.T2[sel.i]);
    return slice ? [p[1], p[2]] : [p[0], sel.key === 'otl' ? p[1] : p[2]];
  };

  // ---------- добавить / удалить опорную точку (контур, низ и верх стрингера, толщина) ----------
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function splitArr(c, i, t, keepType) {
    var p0 = c.P[i], p1 = c.T2[i], p2 = c.T1[i + 1], p3 = c.P[i + 1];
    var a = lerp(p0, p1, t), bq = lerp(p1, p2, t), cc = lerp(p2, p3, t), d = lerp(a, bq, t), e = lerp(bq, cc, t), m = lerp(d, e, t);
    c.T2[i] = a; c.T1[i + 1] = cc;
    c.P.splice(i + 1, 0, m); c.T1.splice(i + 1, 0, d); c.T2.splice(i + 1, 0, e);
    if (c.ctype) c.ctype.splice(i + 1, 0, 0);
    if (c.ttype) c.ttype.splice(i + 1, 0, 0);
    if (c.free) c.free.splice(i + 1, 0, false);
  }
  // точка на кривой: сегмент и параметр, ближайшие к (u, v) в плоскости вида
  E.prototype.nearestOnCurve = function (key, u, v) {
    var c = this.curve(key), iv = key === 'otl' ? 1 : 2, best = null;
    for (var i = 0; i < c.P.length - 1; i++) for (var k = 1; k < 100; k++) {
      var t = k / 100, p = c.point(i, t), d = Math.hypot(p[0] - u, p[iv] - v);
      if (!best || d < best.d) best = { i: i, t: t, d: d };
    }
    return best;
  };
  E.prototype.insertPoint = function (key, i, t) {
    if (key.indexOf('slice:') === 0) return false;     // у всех сечений должно быть одно число точек
    var c = this.curve(key); if (!c) return false;
    splitArr(c, i, t);
    // база привязки верха и кривая толщины идут той же структурой
    if (key === 'deck') splitArr(this.deck0, i, t);
    if (key === 'thick' && this.diffB) { splitArr(this.diffB, i, t); this._diff0(); }
    this.sync(); this.dirty = true; this.everEdited = true;
    return true;
  };
  E.prototype.deletePoint = function (key, i) {
    if (key.indexOf('slice:') === 0) return false;
    var c = this.curve(key); if (!c || i <= 0 || i >= c.P.length - 1 || c.P.length <= 2) return false;
    // удаление: ручки соседей подбираются так, чтобы одна дуга как можно ближе прошла по двум прежним
    function bez(a, b, c, d, t) { var u = 1 - t; return [0, 1, 2].map(function (k) { return u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]; }); }
    function del(o) {
      var A = o.P[i - 1], B = o.P[i + 1], old = [], k, j;
      for (k = 1; k < 20; k++) old.push(bez(o.P[i - 1], o.T2[i - 1], o.T1[i], o.P[i], k / 20));
      for (k = 0; k < 20; k++) old.push(bez(o.P[i], o.T2[i], o.T1[i + 1], o.P[i + 1], k / 20));
      var d1 = [0, 1, 2].map(function (q) { return o.T2[i - 1][q] - A[q]; }), d2 = [0, 1, 2].map(function (q) { return o.T1[i + 1][q] - B[q]; });
      var n1 = Math.hypot(d1[0], d1[1], d1[2]) || 1, n2 = Math.hypot(d2[0], d2[1], d2[2]) || 1;
      d1 = d1.map(function (v) { return v / n1; }); d2 = d2.map(function (v) { return v / n2; });
      function err(l1, l2) {
        var h1 = [0, 1, 2].map(function (q) { return A[q] + d1[q] * l1; }), h2 = [0, 1, 2].map(function (q) { return B[q] + d2[q] * l2; });
        var cur = []; for (k = 0; k <= 60; k++) cur.push(bez(A, h1, h2, B, k / 60));
        var e = 0;
        old.forEach(function (p) { var m = Infinity; cur.forEach(function (q) { m = Math.min(m, (p[0] - q[0]) * (p[0] - q[0]) + (p[1] - q[1]) * (p[1] - q[1]) + (p[2] - q[2]) * (p[2] - q[2])); }); e += m; });
        return e;
      }
      var chord = Math.hypot(B[0] - A[0], B[1] - A[1], B[2] - A[2]), l1 = chord / 3, l2 = chord / 3, st = chord / 6, e0 = err(l1, l2);
      for (j = 0; j < 60 && st > chord * 1e-4; j++) {
        var moved = false;
        [[st, 0], [-st, 0], [0, st], [0, -st]].forEach(function (dd) {
          var a1 = Math.max(chord * 0.02, l1 + dd[0]), a2 = Math.max(chord * 0.02, l2 + dd[1]), e1 = err(a1, a2);
          if (e1 < e0) { e0 = e1; l1 = a1; l2 = a2; moved = true; }
        });
        if (!moved) st /= 2;
      }
      for (k = 0; k < 3; k++) { o.T2[i - 1][k] = A[k] + d1[k] * l1; o.T1[i + 1][k] = B[k] + d2[k] * l2; }
      ['P', 'T1', 'T2', 'ctype', 'ttype', 'free'].forEach(function (g) { if (o[g]) o[g].splice(i, 1); });
    }
    del(c);
    if (key === 'deck' && this.deck0.P.length > c.P.length) del(this.deck0);
    if (key === 'thick' && this.diffB && this.diffB.P.length > c.P.length) { del(this.diffB); this._diff0(); }
    if (key === 'bot' || key === 'thick') this.regenDeck();
    this.sync(); this.renormSlices(); this.sync(); this.dirty = true; this.everEdited = true;
    return true;
  };

  // тип точки: 'smooth' — касательные на одной прямой, 'corner' — излом (независимые), 'axis' — горизонтальная
  // (в сечении — вертикальная) касательная
  E.prototype.setType = function (key, i, type) {
    var c = this.curve(key); if (!c) return;
    var slice = key.indexOf('slice:') === 0, iu = slice ? 1 : 0, iv = key === 'otl' ? 1 : 2, n = c.P.length, P = c.P[i];
    c.free = c.free || c.P.map(function () { return false; });
    c.ttype = c.ttype || c.P.map(function () { return 0; });
    c.free[i] = type === 'corner';
    if (type === 'axis' || type === 'smooth') {
      var a = i > 0 ? c.T1[i] : null, b = i < n - 1 ? c.T2[i] : null;
      var la = a ? Math.hypot(a[iu] - P[iu], a[iv] - P[iv]) : 0, lb = b ? Math.hypot(b[iu] - P[iu], b[iv] - P[iv]) : 0;
      var du, dv;
      if (type === 'axis') { if (slice) { du = 0; dv = 1; } else { du = 1; dv = 0; } }
      else {
        du = (b ? b[iu] - P[iu] : 0) - (a ? a[iu] - P[iu] : 0); dv = (b ? b[iv] - P[iv] : 0) - (a ? a[iv] - P[iv] : 0);
        var l = Math.hypot(du, dv) || 1; du /= l; dv /= l;
      }
      if (type === 'axis' && slice && b && b[iv] < P[iv]) dv = -1;
      if (a) { a[iu] = P[iu] - du * la; a[iv] = P[iv] - dv * la; }
      if (b) { b[iu] = P[iu] + du * lb; b[iv] = P[iv] + dv * lb; }
      c.ttype[i] = type === 'axis' ? 16 : 0;
    }
    if (key === 'bot' || key === 'thick') this.regenDeck();
    this.sync(); this.dirty = true; this.everEdited = true;
  };
  E.prototype.typeOf = function (key, i) {
    var c = this.curve(key); if (!c) return 'smooth';
    if (c.free && c.free[i]) return 'corner';
    if (c.ttype && c.ttype[i] === 16) return 'axis';
    return 'smooth';
  };

  // ---------- сечения: добавить, удалить, сдвинуть ----------
  E.prototype.addSlice = function (model, x) {
    var b = this.b, k = 0;
    while (k < b.slices.length && b.slices[k].P[0][0] < x) k++;
    if (k === 0 || k >= b.slices.length) return -1;
    if (Math.abs(b.slices[k].P[0][0] - x) < 0.5 || Math.abs(b.slices[k - 1].P[0][0] - x) < 0.5) return -1;
    var src = b.slices[k - 1], cc = model.sectionCtrl(x);
    function pts(A) { return A.map(function (p) { return [x, p[0], p[1]]; }); }
    var c = new TS.Curve(pts(cc.P), pts(cc.T1), pts(cc.T2), src.ctype.slice(), src.name);
    c.ttype = src.ttype ? src.ttype.slice() : null;
    c.wrap = src.wrap.cloneNode(true);
    c.node = c.wrap.getElementsByTagName('Bezier3d')[0];
    b.slices.splice(k, 0, c);
    this.dirty = true; this.everEdited = true;
    return k;
  };
  E.prototype.deleteSlice = function (k) {
    var b = this.b;
    if (k <= 0 || k >= b.slices.length - 1) return false;     // хвост и нос не удаляются
    b.slices.splice(k, 1);
    this.dirty = true; this.everEdited = true;
    return true;
  };
  E.prototype.moveSlice = function (k, x) {
    var b = this.b, s = b.slices[k];
    if (k <= 0 || k >= b.slices.length - 1) return false;
    var lo = b.slices[k - 1].P[0][0] + 0.5, hi = b.slices[k + 1].P[0][0] - 0.5;
    x = Math.max(lo, Math.min(hi, x));
    [s.P, s.T1, s.T2].forEach(function (A) { A.forEach(function (p) { p[0] = x; }); });
    this.renormSlices(); this.dirty = true; this.everEdited = true;
    return x;
  };

  TS.Editor = E;
})(window.TS = window.TS || {});
