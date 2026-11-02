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
  // пропорции — как у серийных крыльев (серф: ~1300 см², размах 950, удлинение ~7, стаб ~200 см², фюзеляж ~660 мм)
  var PRESETS = {
    // крыло Tentaclesurf: снято с 3D-модели (размах 719, площадь ~1165 см², профиль ≈ NACA 4411, кромка уходит назад на 120 мм)
    tentacle: { span: 719, cr: 199, ct: 108, sweep: 120, naca: '4411', stab: 195, fuse: 629 },
    surf: { span: 950, cr: 188, ct: 60, sweep: 60, naca: '2412', stab: 195, fuse: 660 },
    wake: { span: 700, cr: 180, ct: 55, sweep: 40, naca: '4412', stab: 180, fuse: 600 },
    pump: { span: 1100, cr: 125, ct: 40, sweep: 70, naca: '2410', stab: 150, fuse: 700 },
    big:  { span: 900, cr: 275, ct: 90, sweep: 50, naca: '4412', stab: 240, fuse: 660 }
  };
  var P = { preset: 'tentacle', span: 719, cr: 199, ct: 108, sweep: 120, naca: '4411', mass: 80, board: 6, kmh: 18,
            stab: 195, fuse: 629, mastDepth: 600, mastChord: 125, mastT: 15, sea: false, clmax: 1.2 };

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

  // стабилизатор: удлинение ~7, та же форма хорды, что у крыла
  function stabGeom() { var S = P.stab * 100, span = Math.sqrt(S * 7), mean = S / span; return { span: span, cr: mean * 1.45, ct: mean * 0.45 }; }
  function halfPlan(span, cr, ct, sw) {
    var half = span / 2, pts = [], N = 40, i;
    function cAt(u) { return ct + (cr - ct) * (1 - Math.pow(Math.min(1, u), 1.5)); }
    function le(y) { return sw * Math.pow(y / half, 1.6); }
    function ch(y) { var u = y / half; return cAt(u) * Math.sqrt(Math.max(0, 1 - Math.pow(Math.max(0, u - 0.8) / 0.2, 2))); }
    // скруглённый конец: хорда сходится к своей середине
    for (i = 0; i <= N; i++) { var y1 = half * i / N, u1 = y1 / half; pts.push([y1, le(y1) + (cAt(u1) - ch(y1)) / 2]); }
    for (i = N - 1; i >= 0; i--) { var y = half * i / N, u = y / half; pts.push([y, le(y) + (cAt(u) + ch(y)) / 2]); }
    return pts;
  }
  function profPts(n, chord, x0, y0, sc, ang) {
    var ca = Math.cos(ang), sa = Math.sin(ang);
    return profile(n, 50).map(function (p) { var x = p[0] * chord, y = p[1] * chord; return (x0 + (x * ca + y * sa) * sc).toFixed(1) + ',' + (y0 + (x * sa - y * ca) * sc).toFixed(1); }).join(' ');
  }
  var DEFS = '<defs><linearGradient id="foY" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff35a"/><stop offset="1" stop-color="#e2d400"/></linearGradient>' +
    '<linearGradient id="foWat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a6d5de"/><stop offset="1" stop-color="#3f8fa1"/></linearGradient>' +
    '<marker id="foAr" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#6b6b63"/></marker></defs>';

  function drawSvg(w) {
    var Wd = 640, pad = 24, sg = stabGeom(), n0 = naca('0010');
    // ---- вид сбоку: доска над водой, мачта, фюзеляж, крылья ----
    var H1 = 330, boardL = 1250, above = 160, mastL = P.mastDepth + above;
    var sc = Math.min((Wd - 2 * pad - 80) / boardL, (H1 - 46 - 40) / (90 + mastL + P.cr * 0.25));
    var bx = (Wd - boardL * sc) / 2, xm = bx + boardL * 0.42 * sc;                               // мачта — 42 % от носа
    var yB = 46, yW = yB + (90 + above) * sc, yF = yB + (90 + mastL) * sc;
    var s = '<svg viewBox="0 0 ' + Wd + ' ' + H1 + '" class="foil-svg">' + DEFS;
    s += '<text x="' + pad + '" y="20" class="cap">' + TS.t('foSide') + '</text>';
    s += '<rect x="0" y="' + yW + '" width="' + Wd + '" height="' + (H1 - yW) + '" fill="url(#foWat)"/>';
    s += '<path d="M0 ' + yW + ' C 160 ' + (yW - 3) + ', 320 ' + (yW + 3) + ', 480 ' + yW + ' S 600 ' + (yW - 2) + ', 640 ' + yW + '" fill="none" stroke="#e9f6f8" stroke-width="2"/>';
    // доска: нос слева
    var bw = boardL * sc, bt = 90 * sc;
    s += '<path d="M' + bx + ' ' + (yB + bt * 0.2) + ' C ' + (bx + bw * 0.08) + ' ' + (yB - bt * 0.35) + ', ' + (bx + bw * 0.2) + ' ' + yB + ', ' + (bx + bw * 0.35) + ' ' + yB +
         ' L ' + (bx + bw) + ' ' + yB + ' L ' + (bx + bw) + ' ' + (yB + bt) + ' L ' + (bx + bw * 0.3) + ' ' + (yB + bt) +
         ' C ' + (bx + bw * 0.12) + ' ' + (yB + bt) + ', ' + (bx + bw * 0.04) + ' ' + (yB + bt * 0.75) + ', ' + bx + ' ' + (yB + bt * 0.2) + ' Z" fill="url(#foY)" stroke="#000" stroke-width="2" stroke-linejoin="round"/>';
    // мачта
    var mc = P.mastChord * sc;
    s += '<rect x="' + (xm - mc / 2) + '" y="' + (yB + bt) + '" width="' + mc + '" height="' + (yF - yB - bt) + '" rx="' + Math.min(4, mc / 3) + '" fill="#2a2a2a"/>';
    // фюзеляж: спереди мачты ~35 %
    var fl = P.fuse * sc, fx0 = xm - fl * 0.36, fx1 = fx0 + fl;
    s += '<rect x="' + fx0 + '" y="' + (yF - 3) + '" width="' + fl + '" height="7" rx="3.5" fill="#2a2a2a"/>';
    // переднее крыло: профиль корня, передняя кромка у носа фюзеляжа, угол установки ~2°
    s += '<polygon points="' + profPts(w.n, P.cr, fx0 - P.cr * 0.08 * sc / sc, yF + 2, sc, 2 * Math.PI / 180) + '" fill="#161616"/>';
    // стабилизатор: тонкий симметричный, у хвоста фюзеляжа, с небольшим отрицательным углом
    s += '<polygon points="' + profPts(n0, sg.cr, fx1 - sg.cr * sc - 2, yF + 1, sc, -1.5 * Math.PI / 180) + '" fill="#161616"/>';
    // размеры
    s += '<line x1="' + (xm + mc / 2 + 10) + '" x2="' + (xm + mc / 2 + 10) + '" y1="' + (yW + 2) + '" y2="' + (yF - 4) + '" stroke="#fff" stroke-width="1.2" marker-start="url(#foAr)" marker-end="url(#foAr)"/>';
    s += '<text x="' + (xm + mc / 2 + 16) + '" y="' + ((yW + yF) / 2 + 4) + '" fill="#fff">' + TS.t('foMastIn') + ' ' + P.mastDepth + '</text>';
    s += '<line x1="' + (bx + bw + 6) + '" x2="' + (bx + bw + 40) + '" y1="' + (yB + bt / 2) + '" y2="' + (yB + bt / 2) + '" stroke="#6b6b63" stroke-width="1.5" marker-start="url(#foAr)"/>';
    s += '<text x="' + (bx + bw - 4) + '" y="' + (yB - 8) + '" text-anchor="end">' + TS.t('foDir') + '</text>';
    s += '</svg>';

    // ---- вид сверху: крыло, фюзеляж, стабилизатор ----
    var half = halfPlan(P.span, P.cr, P.ct, P.sweep), hs = halfPlan(sg.span, sg.cr, sg.ct, P.sweep * 0.3);
    var xmax = 0; half.forEach(function (p) { xmax = Math.max(xmax, p[1]); });
    var lenAll = Math.max(P.fuse * 0.64 + P.cr * 0.08, xmax) + P.cr * 0.1 + 20;
    var H2 = 360, sc2 = Math.min((Wd - 2 * pad) / P.span, (H2 - 100) / (P.fuse + 40)), cx = Wd / 2, y0 = 54;
    function pt(p, sgn, dy) { return (cx + sgn * p[0] * sc2).toFixed(1) + ',' + (y0 + (p[1] + (dy || 0)) * sc2).toFixed(1); }
    function full(h, dy) { return h.map(function (p) { return pt(p, 1, dy); }).concat(h.slice().reverse().map(function (p) { return pt(p, -1, dy); })).join(' '); }
    var stabY = P.fuse - sg.cr - P.cr * 0.0;                                  // от передней кромки крыла
    s += '<svg viewBox="0 0 ' + Wd + ' ' + H2 + '" class="foil-svg">' + DEFS;
    s += '<text x="' + pad + '" y="22" class="cap">' + TS.t('foPlan') + ' · ' + f(w.S * 1e4, 0) + ' ' + TS.t('hyCm2') + ' · ' + TS.t('foAR') + ' ' + f(w.AR, 1) + ' · ' + TS.t('foStabS') + ' ' + P.stab + ' ' + TS.t('hyCm2') + '</text>';
    s += '<rect x="' + (cx - 12 * sc2 / sc2 * 0.5 - 4) + '" y="' + (y0 - 8 * sc2) + '" width="8" height="' + ((P.fuse + 8) * sc2) + '" rx="4" fill="#2a2a2a"/>';
    s += '<polygon points="' + full(half) + '" fill="url(#foY)" stroke="#000" stroke-width="2" stroke-linejoin="round"/>';
    s += '<polygon points="' + full(hs, stabY) + '" fill="url(#foY)" stroke="#000" stroke-width="1.6" stroke-linejoin="round"/>';
    s += '<ellipse cx="' + cx + '" cy="' + (y0 + (P.fuse * 0.36 - P.mastChord / 2) * sc2) + '" rx="' + Math.max(3, P.mastChord * P.mastT / 200 * sc2) + '" ry="' + (P.mastChord / 2 * sc2) + '" fill="#000" opacity=".55"/>';
    var yd = y0 + (Math.max(xmax, stabY + sg.cr) + 30) * sc2;
    s += '<line x1="' + (cx - P.span / 2 * sc2) + '" x2="' + (cx + P.span / 2 * sc2) + '" y1="' + yd + '" y2="' + yd + '" stroke="#6b6b63" stroke-width="1.2" marker-start="url(#foAr)" marker-end="url(#foAr)"/>';
    s += '<text x="' + cx + '" y="' + (yd + 16) + '" text-anchor="middle">' + TS.t('foSpan') + ' ' + P.span + ' ' + TS.t('mm') + '</text>';
    var xr = cx - P.span / 2 * sc2 - 0;
    var xd = cx - P.span * sc2 * 0.18;
    s += '<line x1="' + xd + '" x2="' + xd + '" y1="' + (y0 + 1) + '" y2="' + (y0 + (P.cr * 0.93 + P.sweep * 0.03) * sc2) + '" stroke="#000" stroke-width="1.2" marker-start="url(#foAr)" marker-end="url(#foAr)"/>';
    s += '<text x="' + (xd + 6) + '" y="' + (y0 + P.cr * sc2 / 2 + 4) + '" fill="#000">' + TS.t('foChordL') + ' ' + P.cr + '</text>';
    void xr;
    s += '</svg>';

    // ---- профиль корня ----
    var H3 = 200, sx = Wd - 2 * pad - 40, yc = 92, pr = profile(w.n, 80);
    s += '<svg viewBox="0 0 ' + Wd + ' ' + H3 + '" class="foil-svg">';
    s += '<text x="' + pad + '" y="20" class="cap">' + TS.t('foProfile') + ' NACA ' + P.naca + ' · ' + TS.t('foRoot') + ' ' + P.cr + ' ' + TS.t('mm') + ' · ' + TS.t('foThick') + ' ' + f(w.n.t * P.cr, 1) + ' ' + TS.t('mm') + '</text>';
    s += '<polygon points="' + pr.map(function (p) { return (pad + 20 + p[0] * sx).toFixed(1) + ',' + (yc - p[1] * sx).toFixed(1); }).join(' ') + '" fill="#161616"/>';
    s += '<line x1="' + (pad + 20) + '" x2="' + (pad + 20 + sx) + '" y1="' + yc + '" y2="' + yc + '" stroke="#f2e400" stroke-width="1.2" stroke-dasharray="5 4"/>';
    var cl = []; for (var i = 0; i <= 40; i++) { var x = i / 40; cl.push((pad + 20 + x * sx).toFixed(1) + ',' + (yc - camber(w.n, x).yc * sx).toFixed(1)); }
    s += '<polyline points="' + cl.join(' ') + '" fill="none" stroke="#fff" stroke-width="1.2" stroke-dasharray="2 3"/>';
    var xt = pad + 20 + 0.3 * sx, ht = w.n.t * sx / 2;
    s += '<line x1="' + xt + '" x2="' + xt + '" y1="' + (yc - camber(w.n, 0.3).yc * sx - ht - 10) + '" y2="' + (yc - camber(w.n, 0.3).yc * sx + ht + 10) + '" stroke="#6b6b63" stroke-width="1.2" marker-start="url(#foAr)" marker-end="url(#foAr)"/>';
    s += '<text x="' + (xt + 6) + '" y="' + (yc + ht + 26) + '">' + f(w.n.t * 100, 0) + ' % — ' + f(w.n.t * P.cr, 1) + ' ' + TS.t('mm') + '</text>';
    s += '<text x="' + pad + '" y="' + (H3 - 6) + '">' + TS.t('foProfLeg') + '</text>';
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
    var half = halfPlan(P.span, P.cr, P.ct, P.sweep), full = half.concat(half.slice().reverse().map(function (p) { return [-p[0], p[1]]; }));
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
    ['foRest', [['stab', 'foStab', 10], ['fuse', 'foFuse', 10], ['mastDepth', 'foMastD', 10], ['mastChord', 'foMastC', 5], ['mastT', 'foMastT', 0.5]]],
    ['foRider', [['mass', 'hyMass', 1], ['board', 'hyBoardM', 0.5], ['kmh', 'hyKmh', 0.5]]]
  ];
  function render() {
    var el = $('foilPage'); if (!el) return;
    var h = '<div class="fin-wrap foil-wrap">' +
      '<div class="fin-head"><img src="img/badge.svg" alt="" class="fin-badge"><div><h1>' + TS.t('foTitle') + '</h1><p class="lead">' + TS.t('foLead') + '</p></div></div>' +
      '<div class="foil-grid"><div class="foil-main">' +
      (P.preset === 'tentacle' ? '<div class="foil-3d"><div class="foil-3d-cap"><b>' + TS.t('fo3dT') + '</b><span>' + TS.t('fo3dN') + '</span></div><div id="fo3d"></div></div>' : '') +
      '<div id="foDraw"></div><div id="foChart"></div></div>' +
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
      var k = e.currentTarget.getAttribute('data-pre'); Object.assign(P, PRESETS[k]); P.preset = k; render(); view3d();
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
  // ---------- 3D-модель крыла Tentaclesurf (img/foil-tentacle.json: позиции int16 × 0.05 мм, индексы uint16) ----------
  var V3 = null;
  function view3d() {
    var box = $('fo3d'); if (!box || !window.THREE) return;
    if (!V3) {
      var r;
      try { r = new THREE.WebGLRenderer({ antialias: true, alpha: true }); } catch (e) { box.textContent = TS.t('fo3dNoGL'); return; }
      var sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(32, 2, 1, 10000);
      sc.add(new THREE.HemisphereLight(0xffffff, 0x8a8a80, 0.75));
      var l1 = new THREE.DirectionalLight(0xffffff, 0.9); l1.position.set(300, 600, 400); sc.add(l1);
      var l2 = new THREE.DirectionalLight(0xffffff, 0.35); l2.position.set(-400, -200, -300); sc.add(l2);
      var g = new THREE.Group(); sc.add(g);
      cam.position.set(-620, 380, 760); cam.lookAt(0, 0, 0);
      var ctl = new THREE.OrbitControls(cam, r.domElement); ctl.enableDamping = true; ctl.autoRotate = true; ctl.autoRotateSpeed = 1.2;
      r.domElement.addEventListener('pointerdown', function () { ctl.autoRotate = false; });
      V3 = { r: r, sc: sc, cam: cam, ctl: ctl, g: g, loaded: false };
      var COL = { wing: 0x1b1b1b, fuse: 0x3a3a3a, mount: 0x6b6b63, nose: 0xf2e400 };
      fetch('img/foil-tentacle.json').then(function (x) { return x.json(); }).then(function (d) {
        d.parts.forEach(function (pt) {
          var pb = atob(pt.pos), ib = atob(pt.idx), pa = new Int16Array(pb.length / 2), ia = new Uint16Array(ib.length / 2), i;
          var dv = new DataView(new ArrayBuffer(pb.length)); for (i = 0; i < pb.length; i++) dv.setUint8(i, pb.charCodeAt(i));
          for (i = 0; i < pa.length; i++) pa[i] = dv.getInt16(i * 2, true);
          var dv2 = new DataView(new ArrayBuffer(ib.length)); for (i = 0; i < ib.length; i++) dv2.setUint8(i, ib.charCodeAt(i));
          for (i = 0; i < ia.length; i++) ia[i] = dv2.getUint16(i * 2, true);
          var pos = new Float32Array(pa.length); for (i = 0; i < pa.length; i++) pos[i] = pa[i] * pt.scale;
          var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(new THREE.BufferAttribute(ia, 1));
          geo.computeVertexNormals();
          g.add(new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: COL[pt.name] || 0x555555, roughness: pt.name === 'wing' ? 0.35 : 0.5, metalness: 0.15, side: THREE.DoubleSide })));
        });
        V3.loaded = true;
      }).catch(function () { box.textContent = TS.t('fo3dNoGL'); });
      (function loop() {
        requestAnimationFrame(loop);
        if (!V3.r.domElement.isConnected || document.body.getAttribute('data-tab') !== 'foil') return;
        V3.ctl.update(); V3.r.render(V3.sc, V3.cam);
      })();
    }
    box.appendChild(V3.r.domElement);
    var w = box.clientWidth || 600, h = Math.round(w * 0.5);
    V3.r.setPixelRatio(window.devicePixelRatio || 1); V3.r.setSize(w, h); V3.cam.aspect = w / h; V3.cam.updateProjectionMatrix();
  }
  TS.foilUI = { init: function () { render(); }, show: function () { if (!$('foDraw')) render(); view3d(); }, lang: function () { render(); view3d(); } };
})(window.TS = window.TS || {});
