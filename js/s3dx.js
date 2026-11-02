/* Tentacle Shaper — чтение файла Shape3D X (.s3dx).
 * Файл — XML в кодировке iso-8859-1, единицы — сантиметры.
 * Кривые — составные кубические Безье: сегмент i = P[i], T2[i], T1[i+1], P[i+1].
 * GPL v3.
 */
(function (TS) {
  'use strict';

  // ---------- кривая Безье ----------
  function Curve(P, T1, T2, ctype, name) {
    this.P = P; this.T1 = T1; this.T2 = T2;
    this.ctype = ctype || []; this.name = name || '';
  }

  Curve.prototype.nSeg = function () { return this.P.length - 1; };

  // точка сегмента i при параметре t
  Curve.prototype.point = function (i, t) {
    var a = this.P[i], b = this.T2[i], c = this.T1[i + 1], d = this.P[i + 1];
    var u = 1 - t, k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
    return [k0 * a[0] + k1 * b[0] + k2 * c[0] + k3 * d[0],
            k0 * a[1] + k1 * b[1] + k2 * c[1] + k3 * d[1],
            k0 * a[2] + k1 * b[2] + k2 * c[2] + k3 * d[2]];
  };

  // n точек на сегмент (общие концы не дублируются)
  Curve.prototype.sample = function (n) {
    n = n || 200;
    var out = [];
    for (var i = 0; i < this.nSeg(); i++) {
      for (var j = (i === 0 ? 0 : 1); j < n; j++) out.push(this.point(i, j / (n - 1)));
    }
    return out;
  };

  // функция «координата по x» (кривая считается монотонной по x)
  Curve.prototype.byX = function (coord, n) {
    var s = this.sample(n || 400).slice().sort(function (p, q) { return p[0] - q[0]; });
    var xs = s.map(function (p) { return p[0]; });
    var vs = s.map(function (p) { return p[coord]; });
    return function (x) { return TS.interp1(x, xs, vs); };
  };

  // ---------- вспомогательные ----------
  TS.interp1 = function (x, xs, vs) {
    var n = xs.length;
    if (x <= xs[0]) return vs[0];
    if (x >= xs[n - 1]) return vs[n - 1];
    var lo = 0, hi = n - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (xs[m] <= x) lo = m; else hi = m; }
    var d = xs[hi] - xs[lo];
    var t = d > 0 ? (x - xs[lo]) / d : 0;
    return vs[lo] + t * (vs[hi] - vs[lo]);
  };

  function kids(node, tag) {
    var out = [];
    if (!node) return out;
    for (var c = node.firstElementChild; c; c = c.nextElementSibling) if (c.tagName === tag) out.push(c);
    return out;
  }
  function kid(node, tag) { return kids(node, tag)[0] || null; }
  function path(node, p) {
    var parts = p.split('/');
    for (var i = 0; i < parts.length && node; i++) node = kid(node, parts[i]);
    return node;
  }
  function text(node, p) { var n = p ? path(node, p) : node; return n ? n.textContent.trim() : null; }
  function num(node, p) { var t = text(node, p); return t === null ? NaN : parseFloat(t); }

  function points(poly) {
    return kids(poly, 'Point3d').map(function (p) { return [num(p, 'x'), num(p, 'y'), num(p, 'z')]; });
  }

  function readCurve(node) {
    if (!node) return null;
    var b = node.tagName === 'Bezier3d' ? node : kid(node, 'Bezier3d');
    if (!b) return null;
    var P = points(path(b, 'Control_points/Polygone3d'));
    var T1 = points(path(b, 'Tangents_1/Polygone3d'));
    var T2 = points(path(b, 'Tangents_2/Polygone3d'));
    var ct = P.map(function (_, i) { return parseInt(text(b, 'Control_type_point_' + i), 10) || 0; });
    var c = new Curve(P, T1, T2, ct, text(b, 'Name') || '');
    c.ttype = P.map(function (_, i) { return parseInt(text(b, 'Tangent_type_point_' + i), 10) || 0; });
    c.node = b;
    return c;
  }

  // ---------- вставки (Box_k): размеры в см, как в файле ----------
  function pt3(node, tag) { var n = path(node, tag + '/Point3d'); return n ? [num(n, 'x'), num(n, 'y'), num(n, 'z')] : null; }
  function readBox(w) {
    var bx = kid(w, 'Box') || w;
    var pc = pt3(bx, 'PointCenter') || pt3(bx, 'Ref_point') || [0, 0, 0];
    return {
      wrap: w, node: bx, name: text(bx, 'Name') || '',
      len: num(bx, 'Length'), wid: num(bx, 'Width'), depth: num(bx, 'Height'),
      ang: num(bx, 'AngleOz') || 0, x: pc[0], y: pc[1], z: pc[2],
      even: text(bx, 'Even') === '1', central: text(bx, 'Central') === '1',
      face: parseInt(text(bx, 'Face'), 10) || 0, cut: text(bx, 'CutCNC') === '1',
      dx: num(bx, 'PointRefDx') || 0, dy: num(bx, 'PointRefDy') || 0
    };
  }
  TS.readBox = readBox;
  // точки «Ref. point» (центр задней кромки), «PointRef» и «PointCenter» — из центра, длины и угла
  function writeBox(b) {
    var bx = b.node, h = b.len / 2, a = b.ang, ca = Math.cos(a), sa = Math.sin(a);
    var rear = [b.x - h * ca, b.y + h * sa];
    var pref = [rear[0] - b.dx * ca - b.dy * sa, rear[1] + b.dx * sa - b.dy * ca];
    function setPt(tag, p) {
      var n = path(bx, tag + '/Point3d'); if (!n) return;
      ['x', 'y'].forEach(function (t, k) { var e = kid(n, t); if (e && Math.abs(parseFloat(e.textContent) - p[k]) > 5e-7) e.textContent = f6(p[k]); });
    }
    setPt('PointCenter', [b.x, b.y]); setPt('Ref_point', rear); setPt('PointRef', pref);
    function setNum(tag, v, d) { var e = kid(bx, tag); if (e && isFinite(v) && Math.abs(parseFloat(e.textContent) - v) > Math.pow(10, -d) / 2) e.textContent = v.toFixed(d); }
    setNum('Length', b.len, 3); setNum('Width', b.wid, 3); setNum('Height', b.depth, 3); setNum('AngleOz', b.ang, 4);
    var ev = kid(bx, 'Even'); if (ev && (ev.textContent === '1') !== b.even) ev.textContent = b.even ? '1' : '0';
    var cc = kid(bx, 'CutCNC'); if (cc && (cc.textContent === '1') !== b.cut) cc.textContent = b.cut ? '1' : '0';
  }

  // ---------- разбор файла ----------
  // buf: ArrayBuffer содержимого .s3dx
  TS.parseS3dx = function (buf, fileName) {
    var txt = new TextDecoder('iso-8859-1').decode(buf);
    // Shape3D пишет тег <Ref. point> — это не XML; правим перед разбором
    var fixed = txt.split('Ref. point>').join('Ref_point>');
    var doc = new DOMParser().parseFromString(fixed, 'application/xml');
    var err = doc.getElementsByTagName('parsererror')[0];
    if (err) throw new Error('XML: ' + err.textContent.slice(0, 200));

    var B = doc.getElementsByTagName('Board')[0];
    if (!B) throw new Error('В файле нет доски (тег <Board>)');

    var board = {
      fileName: fileName || '',
      rawText: txt, doc: doc, B: B,
      name: text(B, 'Name') || '',
      length: num(B, 'Length'),
      info: {},
      otl: readCurve(kid(B, 'Otl')),
      strbot: readCurve(kid(B, 'StrBot')),
      strdeck: readCurve(kid(B, 'StrDeck')),
      top: {}, side: {},
      slices: []
    };
    ['Length', 'LengthDev', 'Width', 'Thickness', 'Tail_rocker', 'Nose_rocker', 'Volume',
     'VolumeTail', 'VolumeNose'].forEach(function (k) { board.info[k] = num(B, k); });

    // кривые точек сечений вдоль доски: Edited=1 — задаёт пользователь, 0 — посчитаны Shape3D
    for (var i = 0; i < 32; i++) {
      ['Top', 'Side'].forEach(function (s) {
        var n = kid(B, 'curveDef' + s + i);
        if (!n) return;
        var bd = kid(n, 'BezierDef');
        var c = readCurve(bd);
        if (c) board[s.toLowerCase()][i] = { edited: text(bd, 'Edited') === '1', curve: c };
      });
    }

    // толщина стрингера относительно низа (Stringer Top «привязан» к Stringer Bot)
    var s4 = kid(B, 'curveDefSide4');
    board.thickDiff = s4 ? readCurve(kid(kid(s4, 'BezierDef'), 'BezDiffRelativeTo')) : null;

    var ns = parseInt(text(B, 'Number_of_slices'), 10) || 0;
    for (var k = 0; k < ns; k++) {
      var w = kid(B, 'Couples_' + k), c = readCurve(w);
      if (c) { c.wrap = w; board.slices.push(c); }
    }
    // вставки (пробки плавников и т. п.)
    board.boxes = [];
    for (var bi = 0; bi < 64; bi++) {
      var bw = kid(B, 'Box_' + bi); if (!bw) continue;
      board.boxes.push(readBox(bw));
    }
    // где в файле стоят сечения: перед каким узлом вставлять при записи
    var lastW = board.slices.length ? board.slices[board.slices.length - 1].wrap : null;
    board.slicesAnchor = lastW ? lastW.nextSibling : null;
    if (!board.otl || !board.strbot || !board.strdeck || board.slices.length < 2)
      throw new Error('Не хватает кривых доски (контур, стрингер или сечения)');
    return board;
  };

  // ---------- запись ----------
  function f6(v) { return (Math.abs(v) < 5e-7 ? 0 : v).toFixed(6); }
  function writePoints(poly, pts) {
    var ps = kids(poly, 'Point3d');
    for (var i = 0; i < ps.length && i < pts.length; i++) {
      ['x', 'y', 'z'].forEach(function (t, k) {
        var n = kid(ps[i], t);
        // неизменённые числа не трогаем — файл остаётся байт в байт
        if (n && Math.abs(parseFloat(n.textContent) - pts[i][k]) > 5e-7) n.textContent = f6(pts[i][k]);
      });
    }
  }
  function writeCurve(c) {
    if (!c || !c.node) return;
    var cp0 = path(c.node, 'Control_points/Polygone3d');
    if (cp0 && kids(cp0, 'Point3d').length !== c.P.length) {
      rebuildPoly(cp0, c.P); rebuildPoly(path(c.node, 'Tangents_1/Polygone3d'), c.T1); rebuildPoly(path(c.node, 'Tangents_2/Polygone3d'), c.T2);
      rebuildTypes(c.node, c);
      return;
    }
    // тип касательной мог поменяться (ровная/горизонтальная)
    if (c.ttype) c.ttype.forEach(function (v, i) {
      var n = kid(c.node, 'Tangent_type_point_' + i);
      if (n && (parseInt(n.textContent, 10) || 0) !== v) n.textContent = ' ' + v;
    });
    writePoints(path(c.node, 'Control_points/Polygone3d'), c.P);
    writePoints(path(c.node, 'Tangents_1/Polygone3d'), c.T1);
    writePoints(path(c.node, 'Tangents_2/Polygone3d'), c.T2);
  }
  TS.copyCurveInto = function (src, dst) {
    if (!src || !dst || src === dst) return;
    dst.P = src.P.map(function (p) { return p.slice(); });
    dst.T1 = src.T1.map(function (p) { return p.slice(); });
    dst.T2 = src.T2.map(function (p) { return p.slice(); });
    if (src.ctype) dst.ctype = src.ctype.slice();
    if (src.ttype) dst.ttype = src.ttype.slice();
    if (src.free) dst.free = src.free.slice();
  };

  // число точек кривой изменилось — перестраиваем списки точек и типов в XML
  function rebuildPoly(poly, pts) {
    var old = kids(poly, 'Point3d'), tpl = old[0];
    if (!tpl) return;
    var ws = tpl.previousSibling && tpl.previousSibling.nodeType === 3 ? tpl.previousSibling.textContent : '\n';
    old.forEach(function (n) {
      if (n.previousSibling && n.previousSibling.nodeType === 3) n.parentNode.removeChild(n.previousSibling);
      n.parentNode.removeChild(n);
    });
    var tail = poly.lastChild;   // пробелы перед закрывающим тегом
    pts.forEach(function (p) {
      var c = tpl.cloneNode(true);
      ['x', 'y', 'z'].forEach(function (t, k) { var n = kid(c, t); if (n) n.textContent = f6(p[k]); });
      poly.insertBefore(poly.ownerDocument.createTextNode(ws), tail);
      poly.insertBefore(c, tail);
    });
    var nb = kid(poly, 'Nb_of_points'); if (nb) nb.textContent = String(pts.length);
  }
  function rebuildTypes(b, c) {
    var doc = b.ownerDocument, ws = '\n';
    var old = [];
    for (var ch = b.firstElementChild; ch; ch = ch.nextElementSibling)
      if (/^(Control|Tangent)_type_point_\d+$/.test(ch.tagName)) old.push(ch);
    if (!old.length) return;
    var anchor = old[old.length - 1].nextSibling;
    if (old[0].previousSibling && old[0].previousSibling.nodeType === 3) ws = old[0].previousSibling.textContent;
    old.forEach(function (n) {
      if (n.previousSibling && n.previousSibling.nodeType === 3) b.removeChild(n.previousSibling);
      b.removeChild(n);
    });
    function add(tag, v) { b.insertBefore(doc.createTextNode(ws), anchor); var e = doc.createElement(tag); e.textContent = ' ' + v; b.insertBefore(e, anchor); }
    c.P.forEach(function (_, i) { add('Control_type_point_' + i, (c.ctype && c.ctype[i]) || 0); });
    c.P.forEach(function (_, i) { add('Tangent_type_point_' + i, (c.ttype && c.ttype[i]) || 0); });
  }

  // fields: {Length, Width, ...} — числа для полей доски (в единицах файла)
  TS.writeS3dx = function (board, fields) {
    var B = board.B;
    // сечения: порядок, имена Couples_k и их число — по текущему списку
    var all = [];
    for (var ch = B.firstElementChild; ch; ch = ch.nextElementSibling) if (/^Couples_\d+$/.test(ch.tagName)) all.push(ch);
    var changed = all.length !== board.slices.length || board.slices.some(function (c, i) { return c.wrap !== all[i]; });
    if (changed) {
      var ws = all[0] && all[0].previousSibling && all[0].previousSibling.nodeType === 3 ? all[0].previousSibling.textContent : '\n';
      all.forEach(function (n) { if (n.previousSibling && n.previousSibling.nodeType === 3) B.removeChild(n.previousSibling); B.removeChild(n); });
      var anchor = board.slicesAnchor && board.slicesAnchor.parentNode === B ? board.slicesAnchor : null;
      board.slices.forEach(function (c, i) {
        var w = c.wrap;
        if (w.tagName !== 'Couples_' + i) {
          var nw = board.doc.createElement('Couples_' + i);
          while (w.firstChild) nw.appendChild(w.firstChild);
          c.wrap = nw; w = nw;
        }
        B.insertBefore(board.doc.createTextNode(ws), anchor);
        B.insertBefore(w, anchor);
      });
      var nsn = kid(B, 'Number_of_slices'); if (nsn) nsn.textContent = String(board.slices.length);
    }
    var curves = [board.otl, board.strbot, board.strdeck, board.thickDiff].concat(board.slices);
    Object.keys(board.top).forEach(function (k) { curves.push(board.top[k].curve); });
    Object.keys(board.side).forEach(function (k) { curves.push(board.side[k].curve); });
    curves.forEach(writeCurve);
    // вставки: список Box_k по текущему набору (добавленные — копии существующих)
    var allB = [];
    for (var cb = B.firstElementChild; cb; cb = cb.nextElementSibling) if (/^Box_\d+$/.test(cb.tagName)) allB.push(cb);
    var chB = allB.length !== board.boxes.length || board.boxes.some(function (bx, i) { return bx.wrap !== allB[i]; });
    if (chB) {
      var anchorB = allB.length ? allB[allB.length - 1].nextSibling : null;
      var wsB = allB[0] && allB[0].previousSibling && allB[0].previousSibling.nodeType === 3 ? allB[0].previousSibling.textContent : '\n\t\t';
      allB.forEach(function (n) { if (n.previousSibling && n.previousSibling.nodeType === 3) B.removeChild(n.previousSibling); B.removeChild(n); });
      board.boxes.forEach(function (bx, i) {
        var w = bx.wrap;
        if (w.tagName !== 'Box_' + i) { var nw = board.doc.createElement('Box_' + i); while (w.firstChild) nw.appendChild(w.firstChild); bx.wrap = nw; w = nw; }
        if (anchorB && anchorB.parentNode === B) { B.insertBefore(board.doc.createTextNode(wsB), anchorB); B.insertBefore(w, anchorB); }
        else { B.appendChild(board.doc.createTextNode(wsB)); B.appendChild(w); }
      });
      var nbb = kid(B, 'NbBoxesFastLoad'); if (nbb) nbb.textContent = String(board.boxes.length);
    }
    board.boxes.forEach(function (bx) { if (bx.changed) writeBox(bx); });
    Object.keys(fields || {}).forEach(function (k) {
      var n = kid(B, k);
      if (n && isFinite(fields[k]) && Math.abs(parseFloat(n.textContent) - fields[k]) > 5e-4) n.textContent = fields[k].toFixed(3);
    });
    var out = new XMLSerializer().serializeToString(board.doc);
    out = out.replace(/<([^\s\/<>]+)\/>/g, '<$1></$1>');           // Shape3D пишет пустые теги парой
    out = out.split('Ref_point>').join('Ref. point>');
    out = out.replace(/\r?\n/g, '\r\n').replace('?><', '?>\r\n<');
    if (/\r\n$/.test(board.rawText) && !/\r\n$/.test(out)) out += '\r\n';
    var bytes = new Uint8Array(out.length);
    for (var i = 0; i < out.length; i++) { var c = out.charCodeAt(i); bytes[i] = c < 256 ? c : 63; }
    return bytes;
  };

  TS.Curve = Curve;
})(window.TS = window.TS || {});
