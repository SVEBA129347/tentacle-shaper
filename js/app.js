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

  // рисуем полигон точек и касательных правимой кривой; sign — зеркало (низ контура)
  function drawHandles(v, key, sign) {
    if (!key || !st.ed) return;
    sign = sign || 1;
    var hs = st.ed.handles(key), sel = st.ed.sel;
    var ctx = v.ctx;
    hs.forEach(function (h) {
      if (h.kind === 'P') return;
      v.poly([[h.pu * 10, sign * h.pv * 10], [h.u * 10, sign * h.v * 10]], { stroke: '#b5a99a', width: 1 });
    });
    hs.forEach(function (h) {
      var isSel = sel && sel.key === h.key && sel.i === h.i && sel.kind === h.kind;
      var p = v.toScreen(h.u * 10, sign * h.v * 10);
      ctx.beginPath();
      if (h.kind === 'P') { ctx.rect(p[0] - 4.5, p[1] - 4.5, 9, 9); ctx.fillStyle = isSel ? C.sel : '#fff'; ctx.fill();
        ctx.lineWidth = 1.6; ctx.strokeStyle = isSel ? C.sel : C.h; ctx.stroke(); }
      else { ctx.arc(p[0], p[1], isSel ? 4.5 : 3.2, 0, 2 * Math.PI); ctx.fillStyle = isSel ? C.sel : C.h; ctx.fill(); }
    });
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
    drawHandles(v, 'otl', 1);
  }

  // ---------- вид сбоку ----------
  function drawSide(ctx, v) {
    var g = st.geo; v.grid(); if (!g) return;
    if (st.sideMode === 'thick' && g.thick) {
      var area = [[0, 0]].concat(g.thick, [[g.S, 0]]);
      v.poly(area, { fill: C.fill }, true);
      v.poly(g.thick, { stroke: C.line, width: 1.8 });
      v.poly([[0, 0], [g.S, 0]], { stroke: '#9aa7b2', width: 1 });
      drawHandles(v, 'thick', 1);
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
      drawHandles(v, 'bot', 1);
      drawHandles(v, 'deck', 1);
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
    if (k >= 0) drawHandles(v, 'slice:' + k, 1);
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
    var key = editKey(view); if (!key) return null;
    var keys = [].concat(key), hs = [];
    keys.forEach(function (k) { hs = hs.concat(st.ed.handles(k)); });
    var best = null, bd = HIT;
    var signs = key === 'otl' ? [1, -1] : [1];
    [true, false].forEach(function (wantP) {
      if (best) return;
      signs.forEach(function (sg) {
        hs.forEach(function (h) {
          if ((h.kind === 'P') !== wantP) return;
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
    if (!h) return false;
    st.ed.sel = { key: h.key, i: h.i, kind: h.kind };
    st.ed.begin();
    st.drag = { sign: h.sign, changed: false }; st.lastSign = h.sign;
    showSel(); redraw2d();
    return true;
  }
  function onDrag(wx, wy, e) {
    var s = st.ed.sel; if (!s || !st.drag) return;
    var u = wx / 10, v = st.drag.sign * wy / 10;
    st.ed.move(s.key, s.i, s.kind, u, v, e.altKey);
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
    var s = st.ed && st.ed.sel; if (!s || s.kind !== 'P') return;
    st.ed.begin();
    if (st.ed.deletePoint(s.key, s.i)) { st.ed.sel = null; heavy(); } else st.ed.undo.pop();
  }
  function setPtType(t) {
    var s = st.ed && st.ed.sel; if (!s) return;
    st.ed.begin(); st.ed.setType(s.key, s.i, t); heavy();
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
    var v = st.ed.value(s);
    st.ed.begin(); st.ed.move(s.key, s.i, s.kind, v[0] + du, v[1] + dv, false); heavy();
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
      st.ed = new TS.Editor(b, st.model.apexIdx);
      buildGeo();
      document.body.classList.add('loaded');
      $('thickBtn').disabled = !b.thickDiff;
      if (!b.thickDiff) setSideMode('rocker');
      $('secRange').max = st.model.L; $('secRange').step = 0.05;
      vTop.fitted = vSide.fitted = vSlice.fitted = false;
      sideBoundsMode();
      setSecX(st.model.sliceX[2] !== undefined ? st.model.sliceX[2] : st.model.L / 2);
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
      draw: drawTop, onClick: function (x) { setSecX(x / 10); }, onMove: status.bind('Y'),
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
        $('coords').textContent = (t ? 'S ' : 'X ') + fmt(x) + '  ' + (t ? 'T ' : 'Z ') + fmt(y);
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
      if (k === 'Escape') { st.ed.sel = null; showSel(); redraw2d(); return; }
      if ((k === 'Delete' || k === 'Backspace') && st.ed.sel) { e.preventDefault(); delSelected(); return; }
      var step = (e.shiftKey ? 1 : 0.1) / 10, d = null;   // 0.1 мм, с Shift — 1 мм
      if (k === 'ArrowLeft') d = [-step, 0]; else if (k === 'ArrowRight') d = [step, 0];
      else if (k === 'ArrowUp') d = [0, step]; else if (k === 'ArrowDown') d = [0, -step];
      if (d && st.ed.sel) {
        e.preventDefault();
        if (st.ed.sel.key === 'otl' && st.drag === null && st.lastSign === -1) d[1] = -d[1];
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
