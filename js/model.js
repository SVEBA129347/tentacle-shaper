/* Tentacle Shaper — поверхность доски и размеры.
 * Сечение нормируется: y / y_апекса, z между центром дна и центром дека.
 * Нормированные точки и касательные плавно (PCHIP) ведутся вдоль доски через сечения,
 * затем растягиваются по кривой апекса (ширина) и по стрингеру (низ и верх).
 * Сверено с Shape3D X: ширина и рокер ±0.03 мм, объём −0.2…−0.45 %.
 * Единицы внутри — сантиметры, как в файле. GPL v3.
 */
(function (TS) {
  'use strict';

  // ---------- PCHIP (как scipy.interpolate.PchipInterpolator) ----------
  function pchipSlopes(x, y) {
    var n = x.length, h = [], m = [], d = new Array(n), i;
    for (i = 0; i < n - 1; i++) { h[i] = x[i + 1] - x[i]; m[i] = (y[i + 1] - y[i]) / h[i]; }
    if (n === 2) { d[0] = d[1] = m[0]; return d; }
    for (i = 1; i < n - 1; i++) {
      if (m[i - 1] * m[i] <= 0) { d[i] = 0; continue; }
      var w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      d[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
    }
    function edge(h0, h1, m0, m1) {
      var e = ((2 * h0 + h1) * m0 - h0 * m1) / (h0 + h1);
      if (Math.sign(e) !== Math.sign(m0)) e = 0;
      else if (Math.sign(m0) !== Math.sign(m1) && Math.abs(e) > Math.abs(3 * m0)) e = 3 * m0;
      return e;
    }
    d[0] = edge(h[0], h[1], m[0], m[1]);
    d[n - 1] = edge(h[n - 2], h[n - 3], m[n - 2], m[n - 3]);
    return d;
  }

  // интерполятор для набора величин: Y[k][j] — величина j в узле k
  function Pchip(xs, Y) {
    var nv = Y[0].length, D = [];
    for (var j = 0; j < nv; j++) {
      var col = Y.map(function (r) { return r[j]; });
      D.push(pchipSlopes(xs, col));
    }
    this.eval = function (x) {
      var n = xs.length, k = 0;
      if (x <= xs[0]) k = 0; else if (x >= xs[n - 1]) k = n - 2;
      else while (k < n - 2 && x > xs[k + 1]) k++;
      var h = xs[k + 1] - xs[k], t = Math.min(1, Math.max(0, (x - xs[k]) / h));
      var t2 = t * t, t3 = t2 * t;
      var h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
      var out = new Array(nv);
      for (var jj = 0; jj < nv; jj++)
        out[jj] = h00 * Y[k][jj] + h10 * h * D[jj][k] + h01 * Y[k + 1][jj] + h11 * h * D[jj][k + 1];
      return out;
    };
  }

  // ---------- модель ----------
  function Model(board) {
    this.board = board;
    var S = board.slices;
    this.nPts = S[0].P.length;
    this.apexIdx = findApex(board);
    this.sliceX = S.map(function (s) { return s.P[0][0]; });
    this.L = board.length;

    var apexTop = board.top[this.apexIdx] ? board.top[this.apexIdx].curve : board.otl;
    this.W = apexTop.byX(1);             // полуширина по апексу
    this.zb = board.strbot.byX(2);        // низ стрингера
    this.zd = board.strdeck.byX(2);       // верх стрингера
    this.halfW = board.otl.byX(1);        // контур (для размеров)

    var a = this.apexIdx, np = this.nPts;
    var rows = S.map(function (s) {
      var yA = s.P[a][1] || 1e-9, z0 = s.P[0][2], z1 = s.P[np - 1][2], dz = (z1 - z0) || 1e-9;
      var r = [];
      [s.P, s.T1, s.T2].forEach(function (A) {
        A.forEach(function (p) { r.push(p[1] / yA, (p[2] - z0) / dz); });
      });
      return r;
    });
    this.interp = new Pchip(this.sliceX, rows);
  }

  function findApex(board) {
    // редактируемая кривая сверху (кроме центра) — это апекс
    var best = -1;
    Object.keys(board.top).forEach(function (k) {
      var i = +k;
      if (i > 0 && board.top[k].edited && best < 0) best = i;
    });
    if (best > 0) return best;
    var mid = board.slices[Math.floor(board.slices.length / 2)];
    var m = 0;
    mid.P.forEach(function (p, i) { if (p[1] > mid.P[m][1]) m = i; });
    return m;
  }

  // контрольные точки сечения в x: {P, T1, T2} — массивы [y, z]
  Model.prototype.sectionCtrl = function (x) {
    var v = this.interp.eval(x), np = this.nPts;
    var W = this.W(x), zb = this.zb(x), zd = this.zd(x), dz = zd - zb;
    var res = [[], [], []];
    for (var g = 0; g < 3; g++)
      for (var i = 0; i < np; i++) {
        var o = (g * np + i) * 2;
        res[g].push([v[o] * W, zb + v[o + 1] * dz]);
      }
    return { P: res[0], T1: res[1], T2: res[2] };
  };

  // половина сечения: от центра дна через рейл к центру дека, точки [y, z]
  Model.prototype.section = function (x, n) {
    n = n || 24;
    var c = this.sectionCtrl(x), out = [];
    for (var k = 0; k < this.nPts - 1; k++) {
      var a = c.P[k], b = c.T2[k], cc = c.T1[k + 1], d = c.P[k + 1];
      for (var j = (k === 0 ? 0 : 1); j < n; j++) {
        var t = j / (n - 1), u = 1 - t;
        var k0 = u * u * u, k1 = 3 * u * u * t, k2 = 3 * u * t * t, k3 = t * t * t;
        out.push([k0 * a[0] + k1 * b[0] + k2 * cc[0] + k3 * d[0],
                  k0 * a[1] + k1 * b[1] + k2 * cc[1] + k3 * d[1]]);
      }
    }
    return out;
  };

  function halfArea(p) {
    var s = 0;
    for (var i = 0; i < p.length; i++) {
      var q = p[(i + 1) % p.length];
      s += p[i][0] * q[1] - q[0] * p[i][1];
    }
    return Math.abs(s) / 2;
  }

  Model.prototype.area = function (x) { return 2 * halfArea(this.section(x, 40)); };

  // объём, литры
  Model.prototype.volume = function (n) {
    n = n || 1500;
    var L = this.L, s = 0, prev = null;
    for (var i = 0; i < n; i++) {
      var x = L * i / (n - 1), A = this.area(x);
      if (prev !== null) s += (A + prev) / 2 * (L / (n - 1));
      prev = A;
    }
    return s / 1000;
  };

  // ---------- размеры (как Master Scale в Shape3D), мм ----------
  Model.prototype.measures = function (stations) {
    var b = this.board, self = this;
    var sb = b.strbot.sample(2000);
    var arc = [0];
    for (var i = 1; i < sb.length; i++)
      arc.push(arc[i - 1] + Math.hypot(sb[i][0] - sb[i - 1][0], sb[i][2] - sb[i - 1][2]));
    var S = arc[arc.length - 1];
    var xsArc = sb.map(function (p) { return p[0]; });
    function xAtArc(d) { return TS.interp1(d, arc, xsArc); }
    var minZ = Infinity, zeroX = 0;
    sb.forEach(function (p) { if (p[2] < minZ) { minZ = p[2]; zeroX = p[0]; } });

    // толщина по нормали к низу (так считает Shape3D в Master Scale; сверено ±0.04 мм)
    var dk = b.strdeck.sample(1500);
    function perpThick(x) {
      var e = 0.02, x0 = Math.max(0, x - e), x1 = Math.min(self.L, x + e);
      var px = x, pz = self.zb(x), tx = x1 - x0, tz = self.zb(x1) - self.zb(x0), tl = Math.hypot(tx, tz);
      tx /= tl; tz /= tl;
      var best = Infinity, prev = null;
      for (var i = 0; i < dk.length; i++) {
        var f = (dk[i][0] - px) * tx + (dk[i][2] - pz) * tz;
        if (prev !== null && (prev.f <= 0) !== (f <= 0)) {
          var t = prev.f / (prev.f - f), qx = prev.p[0] + (dk[i][0] - prev.p[0]) * t, qz = prev.p[2] + (dk[i][2] - prev.p[2]) * t;
          var d = Math.hypot(qx - px, qz - pz); if (d < best) best = d;
        }
        prev = { f: f, p: dk[i] };
      }
      if (!isFinite(best)) for (var j = 0; j < dk.length; j++) best = Math.min(best, Math.hypot(dk[j][0] - px, dk[j][2] - pz));
      return best;
    }
    function row(x) {
      return { x: x, width: 20 * self.halfW(x), thick: 10 * perpThick(x), rocker: 10 * (self.zb(x) - minZ), deck: 10 * (self.zd(x) - minZ) };
    }
    stations = stations || [0, 50, 100, 200, 305, 500];
    var tail = stations.map(function (d) { return Object.assign({ d: d }, row(xAtArc(Math.min(d / 10, S)))); });
    var nose = stations.slice().reverse().map(function (d) {
      return Object.assign({ d: d }, row(xAtArc(Math.max(S - d / 10, 0))));
    });

    var maxW = 0, maxWx = 0, maxT = 0, maxTx = 0;
    for (var k = 0; k <= 2000; k++) {
      var x = this.L * k / 2000, w = this.halfW(x), t = this.zd(x) - this.zb(x);
      if (w > maxW) { maxW = w; maxWx = x; }
      if (t > maxT) { maxT = t; maxTx = x; }
    }
    function arcAtX(x) { return TS.interp1(x, xsArc, arc) * 10; }
    return {
      lengthDev: S * 10, length: this.L * 10,
      width: maxW * 20, widthAt: arcAtX(maxWx),
      thick: maxT * 10, thickAt: arcAtX(maxTx),
      zeroAt: arcAtX(zeroX),
      tailRocker: 10 * (this.zb(0) - minZ), noseRocker: 10 * (this.zb(this.L) - minZ),
      tail: tail, nose: nose, minZ: minZ, xAtArc: function (mm) { return xAtArc(mm / 10); }, arcAtX: arcAtX, perpThick: function (x) { return 10 * perpThick(x); }
    };
  };

  // размеры сечения в x (мм): ширина, толщина по оси, высоты дека у рейла, апекс, V, точка рейла
  Model.prototype.sliceMeasures = function (x, dists) {
    dists = dists || [10, 20, 50, 100];
    var c = this.sectionCtrl(x), a = this.apexIdx, n = this.nPts, sec = this.section(x, 60);
    var zmin = Infinity; sec.forEach(function (p) { zmin = Math.min(zmin, p[1]); });
    var yA = c.P[a][0], zA = c.P[a][1];
    // деко-часть: от апекса к центру дека; высота над нижней точкой сечения на расстоянии d от апекса
    var per = (n - 1 - a) * 59 + 1, deckPart = sec.slice(sec.length - per);   // точки от апекса до центра дека
    function deckAt(d) {
      var y = yA - d / 10;
      for (var i = 1; i < deckPart.length; i++) {
        var p = deckPart[i - 1], q = deckPart[i];
        if ((p[0] - y) * (q[0] - y) <= 0 && p[0] !== q[0]) { var t = (y - p[0]) / (q[0] - p[0]); return 10 * (p[1] + (q[1] - p[1]) * t - zmin); }
      }
      return NaN;
    }
    var rp = a > 0 ? c.P[a - 1] : c.P[0];
    return {
      W: 20 * yA, T: 10 * (c.P[n - 1][1] - c.P[0][1]),
      deck: dists.map(function (d) { return { d: d, h: deckAt(d) }; }),
      AB: 10 * (zA - zmin), AD: 10 * (c.P[n - 1][1] - zA),
      V: 10 * (rp[1] - c.P[0][1]), rail: 10 * rp[0]
    };
  };

  // высота низа доски в точке (x, |y|), см
  Model.prototype.bottomZ = function (x, y) {
    var sec = this.section(x, 40), a = this.apexIdx, n = a * 39 + 1, ay = Math.abs(y);
    for (var i = 1; i < n && i < sec.length; i++) {
      var p = sec[i - 1], q = sec[i];
      if ((p[0] - ay) * (q[0] - ay) <= 0 && p[0] !== q[0]) return p[1] + (q[1] - p[1]) * (ay - p[0]) / (q[0] - p[0]);
    }
    return sec[0][1];
  };

  // сетка поверхности для 3D: массив сечений (обе половины), мм
  Model.prototype.mesh = function (nx, nsec) {
    nx = nx || 140; nsec = nsec || 16;
    var rows = [];
    for (var i = 0; i < nx; i++) {
      var u = i / (nx - 1);
      var x = this.L * (0.5 - 0.5 * Math.cos(Math.PI * u));   // гуще у носа и хвоста
      var half = this.section(x, nsec);
      var full = half.map(function (p) { return [x * 10, p[0] * 10, p[1] * 10]; });
      var mir = half.slice(1, -1).reverse().map(function (p) { return [x * 10, -p[0] * 10, p[1] * 10]; });
      rows.push(full.concat(mir));
    }
    return rows;
  };

  // линии точек сечения вдоль доски (для видов), мм: [{y:[[x,y]], z:[[x,z]]}]
  Model.prototype.pointLines = function (n) {
    n = n || 300;
    var lines = [];
    for (var p = 0; p < this.nPts; p++) lines.push({ top: [], side: [] });
    for (var i = 0; i < n; i++) {
      var x = this.L * i / (n - 1), c = this.sectionCtrl(x);
      for (var q = 0; q < this.nPts; q++) {
        lines[q].top.push([x * 10, c.P[q][0] * 10]);
        lines[q].side.push([x * 10, c.P[q][1] * 10]);
      }
    }
    return lines;
  };

  TS.Model = Model;
  TS.pchipSlopes = pchipSlopes;
})(window.TS = window.TS || {});
