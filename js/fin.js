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
  '<svg id="finSvg" viewBox="0 70 1000 530" role="img" aria-labelledby="finSvgT">' +
  '<title id="finSvgT"></title>' +
  '<defs>' +
    '<linearGradient id="fSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfaf3"/><stop offset="1" stop-color="#eef0e8"/></linearGradient>' +
    '<linearGradient id="fW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc0cd"/><stop offset="1" stop-color="#2f7d8f"/></linearGradient>' +
    '<linearGradient id="fBoard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff35a"/><stop offset="1" stop-color="#e2d400"/></linearGradient>' +
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
  '<path d="M738 393 C 746 425, 772 456, 812 474 C 800 448, 790 420, 792 393 Z" fill="#161616"/>' +
  // доска: дно и дек с рокером, нос поднят
  '<path id="finBoardShape" d="M842 393 C 650 397, 380 394, 230 380 C 185 376, 156 366, 134 349 C 160 352, 196 356, 232 359 C 390 368, 650 372, 846 374 C 852 378, 852 389, 842 393 Z" fill="url(#fBoard)" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>' +
  // трубка внутри доски: от плавника вперёд к присоске
  '<path id="finTubeLine" d="M765 393 C 765 384, 752 383, 736 383 L 520 377 C 500 376, 490 372, 488 367" fill="none" stroke="#0f4a57" stroke-width="6" stroke-linecap="round"/>' +
  '<path d="M765 393 C 765 384, 752 383, 736 383 L 520 377 C 500 376, 490 372, 488 367" fill="none" stroke="#9edbe6" stroke-width="2" stroke-linecap="round"/>' +
  '<path id="finTube" d="M488 367 C 490 372, 500 376, 520 377 L 736 383 C 752 383, 765 384, 765 393" fill="none" stroke="none"/>' +
  // присоска под передней ногой
  '<rect x="458" y="358" width="62" height="7" rx="3.5" fill="#000"/>' +
  // райдер: пиктограмма в стойке, лицом к носу
  '<g fill="none" stroke="#161616" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M462 356 L 512 358" stroke-width="13"/>' +                          // передняя ступня
    '<path d="M712 368 L 760 370" stroke-width="13"/>' +                          // задняя ступня
    '<path d="M488 352 L 462 292 L 588 248" stroke-width="27"/>' +                // передняя нога: голень, бедро
    '<path d="M732 362 L 690 298 L 600 252" stroke-width="27"/>' +                // задняя нога
    '<path d="M594 250 L 552 170" stroke-width="40"/>' +                          // корпус
    '<path d="M548 176 L 486 196 L 424 226" stroke-width="18"/>' +                // передняя рука
    '<path d="M560 174 L 622 172 L 676 142" stroke-width="18"/>' +                // задняя рука
  '</g>' +
  '<circle cx="532" cy="128" r="27" fill="#161616"/>' +
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
  '<circle cx="775" cy="430" r="52" fill="none" stroke="#fff" stroke-width="2" stroke-dasharray="6 5"/>' +
  '<path d="M724 446 L 472 520" stroke="#fff" stroke-width="2" stroke-dasharray="6 5"/>' +
  // плавник крупно: панель
  '<g transform="translate(24 404)">' +
    '<rect width="448" height="182" rx="16" fill="#fbfaf3" stroke="#161616" stroke-width="2"/>' +
    '<text x="18" y="28" font-size="16" font-weight="600" id="finInsetT"></text>' +
    '<rect x="120" y="40" width="250" height="14" fill="url(#fBoard)" stroke="#000" stroke-width="2"/>' +
    '<path d="M170 54 C 186 104, 240 150, 340 172 C 312 128, 292 90, 296 54 Z" fill="#161616"/>' +
    // канал Вентури
    '<path d="M196 104 C 222 106, 238 114, 252 115 C 268 115, 284 112, 312 114 L 316 136 C 288 128, 268 124, 252 124 C 236 124, 220 128, 200 130 Z" fill="#0f4a57"/>' +
    '<path d="M196 104 C 222 106, 238 114, 252 115 C 268 115, 284 112, 312 114" fill="none" stroke="#f2e400" stroke-width="2.5"/>' +
    '<path d="M200 130 C 220 128, 236 124, 252 124 C 268 124, 288 128, 316 136" fill="none" stroke="#f2e400" stroke-width="2.5"/>' +
    '<path d="M248 115 L 248 50 M 256 115 L 256 50" stroke="#9edbe6" stroke-width="2.5"/>' +
    '<path id="finChan" d="M150 116 C 210 117, 236 119, 252 119 C 270 119, 300 122, 380 130" fill="none" stroke="none"/>' +
    '<path id="finRise" d="M252 116 L 252 46" fill="none" stroke="none"/>' +
    '<g id="finDots"></g>' +
    '<g font-size="13" fill="#161616">' +
      '<text x="120" y="112" text-anchor="end" id="fL1"></text><path d="M124 108 L 184 112" stroke="#161616"/>' +
      '<text x="252" y="164" text-anchor="middle" id="fL2"></text><path d="M252 150 L 252 128" stroke="#161616"/>' +
      '<text x="330" y="80" id="fL5"></text><path d="M326 76 L 262 70" stroke="#161616"/>' +
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
