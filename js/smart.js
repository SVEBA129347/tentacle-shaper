/* Tentacle Shaper — «умные» функции (как Smart Functions в Shape3D): задать ширину, толщину или рокер
 * на нужном расстоянии от хвоста или носа; окно размеров и подбор объёма. GPL v3.
 */
(function (TS) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function fmt(v, d) { return isFinite(v) ? (+v).toFixed(d === undefined ? 1 : d) : '—'; }

  // значение величины what на расстоянии d мм (вдоль стрингера) от хвоста/носа
  function valueAt(b, what, d, from) {
    var m = new TS.Model(b), ms = m.measures([0]), S = ms.lengthDev;
    var x = ms.xAtArc(from === 'nose' ? Math.max(0, S - d) : Math.min(S, d));
    if (BOT[what]) {
      var c = m.sectionCtrl(x);
      return { v: bottomMeasure(c, railIdx(m.apexIdx), what, 0, 1), x: x };
    }
    var v = what === 'width' ? 20 * m.halfW(x) : what === 'thick' ? ms.perpThick(x) : 10 * (m.zb(x) - ms.minZ);
    return { v: v, x: x };
  }

  // ---------- V / конкейв / двойной конкейв в сечении ----------
  // низ сечения — точки от центра (0) до рейла (r). V — рейл выше центра, мм; конкейв — центр выше рейла, мм;
  // двойной конкейв — наибольшая высота низа над прямой «центр — рейл», мм.
  var BOT = { vee: 1, conc: 1, dconc: 1 };
  function railIdx(a) { return Math.max(1, a - 1); }
  function bez(a, b, c, d, t, k) { var u = 1 - t; return u * u * u * a[k] + 3 * u * u * t * b[k] + 3 * u * t * t * c[k] + t * t * t * d[k]; }
  // c: {P,T1,T2}; iy, iz — индексы координат Y и Z в точках
  function bottomMeasure(c, r, what, iy, iz) {
    var P = c.P;
    if (what === 'vee') return 10 * (P[r][iz] - P[0][iz]);
    if (what === 'conc') return 10 * (P[0][iz] - P[r][iz]);
    var y0 = P[0][iy], z0 = P[0][iz], yr = P[r][iy], zr = P[r][iz], best = 0;
    for (var i = 0; i < r; i++) for (var q = 1; q < 40; q++) {
      var t = q / 40, y = bez(P[i], c.T2[i], c.T1[i + 1], P[i + 1], t, iy), z = bez(P[i], c.T2[i], c.T1[i + 1], P[i + 1], t, iz);
      var zc = z0 + (zr - z0) * (yr - y0 ? (y - y0) / (yr - y0) : 0);
      best = Math.max(best, z - zc);
    }
    return 10 * best;
  }
  // добавить к низу сечения A·g(y/yр): V — g = u (поднимает рейл), конкейв — g = u² (центр остаётся горизонтальным),
  // двойной — g = −4u(1−u) (центр и рейл на месте, середина поднимается)
  function addBottom(s, r, what, A) {
    var yr = s.P[r][1] || 1e-6;
    function g(u) { return what === 'vee' ? u : what === 'conc' ? -u * u : 4 * u * (1 - u); }
    function gp(u) { return what === 'vee' ? 1 : what === 'conc' ? -2 * u : 4 - 8 * u; }
    for (var i = 0; i <= r; i++) {
      var y = s.P[i][1], u = Math.min(1, y / yr), f = A * g(u), fp = A * gp(u) / yr;
      if (i > 0) s.T1[i][2] += f + fp * (s.T1[i][1] - y);
      if (i < r) s.T2[i][2] += f + fp * (s.T2[i][1] - y);
      else s.T2[i][2] += f;                       // касательная рейла к апексу — только сдвиг
      s.P[i][2] += f;
    }
  }
  // задать V / конкейв на расстоянии d мм: правится ближайшее сечение (до 20 мм), иначе добавляется новое
  TS.smartBottom = function (b, ed, model, what, d, from, target) {
    var x = valueAt(b, what, d, from).x, xs = b.slices.map(function (c) { return c.P[0][0]; }), k = -1, added = false;
    xs.forEach(function (sx, i) { if (Math.abs(sx - x) <= 2 && (k < 0 || Math.abs(sx - x) < Math.abs(xs[k] - x))) k = i; });
    if (k < 0) { k = ed.addSlice(model, x); added = true; if (k < 0) return null; }
    var s = b.slices[k], r = railIdx(model.apexIdx);
    var keep = { T1: s.T1.map(function (p) { return p.slice(); }), T2: s.T2.map(function (p) { return p.slice(); }), P: s.P.map(function (p) { return p.slice(); }) };
    function f(A) {
      ['P', 'T1', 'T2'].forEach(function (gk) { keep[gk].forEach(function (p, i) { s[gk][i][2] = p[2]; }); });
      addBottom(s, r, what, A);
      return bottomMeasure(s, r, what, 1, 2) - target;
    }
    var a0 = 0, f0 = f(0), a1 = 0.1, f1 = f(a1);
    for (var it = 0; it < 20 && Math.abs(f1) > 0.005; it++) {
      if (Math.abs(f1 - f0) < 1e-12) break;
      var a2 = a1 - f1 * (a1 - a0) / (f1 - f0);
      a0 = a1; f0 = f1; a1 = a2; f1 = f(a1);
    }
    ed.dirty = true; ed.everEdited = true;
    ed.renormSlices(); ed.sync();
    return { slice: k + 1, x: s.P[0][0], added: added, error: f1 };
  };

  // подвинуть ближайшую по X опорную точку нужной кривой так, чтобы величина стала нужной (метод секущих)
  TS.smartSet = function (b, ed, what, d, from, target) {
    var key = what === 'width' ? 'otl' : what === 'thick' ? 'deck' : 'bot';
    var c = ed.curve(key), iv = key === 'otl' ? 1 : 2;
    var x = valueAt(b, what, d, from).x, n = c.P.length, L = b.length, best = -1;
    // концы двигаем, только если точка у самого конца (10 % длины), иначе — ближайшую внутреннюю
    if (x < 0.1 * L) best = 0; else if (x > 0.9 * L) best = n - 1;
    else for (var i = 1; i < n - 1; i++) if (best < 0 || Math.abs(c.P[i][0] - x) < Math.abs(c.P[best][0] - x)) best = i;
    if (best < 0) best = x < L / 2 ? 0 : n - 1;
    function f(v) { ed.move(key, best, 'P', c.P[best][0], v, false); return valueAt(b, what, d, from).v - target; }
    var v0 = c.P[best][iv], f0 = valueAt(b, what, d, from).v - target, v1 = v0 + (f0 > 0 ? -0.1 : 0.1), f1 = f(v1);
    for (var it = 0; it < 12 && Math.abs(f1) > 0.005; it++) {
      if (Math.abs(f1 - f0) < 1e-9) break;
      var v2 = v1 - f1 * (v1 - v0) / (f1 - f0);
      v0 = v1; f0 = f1; v1 = v2; f1 = f(v1);
    }
    ed.renormSlices(); ed.sync();
    return { point: best + 1, error: f1 };
  };

  // ---------- окно размеров ----------
  var base = null;
  function openSize() {
    var st = TS.state; if (!st.board) return;
    var c = TS.resizeMeasure(st.board);
    base = c;
    $('szL0').textContent = fmt(c.L); $('szW0').textContent = fmt(c.W); $('szT0').textContent = fmt(c.T);
    $('szTr0').textContent = fmt(c.tr); $('szNr0').textContent = fmt(c.nr);
    $('szL').value = fmt(c.L); $('szW').value = fmt(c.W); $('szT').value = fmt(c.T); $('szTr').value = fmt(c.tr); $('szNr').value = fmt(c.nr);
    $('volNow').textContent = fmt(c.m.volume(), 2) + ' ' + TS.t('l');
    $('volT').value = fmt(c.m.volume(), 2); $('volMsg').textContent = '';
    $('dlgSize').hidden = false;
  }
  function num(id) { return parseFloat($(id).value.replace(',', '.')); }
  function onLength() {
    var k = num('szL') / base.L, mode = $('szMode').value;
    if (!isFinite(k)) return;
    if (mode === 'prop') { $('szW').value = fmt(base.W * k); }
    if (mode === 'prop' || mode === 'side') { $('szT').value = fmt(base.T * k); }
    if (mode !== 'none') { $('szTr').value = fmt(base.tr * k); $('szNr').value = fmt(base.nr * k); }
  }
  function onThick() {
    if (!$('szZ').checked) return;
    var k = num('szT') / base.T; if (!isFinite(k)) return;
    $('szTr').value = fmt(base.tr * k); $('szNr').value = fmt(base.nr * k);
  }
  function applySize() {
    var st = TS.state, ed = st.ed;
    var tg = { L: num('szL'), W: num('szW'), T: num('szT'), tr: num('szTr'), nr: num('szNr') };
    // не трогаем то, что не изменили
    ['L', 'W', 'T', 'tr', 'nr'].forEach(function (k) { if (Math.abs(tg[k] - base[k]) < 0.05) tg[k] = NaN; });
    ed.begin();
    TS.resizeTo(st.board, ed, tg);
    $('dlgSize').hidden = true;
    TS.appHeavy();
  }
  function volumeGo() {
    var st = TS.state, ed = st.ed, t = num('volT'); if (!isFinite(t)) return;
    $('volMsg').textContent = TS.t('volBusy');
    setTimeout(function () {
      ed.begin();
      var k = TS.volumeFit(st.board, ed, t, $('volWhat').value, base);
      if (k === null) { ed.doUndo(); $('volMsg').textContent = TS.t('volFail'); return; }
      var c = TS.resizeMeasure(st.board);
      $('volMsg').textContent = TS.t('volDone') + ' ' + fmt(c.m.volume(), 2) + ' ' + TS.t('l') + ' · ' +
        TS.t('width') + ' ' + fmt(c.W) + ' · ' + TS.t('thick') + ' ' + fmt(c.T) + ' ' + TS.t('mm');
      $('volNow').textContent = fmt(c.m.volume(), 2) + ' ' + TS.t('l');
      TS.appHeavy();
    }, 30);
  }

  // ---------- окно «задать в точке» ----------
  function smartNow() {
    var st = TS.state; if (!st.board) return;
    var r = valueAt(st.board, $('smWhat').value, num('smD'), $('smFrom').value);
    $('smNow').textContent = TS.t('szNow') + ': ' + fmt(r.v, 2) + ' ' + TS.t('mm');
    if (document.activeElement !== $('smV')) $('smV').value = fmt(r.v, 2);
  }
  function smartApply() {
    var st = TS.state, ed = st.ed, v = num('smV'); if (!isFinite(v)) return;
    ed.begin();
    var what = $('smWhat').value;
    if (BOT[what]) {
      var rb = TS.smartBottom(st.board, ed, st.model, what, num('smD'), $('smFrom').value, v);
      if (!rb) { ed.undo.pop(); $('smNow').textContent = TS.t('smNoSlice'); return; }
      TS.appHeavy(); smartNow();
      $('smNow').textContent += ' · ' + (rb.added ? TS.t('smAdded') : TS.t('smSlice')) + ' ' + rb.slice + ' (' + fmt(rb.x * 10, 0) + ' ' + TS.t('mm') + ')';
      return;
    }
    var r = TS.smartSet(st.board, ed, what, num('smD'), $('smFrom').value, v);
    TS.appHeavy(); smartNow();
    $('smNow').textContent += ' · ' + TS.t('smMoved') + ' ' + r.point;
  }

  TS.smartUI = {
    init: function () {
      $('sizeBtn').addEventListener('click', openSize);
      $('szCancel').addEventListener('click', function () { $('dlgSize').hidden = true; });
      $('szApply').addEventListener('click', applySize);
      $('szL').addEventListener('input', onLength);
      $('szT').addEventListener('input', onThick);
      $('volGo').addEventListener('click', volumeGo);
      $('smartBtn').addEventListener('click', function () { $('dlgSmart').hidden = false; smartNow(); });
      $('smClose').addEventListener('click', function () { $('dlgSmart').hidden = true; });
      ['smWhat', 'smD', 'smFrom'].forEach(function (id) { $(id).addEventListener('change', smartNow); });
      $('smApply').addEventListener('click', smartApply);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { $('dlgSize').hidden = true; $('dlgSmart').hidden = true; }
      });
    }
  };
})(window.TS = window.TS || {});
