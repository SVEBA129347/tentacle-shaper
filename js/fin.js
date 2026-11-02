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
  '<svg id="finSvg" viewBox="0 0 1000 600" role="img" aria-labelledby="finSvgT">' +
  '<title id="finSvgT"></title>' +
  '<defs>' +
    '<linearGradient id="fSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfaf3"/><stop offset="1" stop-color="#eef0e8"/></linearGradient>' +
    '<linearGradient id="fW" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fc0cd"/><stop offset="1" stop-color="#2f7d8f"/></linearGradient>' +
    '<linearGradient id="fBoard" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff35a"/><stop offset="1" stop-color="#e2d400"/></linearGradient>' +
    '<linearGradient id="fFin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#575757"/><stop offset="1" stop-color="#101010"/></linearGradient>' +
    '<path id="fFinShape" d="M0 0C.16 .32 .5 .8 1.06 .98C1.16 1.01 1.2 .95 1.13 .9C.98 .78 .86 .55 .86 .32C.86 .14 .9 .04 .98 0Z"/>' +
    '<linearGradient id="fFace" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2f7d8f"/><stop offset=".7" stop-color="#3f98a3"/><stop offset="1" stop-color="#8fd3c8"/></linearGradient>' +
    '<linearGradient id="fRail" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff7a0"/><stop offset=".45" stop-color="#f2e400"/><stop offset="1" stop-color="#c9bd00"/></linearGradient>' +
    '<marker id="fA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#c2255c"/></marker>' +
    '<clipPath id="fWater"><rect x="0" y="392" width="1000" height="208"/></clipPath>' +
  '</defs>' +
  '<rect width="1000" height="600" fill="url(#fSky)"/>' +
  // волна: склон поднимается вправо, гребень заворачивается
  '<path d="M0 398 C 260 396, 520 400, 700 396 C 800 393, 860 372, 900 320 C 930 280, 948 220, 962 176 C 972 146, 986 128, 1000 122 L 1000 600 L 0 600 Z" fill="url(#fFace)"/>' +
  '<path d="M0 420 C 300 418, 600 424, 1000 410 L 1000 600 L 0 600 Z" fill="#2a7385" opacity=".55"/>' +
  '<path d="M1000 104 C 960 98, 920 112, 902 140 C 892 156, 892 172, 900 184 C 906 168, 918 160, 932 162 C 948 164, 956 178, 952 194 C 966 180, 978 160, 1000 150 Z" fill="#ffffff" opacity=".95"/>' +
  '<path d="M916 182 C 912 210, 906 236, 896 262 M940 176 C 934 214, 926 250, 912 286" fill="none" stroke="#e9f6f8" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>' +
  '<path d="M0 398 C 260 396, 520 400, 700 396 C 800 393, 860 372, 900 320 C 930 280, 948 220, 962 176" fill="none" stroke="#e9f6f8" stroke-width="3"/>' +
  '<g id="finStreaks" stroke="#e9f6f8" stroke-width="2.2" stroke-linecap="round" opacity=".55" clip-path="url(#fWater)"></g>' +
  // брызги у хвоста
  '<path d="M846 386 C 870 372, 892 366, 912 370 M850 390 C 880 384, 905 386, 925 394" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>' +
  // плавник у хвоста (классическая форма с выносом назад)
  '<use href="#fFinShape" transform="translate(736 391) scale(72)" fill="url(#fFin)"/>' +
  // доска: дно и дек с рокером, нос поднят
  '<path id="finBoardShape" d="M128 344 C 170 353, 232 362, 330 364 C 470 366, 650 369, 780 372 C 816 373, 838 375, 848 378 C 852 382, 851 388, 844 391 C 700 393, 470 393, 340 388 C 250 384, 176 368, 128 344 Z" fill="url(#fRail)" stroke="#000" stroke-width="2" stroke-linejoin="round"/>' +
  '<path d="M150 351 C 230 366, 420 371, 600 374 C 700 375, 790 378, 842 382" fill="none" stroke="#a89d00" stroke-width="1.2" opacity=".8"/>' +
  // накладка на хвосте с упором
  '<path d="M690 371 L 832 375 C 840 375, 845 371, 846 364 C 846 360, 842 360, 840 364 C 838 368, 834 370, 828 370 L 692 366 Z" fill="#262626"/>' +
  // лиш от хвоста к задней ноге
  '<path d="M843 377 C 862 370, 850 352, 818 356 C 786 360, 760 350, 722 352" fill="none" stroke="#161616" stroke-width="2"/>' +
  // трубка внутри доски: от плавника вперёд к присоске
  '<path id="finTubeLine" d="M765 393 C 765 384, 752 383, 736 383 L 520 377 C 500 376, 490 372, 488 367" fill="none" stroke="#0f4a57" stroke-width="6" stroke-linecap="round"/>' +
  '<path d="M765 393 C 765 384, 752 383, 736 383 L 520 377 C 500 376, 490 372, 488 367" fill="none" stroke="#9edbe6" stroke-width="2" stroke-linecap="round"/>' +
  '<path id="finTube" d="M488 367 C 490 372, 500 376, 520 377 L 736 383 C 752 383, 765 384, 765 393" fill="none" stroke="none"/>' +
  // присоска под передней ногой
  '<rect x="458" y="358" width="62" height="7" rx="3.5" fill="#000"/>' +
  // райдер в стойке, лицом к носу; передняя стопа на присоске
  '<g fill="#161616"><path d="M548.9 223.1C553.6 232.6 565 233.6 575.5 239.9C586 246.1 601.4 254.6 611.9 260.9C622.4 267.1 630.8 275.4 638.5 277.6C646.1 279.8 654.6 277.7 657.7 274C660.8 270.3 660.6 262.2 656.9 255.2C653.2 248.3 643.6 241.4 635.5 232.3C627.3 223.2 616 209.8 607.9 200.5C599.8 191.3 597.2 179.8 587.1 176.9C577 173.9 553.5 175.1 547.2 182.8C540.8 190.5 544.2 213.6 548.9 223.1Z"/><path d="M636.5 274C637.8 280.8 643.1 289.1 648.5 296.7C654 304.3 662.2 312 669.2 319.6C676.2 327.2 685.3 336.4 690.3 342.2C695.3 348.1 696.1 352.3 699.4 354.5C702.7 356.8 707.9 357.4 710.1 355.9C712.3 354.4 713.6 349.3 712.6 345.5C711.5 341.6 707.8 339.4 703.9 332.9C699.9 326.3 693.9 314.9 689 305.9C684 297 678.9 287 674 279C669.1 271.1 665.1 261.9 659.5 258C654 254.1 644.7 253 640.8 255.6C637 258.3 635.2 267.1 636.5 274Z"/><path d="M536 172.6C525.5 173.9 521 183.6 511.8 191.3C502.7 199 490.1 210.9 481.2 218.9C472.2 226.9 462.5 232.6 458 239.3C453.6 246 451.9 254.9 454.6 259.2C457.2 263.4 466.2 266.1 474 264.7C481.8 263.3 490.5 255.9 501.4 251C512.3 246.2 528.4 240 539.5 235.4C550.6 230.8 562.1 232 568 223.4C573.8 214.8 580.2 192.1 574.9 183.6C569.5 175.2 546.6 171.3 536 172.6Z"/><path d="M451.9 257.2C451.7 263.9 456.7 272 460.4 280.2C464.2 288.4 469.9 297.6 474.4 306.4C478.9 315.2 484.4 326.2 487.4 333C490.4 339.7 490 343.8 492.5 346.8C495 349.7 500 351.7 502.5 350.8C505 349.8 507.4 345.1 507.5 341.2C507.6 337.3 504.6 334.4 502.9 327.3C501.1 320.1 499 307.8 496.9 298.1C494.8 288.4 493.4 277.6 490.4 269.1C487.5 260.6 483.9 252 479.1 247.1C474.3 242.3 466.2 238.5 461.6 240.2C457.1 241.9 452.1 250.5 451.9 257.2Z"/><path d="M506 338C502 337 496 345 490 348C484 351 475 353.8 470 356C465 358.2 461.7 359.3 460 361C458.3 362.7 451.3 365.2 460 366C468.7 366.8 503 368 512 366C521 364 515 358.7 514 354C513 349.3 510 339 506 338Z"/><path d="M712 344C708 343 702 351 696 354C690 357 681 359.8 676 362C671 364.2 667.7 365.3 666 367C664.3 368.7 657.3 371.2 666 372C674.7 372.8 709 374 718 372C727 370 721 364.7 720 360C719 355.3 716 345 712 344Z"/><path d="M593.8 185.9C596.2 177.4 589.7 176.9 585.6 170C581.6 163.1 574.1 153.1 569.5 144.4C564.9 135.7 561.6 126 558 117.9C554.5 109.9 551.5 101.8 548 96.2C544.6 90.7 540.8 87.2 537.3 84.7C533.8 82.3 533.1 82.7 527 81.4C520.8 80.1 506.1 73.2 500.5 76.7C494.8 80.3 495 96.2 493 102.6C491.1 109 488.8 110.4 489 114.9C489.1 119.5 490.4 124.5 493.7 130.1C497.1 135.8 504.3 143.2 508.9 148.7C513.4 154.1 517.3 155.8 520.9 162.9C524.5 169.9 528 183.4 530.4 190.9C532.9 198.5 529.1 202.8 535.8 207.9C542.6 213 561.3 225.2 570.9 221.6C580.6 217.9 591.3 194.5 593.8 185.9Z"/><ellipse cx="576" cy="196" rx="26" ry="30" transform="rotate(-20 576 196)"/><ellipse cx="514" cy="100" rx="20" ry="17"/><path d="M497.6 89.8C491.6 91.5 484.1 98.8 476.8 104.1C469.6 109.4 459 118.6 454.2 121.9C449.5 125.2 453 124.6 448.3 123.9C443.6 123.3 433.5 120.1 426.1 118.1C418.7 116.2 408.7 112.6 403.9 112.3C399.1 112 397.9 114.6 397.3 116.4C396.7 118.3 396.2 120.6 400.3 123.2C404.3 125.8 414.4 128.9 421.5 131.9C428.5 134.8 435.6 140.3 442.6 141C449.5 141.7 455.3 138.8 463 135.8C470.8 132.9 481.2 127.8 489.1 123.6C497 119.3 506.4 115 510.4 110.2C514.4 105.3 515.3 97.6 513.1 94.2C511 90.9 503.7 88.2 497.6 89.8Z"/><path d="M514.4 109.3C518.1 114.9 527.4 120.7 536 127C544.5 133.3 558.3 141.9 565.7 146.9C573.1 151.9 573.7 153.7 580.2 156.8C586.6 159.8 596.6 162.5 604.2 165.2C611.8 167.9 621.1 172.2 625.8 173C630.5 173.8 631.8 171.7 632.5 170C633.3 168.3 634 165.9 630.2 163C626.4 160 617 156.1 609.9 152.4C602.7 148.7 592.8 143.8 587.2 140.8C581.6 137.7 582.3 139.4 576.2 134.2C570.1 128.9 558.3 116.5 550.6 109.2C542.8 102 535.8 93.4 529.6 90.7C523.5 88 516.2 90.1 513.7 93.1C511.1 96.2 510.7 103.6 514.4 109.3Z"/><path d="M404 112C401.3 108.2 389.7 102.3 384 101C378.3 99.7 372.3 102.3 370 104C367.7 105.7 368.3 109.2 370 111C371.7 112.8 375 112.8 380 115C385 117.2 396 124.5 400 124C404 123.5 406.7 115.8 404 112Z"/><path d="M633 164C637.7 163.7 648.8 168.7 652 172C655.2 175.3 653.3 181.7 652 184C650.7 186.3 648.7 187.7 644 186C639.3 184.3 625.8 177.7 624 174C622.2 170.3 628.3 164.3 633 164Z"/><path d="M521.9 86.7C521.3 81.3 515.1 73.4 511.1 69.9C507.2 66.4 501.4 64.4 498.3 65.8C495.3 67.1 493.1 72.7 492.9 78.1C492.7 83.4 493.6 93.6 497.2 97.7C500.9 101.8 510.6 104.5 514.8 102.7C518.9 100.9 522.5 92.2 521.9 86.7Z"/><path d="M496 20C491 20 482.7 19.7 478 22C473.3 24.3 470 30.3 468 34C466 37.7 467.3 40.7 466 44C464.7 47.3 460 51.7 460 54C460 56.3 465.3 56.5 466 58C466.7 59.5 463.8 61.5 464 63C464.2 64.5 466.5 65.5 467 67C467.5 68.5 465.8 70.2 467 72C468.2 73.8 470.8 76.8 474 78C477.2 79.2 481.7 80 486 79C490.3 78 495.7 74.5 500 72C504.3 69.5 509 68 512 64C515 60 517.3 53.3 518 48C518.7 42.7 517.7 36.3 516 32C514.3 27.7 511.3 24 508 22C504.7 20 501 20 496 20Z"/><path d="M506 22 C 522 20, 536 26, 544 36 C 532 32, 526 34, 516 38 Z M514 40 C 528 42, 538 50, 542 60 C 532 52, 524 52, 516 54 Z M480 24 C 474 16, 484 12, 498 16 Z"/></g>' +
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
    '<path d="M179 89 C 200 91, 220 97, 232 97 C 248 97, 264 92, 278 92 L 281 114 C 266 112, 248 106, 232 106 C 220 106, 210 110, 202 113 Z" fill="#0f4a57"/>' +
    '<path d="M179 89 C 200 91, 220 97, 232 97 C 248 97, 264 92, 278 92" fill="none" stroke="#f2e400" stroke-width="2.5"/>' +
    '<path d="M202 113 C 210 110, 220 106, 232 106 C 248 106, 266 112, 281 114" fill="none" stroke="#f2e400" stroke-width="2.5"/>' +
    '<path d="M228 98 L 228 50 M 236 98 L 236 50" stroke="#9edbe6" stroke-width="2.5"/>' +
    '<path id="finChan" d="M110 101 C 170 101, 214 102, 232 102 C 252 102, 280 103, 350 108" fill="none" stroke="none"/>' +
    '<path id="finRise" d="M232 99 L 232 46" fill="none" stroke="none"/>' +
    '<g id="finDots"></g>' +
    '<g font-size="13" fill="#161616">' +
      '<text x="112" y="100" text-anchor="end" id="fL1"></text><path d="M116 96 L 178 94" stroke="#161616"/>' +
      '<text x="232" y="168" text-anchor="middle" id="fL2"></text><path d="M232 154 L 232 108" stroke="#161616"/>' +
      '<text x="330" y="80" id="fL5"></text><path d="M326 76 L 242 70" stroke="#161616"/>' +
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
