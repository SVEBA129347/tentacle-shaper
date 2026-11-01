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
    return new Curve(P, T1, T2, ct, text(b, 'Name') || '');
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
      rawText: txt,
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

    var ns = parseInt(text(B, 'Number_of_slices'), 10) || 0;
    for (var k = 0; k < ns; k++) {
      var c = readCurve(kid(B, 'Couples_' + k));
      if (c) board.slices.push(c);
    }
    if (!board.otl || !board.strbot || !board.strdeck || board.slices.length < 2)
      throw new Error('Не хватает кривых доски (контур, стрингер или сечения)');
    return board;
  };

  TS.Curve = Curve;
})(window.TS = window.TS || {});
