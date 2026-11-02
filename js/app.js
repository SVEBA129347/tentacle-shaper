/* Tentacle Shaper — страница: открытие и сохранение файла, виды, правка, размеры. GPL v3. */
(function (TS) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var st = { board: null, model: null, ed: null, secX: 0, geo: null, sideMode: 'rocker', drag: null };
  var C = { line: '#1d2b36', fill: 'rgba(240,236,226,0.9)', slice: '#d9480f', cur: '#1971c2',
            pt: '#7a8a99', apex: '#1971c2', rail: '#2f9e44', h: '#e8590c', sel: '#c2255c' };
  var HIT = 9;   // радиус захвата точки, пикселей

  function fmt(v, d) { return isFinite(v) ? v.toFixed(d === undefined ? 1 : d) : '—'; }

  // ---------- геометрия для видов (мм) ----------
  function buildGeo() {
    var b = st.board, m = st.model;
    var otl = b.otl.sample(120).map(function (p) { return [p[0] * 10, p[1] * 10]; });
    var outline = otl.concat(otl.slice().reverse().map(function (p) { return [p[0], -p[1]]; }));
    var bot = b.strbot.sample(120).map(function (p) { return [p[0] * 10, p[2] * 10]; });
    var deck = b.strdeck.sample(120).map(function (p) { return [p[0] * 10, p[2] * 10]; });
    var minZ = Math.min.apply(null, bot.map(function (p) { return p[1]; }));
    var maxZ = Math.max.apply(null, deck.map(function (p) { return p[1]; }));
    var maxY = Math.max.apply(null, otl.map(function (p) { return p[1]; }));
    var th = b.thickDiff ? b.thickDiff.sample(120).map(function (p) { return [p[0] * 10, p[2] * 10]; }) : null;
    st.geo = {
      outline: outline, side: deck.concat(bot.slice().reverse()), bot: bot, deck: deck, thick: th,
      lines: m.pointLines(240), L: m.L * 10, minZ: minZ, maxZ: maxZ, maxY: maxY,
      maxT: th ? Math.max.apply(null, th.map(function (p) { return p[1]; })) : 1,
      S: th ? th[th.length - 1][0] : 1
    };
  }

  // ---------- какие точки правятся в каком виде ----------
  function sliceIndexAtCursor() {
    if (!st.model) return -1;
    for (var k = 0; k < st.model.sliceX.length; k++) if (Math.abs(st.model.sliceX[k] - st.secX) < 1e-4) return k;
    return -1;
  }
  function editKey(view) {
    if (view === vTop) return 'otl';
    if (view === vSide) return st.sideMode === 'thick' ? 'thick' : ['bot', 'deck'];
    if (view === vSlice) { var k = sliceIndexAtCursor(); return k >= 0 ? 'slice:' + k : null; }
    return null;
  }

  // ---------- выбор: главная точка + ещё выбранные (Ctrl/Shift) ----------
  function sameSel(a, b) { return a && b && a.key === b.key && a.i === b.i && a.kind === b.kind; }
  function allSel() {
    var s = st.ed && st.ed.sel; if (!s) return [];
    return [s].concat((st.ed.multi || []).filter(function (m) { return !sameSel(m, s); }));
  }
  function inSel(h) { return allSel().some(function (s) { return sameSel(s, h); }); }
  function clearMulti() { if (st.ed) st.ed.multi = []; }
  // касательные точки видны, если включено «все касательные» (T) или точка выбрана
  function tanVisible(h) {
    if (st.allTan) return true;
    return allSel().some(function (s) { return s.key === h.key && s.i === h.i; });
  }

  // рисуем полигон точек и касательных правимой кривой; sign — зеркало (низ контура)
  function drawHandles(v, key, sign) {
    if (!key || !st.ed || st.hidePts) return;
    sign = sign || 1;
    var hs = st.ed.handles(key);
    var ctx = v.ctx;
    hs.forEach(function (h) {
      if (h.kind === 'P' || !tanVisible(h)) return;
      v.poly([[h.pu * 10, sign * h.pv * 10], [h.u * 10, sign * h.v * 10]], { stroke: '#b5a99a', width: 1 });
    });
    hs.forEach(function (h) {
      if (h.kind !== 'P' && !tanVisible(h)) return;
      var isSel = inSel(h);
      var p = v.toScreen(h.u * 10, sign * h.v * 10);
      ctx.beginPath();
      if (h.kind === 'P') { ctx.rect(p[0] - 4.5, p[1] - 4.5, 9, 9); ctx.fillStyle = isSel ? C.sel : '#fff'; ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = isSel ? C.sel : C.h; ctx.stroke(); }
      else { ctx.arc(p[0], p[1], isSel ? 4.5 : 3.2, 0, 2 * Math.PI); ctx.fillStyle = isSel ? C.sel : C.h; ctx.fill(); }
    });
  }

  // ---------- проверка ошибок (E): совпавшие точки — зелёные, петли и изломы — красные ----------
  function curveErrors(c, iu, iv, isSlice, L) {
    var out = [], n = c.P.length, i, k;
    for (i = 0; i < n; i++) {
      var P = c.P[i];
      if (i < n - 1 && Math.hypot(c.P[i + 1][iu] - P[iu], c.P[i + 1][iv] - P[iv]) < 0.05) out.push({ u: P[iu], v: P[iv], c: 'g', t: 'errSame' });
      // касательная нулевой длины — может дать петлю
      var z1 = i > 0 && Math.hypot(c.T1[i][iu] - P[iu], c.T1[i][iv] - P[iv]) < 0.005;
      var z2 = i < n - 1 && Math.hypot(c.T2[i][iu] - P[iu], c.T2[i][iv] - P[iv]) < 0.005;
      if (!isSlice && (z1 || z2))
        out.push({ u: P[iu], v: P[iv], c: 'r', t: 'errZero' });
      // излом там, где точка не задана как излом
      if (!isSlice && i > 0 && i < n - 1 && !(c.free && c.free[i])) {
        var ax = P[iu] - c.T1[i][iu], ay = P[iv] - c.T1[i][iv], bx = c.T2[i][iu] - P[iu], by = c.T2[i][iv] - P[iv];
        var la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
        if (la > 1e-6 && lb > 1e-6 && (ax * bx + ay * by) / (la * lb) < Math.cos(1 * Math.PI / 180)) out.push({ u: P[iu], v: P[iv], c: 'o', t: 'errKink' });
      }
    }
    if (!isSlice) {
      // по длине кривая должна идти только вперёд и не выходить за 0…L
      for (i = 0; i < n - 1; i++) {
        var prev = c.point(i, 0);
        for (k = 1; k <= 40; k++) {
          var p = c.point(i, k / 40);
          if (p[0] < prev[0] - 1e-6 || p[0] < -1e-4 || (L && p[0] > L + 1e-4)) { out.push({ u: p[0], v: p[iv], c: 'r', t: 'errLoop' }); break; }
          prev = p;
        }
      }
    } else {
      // сечение: не заходит за ось и не пересекает само себя
      var pts = [];
      for (i = 0; i < n - 1; i++) for (k = 0; k < 30; k++) pts.push(c.point(i, k / 30));
      pts.push(c.P[n - 1]);
      var bad = null;
      pts.forEach(function (q) { if (!bad && q[1] < -0.01) bad = q; });
      if (bad) out.push({ u: bad[1], v: bad[2], c: 'r', t: 'errAxis' });
      for (i = 0; i < pts.length - 1 && out.length < 40; i++) for (k = i + 2; k < pts.length - 1; k++) {
        if (segX(pts[i], pts[i + 1], pts[k], pts[k + 1])) { out.push({ u: pts[i][1], v: pts[i][2], c: 'r', t: 'errLoop' }); i = pts.length; break; }
      }
    }
    return out;
  }
  function segX(a, b, c, d) {
    function cr(p, q, r) { return (q[1] - p[1]) * (r[2] - p[2]) - (q[2] - p[2]) * (r[1] - p[1]); }
    var d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
    return ((d1 > 0) !== (d2 > 0)) && ((d3 > 0) !== (d4 > 0)) && Math.abs(d1) > 1e-12 && Math.abs(d2) > 1e-12;
  }
  // все ошибки доски: {view, u, v (см), c, t}
  function boardErrors() {
    var b = st.board, L = b.length, out = [];
    function add(view, list) { list.forEach(function (e) { e.view = view; out.push(e); }); }
    add('top', curveErrors(b.otl, 0, 1, false, L));
    add('side', curveErrors(b.strbot, 0, 2, false, L));
    add('side', curveErrors(b.strdeck, 0, 2, false, L));
    if (b.thickDiff) add('thick', curveErrors(b.thickDiff, 0, 2, false, 0));
    b.slices.forEach(function (s, k) { add('slice:' + k, curveErrors(s, 1, 2, true, 0)); });
    var n = b.otl.P.length;
    if (b.otl.P[0][1] < 0.05) out.push({ view: 'top', u: 0, v: b.otl.P[0][1], c: 'r', t: 'errEndW' });
    if (b.otl.P[n - 1][1] < 0.05) out.push({ view: 'top', u: L, v: b.otl.P[n - 1][1], c: 'r', t: 'errEndW' });
    [0, L].forEach(function (x) { if (st.model.zd(x) - st.model.zb(x) < 0.05) out.push({ view: 'side', u: x, v: st.model.zb(x), c: 'r', t: 'errEndT' }); });
    for (var k = 0; k + 1 < st.model.sliceX.length; k++) {
      if (st.model.sliceX[k + 1] - st.model.sliceX[k] < 0.5) out.push({ view: 'top', u: st.model.sliceX[k], v: 0, c: 'g', t: 'errSlices' });
    }
    return out;
  }
  function drawErrors(v, view) {
    if (!st.showErr || !st.errs) return;
    var ctx = v.ctx, ki = sliceIndexAtCursor();
    st.errs.forEach(function (e) {
      if (e.view !== view && !(view === 'slice' && e.view === 'slice:' + ki)) return;
      var signs = view === 'top' && e.v > 0 ? [1, -1] : [1];
      signs.forEach(function (sg) {
        var p = v.toScreen(e.u * 10, sg * e.v * 10);
        ctx.beginPath(); ctx.arc(p[0], p[1], 11, 0, 2 * Math.PI);
        var col = { g: ['rgba(47,158,68,0.35)', '#2f9e44'], o: ['rgba(247,103,7,0.25)', '#f76707'], r: ['rgba(224,49,49,0.35)', '#e03131'] }[e.c];
        ctx.fillStyle = col[0]; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = col[1]; ctx.stroke();
      });
    });
  }
  function updateErrors() {
    if (!st.showErr || !st.board) { st.errs = null; return; }
    st.errs = boardErrors();
    var kinds = {};
    st.errs.slice().sort(function (a, b) { return (a.c === 'o') - (b.c === 'o'); }).forEach(function (e) {
      var w = e.view.indexOf('slice:') === 0 ? TS.t('slice') + ' ' + (+e.view.slice(6) + 1) : TS.t(e.view === 'top' ? 'top' : (e.view === 'thick' ? 'thickMode' : 'side'));
      kinds[TS.t(e.t) + ' (' + w + ')'] = 1;
    });
    var ks = Object.keys(kinds), real = st.errs.some(function (e) { return e.c !== 'o'; });
    $('msg').textContent = (real ? TS.t('errFound') + ': ' : TS.t('errNone') + '. ') + (ks.length ? ks.slice(0, 4).join('; ') + (ks.length > 4 ? '…' : '') : '');
  }

  // ---------- глубина дуги (D): выбранный участок кривой между двумя точками ----------
  function arcPlane(key) { return key.indexOf('slice:') === 0 ? [1, 2] : (key === 'otl' ? [0, 1] : [0, 2]); }
  function pickArc(view, sx, sy) {
    var key = editKey(view); if (!key) return null;
    var best = null;
    [].concat(key).forEach(function (k) {
      var c = st.ed.curve(k); if (!c) return;
      var pl = arcPlane(k), signs = k === 'otl' ? [1, -1] : [1];
      signs.forEach(function (sg) {
        for (var i = 0; i < c.P.length - 1; i++) for (var q = 1; q < 60; q++) {
          var p = c.point(i, q / 60), s = view.toScreen(p[pl[0]] * 10, sg * p[pl[1]] * 10), d = Math.hypot(s[0] - sx, s[1] - sy);
          if (d < 10 && (!best || d < best.d)) best = { key: k, i: i, d: d };
        }
      });
    });
    return best && { key: best.key, i: best.i };
  }
  function arcInfo(a) {
    var c = st.ed.curve(a.key); if (!c || a.i >= c.P.length - 1) return null;
    var pl = arcPlane(a.key), A = c.P[a.i], B = c.P[a.i + 1];
    var ax = A[pl[0]], ay = A[pl[1]], bx = B[pl[0]], by = B[pl[1]], ch = Math.hypot(bx - ax, by - ay) || 1e-9;
    var nx = -(by - ay) / ch, ny = (bx - ax) / ch, best = { d: 0, p: [ax, ay] }, len = 0, prev = [ax, ay];
    for (var q = 1; q <= 200; q++) {
      var p = c.point(a.i, q / 200), u = p[pl[0]], v = p[pl[1]], d = (u - ax) * nx + (v - ay) * ny;
      len += Math.hypot(u - prev[0], v - prev[1]); prev = [u, v];
      if (Math.abs(d) > Math.abs(best.d)) best = { d: d, p: [u, v] };
    }
    return { A: [ax, ay], B: [bx, by], depth: Math.abs(best.d), deep: best.p, foot: [best.p[0] - best.d * nx, best.p[1] - best.d * ny],
             chord: ch, len: len, ang: Math.atan2(by - ay, bx - ax) * 180 / Math.PI };
  }
  function drawArc(v, view) {
    if (!st.showDepth || !st.arc) return;
    var a = st.arc, vk = a.key.indexOf('slice:') === 0 ? 'slice' : (a.key === 'otl' ? 'top' : (a.key === 'thick' ? 'thick' : 'side'));
    if (vk === 'slice' && a.key !== 'slice:' + sliceIndexAtCursor()) return;
    if (vk !== view) return;
    var r = arcInfo(a); if (!r) return;
    var st2 = { stroke: '#e03131', width: 1.4 };
    v.poly([[r.A[0] * 10, r.A[1] * 10], [r.B[0] * 10, r.B[1] * 10]], { stroke: '#e03131', width: 1, dash: [5, 3] });
    v.poly([[r.foot[0] * 10, r.foot[1] * 10], [r.deep[0] * 10, r.deep[1] * 10]], st2);
    v.label(r.deep[0] * 10, r.deep[1] * 10, fmt(r.depth * 10, 2) + ' ' + TS.t('mm'), '#c92a2a', 'center', -8);
  }
  function arcStatus() {
    if (!st.showDepth || !st.arc) return;
    var r = arcInfo(st.arc); if (!r) return;
    var mm = ' ' + TS.t('mm');
    $('coords').textContent = TS.t('arcDepth') + ' ' + fmt(r.depth * 10, 2) + mm + ' · ' + TS.t('arcChord') + ' ' + fmt(r.chord * 10, 1) + mm +
      ' · ' + TS.t('arcLen') + ' ' + fmt(r.len * 10, 1) + mm + ' · ' + TS.t('arcAng') + ' ' + fmt(r.ang, 2) + '°';
  }

  // ---------- гребёнка кривизны и исходная форма ----------
  // кривизна кривой Безье в плоскости вида (iu, iv) — по аналитическим производным
  function comb(v, c, iu, iv, sign, color) {
    if (!st.showCurv || !c) return;
    var pts = [], kmax = 0;
    for (var i = 0; i < c.P.length - 1; i++) {
      var a = c.P[i], b = c.T2[i], cc = c.T1[i + 1], d = c.P[i + 1];
      for (var k = 0; k <= 24; k++) {
        var t = k / 24, u = 1 - t;
        var x = u * u * u * a[iu] + 3 * u * u * t * b[iu] + 3 * u * t * t * cc[iu] + t * t * t * d[iu];
        var y = u * u * u * a[iv] + 3 * u * u * t * b[iv] + 3 * u * t * t * cc[iv] + t * t * t * d[iv];
        var dx = 3 * (u * u * (b[iu] - a[iu]) + 2 * u * t * (cc[iu] - b[iu]) + t * t * (d[iu] - cc[iu]));
        var dy = 3 * (u * u * (b[iv] - a[iv]) + 2 * u * t * (cc[iv] - b[iv]) + t * t * (d[iv] - cc[iv]));
        var ddx = 6 * (u * (cc[iu] - 2 * b[iu] + a[iu]) + t * (d[iu] - 2 * cc[iu] + b[iu]));
        var ddy = 6 * (u * (cc[iv] - 2 * b[iv] + a[iv]) + t * (d[iv] - 2 * cc[iv] + b[iv]));
        var sp = Math.hypot(dx, dy) || 1e-9, kap = (dx * ddy - dy * ddx) / (sp * sp * sp);
        pts.push({ x: x * 10, y: sign * y * 10, nx: -dy / sp, ny: sign * dx / sp, k: kap * sign });
        kmax = Math.max(kmax, Math.abs(kap));
      }
    }
    if (!kmax) return;
    var ctx = v.ctx, scale = 40 / kmax;     // самая крутая точка — 40 пикселей
    ctx.strokeStyle = color || 'rgba(194,37,92,0.55)'; ctx.lineWidth = 1; ctx.beginPath();
    var tip = [];
    pts.forEach(function (p) {
      var s0 = v.toScreen(p.x, p.y), L = -p.k * scale;
      var e = [s0[0] + p.nx * L, s0[1] - p.ny * L];
      ctx.moveTo(s0[0], s0[1]); ctx.lineTo(e[0], e[1]); tip.push(e);
    });
    ctx.stroke(); ctx.beginPath();
    tip.forEach(function (e, i) { if (i) ctx.lineTo(e[0], e[1]); else ctx.moveTo(e[0], e[1]); });
    ctx.stroke();
  }
  var REF = 'rgba(25,113,194,0.55)', GH = { stroke: 'rgba(47,158,68,0.85)', width: 1.4, dash: [8, 4] };
  function ghostTop(v) {
    if (!st.ghost) return;
    var o = st.ghost.board.otl.sample(80).map(function (p) { return [p[0] * 10, p[1] * 10]; });
    v.poly(o, GH); v.poly(o.map(function (p) { return [p[0], -p[1]]; }), GH);
  }
  function ghostSide(v) {
    if (!st.ghost || st.sideMode === 'thick') return;
    [st.ghost.board.strbot, st.ghost.board.strdeck].forEach(function (c) { v.poly(c.sample(80).map(function (p) { return [p[0] * 10, p[2] * 10]; }), GH); });
  }
  function ghostSlice(v) {
    if (!st.ghost) return;
    var x = Math.min(st.secX, st.ghost.L), h = st.ghost.section(x, 40).map(function (p) { return [p[0] * 10, p[1] * 10]; });
    v.poly(h.concat(h.slice(0, -1).reverse().map(function (p) { return [-p[0], p[1]]; })), GH, true);
  }
  function refTop(v) {
    if (!st.showOrig || !st.refModel || !st.ed || !st.ed.everEdited) return;
    var o = st.refModel.board.otl.sample(80).map(function (p) { return [p[0] * 10, p[1] * 10]; });
    v.poly(o, { stroke: REF, width: 1.2, dash: [5, 3] }); v.poly(o.map(function (p) { return [p[0], -p[1]]; }), { stroke: REF, width: 1.2, dash: [5, 3] });
  }
  function refSide(v) {
    if (!st.showOrig || !st.refModel || !st.ed || !st.ed.everEdited) return;
    var rb = st.refModel.board;
    if (st.sideMode === 'thick') { if (rb.thickDiff) v.poly(rb.thickDiff.sample(80).map(function (p) { return [p[0] * 10, p[2] * 10]; }), { stroke: REF, width: 1.2, dash: [5, 3] }); return; }
    [rb.strbot, rb.strdeck].forEach(function (c) { v.poly(c.sample(80).map(function (p) { return [p[0] * 10, p[2] * 10]; }), { stroke: REF, width: 1.2, dash: [5, 3] }); });
  }
  function refSlice(v) {
    if (!st.showOrig || !st.refModel || !st.ed || !st.ed.everEdited) return;
    var x = Math.min(st.secX, st.refModel.L), h = st.refModel.section(x, 40).map(function (p) { return [p[0] * 10, p[1] * 10]; });
    v.poly(h.concat(h.slice(0, -1).reverse().map(function (p) { return [-p[0], p[1]]; })), { stroke: REF, width: 1.2, dash: [5, 3] }, true);
  }

  // ---------- измерения под мышкой и мерные линейки ----------
  function rmMs() { return st.rmMs || (st.rmMs = st.model.measures(RM)); }
  function trace(xmm) {
    if (!st.model) return;
    var m = st.model, x = Math.max(0, Math.min(m.L, xmm / 10)), ms = rmMs();
    $('coords').textContent = 'X ' + fmt(x * 10) + ' (' + TS.t('trArc') + ' ' + fmt(ms.arcAtX(x)) + ') · ' +
      TS.t('width') + ' ' + fmt(20 * m.halfW(x)) + ' · ' + TS.t('rocker') + ' ' + fmt(10 * (m.zb(x) - ms.minZ)) + ' · ' +
      TS.t('trThickV') + ' ' + fmt(10 * (m.zd(x) - m.zb(x))) + ' ' + TS.t('mm');
    if (st.follow) setSecX(x);
  }
  st.bars = [];
  function barX(b) { var ms = rmMs(), S = ms.arcAtX(st.model.L); return ms.xAtArc(b.from === 'nose' ? Math.max(0, S - b.d) : Math.min(S, b.d)); }
  function drawBars(v, view) {
    if (!st.model || !st.bars.length) return;
    var m = st.model, ms = rmMs(), ctx = v.ctx;
    st.bars.forEach(function (b) {
      var x = barX(b), X = x * 10, lab;
      if (view === 'top') { var w = m.halfW(x) * 10; v.poly([[X, -w - 10], [X, w + 10]], { stroke: '#495057', width: 1, dash: [3, 3] }); lab = fmt(2 * w); v.label(X, -w - 10, lab, '#1d2b36', 'center', 14); }
      else if (st.sideMode !== 'thick') {
        var zb = m.zb(x) * 10, zd = m.zd(x) * 10;
        v.poly([[X, zb - 6], [X, zd + 6]], { stroke: '#495057', width: 1, dash: [3, 3] });
        v.label(X, zd + 6, fmt(zd - ms.minZ * 10) + ' / ' + fmt(zd - zb), '#1d2b36', 'center', -4);
        v.label(X, zb - 6, fmt(zb - ms.minZ * 10), '#1d2b36', 'center', 14);
      }
    });
  }
  function renderBars() {
    $('barList').innerHTML = st.bars.map(function (b, i) {
      return '<button class="chip bar" data-i="' + i + '">' + b.d + ' ' + TS.t(b.from === 'nose' ? 'fromNose' : 'fromTail') + ' ×</button>';
    }).join('');
  }

  // ---------- пробки плавников ----------
  // места пробки: [{x, y, ang}] в см (пара — с зеркалом)
  function boxPlaces(o) {
    if (o.central || Math.abs(o.y) < 1e-6) return [{ x: o.x, y: 0, ang: 0, sign: 1 }];
    var r = [{ x: o.x, y: Math.abs(o.y), ang: -Math.abs(o.ang), sign: 1 }];
    if (o.even) r.push({ x: o.x, y: -Math.abs(o.y), ang: Math.abs(o.ang), sign: -1 });
    return r;
  }
  function obround(o, pl) {
    var h = Math.max(0, (o.len - o.wid) / 2), r = o.wid / 2, ca = Math.cos(pl.ang), sa = Math.sin(pl.ang), pts = [], q;
    function P(u, v) { return [(pl.x + u * ca - v * sa) * 10, (pl.y + u * sa + v * ca) * 10]; }
    for (q = 0; q <= 16; q++) { var t = -Math.PI / 2 + Math.PI * q / 16; pts.push(P(h + r * Math.cos(t), r * Math.sin(t))); }
    for (q = 0; q <= 16; q++) { var t2 = Math.PI / 2 + Math.PI * q / 16; pts.push(P(-h + r * Math.cos(t2), r * Math.sin(t2))); }
    return pts;
  }
  function drawBoxesTop(v) {
    (st.board.boxes || []).forEach(function (o, i) {
      var sel = st.selBox === i;
      boxPlaces(o).forEach(function (pl) {
        v.poly(obround(o, pl), { fill: sel ? 'rgba(95,61,196,0.25)' : 'rgba(95,61,196,0.10)', stroke: '#5f3dc4', width: sel ? 2 : 1.2 }, true);
      });
    });
  }
  function drawBoxesSide(v) {
    if (st.sideMode === 'thick') return;
    (st.board.boxes || []).forEach(function (o, i) {
      if (o.face !== 1) return;
      var zb = st.model.bottomZ(o.x, o.y) * 10, x0 = (o.x - o.len / 2) * 10, x1 = (o.x + o.len / 2) * 10;
      v.poly([[x0, zb], [x1, zb], [x1, zb + o.depth * 10], [x0, zb + o.depth * 10]], { fill: 'rgba(95,61,196,0.15)', stroke: '#5f3dc4', width: st.selBox === i ? 2 : 1 }, true);
    });
  }
  function drawBoxesSlice(v) {
    (st.board.boxes || []).forEach(function (o) {
      if (o.face !== 1 || Math.abs(st.secX - o.x) > o.len / 2) return;
      boxPlaces(o).forEach(function (pl) {
        var y = pl.y, zb = st.model.bottomZ(st.secX, y) * 10, w = o.wid / 2;
        v.poly([[(y - w) * 10, zb], [(y + w) * 10, zb], [(y + w) * 10, zb + o.depth * 10], [(y - w) * 10, zb + o.depth * 10]], { fill: 'rgba(95,61,196,0.15)', stroke: '#5f3dc4', width: 1 }, true);
      });
    });
  }
  function boxHit(view, wx, wy) {
    if (view !== vTop || !st.board.boxes) return -1;
    var x = wx / 10, y = wy / 10;
    for (var i = 0; i < st.board.boxes.length; i++) {
      var o = st.board.boxes[i], pls = boxPlaces(o);
      for (var k = 0; k < pls.length; k++) {
        var pl = pls[k], dx = x - pl.x, dy = y - pl.y, ca = Math.cos(-pl.ang), sa = Math.sin(-pl.ang);
        var u = dx * ca - dy * sa, vv = dx * sa + dy * ca, h = Math.max(0, (o.len - o.wid) / 2);
        var du = Math.max(0, Math.abs(u) - h);
        if (Math.hypot(du, vv) <= o.wid / 2) return { i: i, sign: pl.sign };
      }
    }
    return -1;
  }
  function renderBoxes() {
    var bx = st.board.boxes || [];
    $('boxList').innerHTML = bx.map(function (o, i) {
      return '<button class="chip box' + (st.selBox === i ? ' on' : '') + '" data-i="' + i + '">' + esc(o.name || 'Box') + ' · ' + fmt(o.x * 10, 0) + '</button>';
    }).join('');
    var o = bx[st.selBox];
    $('boxForm').hidden = !o;
    if (!o) return;
    var ins = $('boxForm').querySelectorAll('input');
    for (var i = 0; i < ins.length; i++) {
      var k = ins[i].getAttribute('data-b');
      if (ins[i] === document.activeElement) continue;
      if (ins[i].type === 'checkbox') ins[i].checked = !!o[k];
      else ins[i].value = k === 'ang' ? fmt(o.ang * 180 / Math.PI, 2) : fmt(o[k] * 10, 1);
    }
  }
  function boxFromForm(e) {
    var o = st.board.boxes[st.selBox]; if (!o) return;
    var k = e.target.getAttribute('data-b'), f = {};
    if (e.target.type === 'checkbox') f[k] = e.target.checked;
    else { var v = parseFloat(e.target.value.replace(',', '.')); if (!isFinite(v)) return; f[k] = k === 'ang' ? v * Math.PI / 180 : v / 10; }
    st.ed.begin(); st.ed.boxSet(st.selBox, f); heavy();
  }

  // ---------- вид сверху ----------
  function drawTop(ctx, v) {
    var g = st.geo; v.grid(); if (!g) return;
    v.poly(g.outline, { fill: C.fill, stroke: C.line, width: 1.8 }, true);
    v.poly([[0, 0], [g.L, 0]], { stroke: '#9aa7b2', width: 1, dash: [6, 4] });
    g.lines.forEach(function (ln, i) {
      if (i === 0 || i === g.lines.length - 1 || i === st.model.apexIdx) return;
      var up = ln.top, dn = up.map(function (p) { return [p[0], -p[1]]; });
      var col = i === 1 ? C.rail : C.pt;
      v.poly(up, { stroke: col, width: 1, dash: [4, 3] }); v.poly(dn, { stroke: col, width: 1, dash: [4, 3] });
    });
    st.model.sliceX.forEach(function (x) {
      var w = st.model.halfW(x) * 10;
      v.poly([[x * 10, -w], [x * 10, w]], { stroke: C.slice, width: 1.3 });
    });
    var cx = st.secX * 10, cw = st.model.halfW(st.secX) * 10;
    v.poly([[cx, -cw - 15], [cx, cw + 15]], { stroke: C.cur, width: 2 });
    drawBars(v, 'top'); refTop(v); ghostTop(v); drawBoxesTop(v);
    comb(v, st.board.otl, 0, 1, 1); comb(v, st.board.otl, 0, 1, -1);
    drawHandles(v, 'otl', 1);
    drawErrors(v, 'top'); drawArc(v, 'top');
  }

  // ---------- вид сбоку ----------
  function drawSide(ctx, v) {
    var g = st.geo; v.grid(); if (!g) return;
    if (st.sideMode === 'thick' && g.thick) {
      var area = [[0, 0]].concat(g.thick, [[g.S, 0]]);
      v.poly(area, { fill: C.fill }, true);
      v.poly(g.thick, { stroke: C.line, width: 1.8 });
      v.poly([[0, 0], [g.S, 0]], { stroke: '#9aa7b2', width: 1 });
      refSide(v); comb(v, st.board.thickDiff, 0, 2, 1);
      drawHandles(v, 'thick', 1);
      drawErrors(v, 'thick'); drawArc(v, 'thick');
    } else {
      v.poly(g.side, { fill: C.fill, stroke: C.line, width: 1.8 }, true);
      var a = g.lines[st.model.apexIdx];
      if (a) v.poly(a.side, { stroke: C.apex, width: 1.4 });
      if (g.lines[1]) v.poly(g.lines[1].side, { stroke: C.rail, width: 1, dash: [4, 3] });
      st.model.sliceX.forEach(function (x) {
        v.poly([[x * 10, st.model.zb(x) * 10], [x * 10, st.model.zd(x) * 10]], { stroke: C.slice, width: 1.3 });
      });
      var cx = st.secX * 10;
      v.poly([[cx, st.model.zb(st.secX) * 10 - 8], [cx, st.model.zd(st.secX) * 10 + 8]], { stroke: C.cur, width: 2 });
      drawBars(v, 'side'); refSide(v); ghostSide(v); drawBoxesSide(v); comb(v, st.board.strbot, 0, 2, 1); comb(v, st.board.strdeck, 0, 2, 1);
      drawHandles(v, 'bot', 1);
      drawHandles(v, 'deck', 1);
      drawErrors(v, 'side'); drawArc(v, 'side');
    }
    var c2 = v.ctx; c2.font = '12px system-ui, sans-serif'; c2.fillStyle = '#6b7a88'; c2.textAlign = 'right';
    if (v.exag > 1.01) c2.fillText(TS.t('vexag') + fmt(v.exag, 0), v.w - 10, 18);
  }

  // ---------- сечение ----------
  function drawSlice(ctx, v) {
    v.grid(); if (!st.model) return;
    var m = st.model, x = st.secX, k = sliceIndexAtCursor();
    var h = m.section(x, 40).map(function (p) { return [p[0] * 10, p[1] * 10]; });
    var full = h.concat(h.slice(0, -1).reverse().map(function (p) { return [-p[0], p[1]]; }));
    v.poly(full, { fill: C.fill, stroke: C.line, width: 1.8 }, true);
    refSlice(v); ghostSlice(v); drawBoxesSlice(v);
    if (k >= 0) { comb(v, st.board.slices[k], 1, 2, 1); drawHandles(v, 'slice:' + k, 1); drawErrors(v, 'slice'); drawArc(v, 'slice'); }
    else {
      var c = m.sectionCtrl(x);
      for (var i = 0; i < m.nPts; i++) v.dot(c.P[i][0] * 10, c.P[i][1] * 10, 3, i === m.apexIdx ? C.apex : '#868e96', true);
    }
    var w = m.halfW(x) * 20, t = (m.zd(x) - m.zb(x)) * 10;
    var c2 = v.ctx; c2.font = '13px system-ui, sans-serif'; c2.fillStyle = '#1d2b36'; c2.textAlign = 'left';
    var head = TS.t('sliceAt') + ' ' + fmt(x * 10) + ' ' + TS.t('mm') + ' ' + TS.t('fromTailShort');
    if (k >= 0) head += '  ·  ' + TS.t('sliceEdit') + ' ' + (k + 1);
    c2.fillText(head, 10, 20);
    c2.fillStyle = '#6b7a88';
    c2.fillText(TS.t('width') + ' ' + fmt(w) + ' · ' + TS.t('thick') + ' ' + fmt(t) + ' ' + TS.t('mm') +
      (k < 0 ? '  ·  ' + TS.t('sliceHint') : ''), 10, 38);
  }

  // ---------- мышь: захват и перетаскивание точек ----------
  function hit(view, sx, sy) {
    var key = editKey(view); if (!key || st.hidePts) return null;
    var keys = [].concat(key), hs = [];
    keys.forEach(function (k) { hs = hs.concat(st.ed.handles(k)); });
    var best = null, bd = HIT;
    var signs = key === 'otl' ? [1, -1] : [1];
    [true, false].forEach(function (wantP) {
      if (best) return;
      signs.forEach(function (sg) {
        hs.forEach(function (h) {
          if ((h.kind === 'P') !== wantP) return;
          if (h.kind !== 'P' && !tanVisible(h)) return;
          var p = view.toScreen(h.u * 10, sg * h.v * 10), d = Math.hypot(p[0] - sx, p[1] - sy);
          if (d < bd) { bd = d; best = { key: h.key, i: h.i, kind: h.kind, sign: sg }; }
        });
      });
    });
    return best;
  }
  function onDown(sx, sy, e, view) {
    if (!st.ed) return false;
    var h = hit(view, sx, sy);
    if (!h && st.showDepth) {
      var a = pickArc(view, sx, sy);
      if (a) { st.arc = a; st.drag = null; redraw2d(); arcStatus(); return true; }
    }
    var mod = e.ctrlKey || e.metaKey;
    if (h && h.kind === 'P' && (mod || e.shiftKey) && st.ed.sel) {
      // Ctrl — добавить/убрать точку; Shift — все точки между выбранной и этой
      var s0 = st.ed.sel, m = st.ed.multi = st.ed.multi || [];
      var hh = { key: h.key, i: h.i, kind: 'P' };
      if (e.shiftKey && s0.key === h.key) {
        var lo = Math.min(s0.i, h.i), hi = Math.max(s0.i, h.i);
        for (var q = lo; q <= hi; q++) if (!m.some(function (x) { return x.key === h.key && x.i === q; })) m.push({ key: h.key, i: q, kind: 'P' });
      } else if (sameSel(s0, hh)) {
        var rest = m.filter(function (x) { return !sameSel(x, hh); });
        st.ed.sel = rest.length ? rest[0] : null; st.ed.multi = rest.slice(1);
      } else {
        var j = -1; m.forEach(function (x, k) { if (sameSel(x, hh)) j = k; });
        if (j >= 0) m.splice(j, 1); else m.push(hh);
      }
      st.selBox = null; st.drag = null; showSel(); redraw2d();
      return true;
    }
    if (h && !inSel(h)) clearMulti();
    if (h && inSel(h) && h.kind === 'P') {
      // щелчок по точке из группы — она становится главной, тянем всю группу
      var keep = allSel().filter(function (x) { return !sameSel(x, h); });
      st.ed.multi = keep;
    }
    if (!h) {
      var w = view.toWorld(sx, sy), bh = boxHit(view, w[0], w[1]);
      if (bh === -1) { if (st.selBox !== undefined && st.selBox !== null) { st.selBox = null; renderBoxes(); redraw2d(); } return false; }
      var o = st.board.boxes[bh.i];
      st.selBox = bh.i; st.ed.sel = null; showSel();
      st.ed.begin();
      st.drag = { box: true, sign: bh.sign, ox: o.x - w[0] / 10, oy: Math.abs(o.y) - bh.sign * w[1] / 10, changed: false };
      renderBoxes(); redraw2d();
      return true;
    }
    st.selBox = null;
    st.ed.sel = { key: h.key, i: h.i, kind: h.kind };
    st.ed.begin();
    st.drag = { sign: h.sign, changed: false }; st.lastSign = h.sign;
    showSel(); redraw2d();
    return true;
  }
  function onDrag(wx, wy, e) {
    if (st.drag && st.drag.box) {
      var o = st.board.boxes[st.selBox];
      var ny = Math.max(o.central ? 0 : o.wid / 2, st.drag.sign * wy / 10 + st.drag.oy);
      st.ed.boxSet(st.selBox, { x: wx / 10 + st.drag.ox, y: o.y < 0 ? -ny : ny });
      st.drag.changed = true; redraw2d(); renderBoxes(); markDirty();
      return;
    }
    var s = st.ed.sel; if (!s || !st.drag) return;
    var u = wx / 10, v = st.drag.sign * wy / 10, g = allSel();
    if (g.length > 1 && s.kind === 'P') {
      var cur = st.ed.value(s);
      st.ed.moveGroup(g, u - cur[0], v - cur[1], e.altKey);
    } else st.ed.move(s.key, s.i, s.kind, u, v, e.altKey);
    st.drag.changed = true;
    light();
  }
  function onUp() {
    if (st.drag && !st.drag.changed) st.ed.undo.pop();   // просто выбор точки — не в историю
    var ch = st.drag && st.drag.changed; st.drag = null;
    if (ch) heavy();
  }

  // ---------- двойной щелчок по линии — новая точка ----------
  function onDbl(sx, sy, view) {
    if (!st.ed) return false;
    var key = editKey(view); if (!key) return false;
    var w = view.toWorld(sx, sy), keys = [].concat(key), best = null;
    keys.forEach(function (k) {
      if (k.indexOf('slice:') === 0) return;
      var sign = k === 'otl' && w[1] < 0 ? -1 : 1;
      var n = st.ed.nearestOnCurve(k, w[0] / 10, sign * w[1] / 10); if (!n) return;
      var p = st.ed.curve(k).point(n.i, n.t), iv = k === 'otl' ? 1 : 2;
      var sp = view.toScreen(p[0] * 10, sign * p[iv] * 10), d = Math.hypot(sp[0] - sx, sp[1] - sy);
      if (d < 10 && (!best || d < best.d)) best = { k: k, i: n.i, t: n.t, d: d };
    });
    if (!best) {
      if (keys[0].indexOf('slice:') === 0) { $('msg').textContent = TS.t('noPtSlice'); return true; }
      return false;
    }
    st.ed.begin();
    if (!st.ed.insertPoint(best.k, best.i, best.t)) { st.ed.undo.pop(); return true; }
    st.ed.sel = { key: best.k, i: best.i + 1, kind: 'P' };
    heavy();
    return true;
  }
  function delSelected() {
    var g = allSel().filter(function (s) { return s.kind === 'P'; }); if (!g.length) return;
    g.sort(function (a, b) { return a.key === b.key ? b.i - a.i : (a.key < b.key ? -1 : 1); });   // с конца, чтобы номера не сбивались
    st.ed.begin();
    var any = false;
    g.forEach(function (s) { if (st.ed.deletePoint(s.key, s.i)) any = true; });
    if (any) { st.ed.sel = null; clearMulti(); heavy(); } else st.ed.undo.pop();
  }
  function setPtType(t) {
    var g = allSel().filter(function (s) { return s.kind === 'P'; }); if (!g.length) return;
    st.ed.begin(); g.forEach(function (s) { st.ed.setType(s.key, s.i, t); }); heavy();
  }
  function sliceButtons() {
    var k = sliceIndexAtCursor(), n = st.model ? st.model.sliceX.length : 0;
    $('slDel').disabled = !(k > 0 && k < n - 1);
    $('slMoveL').style.visibility = k > 0 && k < n - 1 ? 'visible' : 'hidden';
    if (k >= 0 && document.activeElement !== $('slX')) $('slX').value = fmt(st.model.sliceX[k] * 10, 1);
    $('slAdd').disabled = !(k < 0 && st.secX > 0.5 && st.secX < st.model.L - 0.5);
  }

  // ---------- пересчёт ----------
  function light() {
    st.model = new TS.Model(st.board); st.rmMs = null;
    buildGeo(); redraw2d(); showSel(); markDirty();
  }
  function heavy() {
    st.ed.renormSlices(); st.ed.sync();
    st.model = new TS.Model(st.board); st.ms = null; st.vol = null; st.rmMs = null;
    buildGeo(); redraw2d(); renderDims(); showSel(); markDirty();
    v3.setModel(st.model, true);
    TS.cncUI.onBoard(true);
    var fe = st.ed.deckFitErr || 0;
    $('msg').textContent = fe > 0.5 ? TS.t('deckFit') + ' ' + fmt(fe, 1) + ' ' + TS.t('mm') : '';
    if (st.showErr) { updateErrors(); redraw2d(); }
    arcStatus();
  }
  function markDirty() {
    var d = st.ed && st.ed.dirty;
    document.body.classList.toggle('dirty', !!d);
    document.title = (d ? '• ' : '') + st.board.fileName.replace(/\.s3dx$/i, '') + ' — Tentacle Shaper';
  }

  // ---------- выбранная точка: поля для точного ввода ----------
  function axisNames(key) {
    if (key === 'otl') return ['X', 'Y'];
    if (key === 'thick') return ['S', 'T'];
    if (key && key.indexOf('slice:') === 0) return ['Y', 'Z'];
    return ['X', 'Z'];
  }
  function showSel() {
    var s = st.ed && st.ed.sel, box = $('selBox');
    if (!s) { box.hidden = true; return; }
    box.hidden = false;
    var v = st.ed.value(s), n = axisNames(s.key);
    var names = { otl: TS.t('outline'), bot: TS.t('rockerCurve'), deck: TS.t('deckCurve'), thick: TS.t('thickCurve') };
    var title = names[s.key] || (TS.t('slice') + ' ' + (+s.key.slice(6) + 1));
    $('selTitle').textContent = title + ' · ' + (s.kind === 'P' ? TS.t('point') : TS.t('tangent')) + ' ' + (s.i + 1);
    $('selUl').textContent = n[0]; $('selVl').textContent = n[1];
    if (document.activeElement !== $('selU')) $('selU').value = fmt(v[0] * 10, 2);
    if (document.activeElement !== $('selV')) $('selV').value = fmt(v[1] * 10, 2);
    var tp = st.ed.typeOf(s.key, s.i), tb = document.querySelectorAll('.ptypes [data-t]');
    for (var q = 0; q < tb.length; q++) { tb[q].classList.toggle('on', tb[q].getAttribute('data-t') === tp); tb[q].disabled = s.kind !== 'P'; }
    $('delPt').disabled = s.kind !== 'P' || s.key.indexOf('slice:') === 0;
    var ng = allSel().length;
    $('selN').textContent = ng > 1 ? TS.t('selN') + ' ' + ng : '';
    $('stepIn').placeholder = TS.t('auto') + ' ' + autoStep(s.key, false);
  }
  function applyInputs() {
    var s = st.ed && st.ed.sel; if (!s) return;
    var u = parseFloat($('selU').value.replace(',', '.')), v = parseFloat($('selV').value.replace(',', '.'));
    if (!isFinite(u) || !isFinite(v)) return;
    var cur = st.ed.value(s);
    if (Math.abs(cur[0] * 10 - u) < 1e-3 && Math.abs(cur[1] * 10 - v) < 1e-3) return;
    st.ed.begin(); st.ed.move(s.key, s.i, s.kind, u / 10, v / 10, false); heavy();
  }
  function nudge(du, dv) {
    var s = st.ed && st.ed.sel; if (!s) return;
    var g = allSel();
    st.ed.begin();
    if (g.length > 1 && s.kind === 'P') st.ed.moveGroup(g, du, dv, false);
    else { var v = st.ed.value(s); st.ed.move(s.key, s.i, s.kind, v[0] + du, v[1] + dv, false); }
    heavy();
  }
  // ---------- шаг стрелок: задан в поле или «авто» — от масштаба вида (как в Shape3D) ----------
  var STEPS = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10];
  function viewOf(key) { return key === 'otl' ? vTop : (key.indexOf('slice:') === 0 ? vSlice : vSide); }
  function autoStep(key, vert) {
    var v = viewOf(key), px = v.s * (vert ? v.exag : 1), want = 3 / (px || 1), r = STEPS[0];
    STEPS.forEach(function (x) { if (x <= want) r = x; });
    return r;
  }
  function stepMM(key, vert, e) {
    var b = st.step > 0 ? st.step : autoStep(key, vert);
    var sh = e.shiftKey, ct = e.ctrlKey || e.altKey;
    return b / (sh && ct ? 10 : (ct ? 4 : (sh ? 2 : 1)));
  }

  // ---------- Ctrl+A, Tab, соседнее сечение ----------
  function activeView() { return TS.activeView || vTop; }
  function selectAll() {
    var key = editKey(activeView()); if (!key) return;
    var g = [];
    [].concat(key).forEach(function (k) { var c = st.ed.curve(k); if (c) for (var i = 0; i < c.P.length; i++) g.push({ key: k, i: i, kind: 'P' }); });
    if (!g.length) return;
    st.ed.sel = g[0]; st.ed.multi = g.slice(1); st.selBox = null; showSel(); redraw2d();
  }
  function tabNext(dir) {
    var s = st.ed.sel;
    if (s) {
      var c = st.ed.curve(s.key), n = c.P.length;
      st.ed.sel = { key: s.key, i: (s.i + dir + n) % n, kind: 'P' }; clearMulti(); showSel(); redraw2d();
      return;
    }
    stepSlice(dir);
  }
  function stepSlice(dir) {
    var xs = st.model.sliceX, k = sliceIndexAtCursor(), j;
    if (k >= 0) j = Math.max(0, Math.min(xs.length - 1, k + dir));
    else { j = 0; while (j < xs.length && xs[j] < st.secX) j++; if (dir < 0) j--; j = Math.max(0, Math.min(xs.length - 1, j)); }
    setSecX(xs[j]);
  }

  // ---------- режимы показа: H — спрятать точки, T — все касательные, E — ошибки, D — глубина дуги ----------
  function toggleView(w) {
    if (w === 'H') st.hidePts = !st.hidePts;
    if (w === 'T') st.allTan = !st.allTan;
    if (w === 'E') { st.showErr = !st.showErr; if (!st.showErr) $('msg').textContent = ''; }
    if (w === 'D') { st.showDepth = !st.showDepth; if (!st.showDepth) st.arc = null; }
    syncViewBtns(); updateErrors(); if (st.model) redraw2d();
  }
  function syncViewBtns() {
    var m = { H: st.hidePts, T: st.allTan, E: st.showErr, D: st.showDepth }, bs = document.querySelectorAll('.viewbtns [data-v]');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', !!m[bs[i].getAttribute('data-v')]);
  }

  // ---------- копировать / вставить (Ctrl+C / Ctrl+V): сечение или кривую, в т.ч. в другую доску ----------
  function clipKey() {
    var s = st.ed.sel;
    if (s) return s.key === 'deck' ? 'bot' : s.key;
    var v = activeView();
    if (v === vSlice) { var k = sliceIndexAtCursor(); return k >= 0 ? 'slice:' + k : null; }
    if (v === vSide) return st.sideMode === 'thick' ? 'thick' : 'bot';
    return 'otl';
  }
  function clipName(kind) {
    return { otl: TS.t('outline'), bot: TS.t('rockerCurve'), thick: TS.t('thickCurve'), slice: TS.t('slice') }[kind] || kind;
  }
  function doCopy(forceKey) {
    if (window.getSelection && String(window.getSelection()).length && !forceKey) return false;   // выделен текст — обычное копирование
    var key = forceKey || clipKey(); if (!key) return false;
    var c = st.ed.copyCurve(key); if (!c) return false;
    st.clip = c;
    try { localStorage.setItem('ts.clip', JSON.stringify(c)); } catch (e) { /* без хранилища — только в этой вкладке */ }
    $('msg').textContent = TS.t('copied') + ': ' + clipName(c.kind) + (c.kind === 'slice' ? ' ' + (+key.slice(6) + 1) : '');
    return true;
  }
  function getClip() {
    var c = st.clip;
    try { var j = localStorage.getItem('ts.clip'); if (j) c = JSON.parse(j); } catch (e) { /* ничего */ }
    return c;
  }
  function doPaste(forceKey) {
    var clip = getClip(); if (!clip) return false;
    var key = forceKey || clipKey();
    if (clip.kind === 'slice' && (!key || key.indexOf('slice:') !== 0)) {
      var k = sliceIndexAtCursor();
      if (k < 0) { $('msg').textContent = TS.t('pasteNeedSlice'); return true; }
      key = 'slice:' + k;
    }
    if (clip.kind !== 'slice' && key && key.indexOf('slice:') === 0) key = clip.kind;
    if (!key) return false;
    st.ed.begin();
    var r = st.ed.pasteCurve(key, clip);
    if (r !== 'ok') { st.ed.undo.pop(); $('msg').textContent = TS.t(r === 'count' ? 'pasteCount' : 'pasteKind') + ' (' + clipName(clip.kind) + ')'; return true; }
    st.ed.sel = null; clearMulti(); heavy();
    $('msg').textContent = TS.t('pasted') + ': ' + clipName(clip.kind);
    return true;
  }

  // ---------- таблички над видами (Rail Master): размеры и % изменения с открытия/сохранения ----------
  var RM = [0, 50, 100, 200, 300, 500];
  function pct(v, r) {
    if (!isFinite(v) || !isFinite(r) || Math.abs(r) < 1e-6) return '';
    var p = (v - r) / Math.abs(r) * 100, t = (Math.abs(p) < 0.5 ? '0' : (p > 0 ? '+' : '') + p.toFixed(0)) + '%';
    return '<div class="pc' + (Math.abs(p) < 0.5 ? ' zero' : '') + '">' + t + '</div>';
  }
  // одна строка таблички: слева от хвоста, справа от носа (как в Shape3D)
  function rmTable(items, ms, ref) {
    var h = '<table><tr><td class="cap">' + TS.t('fromTail') + ', ' + TS.t('mm') + '</td>';
    ms.tail.forEach(function (r) { h += '<th>' + r.d + '</th>'; });
    h += '<td class="sep"></td>';
    ms.nose.forEach(function (r) { h += '<th>' + r.d + '</th>'; });
    h += '<td class="cap">' + TS.t('fromNose') + '</td></tr>';
    items.forEach(function (it) {
      h += '<tr><td class="cap">' + it[0] + '</td>';
      ms.tail.forEach(function (r, i) { h += '<td>' + fmt(r[it[1]], 1) + (ref ? pct(r[it[1]], ref.tail[i][it[1]]) : '') + '</td>'; });
      h += '<td class="sep"></td>';
      ms.nose.forEach(function (r, i) { h += '<td>' + fmt(r[it[1]], 1) + (ref ? pct(r[it[1]], ref.nose[i][it[1]]) : '') + '</td>'; });
      h += '<td></td></tr>';
    });
    return h + '</table>';
  }
  function renderRM() {
    if (!st.model) return;
    var m = st.model, ms = st.rmMs || (st.rmMs = m.measures(RM)), ref = st.refMs;
    $('rmTop').innerHTML = rmTable([[TS.t('width'), 'width']], ms, ref);
    $('rmSide').innerHTML = st.sideMode === 'thick' ? rmTable([[TS.t('thick'), 'thick']], ms, ref)
      : rmTable([[TS.t('deckRocker'), 'deck'], [TS.t('rocker'), 'rocker']], ms, ref);
    var sm = m.sliceMeasures(st.secX), sr = st.refModel ? st.refModel.sliceMeasures(Math.min(st.secX, st.refModel.L)) : null;
    function cell(k, label, v, r) { return '<td><div class="cap">' + label + '</div>' + fmt(v, 1) + (sr ? pct(v, r) : '') + '</td>'; }
    var h = '<table><tr><th colspan="7">' + TS.t('deckContour') + '</th></tr><tr>';
    h += cell('W', TS.t('width'), sm.W, sr && sr.W);
    h += cell('AD', TS.t('rmAD'), sm.AD, sr && sr.AD);
    sm.deck.forEach(function (d, i) { h += cell('d', d.d, d.h, sr && sr.deck[i].h); });
    h += cell('T', TS.t('rmT'), sm.T, sr && sr.T);
    h += '</tr></table><table><tr><th colspan="3">' + TS.t('botContour') + '</th></tr><tr>';
    h += cell('AB', TS.t('rmAB'), sm.AB, sr && sr.AB) + cell('V', TS.t('rmV'), sm.V, sr && sr.V) + cell('R', TS.t('rmRail'), sm.rail, sr && sr.rail);
    $('rmSlice').innerHTML = h + '</tr></table>';
  }
  function setRef(buf) {
    try { var rb = TS.parseS3dx(buf, ''); st.refModel = new TS.Model(rb); st.refMs = st.refModel.measures(RM); }
    catch (e) { st.refModel = null; st.refMs = null; }
  }

  // ---------- панель размеров ----------
  function renderDimsHook() { renderBoxes(); }
  function renderDims() {
    renderDimsHook();
    var m = st.model, b = st.board; if (!m) return;
    var ms = st.ms || (st.ms = m.measures());
    var vol = st.vol || (st.vol = m.volume());
    var mm = TS.t('mm');
    var h = '';
    h += '<div class="name">' + esc(b.fileName.replace(/\.s3dx$/i, '')) + '</div>';
    h += '<div class="big">' + fmt(ms.lengthDev) + ' × ' + fmt(ms.width) + ' × ' + fmt(ms.thick) + ' <span>' + mm + '</span></div>';
    h += '<table class="kv">';
    h += tr(TS.t('length'), fmt(ms.lengthDev) + ' ' + mm, TS.t('lengthDev'));
    h += tr(TS.t('width'), fmt(ms.width) + ' ' + mm, TS.t('at') + ' ' + fmt(ms.widthAt, 0));
    h += tr(TS.t('thick'), fmt(ms.thick) + ' ' + mm, TS.t('at') + ' ' + fmt(ms.thickAt, 0));
    h += tr(TS.t('tailRocker'), fmt(ms.tailRocker) + ' ' + mm, '');
    h += tr(TS.t('noseRocker'), fmt(ms.noseRocker) + ' ' + mm, '');
    h += tr(TS.t('zero'), fmt(ms.zeroAt, 0) + ' ' + mm, TS.t('fromTail'));
    h += tr(TS.t('volume'), fmt(vol, 2) + ' ' + TS.t('l'), TS.t('volOur'));
    if (isFinite(b.info.Volume) && !(st.ed && st.ed.everEdited)) h += tr('', fmt(b.info.Volume / 10, 2) + ' ' + TS.t('l'), TS.t('volFile'));
    h += '</table>';
    h += '<table class="ms"><thead><tr><th>' + mm + '</th><th>' + TS.t('width') + '</th><th>' + TS.t('thick') +
         '</th><th>' + TS.t('rocker') + '</th></tr></thead><tbody>';
    h += '<tr class="sec"><td colspan="4">' + TS.t('fromTail') + '</td></tr>';
    ms.tail.forEach(function (r) { h += msRow(r); });
    h += '<tr class="sec"><td colspan="4">' + TS.t('fromNose') + '</td></tr>';
    ms.nose.forEach(function (r) { h += msRow(r); });
    h += '</tbody></table>';
    $('dims').innerHTML = h;

    var s = '';
    m.sliceX.forEach(function (x, i) {
      s += '<button class="chip" data-x="' + x + '">' + (i + 1) + ' · ' + fmt(x * 10, 0) + '</button>';
    });
    $('sliceList').innerHTML = s;
  }
  function tr(k, v, n) { return '<tr><td>' + k + '</td><td class="v">' + v + '</td><td class="n">' + n + '</td></tr>'; }
  function msRow(r) { return '<tr><td>' + r.d + '</td><td>' + fmt(r.width, 2) + '</td><td>' + fmt(r.thick, 2) + '</td><td>' + fmt(r.rocker, 2) + '</td></tr>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- управление ----------
  var vTop, vSide, vSlice, v3;
  function setSecX(xcm) {
    if (!st.model) return;
    st.secX = Math.max(0, Math.min(st.model.L, xcm));
    $('secRange').value = st.secX;
    $('secVal').textContent = fmt(st.secX * 10) + ' ' + TS.t('mm');
    if (st.ed && st.ed.sel && st.ed.sel.key.indexOf('slice:') === 0 && st.ed.sel.key !== 'slice:' + sliceIndexAtCursor()) { st.ed.sel = null; showSel(); }
    vSlice.fitted = false;
    redraw2d();
  }
  function redraw2d() { vTop.redraw(); vSide.redraw(); vSlice.redraw(); renderRM(); if (st.model) sliceButtons(); }

  function setSideMode(m) {
    st.sideMode = m;
    var bs = document.querySelectorAll('.sidemode:not(.cncside) button');
    for (var i = 0; i < bs.length; i++) bs[i].classList.toggle('on', bs[i].getAttribute('data-m') === m);
    if (st.ed && st.ed.sel && (st.ed.sel.key === 'bot' || st.ed.sel.key === 'deck' || st.ed.sel.key === 'thick')) { st.ed.sel = null; showSel(); }
    sideBoundsMode(); vSide.fitted = false; if (st.model) { vSide.redraw(); st.rmMs = st.rmMs; renderRM(); }
  }
  function sideBoundsMode() {
    var g = st.geo; if (!g) return;
    if (st.sideMode === 'thick') vSide.exag = 4;
    else { var ratio = g.L / ((g.maxZ - g.minZ) || 1); vSide.exag = ratio > 12 ? 2 : 1; }
  }

  function loadBuffer(buf, name) {
    try {
      var b = TS.parseS3dx(buf, name);
      st.board = b; st.model = new TS.Model(b); st.ms = null; st.vol = null; st.viewed3d = false; st.rmMs = null;
      setRef(buf);
      st.ed = new TS.Editor(b, st.model.apexIdx); st.selBox = null;
      buildGeo();
      document.body.classList.add('loaded');
      $('thickBtn').disabled = !b.thickDiff;
      if (!b.thickDiff) setSideMode('rocker');
      $('secRange').max = st.model.L; $('secRange').step = 0.05;
      vTop.fitted = vSide.fitted = vSlice.fitted = false;
      sideBoundsMode();
      setSecX(st.model.sliceX[2] !== undefined ? st.model.sliceX[2] : st.model.L / 2);
      st.arc = null; clearMulti(); updateErrors();
      renderDims(); showSel(); markDirty();
      v3.setModel(st.model);
      TS.cncUI.onBoard(false);
      $('msg').textContent = '';
    } catch (e) {
      console.error(e);
      $('msg').textContent = TS.t('err') + ': ' + e.message;
    }
  }
  function openFile(f) {
    if (!f) return;
    if (st.ed && st.ed.dirty && !confirm(TS.t('discard'))) return;
    var r = new FileReader();
    r.onload = function () { loadBuffer(r.result, f.name); };
    r.readAsArrayBuffer(f);
  }
  TS.loadBuffer = loadBuffer;   // для проверок
  TS.appHeavy = function () { heavy(); };
  TS.state = st;

  function save() {
    if (!st.board) return;
    st.ed.renormSlices(); st.ed.sync();
    st.model = new TS.Model(st.board);
    var ms = st.model.measures(), vol = st.model.volume();
    var bytes = TS.writeS3dx(st.board, st.ed.everEdited ? {
      LengthDev: ms.lengthDev / 10, Width: ms.width / 10, Thickness: ms.thick / 10,
      Tail_rocker: ms.tailRocker / 10, Nose_rocker: ms.noseRocker / 10, Volume: vol * 10
    } : {});
    var blob = new Blob([bytes], { type: 'application/octet-stream' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = st.board.fileName || 'board.s3dx';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    st.ed.dirty = false; markDirty(); renderDims();
    setRef(bytes.buffer); renderRM();
    TS.lastSaved = bytes;   // для проверок
  }

  function setTab(t) {
    document.body.setAttribute('data-tab', t);
    var b = document.querySelectorAll('.tab');
    for (var i = 0; i < b.length; i++) b[i].classList.toggle('on', b[i].getAttribute('data-tab') === t);
    if (t === 'design') { vTop.fitted = vSide.fitted = vSlice.fitted = false; if (st.model) redraw2d(); }
    if (t === '3d' && st.model && !st.viewed3d) { st.viewed3d = true; v3.resetView(); }
    if (t === 'cnc' && st.model) TS.cncUI.show();
  }

  function init() {
    TS.applyI18n();
    var status = function (x, y) { $('coords').textContent = 'X ' + fmt(x) + '  ' + (this || 'Y') + ' ' + fmt(y); };
    vTop = new TS.View2D($('cTop'), {
      bounds: function () { var g = st.geo; return g && [0, -g.maxY, g.L, g.maxY]; },
      draw: drawTop, onClick: function (x) { setSecX(x / 10); }, onMove: function (x) { trace(x); },
      onDown: onDown, onDrag: onDrag, onUp: onUp, onDbl: onDbl
    });
    vSide = new TS.View2D($('cSide'), {
      bounds: function () {
        var g = st.geo; if (!g) return null;
        return st.sideMode === 'thick' ? [0, 0, g.S, g.maxT * 1.15] : [0, g.minZ, g.L, g.maxZ];
      },
      draw: drawSide, onClick: function (x) { if (st.sideMode !== 'thick') setSecX(x / 10); },
      onMove: function (x, y) {
        var t = st.sideMode === 'thick';
        if (t) $('coords').textContent = 'S ' + fmt(x) + '  T ' + fmt(y); else trace(x);
      },
      onDown: onDown, onDrag: onDrag, onUp: onUp, onDbl: onDbl
    });
    vSlice = new TS.View2D($('cSlice'), {
      bounds: function () {
        if (!st.model) return null;
        var m = st.model, x = st.secX, w = Math.max(m.halfW(x) * 10, 30);
        return [-w, m.zb(x) * 10 - 5, w, m.zd(x) * 10 + 5];
      },
      draw: drawSlice, onMove: function (y, z) { $('coords').textContent = 'Y ' + fmt(y) + '  Z ' + fmt(z); },
      onDown: onDown, onDrag: onDrag, onUp: onUp, onDbl: onDbl
    });
    v3 = new TS.View3D($('v3d'));
    TS.views = { top: vTop, side: vSide, slice: vSlice };
    TS.cncUI.init();
    TS.smartUI.init();
    var tb = document.querySelectorAll('.ptypes [data-t]');
    for (var q2 = 0; q2 < tb.length; q2++) tb[q2].addEventListener('click', function (e) { setPtType(e.currentTarget.getAttribute('data-t')); });
    $('delPt').addEventListener('click', delSelected);
    st.allTan = true;
    var vb = document.querySelectorAll('.viewbtns [data-v]');
    for (var q3 = 0; q3 < vb.length; q3++) vb[q3].addEventListener('click', function (e) { toggleView(e.currentTarget.getAttribute('data-v')); });
    syncViewBtns();
    $('stepIn').addEventListener('change', function () { var v = parseFloat($('stepIn').value.replace(',', '.')); st.step = isFinite(v) && v > 0 ? v : 0; if (!st.step) $('stepIn').value = ''; });
    $('slCopy').addEventListener('click', function () { var k = sliceIndexAtCursor(); if (k >= 0) doCopy('slice:' + k); });
    $('slPaste').addEventListener('click', function () { doPaste(); });
    st.showOrig = true;
    $('barAdd').addEventListener('click', function () {
      var d = parseFloat($('barD').value); if (!isFinite(d) || !st.model) return;
      st.bars.push({ d: d, from: $('barFrom').value }); renderBars(); redraw2d();
    });
    $('barList').addEventListener('click', function (e) {
      var i = e.target.getAttribute && e.target.getAttribute('data-i'); if (i === null) return;
      st.bars.splice(+i, 1); renderBars(); redraw2d();
    });
    $('ghostBtn').addEventListener('click', function () {
      if (st.ghost) { st.ghost = null; $('ghostBtn').classList.remove('on'); $('ghostBtn').title = TS.t('ghostTip'); redraw2d(); return; }
      $('ghostFile').click();
    });
    $('ghostFile').addEventListener('change', function (e) {
      var f = e.target.files[0]; e.target.value = ''; if (!f) return;
      var r = new FileReader();
      r.onload = function () {
        try { st.ghost = new TS.Model(TS.parseS3dx(r.result, f.name)); $('ghostBtn').classList.add('on'); $('ghostBtn').title = f.name; $('msg').textContent = ''; }
        catch (err) { $('msg').textContent = TS.t('err') + ': ' + err.message; }
        redraw2d();
      };
      r.readAsArrayBuffer(f);
    });
    $('boxList').addEventListener('click', function (e) {
      var i = e.target.getAttribute && e.target.getAttribute('data-i'); if (i === null) return;
      st.selBox = +i; st.ed.sel = null; showSel(); renderBoxes(); redraw2d();
    });
    var bins = $('boxForm').querySelectorAll('input');
    for (var bq = 0; bq < bins.length; bq++) bins[bq].addEventListener('change', boxFromForm);
    $('boxAdd').addEventListener('click', function () {
      st.ed.begin(); st.selBox = st.ed.addBox(Math.min(st.model.L * 0.2, 30), 15); heavy();
    });
    $('boxDel').addEventListener('click', function () {
      if (st.selBox === null || st.selBox === undefined) return;
      st.ed.begin(); st.ed.deleteBox(st.selBox); st.selBox = null; heavy();
    });
    $('followChk').addEventListener('change', function (e) { st.follow = e.target.checked; });
    $('curvBtn').addEventListener('click', function () { st.showCurv = !st.showCurv; $('curvBtn').classList.toggle('on', st.showCurv); if (st.model) redraw2d(); });
    $('origBtn').addEventListener('click', function () { st.showOrig = !st.showOrig; $('origBtn').classList.toggle('on', st.showOrig); if (st.model) redraw2d(); });
    $('slAdd').addEventListener('click', function () {
      st.ed.begin(); var k = st.ed.addSlice(st.model, st.secX);
      if (k < 0) { st.ed.undo.pop(); return; }
      heavy(); setSecX(st.model.sliceX[k]);
    });
    $('slDel').addEventListener('click', function () {
      var k = sliceIndexAtCursor(); st.ed.begin();
      if (!st.ed.deleteSlice(k)) { st.ed.undo.pop(); return; }
      st.ed.sel = null; heavy(); setSecX(st.secX);
    });
    $('slX').addEventListener('change', function () {
      var k = sliceIndexAtCursor(), v = parseFloat($('slX').value.replace(',', '.')) / 10; if (k < 0 || !isFinite(v)) return;
      st.ed.begin(); var x = st.ed.moveSlice(k, v); if (x === false) { st.ed.undo.pop(); return; }
      st.ed.sel = null; heavy(); setSecX(x);
    });

    $('file').addEventListener('change', function (e) { openFile(e.target.files[0]); e.target.value = ''; });
    $('openBtn').addEventListener('click', function () { $('file').click(); });
    $('saveBtn').addEventListener('click', save);
    $('undoBtn').addEventListener('click', function () { if (st.ed && st.ed.doUndo()) heavy(); });
    $('redoBtn').addEventListener('click', function () { if (st.ed && st.ed.doRedo()) heavy(); });
    $('secRange').addEventListener('input', function (e) { setSecX(parseFloat(e.target.value)); });
    $('sliceList').addEventListener('click', function (e) {
      var x = e.target.getAttribute && e.target.getAttribute('data-x'); if (x !== null) setSecX(parseFloat(x));
    });
    var sm = document.querySelectorAll('.sidemode:not(.cncside) button');
    for (var q = 0; q < sm.length; q++) sm[q].addEventListener('click', function (e) { setSideMode(e.currentTarget.getAttribute('data-m')); });
    ['selU', 'selV'].forEach(function (id) {
      $(id).addEventListener('change', applyInputs);
      $(id).addEventListener('keydown', function (e) { if (e.key === 'Enter') { applyInputs(); e.target.blur(); } });
    });
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener('click', function (e) { setTab(e.currentTarget.getAttribute('data-tab')); });
    $('wire').addEventListener('change', function (e) { v3.setWire(e.target.checked); });
    $('reset3d').addEventListener('click', function () { v3.resetView(); });
    var lb = document.querySelectorAll('.lang button');
    for (var j = 0; j < lb.length; j++) lb[j].addEventListener('click', function (e) {
      TS.setLang(e.currentTarget.getAttribute('data-l')); markLang();
      if (st.model) { renderDims(); setSecX(st.secX); showSel(); }
      TS.cncUI.lang();
    });
    markLang();

    document.addEventListener('keydown', function (e) {
      var mod = e.ctrlKey || e.metaKey, tag = (e.target.tagName || '').toLowerCase(), k = e.key;
      if (mod && (k === 's' || k === 'S' || k === 'ы' || k === 'Ы')) { e.preventDefault(); save(); return; }
      if (tag === 'input') return;
      if (!st.ed) return;
      if (mod && (k === 'z' || k === 'Z' || k === 'я' || k === 'Я')) {
        e.preventDefault(); if (e.shiftKey ? st.ed.doRedo() : st.ed.doUndo()) heavy(); return;
      }
      if (mod && (k === 'y' || k === 'н')) { e.preventDefault(); if (st.ed.doRedo()) heavy(); return; }
      var code = e.code || '';
      if (k === 'Escape') { st.ed.sel = null; clearMulti(); st.arc = null; showSel(); redraw2d(); return; }
      if ((k === 'Delete' || k === 'Backspace') && st.ed.sel) { e.preventDefault(); delSelected(); return; }
      if (mod && code === 'KeyA') { e.preventDefault(); selectAll(); return; }
      if (mod && code === 'KeyC') { if (doCopy()) e.preventDefault(); return; }
      if (mod && code === 'KeyV') { if (doPaste()) e.preventDefault(); return; }
      if (k === 'Tab') { e.preventDefault(); tabNext(e.shiftKey ? -1 : 1); return; }
      if (!mod && !e.altKey) {
        if (code === 'KeyK') { $('curvBtn').click(); return; }
        if (code === 'KeyX') { $('followChk').checked = !$('followChk').checked; st.follow = $('followChk').checked; return; }
        if (code === 'KeyO') { $('origBtn').click(); return; }
        if (code === 'KeyH' || code === 'KeyT' || code === 'KeyE' || code === 'KeyD') { toggleView(code.slice(3)); return; }
      }
      var s = st.ed.sel, d = null;
      if (k === 'ArrowLeft' || k === 'ArrowRight' || k === 'ArrowUp' || k === 'ArrowDown') {
        if (!s && (st.selBox === null || st.selBox === undefined)) {
          // без выбранной точки: стрелки ← → на виде сечения — соседнее сечение
          if (TS.activeView === vSlice && (k === 'ArrowLeft' || k === 'ArrowRight')) { e.preventDefault(); stepSlice(k === 'ArrowRight' ? 1 : -1); }
          return;
        }
        var key = s ? s.key : 'otl', hz = stepMM(key, false, e) / 10, vt = stepMM(key, true, e) / 10;
        if (k === 'ArrowLeft') d = [-hz, 0]; else if (k === 'ArrowRight') d = [hz, 0];
        else if (k === 'ArrowUp') d = [0, vt]; else d = [0, -vt];
      }
      if (d && st.selBox !== null && st.selBox !== undefined && !s) {
        e.preventDefault(); var ob = st.board.boxes[st.selBox];
        st.ed.begin(); st.ed.boxSet(st.selBox, { x: ob.x + d[0], y: ob.y + (ob.y < 0 ? -d[1] : d[1]) }); heavy(); return;
      }
      if (d && s) {
        e.preventDefault();
        if (s.key === 'otl' && st.drag === null && st.lastSign === -1) d[1] = -d[1];
        nudge(d[0], d[1]);
      }
    });

    document.addEventListener('dragover', function (e) { e.preventDefault(); document.body.classList.add('drag'); });
    document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) document.body.classList.remove('drag'); });
    document.addEventListener('drop', function (e) {
      e.preventDefault(); document.body.classList.remove('drag');
      openFile(e.dataTransfer.files[0]);
    });
    window.addEventListener('beforeunload', function (e) {
      if (st.ed && st.ed.dirty) { e.preventDefault(); e.returnValue = ''; }
    });
    window.addEventListener('resize', function () { if (st.model) { vTop.fitted = vSide.fitted = vSlice.fitted = false; redraw2d(); } });
    setTab('design');
  }
  function markLang() {
    var lb = document.querySelectorAll('.lang button');
    for (var j = 0; j < lb.length; j++) lb[j].classList.toggle('on', lb[j].getAttribute('data-l') === TS.lang());
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.TS = window.TS || {});
