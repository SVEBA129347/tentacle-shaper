/* Tentacle Shaper — страница «Плавник-насос»: как работает плавник Tentaclesurf с каналом Вентури,
 * анимация потока и расчёт прижима присоски по скорости (TS.hydro.pump). Ссылка: …/#fin. GPL v3. */
(function (TS) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var DIM = { d1: 11, d2: 6, d3: 11, eta: 0.85, k: 0.3, depth: 70, pad: 80, seal: 0.8 };
  var kmh = 18, raf = null, t0 = 0, parts = [], reduce = false;

  // разрез: доска едет влево, вода бежит вправо; канал в плавнике, трубка к присоске на деке
  var SVG = '' +
  '<svg id="finSvg" viewBox="0 0 800 400" role="img" aria-labelledby="finSvgT">' +
  '<title id="finSvgT"></title>' +
  '<defs><linearGradient id="fW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfe7ec"/><stop offset="1" stop-color="#8fc3cf"/></linearGradient>' +
  '<marker id="fA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#000"/></marker></defs>' +
  '<rect x="0" y="150" width="800" height="250" fill="url(#fW)"/>' +
  '<path d="M0 150 Q 40 146 80 150 T 160 150 T 240 150 T 320 150 T 400 150 T 480 150 T 560 150 T 640 150 T 720 150 T 800 150" fill="none" stroke="#5aa3b3" stroke-width="2"/>' +
  '<g id="finStreaks" stroke="#ffffff" stroke-width="2" stroke-linecap="round" opacity=".7"></g>' +
  // доска
  '<path d="M40 150 C 60 126, 90 122, 140 122 L 700 124 C 740 125, 770 132, 790 146 L 790 150 Z" fill="#f2e400" stroke="#000" stroke-width="2.5"/>' +
  // плавник
  '<path id="finBody" d="M415 150 C 440 230, 520 300, 610 338 C 592 285, 566 222, 566 150 Z" fill="#161616"/>' +
  // канал: стенки
  '<path d="M452 236 C 485 239, 505 248, 522 249 C 540 249, 562 246, 590 249 L 594 272 C 562 263, 540 258, 522 258 C 506 258, 488 262, 456 262 Z" fill="#0f4a57"/>' +
  '<path d="M452 236 C 485 239, 505 248, 522 249 C 540 249, 562 246, 590 249" fill="none" stroke="#f2e400" stroke-width="3"/>' +
  '<path d="M456 262 C 488 262, 506 258, 522 258 C 540 258, 562 263, 594 272" fill="none" stroke="#f2e400" stroke-width="3"/>' +
  '<path id="finChan" d="M440 249 C 486 250, 505 253, 522 253 C 541 253, 565 256, 640 262" fill="none" stroke="none"/>' +
  // трубка от горла к присоске
  '<path d="M518 252 L 518 118 M 526 252 L 526 118" stroke="#f2e400" stroke-width="2"/>' +
  '<path id="finTube" d="M522 118 L 522 253" fill="none" stroke="none"/>' +
  // присоска и нога
  '<rect x="482" y="114" width="80" height="8" rx="4" fill="#000"/>' +
  '<path id="finFoot" d="M492 6 L 492 70 C 490 88, 484 100, 486 112 L 612 113 C 624 112, 626 102, 614 98 C 590 92, 560 86, 540 74 L 532 6 Z" fill="#e8c9a8" stroke="#000" stroke-width="2.5" stroke-linejoin="round"/>' +
  '<line id="finArrow" x1="440" y1="22" x2="440" y2="100" stroke="#000" stroke-width="4" marker-end="url(#fA)"/>' +
  '<text id="finArrowT" x="426" y="44" font-size="20" font-weight="600" text-anchor="end"></text>' +
  '<g id="finDots"></g>' +
  // подписи
  '<g font-size="15" fill="#000"><text x="300" y="222" id="fL1" text-anchor="end"></text><text x="522" y="322" id="fL2" fill="#fff" text-anchor="middle"></text><text x="640" y="196" id="fL3"></text><text x="660" y="100" id="fL4"></text></g>' +
  '<path d="M306 218 L 452 246" stroke="#000" stroke-width="1.2"/><path d="M522 304 L 522 262" stroke="#fff" stroke-width="1.2"/><path d="M636 192 L 530 192" stroke="#000" stroke-width="1.2"/><path d="M656 96 L 566 116" stroke="#000" stroke-width="1.2"/>' +
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
    $('finArrowT').textContent = TS.t('finPress');
    $('finKmh').addEventListener('input', function () { kmh = +this.value; numbers(); });
    $('finCopy').addEventListener('click', function () {
      var url = location.href.split('#')[0] + '#fin';
      try { navigator.clipboard.writeText(url); this.textContent = TS.t('finCopied'); } catch (e) { prompt('', url); }
    });
    $('finToWater').addEventListener('click', function () { var t = document.querySelector('.tab[data-tab="hydro"]'); if (TS.state.model && t) t.click(); else TS.newBoard(); });
    // частицы: вода снаружи и в канале, пузырьки воздуха в трубке
    parts = [];
    var dots = $('finDots'), streaks = $('finStreaks'), i, c;
    for (i = 0; i < 14; i++) { c = el.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', 4); c.setAttribute('fill', '#2b8fa6'); dots.appendChild(c); parts.push({ el: c, kind: 'chan', s: i / 14 }); }
    for (i = 0; i < 6; i++) { c = el.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('r', 3.2); c.setAttribute('fill', '#fff'); c.setAttribute('stroke', '#2b8fa6'); dots.appendChild(c); parts.push({ el: c, kind: 'air', s: i / 6 }); }
    for (i = 0; i < 18; i++) { c = el.ownerDocument.createElementNS('http://www.w3.org/2000/svg', 'line'); streaks.appendChild(c); parts.push({ el: c, kind: 'water', s: i / 18, y: 175 + (i * 37) % 210 }); }
    numbers(); start();
  }

  function numbers() {
    var q = holdAt(kmh);
    $('finKmhV').textContent = kmh + ' ' + TS.t('hyKmhU');
    $('finKg').textContent = '≈ ' + q.kg.toFixed(0) + ' ' + TS.t('hyKgf');
    $('finKgN').textContent = TS.t('finKgN') + ' ' + DIM.pad + ' ' + TS.t('hyCm2') + ' · ' + TS.t('hyVac').toLowerCase() + ' ' + (q.vac / 1000).toFixed(0) + ' ' + TS.t('hyKpa');
    var a = $('finArrow'); a.setAttribute('stroke-width', (2 + q.kg / 5).toFixed(1));
    var m = $('finMark'); if (m) { var x = 34 + (kmh - 8) / 22 * 274; m.setAttribute('x1', x); m.setAttribute('x2', x); }
  }

  function step(ts) {
    if (!document.body || document.body.getAttribute('data-tab') !== 'fin') { raf = null; return; }
    var dt = t0 ? Math.min(0.05, (ts - t0) / 1000) : 0; t0 = ts;
    var v = reduce ? 0 : kmh / 18, chan = $('finChan'), tube = $('finTube');
    var LC = chan.getTotalLength(), LT = tube.getTotalLength();
    parts.forEach(function (p) {
      if (p.kind === 'water') {
        p.s = (p.s + dt * 0.35 * v) % 1;
        var x = -60 + p.s * 920; p.el.setAttribute('x1', x); p.el.setAttribute('x2', x + 18 + 10 * v); p.el.setAttribute('y1', p.y); p.el.setAttribute('y2', p.y);
      } else if (p.kind === 'chan') {
        // в горле быстрее: шаг по пути зависит от места
        var sp = (p.s > 0.4 && p.s < 0.6) ? 2.2 : 1;
        p.s = (p.s + dt * 0.45 * v * sp) % 1;
        var pt = chan.getPointAtLength(p.s * LC); p.el.setAttribute('cx', pt.x); p.el.setAttribute('cy', pt.y);
      } else {
        p.s = (p.s + dt * 0.25 * v) % 1;
        var q = tube.getPointAtLength(p.s * LT); p.el.setAttribute('cx', q.x); p.el.setAttribute('cy', q.y);
        p.el.setAttribute('opacity', v > 0 ? 1 : 0.6);
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
