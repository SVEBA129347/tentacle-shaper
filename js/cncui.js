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
    ['cncFeed', [['feed', 'cFeed', 100], ['feedHead', 'cFeedHead', 100], ['safeZ', 'cSafeZ', 1]]]
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
      if (g[0] === 'cncLines') h += '<label class="chk"><input data-k="stringer" type="checkbox"> <span data-i18n="cStringer">' + TS.t('cStringer') + '</span></label>' +
        '<label class="chk"><input data-k="endCut" type="checkbox"> <span data-i18n="cEndCut">' + TS.t('cEndCut') + '</span></label>';
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

  function invalidate() { U.res = { deck: null, bot: null }; U.stale = true; renderInfo(); redraw(); }

  function compute() {
    var m = TS.state.model; if (!m) return;
    var t0 = Date.now();
    U.res.deck = TS.cncSide(m, U.s, 'deck');
    U.res.bot = TS.cncSide(m, U.s, 'bot');
    U.ms = Date.now() - t0; U.stale = false;
    renderInfo(); redraw();
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
        var st = stats(U.res[side]);
        h += '<div class="cstat"><b>' + TS.t(side === 'deck' ? 'cDeck' : 'cBot') + '</b>: ' + st.lines + ' ' + TS.t('cPasses') + ', ' +
          st.n + ' ' + TS.t('cPoints') + ', ' + fmt(st.len / 1000, 1) + ' ' + TS.t('cMeters') + ' ≈ ' + fmt(st.len / s.feed, 0) + ' ' + TS.t('cMin') +
          '<br>X ' + fmt(st.minX, 0) + '…' + fmt(st.maxX, 0) + ', Y ' + fmt(st.minY, 0) + '…' + fmt(st.maxY, 0) + ', Z ' + fmt(st.minZ, 1) + '…' + fmt(st.maxZ, 1) + '</div>';
      });
    } else h += '<div class="cstat muted">' + TS.t('cNotYet') + '</div>';
    $('cncInfo').innerHTML = h;
    $('cSaveDeck').disabled = $('cSaveBot').disabled = U.stale;
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
        U.vTop.fitted = U.vSide.fitted = false; redraw();
      });
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
