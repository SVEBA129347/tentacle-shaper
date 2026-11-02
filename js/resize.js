/* Tentacle Shaper — изменение размеров доски (как окно Size and parameters в Shape3D) и подбор объёма.
 * Длина — растяжение по X; ширина — по Y; рокер — растяжение высоты низа над нулевой точкой
 * (отдельно для хвоста и носа), верх двигается вместе с низом; толщина — растяжение верха над низом.
 * После изменения форма сечений сохраняется (они подгоняются под новые кривые). GPL v3.
 */
(function (TS) {
  'use strict';

  function each(c, f) { if (!c) return; ['P', 'T1', 'T2'].forEach(function (g) { c[g].forEach(f); }); }

  // все кривые доски, которые надо преобразовывать, с их ролью
  function curves(b, ed) {
    var out = { x: [], y: [], side: [] };
    [b.otl, b.strbot, b.strdeck, b.thickDiff, ed.deck0, ed.diffB].concat(b.slices).forEach(function (c) { if (c) out.x.push(c); });
    Object.keys(b.top).forEach(function (k) { out.x.push(b.top[k].curve); out.y.push(b.top[k].curve); });
    Object.keys(b.side).forEach(function (k) { out.x.push(b.side[k].curve); out.side.push({ k: +k, c: b.side[k].curve }); });
    out.y.push(b.otl); b.slices.forEach(function (s) { out.y.push(s); });
    return out;
  }
  function uniq(a) { var r = []; a.forEach(function (c) { if (r.indexOf(c) < 0) r.push(c); }); return r; }

  // f: {kx, ky, kt, ktr, knr} — множители длины, ширины, толщины, рокера хвоста и носа
  TS.resizeApply = function (b, ed, f) {
    var L = b.length, cv = curves(b, ed), last = b.slices[0].P.length - 1, rec = TS.boxRecord(b);
    // кривые-копии (низ и верх стрингера в side), их заменит sync
    var sideOther = cv.side.filter(function (o) { return o.k !== 0 && o.k !== last; }).map(function (o) { return o.c; });

    if (f.kx && Math.abs(f.kx - 1) > 1e-9) {
      uniq(cv.x).forEach(function (c) { each(c, function (p) { p[0] *= f.kx; }); });
      b.length = L * f.kx; L = b.length;
    }
    if (f.ky && Math.abs(f.ky - 1) > 1e-9) uniq(cv.y).forEach(function (c) { each(c, function (p) { p[1] *= f.ky; }); });

    var deckLike = uniq([b.strdeck, ed.deck0].concat(sideOther));
    if ((f.ktr && Math.abs(f.ktr - 1) > 1e-9) || (f.knr && Math.abs(f.knr - 1) > 1e-9)) {
      var zbOld = b.strbot.byX(2), sb = b.strbot.sample(400), minZ = Infinity, zx = 0;
      sb.forEach(function (p) { if (p[2] < minZ) { minZ = p[2]; zx = p[0]; } });
      var a = f.ktr || 1, n = f.knr || 1, w = 0.08 * L;
      var kk = function (x) { var t = Math.min(1, Math.max(0, (x - (zx - w)) / (2 * w))); t = t * t * (3 - 2 * t); return a + (n - a) * t; };
      each(b.strbot, function (p) { p[2] = minZ + (p[2] - minZ) * kk(p[0]); });
      var zbNew = b.strbot.byX(2);
      deckLike.forEach(function (c) { each(c, function (p) { p[2] += zbNew(p[0]) - zbOld(p[0]); }); });
      b.slices.forEach(function (s) { var d = zbNew(s.P[0][0]) - zbOld(s.P[0][0]); each(s, function (p) { p[2] += d; }); });
    }
    if (f.kt && Math.abs(f.kt - 1) > 1e-9) {
      var zb = b.strbot.byX(2);
      deckLike.forEach(function (c) { each(c, function (p) { p[2] = zb(p[0]) + (p[2] - zb(p[0])) * f.kt; }); });
      [b.thickDiff, ed.diffB].forEach(function (c) { each(c, function (p) { p[2] *= f.kt; }); });
    }
    ed.sync();
    ed._baseThickness();
    ed.renormSlices(); ed.sync();
    TS.boxFollow(b, rec);
    ed.dirty = true; ed.everEdited = true;
  };

  function measure(b) {
    var m = new TS.Model(b), ms = m.measures();
    return { m: m, L: ms.lengthDev, W: ms.width, T: ms.thick, tr: ms.tailRocker, nr: ms.noseRocker };
  }
  TS.resizeMeasure = measure;

  // привести доску к целевым размерам (мм); незаданные (NaN) не трогаем. Несколько проходов для точности.
  TS.resizeTo = function (b, ed, tg) {
    for (var it = 0; it < 5; it++) {
      var c = measure(b), f = {}, done = true;
      function k(key, cur) {
        if (!isFinite(tg[key]) || !isFinite(cur) || Math.abs(cur) < 1e-3) return 1;
        if (Math.abs(tg[key] - cur) > 0.01) done = false;
        return tg[key] / cur;
      }
      f.kx = k('L', c.L); f.ky = k('W', c.W); f.ktr = k('tr', c.tr); f.knr = k('nr', c.nr); f.kt = k('T', c.T);
      if (done) break;
      TS.resizeApply(b, ed, f);
    }
    return measure(b);
  };

  // подбор объёма: меняем выбранный размер (или все по режиму) до нужного объёма, литры
  TS.volumeFit = function (b, ed, targetL, what, base) {
    var snap = ed.snapshot(), L0 = b.length;
    function vol(k) {
      ed.restore(snap); b.length = L0; ed._baseThickness();
      var tg = {};
      if (what === 'T') tg.T = base.T * k;
      else if (what === 'W') tg.W = base.W * k;
      else { tg.T = base.T * k; tg.W = base.W * k; }
      TS.resizeTo(b, ed, tg);
      return new TS.Model(b).volume(400);
    }
    var lo = 0.6, hi = 1.6, vlo = vol(lo), vhi = vol(hi);
    if ((vlo - targetL) * (vhi - targetL) > 0) { vol(1); return null; }
    for (var i = 0; i < 22; i++) {
      var mid = (lo + hi) / 2, vm = vol(mid);
      if ((vm - targetL) * (vlo - targetL) > 0) { lo = mid; vlo = vm; } else hi = mid;
    }
    vol((lo + hi) / 2);
    return (lo + hi) / 2;
  };
})(window.TS = window.TS || {});
