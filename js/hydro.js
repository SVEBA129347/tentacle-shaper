/* Tentacle Shaper — вода: скольжение и сопротивление доски, плавники, насос в плавнике.
 * Доска: метод Савицкого (Savitsky 1964) для глиссирующих корпусов — подъёмная сила, центр давления,
 * трение по ITTC-57. Метод сделан для катеров (призматический корпус), для доски с рокером это
 * оценка ±15–20 %; для сравнения досок между собой — годится.
 * Плавник: трение по ITTC с поправкой на толщину профиля.
 * Насос в плавнике: трубка Вентури — Бернулли с потерями; разрежение в горле → присоска.
 * Внутри — СИ (м, Н, Па). GPL v3.
 */
(function (TS) {
  'use strict';
  var RHO = 1000, NU = 1.05e-6, G = 9.81, PATM = 101325, PVAP = 2340;

  function cfITTC(re) { return re > 1e3 ? 0.075 / Math.pow(Math.log(re) / Math.LN10 - 2, 2) : 0.01; }

  // ---------- геометрия доски для расчёта ----------
  function geom(model) {
    var L = model.L / 100, n = 120, xs = [], w = [], beta = [];
    for (var i = 0; i <= n; i++) {
      var xc = model.L * i / n;
      xs.push(xc / 100); w.push(model.halfW(xc) * 2 / 100);
      var sm = model.sliceMeasures(Math.max(0.5, Math.min(model.L - 0.5, xc)));
      var b = sm.rail > 1 ? Math.atan(Math.max(0, sm.V) / sm.rail) * 180 / Math.PI : 0;   // конкейв (V<0) не учитываем: β = 0
      beta.push(b);
    }
    // средняя ширина и килеватость на длине lw от хвоста
    function mean(arr, lw) {
      var s = 0, k = 0;
      for (var j = 0; j <= n; j++) if (xs[j] <= lw + 1e-9) { s += arr[j]; k++; }
      return k ? s / k : arr[0];
    }
    return { L: L, meanW: function (lw) { return mean(w, Math.max(0.05, Math.min(L, lw))); },
             meanB: function (lw) { return mean(beta, Math.max(0.05, Math.min(L, lw))); }, xs: xs, w: w };
  }

  // ---------- Савицкий: равновесие на скорости V (м/с) при весе W (Н) и центре тяжести lcg (м от хвоста) ----------
  function planing(g, V, W, lcg) {
    var q = 0.5 * RHO * V * V;
    function atTau(tau) {
      // по углу τ ищем смоченную длину λ (в ширинах), при которой подъёмная сила = весу
      var lo = 0.05, hi = 12, b, cv, beta, lam;
      function lift(l) {
        b = g.meanW(0.5); for (var it = 0; it < 6; it++) b = g.meanW(l * b);
        cv = V / Math.sqrt(G * b); beta = g.meanB(l * b);
        var cl0 = Math.pow(tau, 1.1) * (0.0120 * Math.sqrt(l) + 0.0055 * Math.pow(l, 2.5) / (cv * cv));
        var clb = cl0 - 0.0065 * beta * Math.pow(cl0, 0.6);
        return clb * q * b * b;
      }
      if (lift(hi) < W) return null;
      for (var k = 0; k < 50; k++) { lam = (lo + hi) / 2; if (lift(lam) < W) lo = lam; else hi = lam; }
      lam = (lo + hi) / 2; lift(lam);
      var lp = (0.75 - 1 / (5.21 * cv * cv / (lam * lam) + 2.39)) * lam * b;
      return { tau: tau, lam: lam, b: b, cv: cv, beta: beta, lp: lp };
    }
    // ищем τ, при котором центр давления под центром тяжести
    // при малом угле доска может не держать вес ни при какой длине — ищем наименьший угол, где держит
    var t0 = 0.3, t1 = 25, a0 = atTau(t0), a1 = atTau(t1);
    while (!a0 && t0 < t1) { t0 += 0.25; a0 = atTau(t0); }
    if (!a0 || !a1) return null;
    if ((a0.lp - lcg) * (a1.lp - lcg) > 0) return null;
    var r;
    for (var k = 0; k < 50; k++) {
      var tm = (t0 + t1) / 2; r = atTau(tm);
      if (!r) return null;
      if ((r.lp - lcg) * (a0.lp - lcg) > 0) { t0 = tm; a0 = r; } else t1 = tm;
    }
    var tr = r.tau * Math.PI / 180, lw = r.lam * r.b;                     // смоченная длина, м
    var v1sq = 1 - 0.0120 * Math.pow(r.tau, 1.1) / (Math.sqrt(r.lam) * Math.cos(tr));
    var V1 = V * Math.sqrt(Math.max(0.5, v1sq));
    var re = V1 * lw / NU, cf = cfITTC(re) + 0.0004;                       // +0.0004 — шероховатость
    var area = r.lam * r.b * r.b / Math.cos(r.beta * Math.PI / 180);
    var Df = 0.5 * RHO * V1 * V1 * cf * area;
    var Dp = W * Math.tan(tr);
    var ok = r.cv >= 1 && r.tau >= 1 && r.tau <= 15 && r.lam <= 4.5;
    return { tau: r.tau, lw: lw, b: r.b, cv: r.cv, beta: r.beta, area: area, Dp: Dp, Df: Df / Math.cos(tr), D: Dp + Df / Math.cos(tr), ok: ok };
  }

  // ---------- плавник: сопротивление при езде прямо ----------
  function finDrag(V, areaCm2, depthMm, tc) {
    var A = areaCm2 / 1e4, d = Math.max(0.02, depthMm / 1000), c = A / d;    // средняя хорда
    var re = V * c / NU, cf = cfITTC(re);
    return 0.5 * RHO * V * V * A * 2 * cf * (1 + 2 * tc + 60 * Math.pow(tc, 4));
  }

  // ---------- насос Вентури в плавнике ----------
  // d1 — вход, d2 — горло, d3 — выход (мм); eta — доля скоростного напора на входе; k — потери (в долях напора горла);
  // depth — глубина горла под водой (мм); h — высота присоски над водой (мм); pad — площадь присоски (см²), seal — плотность прилегания
  function pump(V, p) {
    var A1 = Math.PI * p.d1 * p.d1 / 4e6, A2 = Math.PI * p.d2 * p.d2 / 4e6, A3 = Math.PI * p.d3 * p.d3 / 4e6;
    var q = 0.5 * RHO * V * V;
    var v3 = Math.sqrt(2 * p.eta * q / RHO / (1 + p.k * Math.pow(A3 / A2, 2)));
    var v2 = v3 * A3 / A2, Q = v3 * A3;
    var p2 = p.eta * q - 0.5 * RHO * v2 * v2 * (1 + 0.1);                // давление в горле относительно воды на этой глубине
    var hyd = RHO * G * p.depth / 1000;
    var abs2 = PATM + hyd + p2, cav = abs2 < PVAP;
    if (cav) abs2 = PVAP;                                                 // кавитация: ниже давления пара не опустится
    var vac = Math.max(0, PATM - abs2 - 0) ;                              // разрежение у присоски (воздух в трубке)
    var force = vac * p.pad / 1e4 * p.seal;
    var drag = RHO * Q * V;                                               // вода, остановленная насосом
    return { v2: v2, Q: Q, vac: vac, force: force, kg: force / G, cav: cav, drag: drag };
  }

  TS.hydro = { geom: geom, planing: planing, finDrag: finDrag, pump: pump };

  // ---------- вкладка «Вода» ----------
  var $ = function (id) { return document.getElementById(id); };
  function f(v, d) { return isFinite(v) ? (+v).toFixed(d === undefined ? 1 : d) : '—'; }
  var P = { mass: 80, board: 3, cg: 38, kmh: 18, fins: 2, finA: 60, finD: 110, finTc: 8,
            pump: false, d1: 11, d2: 6, d3: 11, eta: 0.85, k: 0.3, depth: 70, h: 150, pad: 80, seal: 0.8 };
  var FIELDS = [
    ['hyRider', [['mass', 'hyMass', 1], ['board', 'hyBoardM', 0.1], ['cg', 'hyCg', 1], ['kmh', 'hyKmh', 0.5]]],
    ['hyFins', [['fins', 'hyFinN', 1], ['finA', 'hyFinA', 1], ['finD', 'hyFinD', 1], ['finTc', 'hyFinTc', 0.5]]],
    ['hyPump', [['d1', 'hyD1', 0.5], ['d2', 'hyD2', 0.5], ['d3', 'hyD3', 0.5], ['depth', 'hyDepth', 5], ['pad', 'hyPad', 5],
                ['seal', 'hySeal', 0.05], ['eta', 'hyEta', 0.05], ['k', 'hyK', 0.05]]]
  ];
  function form() {
    var h = '';
    FIELDS.forEach(function (g) {
      h += '<h3>' + TS.t(g[0]) + '</h3><div class="form">';
      if (g[0] === 'hyPump') h += '<label class="chk"><input data-h="pump" type="checkbox"> <span>' + TS.t('hyPumpOn') + '</span></label>';
      g[1].forEach(function (x) { h += '<label><span>' + TS.t(x[1]) + '</span><input data-h="' + x[0] + '" type="number" step="' + x[2] + '"></label>'; });
      h += '</div>';
    });
    $('hyForm').innerHTML = h;
    var ins = $('hyForm').querySelectorAll('input');
    for (var i = 0; i < ins.length; i++) {
      var k = ins[i].getAttribute('data-h');
      if (ins[i].type === 'checkbox') ins[i].checked = !!P[k]; else ins[i].value = P[k];
      ins[i].addEventListener('change', function (e) {
        var kk = e.target.getAttribute('data-h');
        if (e.target.type === 'checkbox') P[kk] = e.target.checked;
        else { var v = parseFloat(String(e.target.value).replace(',', '.')); if (isFinite(v)) P[kk] = v; }
        run();
      });
    }
  }
  var cache = null;
  function curve(model) {
    var g = geom(model), W = (P.mass + P.board) * G, lcg = g.L * P.cg / 100, out = [];
    for (var k = 6; k <= 30; k += 0.5) {
      var V = k / 3.6, r = planing(g, V, W, lcg), fd = P.fins * finDrag(V, P.finA, P.finD, P.finTc / 100);
      var pp = P.pump ? pump(V, P) : null;
      if (r) { r.fin = fd; r.pd = pp ? pp.drag * P.fins : 0; r.T = r.D + fd + r.pd; r.slope = Math.asin(Math.min(1, r.T / W)) * 180 / Math.PI; }
      out.push({ kmh: k, r: r, pp: pp });
    }
    return { g: g, W: W, lcg: lcg, pts: out };
  }
  function run() {
    var st = TS.state; if (!st || !st.model) return;
    cache = { me: curve(st.model), gh: st.ghost ? curve(st.ghost) : null };
    table(); draw();
  }
  function at(c, kmh) { var best = null; c.pts.forEach(function (p) { if (!best || Math.abs(p.kmh - kmh) < Math.abs(best.kmh - kmh)) best = p; }); return best; }
  function table() {
    var c = cache.me, p = at(c, P.kmh), r = p.r, h = '<table class="kv">';
    function tr(k, v, n) { h += '<tr><td>' + k + '</td><td class="v">' + v + '</td><td class="n">' + (n || '') + '</td></tr>'; }
    h += '<tr><td colspan="3"><b>' + f(p.kmh, 1) + ' ' + TS.t('hyKmhU') + ' · ' + f(c.W / G, 0) + ' ' + TS.t('hyKg') + '</b></td></tr>';
    if (!r) tr(TS.t('hyNoPlane'), '', '');
    else {
      tr(TS.t('hyTau'), f(r.tau, 1) + '°', TS.t('hyTauN'));
      tr(TS.t('hyWet'), f(r.lw * 1000, 0) + ' ' + TS.t('mm'), TS.t('hyWetN') + ' ' + f(r.b * 1000, 0));
      tr(TS.t('hyDrag'), f(r.D, 0) + ' ' + TS.t('hyN'), TS.t('hyDragN') + ' ' + f(r.Dp, 0) + ' + ' + f(r.Df, 0));
      tr(TS.t('hyFinDrag'), f(r.fin + r.pd, 1) + ' ' + TS.t('hyN'), '');
      tr(TS.t('hyTotal'), f(r.T, 0) + ' ' + TS.t('hyN'), '≈ ' + f(r.T / G, 1) + ' ' + TS.t('hyKgf'));
      tr(TS.t('hySlope'), f(r.slope, 1) + '°', TS.t('hySlopeN'));
      tr(TS.t('hyPower'), f(r.T * p.kmh / 3.6, 0) + ' ' + TS.t('hyW'), '');
      if (!r.ok) h += '<tr><td colspan="3" class="warnc">' + TS.t('hyOut') + '</td></tr>';
    }
    if (p.pp) {
      var q = p.pp;
      h += '<tr><td colspan="3"><b>' + TS.t('hyPump') + '</b></td></tr>';
      tr(TS.t('hyVac'), f(q.vac / 1000, 1) + ' ' + TS.t('hyKpa'), q.cav ? TS.t('hyCav') : '');
      tr(TS.t('hyHold'), f(q.kg, 1) + ' ' + TS.t('hyKgf'), TS.t('hyHoldN') + ' ' + P.pad + ' ' + TS.t('hyCm2'));
      tr(TS.t('hyThroat'), f(q.v2, 1) + ' ' + TS.t('hyMs'), f(q.Q * 60000, 1) + ' ' + TS.t('hyLmin'));
    }
    $('hyOut').innerHTML = h + '</table>';
  }
  // ---------- графики: сопротивление и уклон волны; удержание присоски ----------
  function draw() {
    var cv = $('cHydro'); if (!cv || !cache) return;
    var r = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1, W = Math.max(300, r.width), H = Math.max(200, r.height);
    cv.width = W * dpr; cv.height = H * dpr;
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    var plots = [{ key: function (p) { return p.r && p.r.T; }, title: TS.t('hyTotal') + ', ' + TS.t('hyN') },
                 { key: function (p) { return p.r && p.r.slope; }, title: TS.t('hySlope') + ', °' }];
    if (P.pump) plots.push({ key: function (p) { return p.pp && p.pp.kg; }, title: TS.t('hyHold') + ', ' + TS.t('hyKgf'), noShade: true });
    var ph = (H - 10) / plots.length;
    plots.forEach(function (pl, i) { plot(ctx, 56, 10 + i * ph, W - 76, ph - 44, pl, i === plots.length - 1); });
  }
  function plot(ctx, x0, y0, w, h, pl, last) {
    var sets = [[cache.me, '#161616', []]];
    if (cache.gh) sets.push([cache.gh, '#2f9e44', [7, 4]]);
    var ymax = 0;
    sets.forEach(function (s) { s[0].pts.forEach(function (p) { var v = pl.key(p); if (v > ymax) ymax = v; }); });
    if (!ymax) ymax = 1;
    var step = Math.pow(10, Math.floor(Math.log(ymax) / Math.LN10)); if (ymax / step < 3) step /= 2; ymax = Math.ceil(ymax / step) * step;
    function X(k) { return x0 + (k - 6) / 24 * w; } function Y(v) { return y0 + h - v / ymax * h; }
    ctx.font = '11px "Golos Text", system-ui, sans-serif'; ctx.fillStyle = '#6b6b63'; ctx.strokeStyle = '#e4e4dd'; ctx.lineWidth = 1;
    for (var v = 0; v <= ymax + 1e-9; v += step) { ctx.beginPath(); ctx.moveTo(x0, Y(v)); ctx.lineTo(x0 + w, Y(v)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(f(v, step < 1 ? 1 : 0), x0 - 6, Y(v) + 4); }
    for (var k = 6; k <= 30; k += 2) { ctx.beginPath(); ctx.moveTo(X(k), y0); ctx.lineTo(X(k), y0 + h); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(k, X(k), y0 + h + 14); }
    ctx.fillStyle = '#161616'; ctx.textAlign = 'left'; ctx.font = '600 12px "Golos Text", system-ui, sans-serif'; ctx.fillText(pl.title, x0 + 4, y0 + 14);
    if (last) { ctx.font = '11px "Golos Text", system-ui, sans-serif'; ctx.fillStyle = '#6b6b63'; ctx.textAlign = 'right'; ctx.fillText(TS.t('hyKmhU'), x0 + w, y0 + h + 28); }
    // скорость из таблицы
    ctx.strokeStyle = '#d4c600'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(P.kmh), y0); ctx.lineTo(X(P.kmh), y0 + h); ctx.stroke();
    // вне области метода Савицкого — серым фоном
    ctx.fillStyle = 'rgba(200,200,190,0.25)';
    if (!pl.noShade) cache.me.pts.forEach(function (p) { if (p.r && !p.r.ok) ctx.fillRect(X(p.kmh) - w / 96, y0, w / 48, h); });
    sets.forEach(function (s) {
      ctx.strokeStyle = s[1]; ctx.lineWidth = 2; ctx.setLineDash(s[2]); ctx.beginPath(); var on = false;
      s[0].pts.forEach(function (p) { var v = pl.key(p); if (!(v > 0)) { on = false; return; } if (on) ctx.lineTo(X(p.kmh), Y(v)); else { ctx.moveTo(X(p.kmh), Y(v)); on = true; } });
      ctx.stroke(); ctx.setLineDash([]);
    });
  }
  TS.hydroUI = {
    init: function () { form(); window.addEventListener('resize', function () { if (document.body.getAttribute('data-tab') === 'hydro') draw(); }); },
    show: function () { run(); },
    lang: function () { form(); if (cache) { table(); draw(); } }
  };
})(window.TS = window.TS || {});
