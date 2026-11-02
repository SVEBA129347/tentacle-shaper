/* Tentacle Shaper — печать (как Plan mode в Shape3D): лист доски с размерами и шаблоны 1:1 по листам A4/A3.
 * Печатает браузер; «Сохранить как PDF» — в том же окне печати. Чертим в мм (SVG с единицами мм). GPL v3.
 */
(function (TS) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function f(v, d) { return isFinite(v) ? (+v).toFixed(d === undefined ? 1 : d) : '—'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var PAPER = { A4: [210, 297], A3: [297, 420] };
  var INK = '#000', THIN = 0.2, MID = 0.35;

  function path(pts, close) {
    return pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1].toFixed(2); }).join('') + (close ? 'Z' : '');
  }
  function line(x1, y1, x2, y2, w, dash) {
    return '<line x1="' + x1.toFixed(2) + '" y1="' + y1.toFixed(2) + '" x2="' + x2.toFixed(2) + '" y2="' + y2.toFixed(2) + '" stroke="' + INK + '" stroke-width="' + (w || THIN) + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + '/>';
  }
  function text(x, y, s, size, anchor, extra) {
    return '<text x="' + x.toFixed(2) + '" y="' + y.toFixed(2) + '" font-size="' + (size || 3) + '" text-anchor="' + (anchor || 'start') + '" font-family="Arial, Helvetica, sans-serif"' + (extra || '') + '>' + esc(s) + '</text>';
  }
  function page(w, h, body) {
    return '<div class="ppage" style="width:' + w + 'mm;height:' + h + 'mm"><svg xmlns="http://www.w3.org/2000/svg" width="' + w + 'mm" height="' + h + 'mm" viewBox="0 0 ' + w + ' ' + h + '">' + body + '</svg></div>';
  }
  // пробки: прямоугольник со скруглёнными концами, см → в пространство мм
  function plugOutline(o, sign) {
    var y = sign * Math.abs(o.y), ang = (o.central || Math.abs(o.y) < 1e-6) ? 0 : -sign * Math.abs(o.ang);
    var h = Math.max(0, (o.len - o.wid) / 2), r = o.wid / 2, ca = Math.cos(ang), sa = Math.sin(ang), pts = [], q;
    function P(u, v) { return [(o.x + u * ca - v * sa) * 10, (y + u * sa + v * ca) * 10]; }
    for (q = 0; q <= 12; q++) { var t = -Math.PI / 2 + Math.PI * q / 12; pts.push(P(h + r * Math.cos(t), r * Math.sin(t))); }
    for (q = 0; q <= 12; q++) { var t2 = Math.PI / 2 + Math.PI * q / 12; pts.push(P(-h + r * Math.cos(t2), r * Math.sin(t2))); }
    return pts;
  }

  // ---------- лист доски (альбомный): контур с ширинами, профиль, сечения, таблица ----------
  function boardSheet(paper) {
    var st = TS.state, b = st.board, m = new TS.Model(b), ms = m.measures(), vol = m.volume();
    var W = PAPER[paper][1], H = PAPER[paper][0], M = 10, k = W / 297;     // альбомная; k — масштаб шрифтов и отступов
    var Lmm = m.L * 10, s = (W - 2 * M) / Lmm, out = '';
    var name = b.fileName.replace(/\.s3dx$/i, '');
    // шапка
    out += text(M, M + 5 * k, name, 6 * k, 'start', ' font-weight="bold"');
    out += text(W - M, M + 5 * k, new Date().toLocaleDateString(), 3.2 * k, 'end');
    out += text(M, M + 11 * k, f(ms.lengthDev) + ' × ' + f(ms.width) + ' × ' + f(ms.thick) + ' ' + TS.t('mm') + '   ·   ' + TS.t('volume') + ' ' + f(vol, 2) + ' ' + TS.t('l') +
      '   ·   ' + TS.t('tailRocker') + ' ' + f(ms.tailRocker) + '   ·   ' + TS.t('noseRocker') + ' ' + f(ms.noseRocker) + ' ' + TS.t('mm'), 3.6 * k);
    // вид сверху
    var wMax = 0;
    var otl = b.otl.sample(160).map(function (p) { return [p[0] * 10, p[1] * 10]; });
    otl.forEach(function (p) { wMax = Math.max(wMax, p[1]); });
    var cy = M + 16 * k + wMax * s + 6 * k, X = function (x) { return M + x * s; };
    var full = otl.map(function (p) { return [X(p[0]), cy - p[1] * s]; }).concat(otl.slice().reverse().map(function (p) { return [X(p[0]), cy + p[1] * s]; }));
    out += '<path d="' + path(full, true) + '" fill="none" stroke="' + INK + '" stroke-width="' + MID + '"/>';
    out += line(X(0), cy, X(Lmm), cy, THIN, '3 1.5');
    (b.boxes || []).forEach(function (o) {
      [1, -1].forEach(function (sg) {
        if (sg < 0 && !(o.even && !(o.central || Math.abs(o.y) < 1e-6))) return;
        out += '<path d="' + path(plugOutline(o, sg).map(function (p) { return [X(p[0]), cy - p[1] * s]; }), true) + '" fill="none" stroke="' + INK + '" stroke-width="' + THIN + '"/>';
      });
    });
    // ширины на станциях (как в Shape3D: 0, 50, 100, 200, 300, 500 мм от хвоста и носа)
    var rows = ms.tail.concat(ms.nose);
    rows.forEach(function (r, i) {
      var x = X(r.x * 10), hw = r.width / 2 * s;
      if (r.d === 0) return;
      out += line(x, cy - hw, x, cy + hw, THIN, '1 1');
      out += text(x, cy - hw - 1.2 * k, f(r.width), 2.6 * k, 'middle');
      out += text(x, cy + hw + 3.2 * k, r.d + ' ' + TS.t(i < ms.tail.length ? 'prT' : 'prN'), 2.2 * k, 'middle', ' fill="#555"');
    });
    out += text(X(0) - 1, cy + 1, f(ms.tail[0].width), 2.6 * k, 'end');
    out += text(X(Lmm) + 1, cy + 1, f(ms.nose[ms.nose.length - 1].width), 2.6 * k, 'start');
    // вид сбоку, по высоте ×ex
    var top = cy + wMax * s + 10 * k, minZ = ms.minZ * 10, maxZ = -Infinity;
    var bot = b.strbot.sample(160).map(function (p) { return [p[0] * 10, p[2] * 10]; }), dk = b.strdeck.sample(160).map(function (p) { return [p[0] * 10, p[2] * 10]; });
    dk.forEach(function (p) { maxZ = Math.max(maxZ, p[1]); });
    // растяжение по высоте — сколько влезает (место под сечения ~32 мм), но не больше 3
    var ex = Math.max(1, Math.min(3, Math.floor((H - M - 34 * k - top) / ((maxZ - minZ) * s) * 2) / 2));
    var base = top + (maxZ - minZ) * s * ex + 2 * k, Z = function (z) { return base - (z - minZ) * s * ex; };
    out += '<path d="' + path(dk.map(function (p) { return [X(p[0]), Z(p[1])]; }).concat(bot.slice().reverse().map(function (p) { return [X(p[0]), Z(p[1])]; })), true) + '" fill="none" stroke="' + INK + '" stroke-width="' + MID + '"/>';
    out += line(X(0), base, X(Lmm), base, THIN, '3 1.5');
    out += text(W - M, top - 1.5 * k, TS.t('vexag') + ex, 2.4 * k, 'end', ' fill="#555"');
    rows.forEach(function (r) {
      var x = X(r.x * 10), zb = Z(m.zb(r.x) * 10), zd = Z(m.zd(r.x) * 10);
      out += line(x, zd, x, base, THIN, '1 1');
      out += text(x, zd - 1.2 * k, f(r.thick), 2.4 * k, 'middle');
      if (r.rocker > 0.05) out += text(x, base + 3 * k, f(r.rocker), 2.4 * k, 'middle', ' fill="#555"');
      void zb;
    });
    // сечения: 300 мм от хвоста, самое широкое место, 300 мм от носа
    var secY = base + 9 * k, xs = [ms.xAtArc(300), ms.widthAt / 10, ms.xAtArc(ms.lengthDev - 300)], ss = Math.min(0.25 * k * 1.6, (W - 2 * M - 20) / 3 / (ms.width + 10));
    xs.forEach(function (x, i) {
      var h = m.section(x, 40).map(function (p) { return [p[0] * 10, p[1] * 10]; }), z0 = m.zb(x) * 10;
      var cx = M + (W - 2 * M) * (i + 0.5) / 3, zz = 0;
      h.forEach(function (p) { zz = Math.max(zz, p[1] - z0); });
      var gy = secY + 5 * k + zz * ss;
      var pts = h.map(function (p) { return [cx + p[0] * ss, gy - (p[1] - z0) * ss]; });
      pts = pts.concat(h.slice().reverse().map(function (p) { return [cx - p[0] * ss, gy - (p[1] - z0) * ss]; }));
      out += '<path d="' + path(pts, true) + '" fill="none" stroke="' + INK + '" stroke-width="' + MID + '"/>';
      var sm = m.sliceMeasures(x);
      var lab = i === 2 ? f(ms.lengthDev - ms.arcAtX(x), 0) + ' ' + TS.t('mm') + ' ' + TS.t('fromNose') : f(ms.arcAtX(x), 0) + ' ' + TS.t('mm') + ' ' + TS.t('fromTail');
      out += text(cx, secY, lab, 2.6 * k, 'middle');
      out += text(cx, gy + 4.5 * k, TS.t('width') + ' ' + f(sm.W) + ' · ' + TS.t('thick') + ' ' + f(sm.T) + ' · V ' + f(sm.V), 2.4 * k, 'middle', ' fill="#555"');
    });
    out += text(M, H - M + 3, 'Tentacle Shaper · ' + TS.t('prStations'), 2.2 * k, 'start', ' fill="#777"');
    return page(W, H, out);
  }

  // ---------- шаблоны 1:1 ----------
  // фигура: {pts: [[[x,y]...]...] (мм), marks: [{x, y, label}], w, h} → страницы с нахлёстом и метками
  function tiles(fig, paper, corr, title, ov) {
    var pw = PAPER[paper][0], ph = PAPER[paper][1], M = 8;
    // ориентация: меньше страниц
    function count(w, h) { return Math.ceil((fig.w * corr - ov) / (w - 2 * M - ov)) * Math.ceil((fig.h * corr - ov) / (h - 2 * M - ov)); }
    var land = count(ph, pw) < count(pw, ph);
    var W = land ? ph : pw, H = land ? pw : ph, aw = W - 2 * M, ah = H - 2 * M - 10;
    var nx = Math.max(1, Math.ceil((fig.w * corr - ov) / (aw - ov))), ny = Math.max(1, Math.ceil((fig.h * corr - ov) / (ah - ov)));
    var pages = [], total = nx * ny, n = 0;
    for (var j = 0; j < ny; j++) for (var i = 0; i < nx; i++) {
      n++;
      var ox = i * (aw - ov), oy = j * (ah - ov), body = '';
      body += '<defs><clipPath id="c' + n + '"><rect x="' + M + '" y="' + M + '" width="' + aw + '" height="' + ah + '"/></clipPath></defs>';
      body += '<g clip-path="url(#c' + n + ')"><g transform="translate(' + (M - ox) + ' ' + (M - oy) + ') scale(' + corr + ')">';
      fig.pts.forEach(function (pl) { body += '<path d="' + path(pl.p, pl.close) + '" fill="none" stroke="' + INK + '" stroke-width="' + (pl.w || 0.3) / corr + '"' + (pl.dash ? ' stroke-dasharray="' + pl.dash + '"' : '') + '/>'; });
      fig.marks.forEach(function (mk) {
        body += line(mk.x, mk.y - (mk.len || 4), mk.x, mk.y + (mk.len || 4), 0.25 / corr);
        if (mk.label) body += text(mk.x + 0.8, mk.y - 1, mk.label, 3 / corr);
      });
      (fig.texts || []).forEach(function (t) { body += text(t.x, t.y, t.s, (t.size || 4) / corr, t.anchor || 'start'); });
      body += '</g></g>';
      // рамка нахлёста и кресты совмещения
      body += '<rect x="' + M + '" y="' + M + '" width="' + aw + '" height="' + ah + '" fill="none" stroke="#999" stroke-width="0.15"/>';
      if (i > 0) body += line(M + ov, M, M + ov, M + ah, 0.15, '2 2');
      if (j > 0) body += line(M, M + ov, M + aw, M + ov, 0.15, '2 2');
      [[M, M], [M + aw, M], [M, M + ah], [M + aw, M + ah]].forEach(function (c) { body += line(c[0] - 3, c[1], c[0] + 3, c[1], 0.2) + line(c[0], c[1] - 3, c[0], c[1] + 3, 0.2); });
      // подпись и контрольный отрезок 100 мм
      var fy = H - M - 1;
      body += text(M, fy, title + ' · ' + TS.t('prSheet') + ' ' + n + '/' + total + ' (' + TS.t('prRow') + ' ' + (j + 1) + ', ' + TS.t('prCol') + ' ' + (i + 1) + ')' + (ov ? ' · ' + TS.t('prOverlap') + ' ' + ov + ' ' + TS.t('mm') : ''), 3);
      var by = fy - 5;
      body += line(W - M - 100, by, W - M, by, 0.4) + line(W - M - 100, by - 1.5, W - M - 100, by + 1.5, 0.3) + line(W - M, by - 1.5, W - M, by + 1.5, 0.3);
      body += text(W - M - 102, by + 1, TS.t('prCheck'), 2.6, 'end');
      pages.push(page(W, H, body));
    }
    return { html: pages.join(''), land: land, n: total };
  }
  // половина контура: от оси до края, X — по прямой от хвоста; метки через 100 мм
  function figOutline() {
    var b = TS.state.board, L = b.length * 10, otl = b.otl.sample(400).map(function (p) { return [p[0] * 10, p[1] * 10]; }), wM = 0;
    otl.forEach(function (p) { wM = Math.max(wM, p[1]); });
    var pad = 12, H = wM + 2 * pad, Y = function (y) { return pad + wM - y; };
    var pts = [{ p: otl.map(function (p) { return [p[0] + pad, Y(p[1])]; }), w: 0.4 },
               { p: [[pad, Y(0)], [L + pad, Y(0)]], w: 0.25, dash: '6 3' },
               { p: [[pad, Y(0)], [pad, Y(otl[0][1])]], w: 0.4 }, { p: [[L + pad, Y(0)], [L + pad, Y(otl[otl.length - 1][1])]], w: 0.4 }];
    var marks = [];
    for (var x = 0; x <= L + 1e-6; x += 100) marks.push({ x: x + pad, y: Y(0), label: String(Math.round(x)) });
    var texts = [{ x: pad + 2, y: Y(0) + 7, s: TS.t('prTail') + ' · ' + TS.t('prAxis') }, { x: L + pad - 2, y: Y(0) + 7, s: TS.t('prNose'), anchor: 'end' }];
    return { pts: pts, marks: marks, texts: texts, w: L + 2 * pad, h: H + 10 };
  }
  // стрингер: низ и верх в виде сбоку, база — прямая через нижнюю точку низа
  function figStringer() {
    var b = TS.state.board, L = b.length * 10;
    var bot = b.strbot.sample(400).map(function (p) { return [p[0] * 10, p[2] * 10]; }), dk = b.strdeck.sample(400).map(function (p) { return [p[0] * 10, p[2] * 10]; });
    var mn = Infinity, mx = -Infinity;
    bot.forEach(function (p) { mn = Math.min(mn, p[1]); }); dk.forEach(function (p) { mx = Math.max(mx, p[1]); });
    var pad = 12, Y = function (z) { return pad + (mx - z); };
    var prof = dk.map(function (p) { return [p[0] + pad, Y(p[1])]; }).concat(bot.slice().reverse().map(function (p) { return [p[0] + pad, Y(p[1])]; }));
    var pts = [{ p: prof, close: true, w: 0.4 }, { p: [[pad, Y(mn)], [L + pad, Y(mn)]], w: 0.25, dash: '6 3' }];
    var marks = [];
    for (var x = 0; x <= L + 1e-6; x += 100) marks.push({ x: x + pad, y: Y(mn), label: String(Math.round(x)) });
    var texts = [{ x: pad + 2, y: Y(mn) + 7, s: TS.t('prTail') + ' · ' + TS.t('prBase') }, { x: L + pad - 2, y: Y(mn) + 7, s: TS.t('prNose'), anchor: 'end' }];
    return { pts: pts, marks: marks, texts: texts, w: L + 2 * pad, h: (mx - mn) + 2 * pad + 10 };
  }
  // сечения: каждое целиком (обе половины) на отдельной фигуре
  function figSlice(x) {
    var m = new TS.Model(TS.state.board), h = m.section(x, 80).map(function (p) { return [p[0] * 10, p[1] * 10]; }), z0 = m.zb(x) * 10;
    var mx = 0, hw = 0; h.forEach(function (p) { mx = Math.max(mx, p[1] - z0); hw = Math.max(hw, p[0]); });
    var mn = 0; h.forEach(function (p) { mn = Math.min(mn, p[1] - z0); });
    var pad = 12, cx = pad + hw, Y = function (z) { return pad + 8 + (mx - (z - z0)); };
    var pts = h.map(function (p) { return [cx + p[0], Y(p[1])]; }).concat(h.slice().reverse().map(function (p) { return [cx - p[0], Y(p[1])]; }));
    var sm = m.sliceMeasures(x), ms = m.measures([0]);
    return { pts: [{ p: pts, close: true, w: 0.4 }, { p: [[cx, Y(z0 + mx) - 4], [cx, Y(z0 + mn) + 4]], w: 0.25, dash: '4 2' }],
             marks: [], texts: [{ x: pad, y: pad + 2, s: TS.t('slice') + ' · ' + f(ms.arcAtX(x), 0) + ' ' + TS.t('mm') + ' ' + TS.t('fromTail') + ' (' + TS.t('prStr') + ') · ' + TS.t('width') + ' ' + f(sm.W) + ' · ' + TS.t('thick') + ' ' + f(sm.T) + ' ' + TS.t('mm') }],
             w: 2 * hw + 2 * pad, h: (mx - mn) + 2 * pad + 16 };
  }

  function build() {
    var what = $('prWhat').value, paper = $('prPaper').value, corr = parseFloat(String($('prCorr').value).replace(',', '.'));
    if (!isFinite(corr) || corr < 0.8 || corr > 1.2) corr = 1;
    var ov = parseFloat($('prOv').value); if (!isFinite(ov) || ov < 0) ov = 10;
    var st = TS.state, name = st.board.fileName.replace(/\.s3dx$/i, ''), r;
    if (what === 'sheet') return { html: boardSheet(paper), land: true, n: 1 };
    if (what === 'otl') return tiles(figOutline(), paper, corr, name + ' · ' + TS.t('prOtl'), ov);
    if (what === 'str') return tiles(figStringer(), paper, corr, name + ' · ' + TS.t('prStrT'), ov);
    // сечения: все заданные или текущее
    var xs = what === 'secCur' ? [st.secX] : st.model.sliceX.filter(function (x) { return x > 0.5 && x < st.model.L - 0.5; });
    var html = '', n = 0, land = false;
    xs.forEach(function (x) { r = tiles(figSlice(x), paper, corr, name + ' · ' + TS.t('slice') + ' ' + f(x * 10, 0), ov); html += r.html; n += r.n; land = r.land; });
    return { html: html, land: land, n: n };
  }
  function preview() {
    if (!TS.state.model) return;
    var r = build();
    $('prPages').textContent = TS.t('prPages') + ': ' + r.n;
    return r;
  }
  function doPrint() {
    var r = preview(); if (!r) return;
    var paper = $('prPaper').value, pz = PAPER[paper];
    $('printArea').innerHTML = r.html;
    var css = $('printPageCss');
    css.textContent = '@page { size: ' + (r.land ? pz[1] + 'mm ' + pz[0] + 'mm' : pz[0] + 'mm ' + pz[1] + 'mm') + '; margin: 0; }';
    $('dlgPrint').hidden = true;
    setTimeout(function () { window.print(); }, 50);
  }
  TS.printBuild = build;      // для проверок
  TS.printUI = {
    init: function () {
      $('printBtn').addEventListener('click', function () { $('dlgPrint').hidden = false; preview(); });
      $('prClose').addEventListener('click', function () { $('dlgPrint').hidden = true; });
      $('prGo').addEventListener('click', doPrint);
      ['prWhat', 'prPaper', 'prCorr', 'prOv'].forEach(function (id) { $(id).addEventListener('change', preview); });
      window.addEventListener('afterprint', function () { $('printArea').innerHTML = ''; });
    }
  };
})(window.TS = window.TS || {});
