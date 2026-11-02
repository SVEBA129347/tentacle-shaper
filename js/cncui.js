/* Tentacle Shaper — вкладка CNC: настройки станка, расчёт траекторий, просмотр, сохранение G-code. GPL v3. */
(function (TS) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var U = { s: null, res: { deck: null, bot: null }, vTop: null, vSide: null, side: 'deck', stale: true };

  // поля настроек: ключ, подпись, шаг
  var GROUPS = [
    ['cncCutter', [['D', 'cD', 0.01], ['r1', 'cR1', 0.01], ['R2', 'cR2', 0.01]]],
    ['cncLines', [['nDeck', 'cNDeck', 1], ['nBot', 'cNBot', 1], ['nRail', 'cNRail', 1], ['varMax', 'cVarMax', 0.1],
                  ['varMaxBot', 'cVarMaxBot', 0.1], ['nPts', 'cNPts', 1]]],
    ['cncPlace', [['X0', 'cX0', 0.01], ['Yc', 'cYc', 0.01], ['Tb', 'cTb', 0.1], ['tilt', 'cTilt', 0.01], ['Z0', 'cZ0', 0.01]]],
    ['cncRough', [['roughStep', 'cRoughStep', 1], ['roughMargin', 'cRoughMargin', 0.5], ['roughLoops', 'cRoughLoops', 1], ['roughLoopStep', 'cRoughLoopStep', 0.5],
                  ['bridgeL', 'cBridgeL', 1], ['bridgeH', 'cBridgeH', 0.5]]],
    ['cncFeed', [['feed', 'cFeed', 100], ['feedHead', 'cFeedHead', 100], ['safeZ', 'cSafeZ', 1]]],
    ['cncOrder', [['mTail', 'cMTail', 1], ['mNose', 'cMNose', 1], ['endX', 'cEndX', 1], ['endY', 'cEndY', 1], ['endZ', 'cEndZ', 1]]]
  ];

  function fmt(v, d) { return isFinite(v) ? (+v).toFixed(d === undefined ? 2 : d) : '—'; }

  function buildForm() {
    var h = '';
    GROUPS.forEach(function (g) {
      h += '<h3 data-i18n="' + g[0] + '">' + TS.t(g[0]) + '</h3><div class="form">';
      g[1].forEach(function (f) {
        h += '<label><span data-i18n="' + f[1] + '">' + TS.t(f[1]) + '</span><input data-k="' + f[0] + '" type="number" step="' + f[2] + '"></label>';
      });
      if (g[0] === 'cncPlace') h += '<div class="formbtns"><button id="cLevel" data-i18n="cLevel">' + TS.t('cLevel') + '</button><button id="cCenter" data-i18n="cCenter">' + TS.t('cCenter') + '</button></div>';
      if (g[0] === 'cncLines') h += '<label class="chk"><input data-k="skim" type="checkbox"> <span data-i18n="cSkim">' + TS.t('cSkim') + '</span></label>' +
        '<label class="chk"><input data-k="stringer" type="checkbox"> <span data-i18n="cStringer">' + TS.t('cStringer') + '</span></label>' +
        '<label class="chk"><input data-k="endCut" type="checkbox"> <span data-i18n="cEndCut">' + TS.t('cEndCut') + '</span></label>';
      if (g[0] === 'cncOrder') h += '<label class="chk"><input data-k="startNose" type="checkbox"> <span data-i18n="cStartNose">' + TS.t('cStartNose') + '</span></label>';
      if (g[0] === 'cncRough') h += '<label class="chk"><input data-k="rough" type="checkbox"> <span data-i18n="cRough">' + TS.t('cRough') + '</span></label>' +
        '<label class="chk"><input data-k="bridges" type="checkbox"> <span data-i18n="cBridges">' + TS.t('cBridges') + '</span></label>' +
        '<label class="chk"><input data-k="plugs" type="checkbox"> <span data-i18n="cPlugs">' + TS.t('cPlugs') + '</span></label>';
      h += '</div>';
    });
    $('cncForm').innerHTML = h;
    var ins = $('cncForm').querySelectorAll('input');
    for (var i = 0; i < ins.length; i++) ins[i].addEventListener('change', readForm);
    $('cLevel').addEventListener('click', function () {
      var m = TS.state.model, L = m.L * 10;
      U.s.tilt = Math.atan2(m.zd(m.L) * 10 - m.zd(0) * 10, L) * 180 / Math.PI;
      TS.cncCenter(U.s, m); fillForm(); invalidate();
    });
    $('cCenter').addEventListener('click', function () { TS.cncCenter(U.s, TS.state.model); fillForm(); invalidate(); });
  }
  function fillForm() {
    var ins = $('cncForm').querySelectorAll('input');
    for (var i = 0; i < ins.length; i++) {
      var k = ins[i].getAttribute('data-k');
      if (ins[i].type === 'checkbox') ins[i].checked = !!U.s[k];
      else ins[i].value = Number.isInteger(U.s[k]) ? U.s[k] : fmt(U.s[k], 3).replace(/\.?0+$/, '');
    }
  }
  function readForm(e) {
    var k = e.target.getAttribute('data-k');
    if (e.target.type === 'checkbox') U.s[k] = e.target.checked;
    else { var v = parseFloat(e.target.value); if (isFinite(v)) U.s[k] = v; }
    if (k === 'tilt' || k === 'Tb') TS.cncCenterKeep(U.s, TS.state.model);
    invalidate();
  }
  // при смене наклона/толщины бланка пересчитываем только границы доски, высоту не трогаем
  TS.cncCenterKeep = function (s, model) {
    var z0 = s.Z0; TS.cncCenter(s, model); var d = z0 - s.Z0; s.Z0 = z0; s.boardLo += d; s.boardHi += d;
  };

  function invalidate() { simStop(); U.sim = null; U.res = { deck: null, bot: null }; U.stale = true; renderInfo(); redraw(); simUI(); }

  function compute() {
    var m = TS.state.model; if (!m) return;
    var t0 = Date.now();
    U.res.deck = TS.cncSide(m, U.s, 'deck');
    U.res.bot = U.s.skim ? null : TS.cncSide(m, U.s, 'bot');
    U.ms = Date.now() - t0; U.stale = false;
    renderInfo(); buildSim(); redraw();
  }

  // ---------- симуляция: фреза едет по программе (без учёта разгона) ----------
  function buildSim() {
    var res = U.res[U.side]; if (!res) { U.sim = null; simUI(); return; }
    var path = TS.cncPath(res, U.s), cum = [0];
    for (var i = 1; i < path.length; i++) cum.push(cum[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]));
    U.sim = { side: U.side, path: path, cum: cum, lines: res.passes.length, total: cum[cum.length - 1], pos: 0, playing: false };
    simUI();
  }
  function simAt(d) {
    var S = U.sim, c = S.cum, lo = 0, hi = c.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (c[m] <= d) lo = m; else hi = m; }
    var a = S.path[lo], b = S.path[hi], t = c[hi] > c[lo] ? (d - c[lo]) / (c[hi] - c[lo]) : 0;
    return { i: lo, p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t], kind: b[3] };
  }
  function simStop() { if (U.sim) U.sim.playing = false; if (U.raf) cancelAnimationFrame(U.raf); U.raf = null; }
  function simTick(ts) {
    var S = U.sim; if (!S || !S.playing) return;
    if (S.ts) {
      var k = parseFloat($('cSimSpeed').value) || 50, dt = Math.min(0.1, (ts - S.ts) / 1000);
      S.pos = Math.min(S.total, S.pos + U.s.feed / 60 * dt * k);   // мм/мин → мм/с, ускорено в k раз
      if (S.pos >= S.total) S.playing = false;
    }
    S.ts = ts; simUI(); redraw();
    if (S.playing) U.raf = requestAnimationFrame(simTick);
  }
  function mmss(sec) { sec = Math.max(0, Math.round(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), q = sec % 60; return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (q < 10 ? '0' : '') + q; }
  function simUI() {
    var S = U.sim, box = $('simBox'); if (!box) return;
    box.hidden = !S;
    if (!S) return;
    $('cSimPlay').textContent = S.playing ? '❚❚' : '▶';
    if (document.activeElement !== $('cSimPos')) $('cSimPos').value = S.total ? Math.round(S.pos / S.total * 1000) : 0;
    var a = simAt(S.pos), f = U.s.feed / 60;
    $('cSimInfo').textContent = TS.t(S.side === 'deck' ? 'cDeck' : 'cBot') + ' · ' + TS.t('cSimLine') + ' ' + S.path[a.i + 1 < S.path.length ? a.i + 1 : a.i][4] + '/' + S.lines + ' (' + TS.t('cK_' + (a.kind || 'move')) + ')' + ' · ' +
      mmss(S.pos / f) + ' / ' + mmss(S.total / f) + ' · X ' + fmt(a.p[0], 1) + ' Y ' + fmt(a.p[1], 1) + ' Z ' + fmt(a.p[2], 1);
  }
  function drawSimTop(v) {
    var S = U.sim; if (!S || S.side !== U.side || S.pos <= 0) return;
    var a = simAt(S.pos), ctx = v.ctx;
    ctx.beginPath();
    for (var i = 0; i <= a.i; i++) { var q = v.toScreen(S.path[i][0], S.path[i][1]); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
    var e = v.toScreen(a.p[0], a.p[1]); ctx.lineTo(e[0], e[1]);
    ctx.strokeStyle = 'rgba(29,43,54,0.85)'; ctx.lineWidth = 1.6; ctx.stroke();
    var circ = []; for (var k = 0; k <= 32; k++) circ.push([a.p[0] + U.s.D / 2 * Math.cos(k / 16 * Math.PI), a.p[1] + U.s.D / 2 * Math.sin(k / 16 * Math.PI)]);
    v.poly(circ, { fill: 'rgba(194,37,92,0.35)', stroke: '#c2255c', width: 1.5 }, true);
  }
  function drawSimSide(v) {
    var S = U.sim; if (!S || S.side !== U.side || S.pos <= 0) return;
    var a = simAt(S.pos), R = U.s.D / 2;
    v.poly([[a.p[0] - R, a.p[2]], [a.p[0] + R, a.p[2]], [a.p[0] + R, a.p[2] + 60], [a.p[0] - R, a.p[2] + 60]], { fill: 'rgba(194,37,92,0.35)', stroke: '#c2255c', width: 1.5 }, true);
  }

  // ---------- лист станка (печать / PDF) ----------
  function machineSheet() {
    var s = U.s, st = TS.state, b = st.board, m = st.model, ms = m.measures(), mm = TS.t('mm');
    var W = 297, H = 210, M = 12, out = '', y = M + 6;
    function T(x, yy, t, size, bold, anchor) { return '<text x="' + x + '" y="' + yy + '" font-size="' + (size || 3.2) + '" font-family="Arial, Helvetica, sans-serif"' + (bold ? ' font-weight="bold"' : '') + (anchor ? ' text-anchor="' + anchor + '"' : '') + '>' + String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</text>'; }
    out += T(M, y, b.fileName.replace(/\.s3dx$/i, '') + ' — ' + TS.t('cSheetT'), 6, true);
    out += T(W - M, y, new Date().toLocaleString(), 3, false, 'end');
    y += 7;
    out += T(M, y, fmt(ms.lengthDev, 1) + ' × ' + fmt(ms.width, 1) + ' × ' + fmt(ms.thick, 1) + ' ' + mm + ' · ' + TS.t('volume') + ' ' + fmt(m.volume(), 2) + ' ' + TS.t('l'), 3.6);
    y += 8;
    var rows = [
      [TS.t('cncCutter'), 'D ' + s.D + ' · R ' + s.r1 + ' · R ' + s.R2],
      [TS.t('cncLines'), TS.t('cNDeck') + ' ' + s.nDeck + ' · ' + TS.t('cNBot') + ' ' + s.nBot + ' · ' + TS.t('cNRail') + ' ' + s.nRail + ' · ' + TS.t('cVarMax') + ' ' + s.varMax],
      [TS.t('cX0'), fmt(s.X0, 2) + ' ' + mm], [TS.t('cYc'), fmt(s.Yc, 2) + ' ' + mm], [TS.t('cTb'), fmt(s.Tb, 1) + ' ' + mm],
      [TS.t('cTilt'), fmt(s.tilt, 3) + '°'], [TS.t('cZ0'), fmt(s.Z0, 2) + ' ' + mm],
      [TS.t('cGaps'), fmt(s.boardLo, 1) + ' / ' + fmt(s.Tb - s.boardHi, 1) + ' ' + mm],
      [TS.t('cncRough'), s.rough ? (TS.t('cRoughStep') + ' ' + s.roughStep + ' · ' + TS.t('cRoughMargin') + ' ' + s.roughMargin + ' · ' + TS.t('cRoughLoops') + ' ' + s.roughLoops) : '—'],
      [TS.t('cBridges'), s.bridges ? (s.bridgeL + ' × ' + s.bridgeH + ' ' + mm) : '—'],
      [TS.t('cPlugs'), s.plugs ? (TS.cncBoxes(b).reduce(function (a, q) { return a + q.places.length; }, 0) + ' ' + TS.t('cPcs')) : '—'],
      [TS.t('cncFeed'), s.feed + ' ' + TS.t('cFeedU') + ' · ' + TS.t('cSafeZ') + ' ' + s.safeZ + ' ' + mm],
      [TS.t('cncOrder'), (s.startNose ? TS.t('cStartNose') : TS.t('cStartTail')) + ' · ' + TS.t('cMTail') + ' ' + s.mTail + ' · ' + TS.t('cMNose') + ' ' + s.mNose + ' · ' + TS.t('cEndPos') + ' ' + s.endX + ', ' + s.endY + ', ' + s.endZ]
    ];
    rows.forEach(function (r) { out += T(M, y, r[0], 3.1, true) + T(M + 62, y, r[1], 3.1); y += 5.2; });
    y += 3;
    if (!U.stale && U.res.deck) {
      ['deck', 'bot'].forEach(function (side) {
        if (!U.res[side]) return;
        var q = stats(U.res[side]);
        out += T(M, y, TS.t(side === 'deck' ? 'cDeck' : 'cBot'), 3.3, true) + T(M + 62, y, q.lines + ' ' + TS.t('cPasses') + ' · ' + q.n + ' ' + TS.t('cPoints') + ' · ' + fmt(q.len / 1000, 1) + ' ' + TS.t('cMeters') + ' ≈ ' + fmt(q.len / s.feed, 0) + ' ' + TS.t('cMin') +
          ' · X ' + fmt(q.minX, 0) + '…' + fmt(q.maxX, 0) + ' · Y ' + fmt(q.minY, 0) + '…' + fmt(q.maxY, 0) + ' · Z ' + fmt(q.minZ, 1) + '…' + fmt(q.maxZ, 1), 3.1);
        y += 5.2;
      });
    } else { out += T(M, y, TS.t('cNotYet'), 3.1); y += 5.2; }
    // доска в бланке (вид сбоку, по высоте ×3), координаты станка
    var fr = new TS.CncFrame(s, 'deck'), Lx = Math.max(m.L * 10 + s.X0 + 40, 2000), sc = (W - 2 * M) / Lx, ex = 3, base = H - M - 8, top = [], bot = [];
    function P(X, Z) { return (M + X * sc).toFixed(2) + ' ' + (base - Z * sc * ex).toFixed(2); }
    for (var i = 0; i <= 160; i++) {
      var x = m.L * i / 160, c = m.sectionCtrl(x), zs = c.P.map(function (p) { return p[1]; });
      var a = fr.p(x * 10, 0, Math.max.apply(null, zs) * 10), bb = fr.p(x * 10, 0, Math.min.apply(null, zs) * 10);
      top.push(P(a[0], a[2])); bot.push(P(bb[0], bb[2]));
    }
    out += '<path d="M' + P(0, 0) + 'L' + P(Lx, 0) + 'L' + P(Lx, s.Tb) + 'L' + P(0, s.Tb) + 'Z" fill="none" stroke="#777" stroke-width="0.25" stroke-dasharray="2 1.5"/>';
    out += '<path d="M' + top.join('L') + 'L' + bot.reverse().join('L') + 'Z" fill="none" stroke="#000" stroke-width="0.35"/>';
    out += T(M, base + 5, '0', 2.6) + T(W - M, base - s.Tb * sc * ex - 2, TS.t('cSheetSide'), 2.6, false, 'end');
    out += T(M, H - 4, TS.t('cWarn'), 2.8);
    return '<div class="ppage" style="width:' + W + 'mm;height:' + H + 'mm"><svg xmlns="http://www.w3.org/2000/svg" width="' + W + 'mm" height="' + H + 'mm" viewBox="0 0 ' + W + ' ' + H + '">' + out + '</svg></div>';
  }

  function stats(res) {
    var n = 0, len = 0, minZ = Infinity, maxZ = -Infinity, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, prev = null;
    res.passes.forEach(function (p) {
      p.pts.forEach(function (q) {
        n++; if (prev) len += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]); prev = q;
        minZ = Math.min(minZ, q[2]); maxZ = Math.max(maxZ, q[2]); minX = Math.min(minX, q[0]); maxX = Math.max(maxX, q[0]);
        minY = Math.min(minY, q[1]); maxY = Math.max(maxY, q[1]);
      });
    });
    return { n: n, len: len, minZ: minZ, maxZ: maxZ, minX: minX, maxX: maxX, minY: minY, maxY: maxY, lines: res.passes.length };
  }

  function renderInfo() {
    if (!U.s) return;
    var s = U.s, mm = TS.t('mm'), h = '';
    h += '<table class="kv">';
    h += tr(TS.t('cGapBot'), fmt(s.boardLo, 1) + ' ' + mm);
    h += tr(TS.t('cGapTop'), fmt(s.Tb - s.boardHi, 1) + ' ' + mm);
    h += '</table>';
    if (s.boardLo < 0 || s.boardHi > s.Tb) h += '<div class="warn">' + TS.t('cOutOfBlank') + '</div>';
    if (!U.stale && U.res.deck) {
      ['deck', 'bot'].forEach(function (side) {
        if (!U.res[side]) return;
        var st = stats(U.res[side]);
        h += '<div class="cstat"><b>' + TS.t(side === 'deck' ? 'cDeck' : 'cBot') + '</b>: ' + st.lines + ' ' + TS.t('cPasses') + ', ' +
          st.n + ' ' + TS.t('cPoints') + ', ' + fmt(st.len / 1000, 1) + ' ' + TS.t('cMeters') + ' ≈ ' + fmt(st.len / s.feed, 0) + ' ' + TS.t('cMin') +
          '<br>X ' + fmt(st.minX, 0) + '…' + fmt(st.maxX, 0) + ', Y ' + fmt(st.minY, 0) + '…' + fmt(st.maxY, 0) + ', Z ' + fmt(st.minZ, 1) + '…' + fmt(st.maxZ, 1) + '</div>';
      });
    } else h += '<div class="cstat muted">' + TS.t('cNotYet') + '</div>';
    $('cncInfo').innerHTML = h;
    $('cSaveDeck').disabled = U.stale;
    $('cSaveBot').disabled = U.stale || !U.res.bot;
    $('cSaveBot').hidden = !!s.skim;
    var bb = document.querySelector('.cncside [data-s="bot"]'); if (bb) bb.disabled = !!s.skim;
    if (s.skim && U.side === 'bot') { U.side = 'deck'; var sb = document.querySelectorAll('.cncside button'); for (var i = 0; i < sb.length; i++) sb[i].classList.toggle('on', sb[i].getAttribute('data-s') === 'deck'); }
  }
  function tr(k, v) { return '<tr><td>' + k + '</td><td class="v">' + v + '</td></tr>'; }

  // ---------- виды ----------
  function boardTop(fr) {
    var b = TS.state.board, otl = b.otl.sample(80);
    var up = otl.map(function (p) { return fr.p(p[0] * 10, p[1] * 10, 0); });
    var dn = otl.slice().reverse().map(function (p) { return fr.p(p[0] * 10, -p[1] * 10, 0); });
    return up.concat(dn).map(function (q) { return [q[0], q[1]]; });
  }
  function drawTop(ctx, v) {
    v.grid(); if (!U.s || !TS.state.model) return;
    var s = U.s, fr = new TS.CncFrame(s, U.side);
    v.poly([[0, s.Yc], [2100, s.Yc]], { stroke: '#9aa7b2', width: 1, dash: [6, 4] });
    v.poly(boardTop(fr), { fill: 'rgba(240,236,226,0.9)', stroke: '#1d2b36', width: 1.5 }, true);
    var res = U.res[U.side];
    if (res) res.passes.forEach(function (p) {
      var col = p.kind === 'stringer' || p.kind === 'endcut' ? '#d9480f' : p.kind === 'rough' ? '#adb5bd' : (U.side === 'deck' ? '#1971c2' : '#2f9e44');
      v.poly(p.pts.map(function (q) { return [q[0], q[1]]; }), { stroke: col, width: 1 });
    });
    drawSimTop(v);
    v.dot(0, 0, 4, '#c2255c');
    v.label(0, 0, '0', '#c2255c', 'left', -8);
  }
  function drawSide(ctx, v) {
    v.grid(); if (!U.s || !TS.state.model) return;
    var s = U.s, m = TS.state.model, fr = new TS.CncFrame(s, U.side), L = m.L * 10;
    v.poly([[0, 0], [2100, 0]], { stroke: '#495057', width: 2 });                    // стол
    var bx1 = Math.max(L + s.X0 + 40, 2000);
    v.poly([[0, 0], [bx1, 0], [bx1, s.Tb], [0, s.Tb]], { fill: 'rgba(25,113,194,0.06)', stroke: '#74a9d8', width: 1, dash: [5, 4] }, true);
    var top = [], bot = [];
    for (var i = 0; i <= 200; i++) {
      var x = m.L * i / 200, c = m.sectionCtrl(x), zs = c.P.map(function (p) { return p[1]; });
      var lo = Math.min.apply(null, zs), hi = Math.max.apply(null, zs);
      var a = fr.p(x * 10, 0, hi * 10), b = fr.p(x * 10, 0, lo * 10);
      top.push([a[0], a[2]]); bot.push([b[0], b[2]]);
    }
    v.poly(top.concat(bot.reverse()), { fill: 'rgba(240,236,226,0.95)', stroke: '#1d2b36', width: 1.5 }, true);
    if (s.bridges) {
      var frD = new TS.CncFrame(s, 'deck');
      [0, m.L].forEach(function (xe, i) {
        var c = frD.p(xe * 10, 0, m.zb(xe) * 10), d = frD.p(xe * 10, 0, m.zd(xe) * 10), mid = (c[2] + d[2]) / 2;
        var lo = Math.max(c[2], mid - s.bridgeH / 2), hi = Math.min(d[2], mid + s.bridgeH / 2), X = (c[0] + d[0]) / 2;
        if (U.side === 'bot') { var t = lo; lo = s.Tb - hi; hi = s.Tb - t; }
        var x0 = i ? X : X - s.bridgeL, x1 = i ? X + s.bridgeL : X;
        v.poly([[x0, lo], [x1, lo], [x1, hi], [x0, hi]], { fill: 'rgba(217,72,15,0.35)', stroke: '#d9480f', width: 1 }, true);
      });
    }
    var res = U.res[U.side];
    if (res) {
      var st = res.passes.filter(function (p) { return p.kind === 'stringer'; })[0];
      if (st) v.poly(st.pts.map(function (q) { return [q[0], q[2]]; }), { stroke: '#d9480f', width: 1.2 });
    }
    drawSimSide(v);
    var c2 = v.ctx; c2.font = '12px system-ui, sans-serif'; c2.fillStyle = '#6b7a88'; c2.textAlign = 'right';
    if (v.exag > 1.01) c2.fillText(TS.t('vexag') + v.exag, v.w - 10, 18);
  }
  function redraw() { if (U.vTop && document.body.getAttribute('data-tab') === 'cnc') { U.vTop.redraw(); U.vSide.redraw(); } }

  function save(side) {
    var res = U.res[side]; if (!res) return;
    var b = TS.state.board, ms = TS.state.model.measures();
    var name = b.fileName.replace(/\.s3dx$/i, '');
    var g = TS.cncGcode(res, U.s, { name: name, desc: fmt(ms.lengthDev, 2) + ' x ' + fmt(ms.width, 2) + ' x ' + fmt(ms.thick, 2) });
    var bytes = new Uint8Array(g.length);
    for (var i = 0; i < g.length; i++) { var c = g.charCodeAt(i); bytes[i] = c < 256 ? c : 63; }
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
    a.download = name + (side === 'deck' ? '_deck' : '_bot') + '.dnc';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    TS.lastGcode = g;
  }

  TS.cncUI = {
    init: function () {
      buildForm();
      U.vTop = new TS.View2D($('cCncTop'), {
        bounds: function () { return U.s ? [-20, U.s.Yc - 340, 2050, U.s.Yc + 340] : null; }, draw: drawTop,
        onMove: function (x, y) { $('coords').textContent = 'X ' + fmt(x, 1) + '  Y ' + fmt(y, 1); }
      });
      U.vSide = new TS.View2D($('cCncSide'), {
        bounds: function () { return U.s ? [-20, -5, 2050, U.s.Tb + 25] : null; }, draw: drawSide, exag: 3,
        onMove: function (x, z) { $('coords').textContent = 'X ' + fmt(x, 1) + '  Z ' + fmt(z, 1); }
      });
      $('cCalc').addEventListener('click', compute);
      $('cSaveDeck').addEventListener('click', function () { save('deck'); });
      $('cSaveBot').addEventListener('click', function () { save('bot'); });
      var sb = document.querySelectorAll('.cncside button');
      for (var i = 0; i < sb.length; i++) sb[i].addEventListener('click', function (e) {
        U.side = e.currentTarget.getAttribute('data-s');
        for (var j = 0; j < sb.length; j++) sb[j].classList.toggle('on', sb[j] === e.currentTarget);
        U.vTop.fitted = U.vSide.fitted = false; simStop(); buildSim(); redraw();
      });
      $('cSimPlay').addEventListener('click', function () {
        var S = U.sim; if (!S) return;
        if (S.playing) { simStop(); simUI(); return; }
        if (S.pos >= S.total) S.pos = 0;
        S.playing = true; S.ts = 0; U.raf = requestAnimationFrame(simTick); simUI();
      });
      $('cSimPos').addEventListener('input', function () { var S = U.sim; if (!S) return; S.pos = S.total * $('cSimPos').value / 1000; simUI(); redraw(); });
      $('cSheet').addEventListener('click', function () { TS.printPages(machineSheet(), true, 'A4'); });
      window.addEventListener('resize', function () { if (U.vTop) { U.vTop.fitted = U.vSide.fitted = false; redraw(); } });
    },
    // новая доска — настройки из файла; правка формы доски — только сброс расчёта
    onBoard: function (edited) {
      if (!TS.state.model) return;
      if (!edited || !U.s) U.s = TS.cncDefaults(TS.state.board, TS.state.model);
      else TS.cncCenterKeep(U.s, TS.state.model);
      fillForm(); invalidate();
    },
    show: function () { U.vTop.fitted = U.vSide.fitted = false; renderInfo(); redraw(); },
    lang: function () { buildForm(); if (U.s) fillForm(); renderInfo(); redraw(); },
    state: U
  };
})(window.TS = window.TS || {});
