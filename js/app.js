/* Tentacle Shaper — страница: открытие файла, виды, размеры. GPL v3. */
(function (TS) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var st = { board: null, model: null, secX: 0, geo: null };
  var C = { line: '#1d2b36', fill: 'rgba(240,236,226,0.9)', slice: '#d9480f', cur: '#1971c2',
            pt: '#7a8a99', apex: '#1971c2', rail: '#2f9e44' };

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
    st.geo = {
      outline: outline, side: deck.concat(bot.slice().reverse()), bot: bot, deck: deck,
      lines: m.pointLines(240), L: m.L * 10, minZ: minZ, maxZ: maxZ, maxY: maxY
    };
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
  }

  // ---------- вид сбоку ----------
  function drawSide(ctx, v) {
    var g = st.geo; v.grid(); if (!g) return;
    v.poly(g.side, { fill: C.fill, stroke: C.line, width: 1.8 }, true);
    var a = g.lines[st.model.apexIdx];
    if (a) v.poly(a.side, { stroke: C.apex, width: 1.4 });
    if (g.lines[1]) v.poly(g.lines[1].side, { stroke: C.rail, width: 1, dash: [4, 3] });
    st.model.sliceX.forEach(function (x) {
      v.poly([[x * 10, st.model.zb(x) * 10], [x * 10, st.model.zd(x) * 10]], { stroke: C.slice, width: 1.3 });
    });
    var cx = st.secX * 10;
    v.poly([[cx, st.model.zb(st.secX) * 10 - 8], [cx, st.model.zd(st.secX) * 10 + 8]], { stroke: C.cur, width: 2 });
    var ctxv = v.ctx; ctxv.font = '12px system-ui, sans-serif'; ctxv.fillStyle = '#6b7a88'; ctxv.textAlign = 'right';
    if (v.exag > 1.01) ctxv.fillText(TS.t('vexag') + fmt(v.exag, 0), v.w - 10, 18);
  }

  // ---------- сечение ----------
  function drawSlice(ctx, v) {
    v.grid(); if (!st.model) return;
    var m = st.model, x = st.secX;
    var h = m.section(x, 40).map(function (p) { return [p[0] * 10, p[1] * 10]; });
    var full = h.concat(h.slice(0, -1).reverse().map(function (p) { return [-p[0], p[1]]; }));
    v.poly(full, { fill: C.fill, stroke: C.line, width: 1.8 }, true);
    var c = m.sectionCtrl(x);
    for (var i = 0; i < m.nPts; i++) {
      var p = [c.P[i][0] * 10, c.P[i][1] * 10];
      if (i > 0) v.poly([p, [c.T1[i][0] * 10, c.T1[i][1] * 10]], { stroke: '#adb5bd', width: 1 });
      if (i < m.nPts - 1) v.poly([p, [c.T2[i][0] * 10, c.T2[i][1] * 10]], { stroke: '#adb5bd', width: 1 });
    }
    for (var k = 0; k < m.nPts; k++) {
      if (k > 0) v.dot(c.T1[k][0] * 10, c.T1[k][1] * 10, 2.2, '#868e96');
      if (k < m.nPts - 1) v.dot(c.T2[k][0] * 10, c.T2[k][1] * 10, 2.2, '#868e96');
      v.dot(c.P[k][0] * 10, c.P[k][1] * 10, 3.5, k === m.apexIdx ? C.apex : C.line, true);
    }
    var w = m.halfW(x) * 20, t = (m.zd(x) - m.zb(x)) * 10;
    var ctxv = v.ctx; ctxv.font = '13px system-ui, sans-serif'; ctxv.fillStyle = '#1d2b36'; ctxv.textAlign = 'left';
    ctxv.fillText(TS.t('sliceAt') + ' ' + fmt(x * 10) + ' ' + TS.t('mm') + ' ' + TS.t('fromTailShort'), 10, 20);
    ctxv.fillStyle = '#6b7a88';
    ctxv.fillText(TS.t('width') + ' ' + fmt(w) + ' · ' + TS.t('thick') + ' ' + fmt(t) + ' ' + TS.t('mm'), 10, 38);
  }

  // ---------- панель размеров ----------
  function renderDims() {
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
    if (isFinite(b.info.Volume)) h += tr('', fmt(b.info.Volume / 10, 2) + ' ' + TS.t('l'), TS.t('volFile'));
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
    vSlice.fitted = false;
    redraw2d();
  }
  function redraw2d() { vTop.redraw(); vSide.redraw(); vSlice.redraw(); }

  function loadBuffer(buf, name) {
    try {
      var b = TS.parseS3dx(buf, name);
      st.board = b; st.model = new TS.Model(b); st.ms = null; st.vol = null; st.viewed3d = false;
      buildGeo();
      document.body.classList.add('loaded');
      $('secRange').max = st.model.L; $('secRange').step = 0.05;
      vTop.fitted = vSide.fitted = vSlice.fitted = false;
      // растяжение вида сбоку, если доска очень плоская на экране
      var ratio = (st.geo.L) / ((st.geo.maxZ - st.geo.minZ) || 1);
      vSide.exag = ratio > 12 ? 2 : 1;
      setSecX(st.model.sliceX[2] !== undefined ? st.model.sliceX[2] : st.model.L / 2);
      renderDims();
      v3.setModel(st.model);
      document.title = b.fileName.replace(/\.s3dx$/i, '') + ' — Tentacle Shaper';
      $('msg').textContent = '';
    } catch (e) {
      console.error(e);
      $('msg').textContent = TS.t('err') + ': ' + e.message;
    }
  }
  function openFile(f) {
    if (!f) return;
    var r = new FileReader();
    r.onload = function () { loadBuffer(r.result, f.name); };
    r.readAsArrayBuffer(f);
  }
  TS.loadBuffer = loadBuffer;   // для проверок

  function setTab(t) {
    document.body.setAttribute('data-tab', t);
    var b = document.querySelectorAll('.tab');
    for (var i = 0; i < b.length; i++) b[i].classList.toggle('on', b[i].getAttribute('data-tab') === t);
    if (t === 'design') { vTop.fitted = vSide.fitted = vSlice.fitted = false; redraw2d(); }
    if (t === '3d' && st.model && !st.viewed3d) { st.viewed3d = true; v3.resetView(); }
  }

  function init() {
    TS.applyI18n();
    var status = function (x, y) { $('coords').textContent = 'X ' + fmt(x) + '  ' + (this || 'Y') + ' ' + fmt(y); };
    vTop = new TS.View2D($('cTop'), {
      bounds: function () { var g = st.geo; return g && [0, -g.maxY, g.L, g.maxY]; },
      draw: drawTop, onClick: function (x) { setSecX(x / 10); }, onMove: status.bind('Y')
    });
    vSide = new TS.View2D($('cSide'), {
      bounds: function () { var g = st.geo; return g && [0, g.minZ, g.L, g.maxZ]; },
      draw: drawSide, onClick: function (x) { setSecX(x / 10); }, onMove: status.bind('Z')
    });
    vSlice = new TS.View2D($('cSlice'), {
      bounds: function () {
        if (!st.model) return null;
        var m = st.model, x = st.secX, w = Math.max(m.halfW(x) * 10, 30);
        return [-w, m.zb(x) * 10 - 5, w, m.zd(x) * 10 + 5];
      },
      draw: drawSlice, onMove: function (y, z) { $('coords').textContent = 'Y ' + fmt(y) + '  Z ' + fmt(z); }
    });
    v3 = new TS.View3D($('v3d'));

    $('file').addEventListener('change', function (e) { openFile(e.target.files[0]); e.target.value = ''; });
    $('openBtn').addEventListener('click', function () { $('file').click(); });
    $('secRange').addEventListener('input', function (e) { setSecX(parseFloat(e.target.value)); });
    $('sliceList').addEventListener('click', function (e) {
      var x = e.target.getAttribute && e.target.getAttribute('data-x'); if (x !== null) setSecX(parseFloat(x));
    });
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) tabs[i].addEventListener('click', function (e) { setTab(e.currentTarget.getAttribute('data-tab')); });
    $('wire').addEventListener('change', function (e) { v3.setWire(e.target.checked); });
    $('reset3d').addEventListener('click', function () { v3.resetView(); });
    var lb = document.querySelectorAll('.lang button');
    for (var j = 0; j < lb.length; j++) lb[j].addEventListener('click', function (e) {
      TS.setLang(e.currentTarget.getAttribute('data-l')); markLang();
      if (st.model) { renderDims(); setSecX(st.secX); }
    });
    markLang();

    document.addEventListener('dragover', function (e) { e.preventDefault(); document.body.classList.add('drag'); });
    document.addEventListener('dragleave', function (e) { if (!e.relatedTarget) document.body.classList.remove('drag'); });
    document.addEventListener('drop', function (e) {
      e.preventDefault(); document.body.classList.remove('drag');
      openFile(e.dataTransfer.files[0]);
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
