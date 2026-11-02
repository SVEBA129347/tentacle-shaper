/* Tentacle Shaper — страница «Плавник-насос»: как работает плавник Tentaclesurf с каналом Вентури,
 * анимация потока и расчёт прижима присоски по скорости (TS.hydro.pump). Ссылка: …/#fin. GPL v3. */
(function (TS) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var DIM = { d1: 11, d2: 6, d3: 11, eta: 0.85, k: 0.3, depth: 70, pad: 80, seal: 0.8 };
  var kmh = 18, raf = null, t0 = 0, parts = [], reduce = false;

  // разрез: доска едет влево, вода бежит вправо; канал в плавнике, трубка к присоске на деке
  // сцена в разрезе: серфер на доске, плавник у хвоста, трубка внутри доски к присоске под передней ногой;
  // слева внизу — плавник крупно, с каналом Вентури. Доска едет влево, вода бежит вправо.
  var SVG = '' +
  '<svg id="finSvg" viewBox="0 30 1000 570" role="img" aria-labelledby="finSvgT">' +
  '<title id="finSvgT"></title>' +
  '<defs>' +
    '<linearGradient id="fSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfaf3"/><stop offset="1" stop-color="#eef0e8"/></linearGradient>' +
    '<linearGradient id="fW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc0cd"/><stop offset="1" stop-color="#2f7d8f"/></linearGradient>' +
    '<linearGradient id="fBoard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff35a"/><stop offset="1" stop-color="#e2d400"/></linearGradient>' +
    '<linearGradient id="fFin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#575757"/><stop offset="1" stop-color="#101010"/></linearGradient>' +
    '<path id="fFinShape" d="M0 0C.22 .42 .62 .84 1.08 1C1.2 1.04 1.27 .96 1.18 .89C.98 .68 .88 .38 .97 0Z"/>' +
    '<marker id="fA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#c2255c"/></marker>' +
    '<clipPath id="fWater"><rect x="0" y="392" width="1000" height="208"/></clipPath>' +
  '</defs>' +
  '<rect width="1000" height="600" fill="url(#fSky)"/>' +
  // вода и пологий склон волны позади
  '<path d="M0 396 C 180 392, 300 398, 420 396 C 560 394, 700 398, 860 386 C 930 380, 970 360, 1000 338 L 1000 600 L 0 600 Z" fill="url(#fW)"/>' +
  '<path d="M0 396 C 180 392, 300 398, 420 396 C 560 394, 700 398, 860 386 C 930 380, 970 360, 1000 338" fill="none" stroke="#e9f6f8" stroke-width="3"/>' +
  '<g id="finStreaks" stroke="#e9f6f8" stroke-width="2.2" stroke-linecap="round" opacity=".55" clip-path="url(#fWater)"></g>' +
  // брызги у хвоста
  '<path d="M846 386 C 870 372, 892 366, 912 370 M850 390 C 880 384, 905 386, 925 394" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>' +
  // плавник у хвоста (классическая форма с выносом назад)
  '<use href="#fFinShape" transform="translate(738 392) scale(70)" fill="url(#fFin)"/>' +
  // доска: дно и дек с рокером, нос поднят
  '<path id="finBoardShape" d="M842 393 C 650 397, 380 394, 230 380 C 185 376, 156 366, 134 349 C 160 352, 196 356, 232 359 C 390 368, 650 372, 846 374 C 852 378, 852 389, 842 393 Z" fill="url(#fBoard)" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>' +
  // трубка внутри доски: от плавника вперёд к присоске
  '<path id="finTubeLine" d="M765 393 C 765 384, 752 383, 736 383 L 520 377 C 500 376, 490 372, 488 367" fill="none" stroke="#0f4a57" stroke-width="6" stroke-linecap="round"/>' +
  '<path d="M765 393 C 765 384, 752 383, 736 383 L 520 377 C 500 376, 490 372, 488 367" fill="none" stroke="#9edbe6" stroke-width="2" stroke-linecap="round"/>' +
  '<path id="finTube" d="M488 367 C 490 372, 500 376, 520 377 L 736 383 C 752 383, 765 384, 765 393" fill="none" stroke="none"/>' +
  // присоска под передней ногой
  '<rect x="458" y="358" width="62" height="7" rx="3.5" fill="#000"/>' +
  // райдер в стойке, лицом к носу; передняя стопа на присоске
  '<g transform="translate(497 352) scale(1.12) translate(-497 -352)"><path d="M540.6 261.2L587.5 325.6A13 13 0 0 0 609.5 312L572.9 241.3A19 19 0 1 0 540.6 261.2ZM592.9 330L664.9 360.4A8 8 0 0 0 672 346.1L604.5 306.8A13 13 0 1 0 592.9 330Z" fill="#303030"/><path d="M659 355 C 656 365, 642 367, 634 368 L 678 369 C 680 361, 676 353, 668 351 Z" fill="#c48c68"/><path d="M525.3 172.8L570.2 197A8 8 0 0 0 578.3 183.3L535.4 155.6A10 10 0 1 0 525.3 172.8ZM570.5 197.2L611.3 217.4A6 6 0 0 0 617.1 206.9L578.2 183.2A8 8 0 1 0 570.5 197.2Z" fill="#303030"/><ellipse cx="620" cy="215" rx="9" ry="6" transform="rotate(25 620 215)" fill="#c48c68"/><path d="M566 240 C 572 222, 566 200, 556 182 C 548 166, 540 154, 530 150 C 518 145, 500 146, 492 152 C 484 160, 484 174, 490 192 C 496 210, 506 230, 516 252 C 526 268, 552 268, 566 240 Z" fill="#1c1c1c"/><path d="M514.5 149L507.5 129.3A8 8 0 0 0 492.2 133.9L497.3 154.2A9 9 0 1 0 514.5 149Z" fill="#d9a07a"/><path d="M499 90 C 484 90, 474 100, 473 113 C 472 117, 468 121, 467 124 C 466 127, 469 128, 471 128 C 470 132, 472 134, 474 135 C 474 139, 478 142, 484 141 C 492 141, 502 138, 510 132 C 519 124, 522 112, 518 102 C 514 94, 507 90, 499 90 Z" fill="#d9a07a"/><path d="M473 108 C 472 94, 484 85, 500 86 C 514 87, 524 98, 523 112 C 522 122, 517 129, 511 133 C 513 122, 510 113, 502 109 C 494 105, 484 109, 473 108 Z" fill="#3a2a1e"/><ellipse cx="505" cy="116" rx="3.5" ry="5.5" fill="#c48c68"/><path d="M523.8 230.9L453.9 280.6A14 14 0 0 0 468.2 304.6L545.2 266.9A21 21 0 1 0 523.8 230.9ZM450.6 300.2L490.1 355A8.5 8.5 0 0 0 504.6 346.2L474.5 285.8A14 14 0 1 0 450.6 300.2Z" fill="#1c1c1c"/><path d="M488 352 C 485 361, 471 362, 463 364 L 508 365 C 510 357, 506 350, 497 348 Z" fill="#d9a07a"/><path d="M499.1 155.4L456.7 189.4A8.5 8.5 0 0 0 466.7 203.1L512.1 173.2A11 11 0 1 0 499.1 155.4ZM462.6 187.5L414.4 184A6 6 0 0 0 412.9 195.9L460.5 204.4A8.5 8.5 0 1 0 462.6 187.5Z" fill="#1c1c1c"/><ellipse cx="408" cy="192" rx="10" ry="6.5" transform="rotate(-12 408 192)" fill="#d9a07a"/><path d="M540 242 L 466 284 M 468 290 L 501 344" stroke="#f2e400" stroke-width="2.2" stroke-linecap="round" fill="none"/><path d="M530 152 C 548 170, 560 204, 558 238" stroke="#f2e400" stroke-width="2.2" stroke-linecap="round" fill="none"/></g>' +
  // прижим
  '<path d="M444 300 L 452 344" stroke="#c2255c" stroke-width="4" marker-end="url(#fA)"/><path d="M534 300 L 526 344" stroke="#c2255c" stroke-width="4" marker-end="url(#fA)"/>' +
  '<g id="finAirDots"></g>' +
  // подписи сцены
  '<g font-size="17" fill="#161616">' +
    '<text x="300" y="300" id="fL4" text-anchor="end"></text>' +
    '<text x="600" y="446" id="fL3" text-anchor="middle" fill="#fff"></text>' +
  '</g>' +
  '<path d="M306 296 L 456 360" stroke="#161616" stroke-width="1.3"/><path d="M600 428 L 600 382" stroke="#fff" stroke-width="1.3"/>' +
  '<text id="finArrowT" x="420" y="296" font-size="17" font-weight="600" fill="#c2255c" text-anchor="end"></text>' +
  // выноска к плавнику крупно
  '<circle cx="782" cy="428" r="54" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 5"/>' +
  '<path d="M730 446 L 472 520" stroke="#fff" stroke-width="2" stroke-dasharray="6 5"/>' +
  // плавник крупно: панель
  '<g transform="translate(24 404)">' +
    '<rect width="448" height="182" rx="16" fill="#fbfaf3" stroke="#161616" stroke-width="2"/>' +
    '<text x="18" y="28" font-size="16" font-weight="600" id="finInsetT"></text>' +
    '<rect x="120" y="40" width="250" height="14" fill="url(#fBoard)" stroke="#000" stroke-width="2"/>' +
    '<use href="#fFinShape" transform="translate(150 54) scale(150 118)" fill="url(#fFin)"/>' +
    // канал Вентури: вход на передней кромке, горло посередине хорды, выход на задней кромке
    '<path d="M180 89 C 205 91, 225 97, 241 97 C 258 97, 274 93, 289 94 L 295 120 C 276 116, 258 106, 241 106 C 228 106, 214 110, 205 113 Z" fill="#0f4a57"/>' +
    '<path d="M180 89 C 205 91, 225 97, 241 97 C 258 97, 274 93, 289 94" fill="none" stroke="#f2e400" stroke-width="2.5"/>' +
    '<path d="M205 113 C 214 110, 228 106, 241 106 C 258 106, 276 116, 295 120" fill="none" stroke="#f2e400" stroke-width="2.5"/>' +
    '<path d="M237 98 L 237 50 M 245 98 L 245 50" stroke="#9edbe6" stroke-width="2.5"/>' +
    '<path id="finChan" d="M110 101 C 170 101, 222 102, 241 102 C 262 102, 292 106, 360 112" fill="none" stroke="none"/>' +
    '<path id="finRise" d="M241 99 L 241 46" fill="none" stroke="none"/>' +
    '<g id="finDots"></g>' +
    '<g font-size="13" fill="#161616">' +
      '<text x="112" y="100" text-anchor="end" id="fL1"></text><path d="M116 96 L 184 98" stroke="#161616"/>' +
      '<text x="241" y="168" text-anchor="middle" id="fL2"></text><path d="M241 154 L 241 109" stroke="#161616"/>' +
      '<text x="330" y="80" id="fL5"></text><path d="M326 76 L 250 70" stroke="#161616"/>' +
    '</g>' +
  '</g>' +
  '</svg>';

  function holdAt(k) { return TS.hydro.pump(k / 3.6, DIM); }

  function chart() {
    var W = 320, H = 150, x0 = 34, y0 = 10, w = W - 46, h = H - 36, pts = [], max = 0;
    for (var k = 8; k <= 30; k++) { var q = holdAt(k); pts.push([k, q.kg]); max = Math.max(max, q.kg); }
    max = Math.ceil(max / 10) * 10;
    function X(k) { return x0 + (k - 8) / 22 * w; } function Y(v) { return y0 + h - v / max * h; }
    var s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="finchart">';
    for (var v = 0; v <= max; v += 10) s += '<line x1="' + x0 + '" x2="' + (x0 + w) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e4e4dd"/><text x="' + (x0 - 5) + '" y="' + (Y(v) + 4) + '" text-anchor="end">' + v + '</text>';
    for (var kk = 10; kk <= 30; kk += 5) s += '<text x="' + X(kk) + '" y="' + (y0 + h + 15) + '" text-anchor="middle">' + kk + '</text>';
    s += '<polyline fill="none" stroke="#000" stroke-width="2.5" points="' + pts.map(function (p) { return X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1); }).join(' ') + '"/>';
    s += '<line id="finMark" x1="' + X(kmh) + '" x2="' + X(kmh) + '" y1="' + y0 + '" y2="' + (y0 + h) + '" stroke="#d4c600" stroke-width="2"/>';
    s += '<text x="' + (x0 + w) + '" y="' + (H - 2) + '" text-anchor="end">' + TS.t('hyKmhU') + '</text></svg>';
    return s;
  }

  function render() {
    var el = $('finPage'); if (!el) return;
    el.innerHTML =
      '<div class="fin-wrap">' +
      '<div class="fin-head"><img src="img/badge.svg" alt="" class="fin-badge"><div><h1>' + TS.t('finTitle') + '</h1><p class="lead">' + TS.t('finLead') + '</p></div></div>' +
      '<div class="fin-stage">' + SVG +
        '<div class="fin-ctl"><label><span>' + TS.t('finSpeed') + '</span><input id="finKmh" type="range" min="8" max="30" step="1" value="' + kmh + '"><b id="finKmhV"></b></label>' +
        '<div class="fin-num"><b id="finKg"></b><span id="finKgN"></span></div></div>' +
      '</div>' +
      '<div class="fin-cols">' +
        '<div><h2>' + TS.t('finHowT') + '</h2><ol class="fin-steps"><li>' + TS.t('finS1') + '</li><li>' + TS.t('finS2') + '</li><li>' + TS.t('finS3') + '</li><li>' + TS.t('finS4') + '</li></ol>' +
        '<h2>' + TS.t('finWhyT') + '</h2><p>' + TS.t('finWhy') + '</p></div>' +
        '<div><h2>' + TS.t('finChartT') + '</h2>' + chart() + '<p class="small">' + TS.t('finChartN') + '</p>' +
        '<p class="small">' + TS.t('finPatent') + '</p>' +
        '<div class="fin-btns"><button id="finCopy">' + TS.t('finCopy') + '</button><button id="finToWater">' + TS.t('finToWater') + '</button></div></div>' +
      '</div></div>';
    $('finSvgT').textContent = TS.t('finTitle');
    $('fL1').textContent = TS.t('finL1'); $('fL2').textContent = TS.t('finL2'); $('fL3').textContent = TS.t('finL3'); $('fL4').textContent = TS.t('finL4');
    $('fL5').textContent = TS.t('finL5'); $('finInsetT').textContent = TS.t('finInset');
    $('finArrowT').textContent = TS.t('finPress');
    $('finKmh').addEventListener('input', function () { kmh = +this.value; numbers(); });
    $('finCopy').addEventListener('click', function () {
      var url = location.href.split('#')[0] + '#fin';
      try { navigator.clipboard.writeText(url); this.textContent = TS.t('finCopied'); } catch (e) { prompt('', url); }
    });
    $('finToWater').addEventListener('click', function () { var t = document.querySelector('.tab[data-tab="hydro"]'); if (TS.state.model && t) t.click(); else TS.newBoard(); });
    // частицы: вода снаружи и в канале, пузырьки воздуха в трубке
    parts = [];
    var dots = $('finDots'), air = $('finAirDots'), streaks = $('finStreaks'), i, c, NS = 'http://www.w3.org/2000/svg';
    for (i = 0; i < 16; i++) { c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 3.2); c.setAttribute('fill', '#7fd0de'); dots.appendChild(c); parts.push({ el: c, kind: 'chan', s: i / 16 }); }
    for (i = 0; i < 4; i++) { c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 2.6); c.setAttribute('fill', '#fff'); c.setAttribute('stroke', '#0f4a57'); dots.appendChild(c); parts.push({ el: c, kind: 'rise', s: i / 4 }); }
    for (i = 0; i < 9; i++) { c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 2.6); c.setAttribute('fill', '#fff'); c.setAttribute('stroke', '#0f4a57'); air.appendChild(c); parts.push({ el: c, kind: 'air', s: i / 9 }); }
    for (i = 0; i < 16; i++) { c = document.createElementNS(NS, 'line'); streaks.appendChild(c); parts.push({ el: c, kind: 'water', s: (i * 0.37) % 1, y: 412 + (i * 29) % 180 }); }
    numbers(); start();
  }

  function numbers() {
    var q = holdAt(kmh);
    $('finKmhV').textContent = kmh + ' ' + TS.t('hyKmhU');
    $('finKg').textContent = '≈ ' + q.kg.toFixed(0) + ' ' + TS.t('hyKgf');
    $('finKgN').textContent = TS.t('finKgN') + ' ' + DIM.pad + ' ' + TS.t('hyCm2') + ' · ' + TS.t('hyVac').toLowerCase() + ' ' + (q.vac / 1000).toFixed(0) + ' ' + TS.t('hyKpa');
    var arr = document.querySelectorAll('#finSvg path[marker-end]');
    for (var ai = 0; ai < arr.length; ai++) arr[ai].setAttribute('stroke-width', (2.5 + q.kg / 6).toFixed(1));
    var m = $('finMark'); if (m) { var x = 34 + (kmh - 8) / 22 * 274; m.setAttribute('x1', x); m.setAttribute('x2', x); }
  }

  function step(ts) {
    if (!document.body || document.body.getAttribute('data-tab') !== 'fin') { raf = null; return; }
    var dt = t0 ? Math.min(0.05, (ts - t0) / 1000) : 0; t0 = ts;
    var v = reduce ? 0 : kmh / 18, chan = $('finChan'), tube = $('finTube'), rise = $('finRise');
    var LC = chan.getTotalLength(), LT = tube.getTotalLength(), LR = rise.getTotalLength();
    parts.forEach(function (p) {
      var pt;
      if (p.kind === 'water') {
        p.s = (p.s + dt * 0.3 * v) % 1;
        var x = -80 + p.s * 1160; p.el.setAttribute('x1', x); p.el.setAttribute('x2', x + 22 + 14 * v); p.el.setAttribute('y1', p.y); p.el.setAttribute('y2', p.y);
      } else if (p.kind === 'chan') {
        var sp = (p.s > 0.36 && p.s < 0.6) ? 2.4 : 1;                      // в сужении быстрее
        p.s = (p.s + dt * 0.4 * v * sp) % 1;
        pt = chan.getPointAtLength(p.s * LC); p.el.setAttribute('cx', pt.x); p.el.setAttribute('cy', pt.y);
      } else if (p.kind === 'rise') {
        p.s = (p.s + dt * 0.35 * v) % 1;                                     // воздух из трубки вниз, в горло
        pt = rise.getPointAtLength((1 - p.s) * LR); p.el.setAttribute('cx', pt.x); p.el.setAttribute('cy', pt.y);
      } else {
        p.s = (p.s + dt * 0.18 * v) % 1;                                     // воздух из-под присоски по трубке к плавнику
        pt = tube.getPointAtLength(p.s * LT); p.el.setAttribute('cx', pt.x); p.el.setAttribute('cy', pt.y);
      }
    });
    raf = requestAnimationFrame(step);
  }
  function start() { if (!raf) { t0 = 0; raf = requestAnimationFrame(step); } }

  TS.finUI = {
    init: function () {
      try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { reduce = false; }
      render();
    },
    show: function () { if (!parts.length) render(); else { numbers(); start(); } },
    lang: function () { render(); }
  };
})(window.TS = window.TS || {});
