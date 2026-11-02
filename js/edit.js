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
    this.zb0 = b.strbot.byX(2); this.zd0 = b.strdeck.byX(2);
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

  function cp(c) { return { P: c.P.map(function (p) { return p.slice(); }), T1: c.T1.map(function (p) { return p.slice(); }), T2: c.T2.map(function (p) { return p.slice(); }) }; }
  E.prototype.snapshot = function () {
    var b = this.b;
    return { otl: cp(b.otl), bot: cp(b.strbot), deck: cp(b.strdeck), thick: b.thickDiff ? cp(b.thickDiff) : null,
             slices: b.slices.map(cp), deck0: cp(this.deck0), diffB: this.diffB ? cp(this.diffB) : null };
  };
  E.prototype.restore = function (s) {
    var b = this.b;
    TS.copyCurveInto(s.otl, b.otl); TS.copyCurveInto(s.bot, b.strbot); TS.copyCurveInto(s.deck, b.strdeck);
    if (s.thick && b.thickDiff) TS.copyCurveInto(s.thick, b.thickDiff);
    s.slices.forEach(function (c, i) { TS.copyCurveInto(c, b.slices[i]); });
    this.deck0 = cp(s.deck0); this.diffB = s.diffB ? cp(s.diffB) : null; this._diff0();
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
      var smooth = false;
      if (hasO) {
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

  TS.Editor = E;
})(window.TS = window.TS || {});
