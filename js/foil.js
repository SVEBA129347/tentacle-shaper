/* Tentacle Shaper — страница «Фойл»: крыло подводного крыла (фойла), профиль NACA 4 цифры,
 * стабилизатор и мачта. Подъёмная сила — теория крыла конечного размаха (наклон по Хельмбольду,
 * угол нулевой подъёмной силы — по тонкому профилю); сопротивление — трение ITTC с поправкой на
 * толщину + индуктивное CL²/(π e AR). Это учебная оценка (±15–25 %), удобная для сравнения крыльев.
 * Ссылка: …/#foil. Внутри — СИ. GPL v3. */
(function (TS) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var NU = 1.05e-6, G = 9.81;
  function f(v, d) { return isFinite(v) ? (+v).toFixed(d === undefined ? 1 : d) : '—'; }
  function cfITTC(re) { return re > 1e3 ? 0.075 / Math.pow(Math.log(re) / Math.LN10 - 2, 2) : 0.01; }

  // образцы — условные, не копии чьих-то крыльев
  var PRESETS = {
    surf: { span: 800, cr: 200, ct: 70, sweep: 40, naca: '2412' },
    wake: { span: 600, cr: 180, ct: 60, sweep: 30, naca: '4412' },
    pump: { span: 1000, cr: 150, ct: 50, sweep: 50, naca: '2412' },
    big:  { span: 900, cr: 260, ct: 90, sweep: 40, naca: '4412' }
  };
  var P = { preset: 'surf', span: 800, cr: 200, ct: 70, sweep: 40, naca: '2412', mass: 80, board: 6, kmh: 18,
            stab: 200, mastDepth: 500, mastChord: 120, mastT: 13, sea: false, clmax: 1.2 };

  // ---------- профиль NACA 4 цифры ----------
  function naca(code) {
    var c = String(code).replace(/\D/g, ''); if (c.length !== 4) c = '2412';
    return { m: +c[0] / 100, p: +c[1] / 10, t: +c.slice(2) / 100 };
  }
  function camber(n, x) {
    if (!n.m || !n.p) return { yc: 0, dy: 0 };
    if (x < n.p) return { yc: n.m / (n.p * n.p) * (2 * n.p * x - x * x), dy: 2 * n.m / (n.p * n.p) * (n.p - x) };
    return { yc: n.m / ((1 - n.p) * (1 - n.p)) * (1 - 2 * n.p + 2 * n.p * x - x * x), dy: 2 * n.m / ((1 - n.p) * (1 - n.p)) * (n.p - x) };
  }
  function profile(n, N) {
    N = N || 60; var up = [], lo = [];
    for (var i = 0; i <= N; i++) {
      var b = Math.PI * i / N, x = (1 - Math.cos(b)) / 2;
      var yt = 5 * n.t * (0.2969 * Math.sqrt(x) - 0.1260 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1036 * x * x * x * x);
      var c = camber(n, x), th = Math.atan(c.dy);
      up.push([x - yt * Math.sin(th), c.yc + yt * Math.cos(th)]); lo.push([x + yt * Math.sin(th), c.yc - yt * Math.cos(th)]);
    }
    return up.slice().reverse().concat(lo.slice(1));          // от задней кромки по верху к передней и по низу назад
  }
  // угол нулевой подъёмной силы тонкого профиля, рад
  function alpha0(n) {
    var s = 0, N = 400;
    for (var i = 0; i < N; i++) { var th = Math.PI * (i + 0.5) / N, x = (1 - Math.cos(th)) / 2; s += camber(n, x).dy * (Math.cos(th) - 1) * Math.PI / N; }
    return -s / Math.PI;
  }

  // ---------- расчёт ----------
  function wing() {
    // хорда по размаху — плавно убывает от корня к концу (как у настоящих крыльев); площадь и САХ — по ней же
    var b = P.span / 1000, cr = P.cr / 1000, ct = P.ct / 1000, tap = ct / cr, S = 0, S2 = 0, N = 200;
    for (var i = 0; i < N; i++) { var c = chordAt((i + 0.5) / N) / 1000; S += c * b / N; S2 += c * c * b / N; }
    var AR = b * b / S, mac = S2 / S;
    var swHalf = Math.atan((P.sweep / 1000 + (ct - cr) / 2) / (b / 2));      // стреловидность по середине хорды
    var a = 2 * Math.PI * AR / (2 + Math.sqrt(AR * AR * (1 + Math.pow(Math.tan(swHalf), 2)) + 4));
    var n = naca(P.naca), e = 0.92 - 0.1 * Math.abs(tap - 0.35);           // Освальд: лучше всего около сужения 0.35
    return { b: b, S: S, AR: AR, mac: mac, a: a, a0: alpha0(n), n: n, e: e, tap: tap };
  }
  function at(w, V) {
    var rho = P.sea ? 1025 : 1000, q = 0.5 * rho * V * V, W = (P.mass + P.board) * G;
    var CL = W / (q * w.S), alpha = CL / w.a + w.a0;
    var form = function (t) { return 1 + 2 * t + 60 * Math.pow(t, 4); };
    var Dw = q * w.S * (2 * cfITTC(V * w.mac / NU) * form(w.n.t) + CL * CL / (Math.PI * w.e * w.AR));
    var Ss = P.stab / 1e4, cs = Math.sqrt(Ss / 4);                                  // стабилизатор: удлинение ≈ 4
    var Ds = q * Ss * 2 * cfITTC(V * cs / NU) * form(0.1);
    var Sm = P.mastDepth / 1000 * P.mastChord / 1000;
    var Dm = q * Sm * 2 * cfITTC(V * P.mastChord / 1000 / NU) * form(P.mastT / 100);
    var D = Dw + Ds + Dm;
    return { V: V, CL: CL, alpha: alpha, W: W, Dw: Dw, Ds: Ds, Dm: Dm, D: D, LD: W / D, P: D * V, stall: CL > P.clmax };
  }
  function speeds(w) {
    var rho = P.sea ? 1025 : 1000, W = (P.mass + P.board) * G;
    function vAt(cl) { return Math.sqrt(2 * W / (rho * w.S * cl)); }
    var best = null;
    for (var k = 5; k <= 45; k += 0.25) { var r = at(w, k / 3.6); if (!r.stall && (!best || r.D < best.D)) best = r; }
    return { stall: vAt(P.clmax) * 3.6, takeoff: vAt(0.9) * 3.6, best: best };
  }

  // хорда (мм) на доле полуразмаха u: плавно убывает от корня к концу
  function chordAt(u) { return P.ct + (P.cr - P.ct) * (1 - Math.pow(Math.min(1, u), 1.5)); }

  // ---------- рисунки: план крыла и профиль ----------
  function planform(w) {
    var b = P.span, cr = P.cr, ct = P.ct, sw = P.sweep, half = b / 2, pts = [], N = 40, i;
    // передняя кромка: от корня (0) к концу (sweep), задняя — от cr к sweep+ct; концы скруглены
    function le(y) { var u = y / half; return sw * Math.pow(u, 1.6); }
    function ch(y) { var u = y / half; return chordAt(u) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, u - 0.9) / 0.1, 2))); }
    for (i = 0; i <= N; i++) { var y = half * i / N; pts.push([y, le(y)]); }
    for (i = N; i >= 0; i--) { var y2 = half * i / N, c = ch(y2); pts.push([y2, le(y2) + Math.max(c, i === N ? 0 : 1)]); }
    return pts;   // половина: [y (размах), x (по потоку)], мм
  }
  function drawSvg(w) {
    var half = planform(w), Wd = 640, Hd = 250, pad = 24;
    var b = P.span, xmax = 0; half.forEach(function (p) { xmax = Math.max(xmax, p[1]); });
    var sc = Math.min((Wd - 2 * pad) / b, (Hd - 2 * pad - 40) / (xmax + 10)), cx = Wd / 2, y0 = pad + 30;
    function pt(p, sg) { return (cx + sg * p[0] * sc).toFixed(1) + ',' + (y0 + p[1] * sc).toFixed(1); }
    var full = half.map(function (p) { return pt(p, 1); }).concat(half.slice().reverse().map(function (p) { return pt(p, -1); }));
    var s = '<svg viewBox="0 0 ' + Wd + ' ' + Hd + '" class="foil-svg">';
    s += '<text x="' + pad + '" y="' + (pad + 4) + '" class="cap">' + TS.t('foPlan') + ' · ' + f(w.S * 1e4, 0) + ' ' + TS.t('hyCm2') + ' · AR ' + f(w.AR, 1) + '</text>';
    s += '<polygon points="' + full.join(' ') + '" fill="#f2e400" stroke="#000" stroke-width="2" stroke-linejoin="round"/>';
    s += '<rect x="' + (cx - 7) + '" y="' + (y0 + P.cr * sc * 0.25 - 4) + '" width="14" height="' + (P.mastChord * sc) + '" fill="#000" opacity=".35"/>';
    s += '<line x1="' + (cx - b / 2 * sc) + '" x2="' + (cx + b / 2 * sc) + '" y1="' + (y0 + xmax * sc + 22) + '" y2="' + (y0 + xmax * sc + 22) + '" stroke="#6b6b63"/>';
    s += '<text x="' + cx + '" y="' + (y0 + xmax * sc + 38) + '" text-anchor="middle" class="cap">' + TS.t('foSpan') + ' ' + P.span + ' ' + TS.t('mm') + '</text>';
    // профиль
    var pr = profile(w.n, 70), sx = Wd - 2 * pad;
    s += '</svg><svg viewBox="0 0 ' + Wd + ' 150" class="foil-svg">';
    s += '<text x="' + pad + '" y="20" class="cap">' + TS.t('foProfile') + ' NACA ' + P.naca + ' · ' + TS.t('foRoot') + ' ' + P.cr + ' ' + TS.t('mm') + ' · ' + TS.t('foThick') + ' ' + f(w.n.t * P.cr, 1) + ' ' + TS.t('mm') + '</text>';
    s += '<line x1="' + pad + '" x2="' + (Wd - pad) + '" y1="88" y2="88" stroke="#d9d9d1" stroke-dasharray="4 3"/>';
    s += '<polygon points="' + pr.map(function (p) { return (pad + p[0] * sx).toFixed(1) + ',' + (88 - p[1] * sx).toFixed(1); }).join(' ') + '" fill="#161616"/>';
    s += '</svg>';
    return s;
  }

  // ---------- график: сопротивление в полёте ----------
  function chart(w, sp) {
    var Wd = 640, Hd = 220, x0 = 46, y0 = 16, cw = Wd - 64, ch = Hd - 48, pts = [], ymax = 0;
    for (var k = 8; k <= 40; k += 0.5) { var r = at(w, k / 3.6); if (!r.stall) { pts.push([k, r.D]); ymax = Math.max(ymax, Math.min(r.D, 400)); } }
    ymax = Math.ceil(ymax / 20) * 20 || 100;
    function X(k) { return x0 + (k - 8) / 32 * cw; } function Y(v) { return y0 + ch - Math.min(v, ymax) / ymax * ch; }
    var s = '<svg viewBox="0 0 ' + Wd + ' ' + Hd + '" class="foil-svg chart">';
    s += '<text x="' + x0 + '" y="12" class="cap">' + TS.t('foDragT') + ', ' + TS.t('hyN') + '</text>';
    for (var v = 0; v <= ymax; v += ymax / 5) s += '<line x1="' + x0 + '" x2="' + (x0 + cw) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e4e4dd"/><text x="' + (x0 - 6) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + f(v, 0) + '</text>';
    for (var kk = 10; kk <= 40; kk += 5) s += '<text x="' + X(kk) + '" y="' + (y0 + ch + 16) + '" text-anchor="middle">' + kk + '</text>';
    s += '<rect x="' + x0 + '" y="' + y0 + '" width="' + Math.max(0, X(Math.min(40, sp.stall)) - x0) + '" height="' + ch + '" fill="#e6e6df"/>';
    s += '<text x="' + (x0 + 6) + '" y="' + (y0 + ch - 8) + '" class="cap">' + TS.t('foStallZone') + '</text>';
    s += '<polyline fill="none" stroke="#000" stroke-width="2.5" points="' + pts.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"/>';
    [[sp.takeoff, TS.t('foTakeoff')], [sp.best.V * 3.6, TS.t('foBest')]].forEach(function (m, i) {
      if (m[0] > 40) return;
      s += '<line x1="' + X(m[0]) + '" x2="' + X(m[0]) + '" y1="' + y0 + '" y2="' + (y0 + ch) + '" stroke="' + (i ? '#2f9e44' : '#d4c600') + '" stroke-width="2"/>';
      s += '<text x="' + (X(m[0]) + 5) + '" y="' + (y0 + 14 + i * 16) + '" class="cap">' + m[1] + ' ' + f(m[0], 0) + '</text>';
    });
    s += '<line x1="' + X(P.kmh) + '" x2="' + X(P.kmh) + '" y1="' + y0 + '" y2="' + (y0 + ch) + '" stroke="#000" stroke-dasharray="3 3"/>';
    s += '<text x="' + (x0 + cw) + '" y="' + (Hd - 4) + '" text-anchor="end">' + TS.t('hyKmhU') + '</text></svg>';
    return s;
  }

  // ---------- DXF: план крыла и профиль корня (мм) ----------
  function dxf(w) {
    var half = planform(w), full = half.concat(half.slice().reverse().map(function (p) { return [-p[0], p[1]]; }));
    var pr = profile(w.n, 120).map(function (p) { return [p[0] * P.cr, p[1] * P.cr - (P.cr + 60)]; });
    // POLYLINE + VERTEX (формат R12) — открывается любой программой и станком
    function poly(pts, layer) {
      var o = ['0', 'POLYLINE', '8', layer, '66', '1', '70', '1', '10', '0', '20', '0', '30', '0'];
      pts.forEach(function (p) { o.push('0', 'VERTEX', '8', layer, '10', p[0].toFixed(3), '20', (-p[1]).toFixed(3), '30', '0'); });
      o.push('0', 'SEQEND', '8', layer);
      return o.join('\r\n');
    }
    return ['0', 'SECTION', '2', 'ENTITIES', poly(full.map(function (p) { return [p[0], p[1]]; }), 'PLAN'), poly(pr.map(function (p) { return [p[0], -p[1]]; }), 'PROFILE'), '0', 'ENDSEC', '0', 'EOF'].join('\r\n') + '\r\n';
  }

  // ---------- страница ----------
  var FIELDS = [
    ['foWing', [['span', 'foSpanL', 10], ['cr', 'foCr', 5], ['ct', 'foCt', 5], ['sweep', 'foSweep', 5], ['naca', 'foNaca', 0]]],
    ['foRest', [['stab', 'foStab', 10], ['mastDepth', 'foMastD', 10], ['mastChord', 'foMastC', 5], ['mastT', 'foMastT', 0.5]]],
    ['foRider', [['mass', 'hyMass', 1], ['board', 'hyBoardM', 0.5], ['kmh', 'hyKmh', 0.5]]]
  ];
  function render() {
    var el = $('foilPage'); if (!el) return;
    var h = '<div class="fin-wrap foil-wrap">' +
      '<div class="fin-head"><img src="img/badge.svg" alt="" class="fin-badge"><div><h1>' + TS.t('foTitle') + '</h1><p class="lead">' + TS.t('foLead') + '</p></div></div>' +
      '<div class="foil-grid"><div class="foil-main"><div id="foDraw"></div><div id="foChart"></div></div>' +
      '<div class="foil-side"><div class="foil-presets"><span>' + TS.t('foPreset') + '</span>' +
      Object.keys(PRESETS).map(function (k) { return '<button data-pre="' + k + '"' + (P.preset === k ? ' class="on"' : '') + '>' + TS.t('foP_' + k) + '</button>'; }).join('') + '</div>' +
      '<div id="foOut"></div><div id="foForm"></div>' +
      '<label class="chk"><input id="foSea" type="checkbox"' + (P.sea ? ' checked' : '') + '> ' + TS.t('foSea') + '</label>' +
      '<div class="fin-btns"><button id="foDxf">' + TS.t('foDxf') + '</button><button id="foCopy">' + TS.t('finCopy') + '</button></div>' +
      '<p class="small">' + TS.t('foNote') + '</p></div></div></div>';
    el.innerHTML = h;
    var fh = '';
    FIELDS.forEach(function (g) {
      fh += '<h3>' + TS.t(g[0]) + '</h3><div class="form">';
      g[1].forEach(function (x) { fh += '<label><span>' + TS.t(x[1]) + '</span><input data-fo="' + x[0] + '"' + (x[0] === 'naca' ? ' maxlength="4" inputmode="numeric"' : ' type="number" step="' + x[2] + '"') + ' value="' + P[x[0]] + '"></label>'; });
      fh += '</div>';
    });
    $('foForm').innerHTML = fh;
    var ins = $('foForm').querySelectorAll('input');
    for (var i = 0; i < ins.length; i++) ins[i].addEventListener('input', function (e) {
      var k = e.target.getAttribute('data-fo'), v = e.target.value;
      if (k === 'naca') { if (/^\d{4}$/.test(v)) P.naca = v; else return; }
      else { v = parseFloat(String(v).replace(',', '.')); if (!isFinite(v) || v <= 0) return; P[k] = v; }
      if (k !== 'mass' && k !== 'board' && k !== 'kmh') { P.preset = ''; marks(); }
      update();
    });
    var pb = el.querySelectorAll('[data-pre]');
    for (var j = 0; j < pb.length; j++) pb[j].addEventListener('click', function (e) {
      var k = e.currentTarget.getAttribute('data-pre'); Object.assign(P, PRESETS[k]); P.preset = k; render();
    });
    $('foSea').addEventListener('change', function (e) { P.sea = e.target.checked; update(); });
    $('foDxf').addEventListener('click', function () {
      var a = document.createElement('a'), w = wing();
      a.href = URL.createObjectURL(new Blob([dxf(w)], { type: 'application/dxf' }));
      a.download = 'foil_' + P.span + '_' + P.cr + '_NACA' + P.naca + '.dxf'; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
    $('foCopy').addEventListener('click', function () {
      var url = location.href.split('#')[0] + '#foil';
      try { navigator.clipboard.writeText(url); this.textContent = TS.t('finCopied'); } catch (e) { prompt('', url); }
    });
    update();
  }
  function marks() { var pb = document.querySelectorAll('#foilPage [data-pre]'); for (var j = 0; j < pb.length; j++) pb[j].classList.toggle('on', pb[j].getAttribute('data-pre') === P.preset); }
  function update() {
    var w = wing(), sp = speeds(w), r = at(w, P.kmh / 3.6);
    $('foDraw').innerHTML = drawSvg(w);
    $('foChart').innerHTML = chart(w, sp);
    var o = '<table class="kv">';
    function tr(k, v, n) { o += '<tr><td>' + k + '</td><td class="v">' + v + '</td><td class="n">' + (n || '') + '</td></tr>'; }
    tr(TS.t('foArea'), f(w.S * 1e4, 0) + ' ' + TS.t('hyCm2'), 'AR ' + f(w.AR, 1));
    tr(TS.t('foTakeoff'), f(sp.takeoff, 1) + ' ' + TS.t('hyKmhU'), TS.t('foTakeoffN'));
    tr(TS.t('foStall'), f(sp.stall, 1) + ' ' + TS.t('hyKmhU'), TS.t('foStallN'));
    tr(TS.t('foBest'), f(sp.best.V * 3.6, 1) + ' ' + TS.t('hyKmhU'), TS.t('foBestN') + ' ' + f(sp.best.D, 0) + ' ' + TS.t('hyN'));
    o += '<tr><td colspan="3"><b>' + f(P.kmh, 1) + ' ' + TS.t('hyKmhU') + ' · ' + f(r.W / G, 0) + ' ' + TS.t('hyKg') + '</b></td></tr>';
    if (r.stall) o += '<tr><td colspan="3" class="warnc">' + TS.t('foTooSlow') + '</td></tr>';
    else {
      tr(TS.t('foAlpha'), f(r.alpha * 180 / Math.PI, 1) + '°', 'CL ' + f(r.CL, 2));
      tr(TS.t('foDrag'), f(r.D, 0) + ' ' + TS.t('hyN'), TS.t('foDragN') + ' ' + f(r.Dw, 0) + ' / ' + f(r.Ds, 0) + ' / ' + f(r.Dm, 0));
      tr(TS.t('foLD'), f(r.LD, 1), '');
      tr(TS.t('hyPower'), f(r.P, 0) + ' ' + TS.t('hyW'), '');
    }
    $('foOut').innerHTML = o + '</table>';
  }
  TS.foil = { naca: naca, profile: profile, alpha0: alpha0, wing: function () { return wing(); }, at: function (V) { return at(wing(), V); }, P: P };
  TS.foilUI = { init: render, show: function () { if (!$('foDraw')) render(); }, lang: render };
})(window.TS = window.TS || {});
