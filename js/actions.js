/* Tentacle Shaper — действия над доской (меню Actions в Shape3D):
 * удлинить/укоротить концы или участок, наклонить, выровнять концы, «как лежит на полу»,
 * выпрямить низ или верх стрингера (толщина сохраняется). Внутри — см. GPL v3.
 */
(function (TS) {
  'use strict';

  function cl(p) { return p.slice(); }
  function uniq(a) { var r = []; a.forEach(function (c) { if (c && r.indexOf(c) < 0) r.push(c); }); return r; }
  // все кривые с координатой X вдоль доски (без кривой толщины — у неё X = длина по низу)
  function xCurves(b, ed) {
    var a = [b.otl, b.strbot, b.strdeck, ed.deck0].concat(b.slices);
    Object.keys(b.top).forEach(function (k) { a.push(b.top[k].curve); });
    Object.keys(b.side).forEach(function (k) { a.push(b.side[k].curve); });
    return uniq(a);
  }
  // кривые, у которых Z — высота (низ, верх, копии в виде сбоку, база верха, сечения)
  function zCurves(b, ed) {
    var a = [b.strbot, b.strdeck, ed.deck0].concat(b.slices);
    Object.keys(b.side).forEach(function (k) { a.push(b.side[k].curve); });
    return uniq(a);
  }
  function finish(b, ed) {
    ed.sync(); ed._baseThickness(); ed.renormSlices(); ed.sync();
    ed.dirty = true; ed.everEdited = true;
  }

  // длина по низу стрингера: таблицы x → s
  function arcTable(c) {
    var sb = c.sample(800), xs = [], ss = [0];
    sb.forEach(function (p, i) { xs.push(p[0]); if (i) ss.push(ss[i - 1] + Math.hypot(p[0] - sb[i - 1][0], p[2] - sb[i - 1][2])); });
    return { xs: xs, ss: ss };
  }

  // ---------- удлинить / укоротить: кусочно-линейное отображение X ----------
  // knots: старые X узлов, nk: новые X узлов (см). Касательные масштабируются по наклону в точке,
  // поэтому плавные точки остаются плавными.
  TS.mapLength = function (b, ed, knots, nk) {
    function seg(x) { var i = 0; while (i < knots.length - 2 && x > knots[i + 1]) i++; return i; }
    function g(x) { var i = seg(x); return nk[i] + (x - knots[i]) * (nk[i + 1] - nk[i]) / (knots[i + 1] - knots[i]); }
    function gp(x) { var i = seg(x); return (nk[i + 1] - nk[i]) / (knots[i + 1] - knots[i]); }
    var L = b.length, old = arcTable(b.strbot), sOld = old.ss[old.ss.length - 1], rec = TS.boxRecord(b);

    xCurves(b, ed).forEach(function (c) {
      for (var i = 0; i < c.P.length; i++) {
        var x = c.P[i][0], nx = g(x), s = gp(x);
        if (c.T1[i]) c.T1[i][0] = nx + s * (c.T1[i][0] - x);
        if (c.T2[i]) c.T2[i][0] = nx + s * (c.T2[i][0] - x);
        c.P[i][0] = nx;
      }
    });
    b.length = g(L);
    // кривая толщины: X — длина по низу; переводим старую длину → x → новый x → новую длину
    var nw = arcTable(b.strbot), sNew = nw.ss[nw.ss.length - 1];
    function sMap(S) {
      var x = TS.interp1(Math.max(0, Math.min(sOld, S)), old.ss, old.xs);
      return TS.interp1(g(x), nw.xs, nw.ss);
    }
    uniq([b.thickDiff, ed.diffB]).forEach(function (c) {
      var n = c.P.length;
      for (var i = 0; i < n; i++) {
        var S = c.P[i][0], nS = sMap(S), e = 0.05, d = (sMap(S + e) - sMap(S - e)) / (2 * e);
        if (i === n - 1) nS = sNew;
        if (i === 0) nS = 0;
        if (c.T1[i]) c.T1[i][0] = nS + d * (c.T1[i][0] - S);
        if (c.T2[i]) c.T2[i][0] = nS + d * (c.T2[i][0] - S);
        c.P[i][0] = nS;
      }
    });
    finish(b, ed);
    TS.boxFollow(b, rec, g);
  };
  // концы: хвост и нос удлиняются на dt / dn (см) за счёт зоны длиной zone от каждого конца
  TS.extendTips = function (b, ed, dt, dn, zone) {
    var L = b.length, z = Math.min(zone, L * 0.45);
    TS.mapLength(b, ed, [0, z, L - z, L], [0, z + dt, L - z + dt, L + dt + dn]);
  };
  // участок от x1 до x2 (см от хвоста) становится длиннее на d
  TS.extendSection = function (b, ed, x1, x2, d) {
    var L = b.length;
    x1 = Math.max(0, Math.min(L, x1)); x2 = Math.max(0, Math.min(L, x2));
    if (x2 - x1 < 1) return false;
    var k = [0], n = [0];
    if (x1 > 1e-6) { k.push(x1); n.push(x1); }
    k.push(x2); n.push(x2 + d);
    if (x2 < L - 1e-6) { k.push(L); n.push(L + d); }
    TS.mapLength(b, ed, k, n);
    return true;
  };

  // ---------- наклон: z += x·tg(α) (точно для кривых Безье) ----------
  TS.rockBoard = function (b, ed, t) {
    zCurves(b, ed).forEach(function (c) {
      ['P', 'T1', 'T2'].forEach(function (g) { c[g].forEach(function (p) { p[2] += p[0] * t; }); });
    });
    finish(b, ed);
  };
  function rockers(b, t) {
    var sb = b.strbot.sample(600), min = Infinity;
    sb.forEach(function (p) { min = Math.min(min, p[2] + p[0] * t); });
    var a = sb[0], z = sb[sb.length - 1];
    return { tail: a[2] + a[0] * t - min, nose: z[2] + z[0] * t - min };
  }
  // выровнять: рокер хвоста = рокер носа
  TS.levelBoard = function (b, ed) {
    var lo = -0.3, hi = 0.3;
    function f(t) { var r = rockers(b, t); return r.nose - r.tail; }
    if (f(lo) * f(hi) > 0) return false;
    for (var i = 0; i < 60; i++) { var m = (lo + hi) / 2; if (f(m) * f(lo) > 0) lo = m; else hi = m; }
    TS.rockBoard(b, ed, (lo + hi) / 2);
    return true;
  };
  // как лежит на полу: под центром объёма низ горизонтален
  TS.naturalLevel = function (b, ed) {
    var m = new TS.Model(b), L = m.L, sv = 0, sx = 0;
    for (var i = 0; i <= 200; i++) {
      var x = L * i / 200, h = m.section(x, 30), a = 0;
      for (var k = 0; k < h.length - 1; k++) a += h[k][0] * h[k + 1][1] - h[k + 1][0] * h[k][1];
      a = Math.abs(a); sv += a; sx += a * x;
    }
    if (!sv) return false;
    var xc = sx / sv, e = 0.5, zb = b.strbot.byX(2);
    var slope = (zb(Math.min(L, xc + e)) - zb(Math.max(0, xc - e))) / (Math.min(L, xc + e) - Math.max(0, xc - e));
    TS.rockBoard(b, ed, -slope);
    return xc;
  };
  // выпрямить низ стрингера: рокер 0, толщина та же (верх идёт за низом)
  TS.flattenBottom = function (b, ed) {
    var sb = b.strbot.sample(600), min = Infinity;
    sb.forEach(function (p) { min = Math.min(min, p[2]); });
    var c = b.strbot, n = c.P.length;
    for (var i = 0; i < n; i++) {
      c.P[i][2] = min;
      c.T1[i][2] = min; c.T2[i][2] = min;
    }
    ed.regenDeck(true);
    // сечения сдвигаются вместе с низом
    finish(b, ed);
  };
  // выпрямить верх стрингера: верх прямой, низ сдвигается так, чтобы толщина осталась
  TS.flattenDeck = function (b, ed) {
    var zd = b.strdeck.byX(2), L = b.length, sd = b.strdeck.sample(600), max = -Infinity;
    sd.forEach(function (p) { max = Math.max(max, p[2]); });
    function dz(x) { return max - zd(Math.max(0, Math.min(L, x))); }
    // низ поднимается на столько же, на сколько поднимается верх (точки добавляются, если нужно для точности)
    var c = b.strbot, base = { P: c.P.map(cl), T1: c.T1.map(cl), T2: c.T2.map(cl) };
    if (c.ctype) base.ctype = c.ctype.slice(); if (c.ttype) base.ttype = c.ttype.slice(); if (c.free) base.free = c.free.slice();
    ed.deckFitErr = TS.shiftFit(base, c, dz, L, 0.02) * 10;
    var dk = b.strdeck;
    for (var j = 0; j < dk.P.length; j++) { dk.P[j][2] = max; dk.T1[j][2] = max; dk.T2[j][2] = max; }
    finish(b, ed);
  };

  // ---------- окно «Действия…» ----------
  var $ = function (id) { return document.getElementById(id); };
  function f1(v) { return isFinite(v) ? v.toFixed(1) : '—'; }
  function num(id) { var v = parseFloat(String($(id).value).replace(',', '.')); return isFinite(v) ? v : NaN; }
  function info() {
    var st = TS.state; if (!st.model) return;
    var ms = new TS.Model(st.board).measures();
    $('acNow').textContent = TS.t('length') + ' ' + f1(st.board.length * 10) + ' ' + TS.t('mm') + ' (' + TS.t('lengthDev') + ' ' + f1(ms.lengthDev) + ') · ' +
      TS.t('tailRocker') + ' ' + f1(ms.tailRocker) + ' · ' + TS.t('noseRocker') + ' ' + f1(ms.noseRocker) + ' · ' + TS.t('thick') + ' ' + f1(ms.thick) + ' ' + TS.t('mm');
  }
  function run(fn) {
    var st = TS.state; if (!st.ed) return;
    st.ed.begin();
    var r = fn(st.board, st.ed);
    if (r === false) { st.ed.undo.pop(); $('acMsg').textContent = TS.t('acFail'); return; }
    st.ed.sel = null; TS.appHeavy(); info();
    $('acMsg').textContent = TS.t('acDone') + (typeof r === 'number' ? ' (' + TS.t('acCg') + ' ' + f1(r * 10) + ' ' + TS.t('mm') + ')' : '');
  }
  TS.actionsUI = {
    init: function () {
      $('actBtn').addEventListener('click', function () { $('acMsg').textContent = ''; info(); $('dlgAct').hidden = false; });
      $('acClose').addEventListener('click', function () { $('dlgAct').hidden = true; });
      $('acMode').addEventListener('change', function () { var s = $('acMode').value === 'sec'; $('acTips').hidden = s; $('acSec').hidden = !s; });
      $('acExt').addEventListener('click', function () {
        if ($('acMode').value === 'sec') {
          var x1 = num('acX1'), x2 = num('acX2'), d = num('acD');
          if (!isFinite(x1) || !isFinite(x2) || !isFinite(d)) return;
          if (x2 - x1 + d < 10) { $('acMsg').textContent = TS.t('acFail'); return; }
          run(function (b, ed) { return TS.extendSection(b, ed, x1 / 10, x2 / 10, d / 10); });
        } else {
          var dt = num('acDt') || 0, dn = num('acDn') || 0, z = num('acZone');
          if (!isFinite(z) || z < 20) z = 300;
          run(function (b, ed) { TS.extendTips(b, ed, dt / 10, dn / 10, z / 10); });
        }
      });
      $('acRock').addEventListener('click', function () {
        var a = num('acAng'); if (!isFinite(a)) return;
        run(function (b, ed) { TS.rockBoard(b, ed, Math.tan(a * Math.PI / 180)); });
      });
      $('acLevel').addEventListener('click', function () { run(TS.levelBoard); });
      $('acNat').addEventListener('click', function () { run(TS.naturalLevel); });
      $('acFlatB').addEventListener('click', function () { run(TS.flattenBottom); });
      $('acFlatD').addEventListener('click', function () { run(TS.flattenDeck); });
      $('acUndo').addEventListener('click', function () { var st = TS.state; if (st.ed && st.ed.doUndo()) { TS.appHeavy(); info(); $('acMsg').textContent = ''; } });
    }
  };
})(window.TS = window.TS || {});
