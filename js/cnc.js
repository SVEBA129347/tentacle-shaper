/* Tentacle Shaper — траектории фрезы и G-code.
 * Линии «серпами»: каждая линия идёт вдоль доски на постоянной доле длины дуги сечения
 * от стрингера к рейлу, поэтому у носа и хвоста линии сходятся.
 * Фреза bull nose: диаметр D, радиус угла r1, радиус дна R2 (как в Shape3D).
 * Положение фрезы: касание в точке поверхности по нормали + проверка «опусканием фрезы»
 * (drop-cutter) по всей поверхности — зарезов нет.
 * Положение доски на станке: сдвиг от упора хвоста X0, наклон, высота в бланке; переворот вокруг
 * продольной оси: Y зеркально относительно оси, Z = толщина бланка − Z.
 * Сверено с G-code Shape3D (DS 133, Sombra 135): касание ±0.3 мм на теле доски.
 * Внутри — миллиметры. GPL v3.
 */
(function (TS) {
  'use strict';

  function num(B, tag) {
    if (!B) return NaN;
    var n = B.getElementsByTagName(tag)[0];
    return n ? parseFloat(n.textContent) : NaN;
  }
  function or(v, d) { return isFinite(v) ? v : d; }

  // ---------- настройки по умолчанию (из блока Machine файла, если есть) ----------
  TS.cncDefaults = function (board, model) {
    var M = board.B.getElementsByTagName('Machine')[0];
    var ob = board.B.getElementsByTagName('OffsetBlank')[0];
    var obx = ob ? num(ob, 'x') : NaN;
    var s = {
      D: or(num(M, 'Diametre') * 10, 22.5), r1: or(num(M, 'Rayon_corner') * 10, 8), R2: or(num(M, 'Rayon_fond') * 10, 30),
      nDeck: or(Math.round(num(M, 'Nb_deck_lines') / 2), 33), nBot: or(Math.round(num(M, 'Nb_bottom_lines') / 2), 30),
      nRail: or(Math.round(num(M, 'Nb_rail_lines') / 2), 5), varMax: or(num(M, 'VarMaxTop'), or(num(M, 'VarMax'), 4)),
      varMaxBot: or(num(M, 'VarMaxBot'), -1),
      nPts: 50, feed: 6000, feedHead: 12000,
      X0: or(obx * 10, 38.04), Yc: or(-num(M, 'PointOY') * 10, 600),
      Tb: 80, tilt: 0, zMode: 'center', Z0: 0, stringer: true, safeZ: 15,
      rough: true, roughStep: or(num(M, 'DzOutlineRoughing') * 10, 30), roughMargin: or(num(M, 'Marge_detourage') * 10, 10),
      roughLoops: 3, roughLoopStep: 18,
      bridges: or(num(M, 'NbPlotsMaintient'), 2) > 0, bridgeL: or(num(M, 'LargeurPlotsMaintient') * 10, 50),
      bridgeH: or(num(M, 'HauteurPlotsMaintient') * 10, 15),
      endCut: or(num(M, 'CutStringerTailDeck'), 1) > 0, xMin: 4, plugs: true
    };
    if (s.Yc <= 0) s.Yc = 600;
    // наклон по умолчанию: концы дека на одной высоте (как ставит Shape3D, ±0.03°)
    var L = model.L * 10, zt = model.zd(0) * 10, zn = model.zd(model.L) * 10;
    s.tilt = Math.atan2(zn - zt, L) * 180 / Math.PI;
    TS.cncCenter(s, model);
    return s;
  };

  // высота: доска посередине толщины бланка
  TS.cncCenter = function (s, model) {
    var a = s.tilt * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a);
    var lo = Infinity, hi = -Infinity;
    for (var i = 0; i <= 300; i++) {
      var x = model.L * i / 300;
      [model.zb(x), model.zd(x)].forEach(function (z) {
        var Z = -x * 10 * sn + z * 10 * c; lo = Math.min(lo, Z); hi = Math.max(hi, Z);
      });
    }
    // у рейлов сечение может опускаться ниже стрингера — учтём апекс и рейл
    for (var j = 0; j <= 100; j++) {
      var xx = model.L * j / 100, cc = model.sectionCtrl(xx);
      cc.P.forEach(function (p) { var Z = -xx * 10 * sn + p[1] * 10 * c; lo = Math.min(lo, Z); hi = Math.max(hi, Z); });
    }
    s.Z0 = (s.Tb - (hi + lo)) / 2;
    s.boardLo = lo + s.Z0; s.boardHi = hi + s.Z0;
  };

  // ---------- координаты доски -> станок ----------
  function Frame(s, side) {
    var a = s.tilt * Math.PI / 180, c = Math.cos(a), sn = Math.sin(a), bot = side === 'bot';
    this.p = function (x, y, z) {
      var X = s.X0 + x * c + z * sn, Zd = s.Z0 - x * sn + z * c;
      return bot ? [X, s.Yc - y, s.Tb - Zd] : [X, s.Yc + y, Zd];
    };
    this.n = function (nx, ny, nz) {
      var X = nx * c + nz * sn, Z = -nx * sn + nz * c;
      return bot ? [X, -ny, -Z] : [X, ny, Z];
    };
  }

  // ---------- профиль фрезы ----------
  function Cutter(s) {
    var D = s.D, r1 = s.r1, R2 = s.R2, rc = D / 2 - r1;
    var sth = R2 > r1 ? Math.min(1, rc / (R2 - r1)) : 1, th = Math.asin(sth);
    var hc = R2 - (R2 - r1) * Math.cos(th), rt = R2 * sth;
    this.R = D / 2; this.sth = sth; this.rc = rc; this.hc = hc; this.r1 = r1; this.R2 = R2;
    // высота нижней поверхности фрезы над кончиком на радиусе rho
    this.h = function (rho) {
      if (rho <= rt) return R2 - Math.sqrt(Math.max(R2 * R2 - rho * rho, 0));
      return hc - Math.sqrt(Math.max(r1 * r1 - (rho - rc) * (rho - rc), 0));
    };
    // положение кончика по точке касания P и нормали n (станок)
    this.tip = function (P, n) {
      var nz = n[2], nxy = Math.hypot(n[0], n[1]);
      if (nz < 0) { var k = 1 / (nxy || 1); n = [n[0] * k, n[1] * k, 0]; nxy = 1; }
      if (nxy <= sth) return [P[0] + R2 * n[0], P[1] + R2 * n[1], P[2] + R2 * n[2] - R2];
      var cx = P[0] + r1 * n[0], cy = P[1] + r1 * n[1], cz = P[2] + r1 * n[2];
      return [cx + rc * n[0] / nxy, cy + rc * n[1] / nxy, cz - hc];   // ось дальше по нормали на rc
    };
  }

  // ---------- облако точек поверхности для проверки «опусканием фрезы» ----------
  function Cloud(model, fr, cell) {
    this.cell = cell; this.map = {};
    var L = model.L, nx = Math.ceil(L * 10 / 2.5);   // шаг ~2.5 мм
    for (var i = 0; i <= nx; i++) {
      var x = L * i / nx, sec = model.section(x, 30);
      for (var j = 0; j < sec.length; j++) {
        var y = sec[j][0], z = sec[j][1];
        this.add(fr.p(x * 10, y * 10, z * 10)); this.add(fr.p(x * 10, -y * 10, z * 10));
      }
    }
  }
  Cloud.prototype.add = function (p) {
    var k = Math.floor(p[0] / this.cell) + ',' + Math.floor(p[1] / this.cell);
    (this.map[k] || (this.map[k] = [])).push(p);
  };
  // наименьшая высота кончика, при которой фреза не врезается в поверхность
  Cloud.prototype.drop = function (X, Y, cut) {
    var R = cut.R, c = this.cell, best = -Infinity;
    var i0 = Math.floor((X - R) / c), i1 = Math.floor((X + R) / c), j0 = Math.floor((Y - R) / c), j1 = Math.floor((Y + R) / c);
    for (var i = i0; i <= i1; i++) for (var j = j0; j <= j1; j++) {
      var a = this.map[i + ',' + j]; if (!a) continue;
      for (var k = 0; k < a.length; k++) {
        var p = a[k], dx = p[0] - X, dy = p[1] - Y, rho = Math.sqrt(dx * dx + dy * dy);
        if (rho > R) continue;
        var z = p[2] - cut.h(rho); if (z > best) best = z;
      }
    }
    return best;
  };

  // ---------- распределение линий (повторяет шаги Shape3D, измерено по его G-code) ----------
  // Дек, сужение V: 6 одинаковых шагов, 15 шагов плавно уменьшаются до 1/V, затем мелкие шаги до рейла.
  // Дно без сужения: равные шаги до точки рейла, дальше линии рейла до апекса.
  function steps(nMain, v, nTail, vTail) {
    var st = [], i, k1 = Math.round(nMain * 6 / 29), k2 = Math.round(nMain * 15 / 29), k3 = nMain - k1 - k2;
    if (v >= 1) { for (i = 0; i < nMain; i++) st.push(1); }
    else {
      for (i = 0; i < k1; i++) st.push(1);
      for (i = 0; i < k2; i++) st.push(1 - (1 - v) * (i + 1) / k2);
      for (i = 0; i < k3; i++) st.push(v);
    }
    for (i = 0; i < nTail; i++) st.push(vTail === undefined ? v : vTail);
    return st;
  }
  function fractions(st) {
    var sum = st.reduce(function (a, b) { return a + b; }, 0), u = [], acc = 0;
    st.forEach(function (x) { acc += x; u.push(acc / sum); });
    return u;
  }
  TS.cncSpacing = function (s, side) {
    if (side === 'deck') {
      var v = s.varMax > 1 ? 1 / s.varMax : 1;
      return fractions(steps(Math.max(1, s.nDeck - s.nRail + 1), v, s.nRail));
    }
    var vb = s.varMaxBot > 1 ? 1 / s.varMaxBot : 1;
    return fractions(steps(Math.max(1, s.nBot + 1), vb, 0));
  };

  // точка на части сечения: idx — номера точек от и до (по порядку обхода), u — доля длины дуги
  function sectionPart(model, x, i0, i1) {
    var c = model.sectionCtrl(x), pts = [], step = i1 > i0 ? 1 : -1, N = 24;
    for (var k = i0; k !== i1; k += step) {
      var a = c.P[k], d = c.P[k + step], b = step > 0 ? c.T2[k] : c.T1[k], cc = step > 0 ? c.T1[k + 1] : c.T2[k - 1];
      for (var j = (pts.length ? 1 : 0); j <= N; j++) {
        var t = j / N, s = 1 - t;
        pts.push([s * s * s * a[0] + 3 * s * s * t * b[0] + 3 * s * t * t * cc[0] + t * t * t * d[0],
                  s * s * s * a[1] + 3 * s * s * t * b[1] + 3 * s * t * t * cc[1] + t * t * t * d[1]]);
      }
    }
    var arc = [0];
    for (var q = 1; q < pts.length; q++) arc.push(arc[q - 1] + Math.hypot(pts[q][0] - pts[q - 1][0], pts[q][1] - pts[q - 1][1]));
    return { pts: pts, arc: arc, len: arc[arc.length - 1] };
  }
  function at(part, u) {
    var s = u * part.len, a = part.arc, i = 1;
    while (i < a.length - 1 && a[i] < s) i++;
    var t = (a[i] - a[i - 1]) ? (s - a[i - 1]) / (a[i] - a[i - 1]) : 0, p = part.pts[i - 1], q = part.pts[i];
    return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
  }

  // ---------- расчёт всех траекторий одной стороны ----------
  // side: 'deck' | 'bot'. Возвращает {passes:[{kind, pts:[[X,Y,Z]]}], stats}
  TS.cncSide = function (model, s, side) {
    var fr = new Frame(s, side), cut = new Cutter(s), cloud = new Cloud(model, fr, 6);
    TS._lastCloud = cloud;
    var np = model.nPts, a = model.apexIdx, last = np - 1;
    var ranges;
    if (side === 'deck') {
      ranges = [{ i0: last, i1: a, u: TS.cncSpacing(s, 'deck') }];
    } else {
      var rp = Math.max(a - 1, 0);
      ranges = [{ i0: 0, i1: rp, u: TS.cncSpacing(s, 'bot') }];
      if (rp !== a && s.nRail > 1) ranges.push({ i0: rp, i1: a, u: fractions(steps(s.nRail - 1, 1, 0)) });
    }
    // станции вдоль доски: гуще у концов
    var L = model.L, N = Math.max(10, s.nPts), xs = [];
    for (var i = 0; i < N; i++) xs.push(L * (0.5 - 0.5 * Math.cos(Math.PI * i / (N - 1))));
    var hx = L * 0.002;

    // точка касания и нормаль на линии u (часть сечения r) в сечении x — координаты доски, мм
    function contact(r, u, x) {
      var x0 = Math.max(0, x - hx), x1 = Math.min(L, x + hx);
      var part = sectionPart(model, x, r.i0, r.i1), p = at(part, u);
      var pa = at(sectionPart(model, x0, r.i0, r.i1), u), pb = at(sectionPart(model, x1, r.i0, r.i1), u);
      var du = Math.min(0.01, u), u2 = Math.min(1, u + 0.01);
      var q0 = at(part, u - du), q1 = at(part, u2);
      var Tx = [(x1 - x0), pb[0] - pa[0], pb[1] - pa[1]], Tu = [0, q1[0] - q0[0], q1[1] - q0[1]];
      var n = [Tx[1] * Tu[2] - Tx[2] * Tu[1], Tx[2] * Tu[0] - Tx[0] * Tu[2], Tx[0] * Tu[1] - Tx[1] * Tu[0]];
      var ln = Math.hypot(n[0], n[1], n[2]) || 1; n = [n[0] / ln, n[1] / ln, n[2] / ln];
      var zc = (model.zb(x) + model.zd(x)) / 2;                       // наружу — от середины толщины
      if (n[1] * p[0] + n[2] * (p[1] - zc) < 0) n = [-n[0], -n[1], -n[2]];
      return { x: x * 10, y: p[0] * 10, z: p[1] * 10, n: n };
    }

    var gouge = 0, passes = [], TOL = 0.05;   // мм: отклонение отрезка от настоящей траектории
    function toTool(c, sign) {
      var P = fr.p(c.x, sign * c.y, c.z), n = fr.n(c.n[0], sign * c.n[1], c.n[2]);
      var t = cut.tip(P, n), dz = cloud.drop(t[0], t[1], cut);
      t.raise = Math.max(0, dz - t[2]);
      if (dz > t[2] + 0.01) { gouge = Math.max(gouge, dz - t[2]); t[2] = dz; }
      t.c = [c.x, sign * c.y, c.z, c.n];
      return t;
    }
    // отрезок прямой между точками фрезы не должен врезаться: проверка «опусканием» в 3 точках
    function chordOk(a, b) {
      for (var k = 1; k < 4; k++) {
        var t = k / 4, X = a[0] + (b[0] - a[0]) * t, Y = a[1] + (b[1] - a[1]) * t, Z = a[2] + (b[2] - a[2]) * t;
        if (cloud.drop(X, Y, cut) > Z + TOL) return false;
      }
      return true;
    }
    // линия с добавлением точек там, где отрезок уходит от настоящей траектории или врезается
    function lineTool(r, u, sign) {
      var f = function (x) { return toTool(contact(r, u, x), sign); };
      var out = [], pts = xs.map(function (x) { return { x: x, t: f(x) }; });
      function refine(A, B, depth) {
        if (depth < 10 && B.x - A.x > 0.02) {
          var xm = (A.x + B.x) / 2, M = { x: xm, t: f(xm) };
          var cm = [(A.t[0] + B.t[0]) / 2, (A.t[1] + B.t[1]) / 2, (A.t[2] + B.t[2]) / 2];
          var dev = Math.hypot(M.t[0] - cm[0], M.t[1] - cm[1], M.t[2] - cm[2]);
          if (dev > TOL || !chordOk(A.t, B.t)) { refine(A, M, depth + 1); out.push(M.t); refine(M, B, depth + 1); }
        }
      }
      out.push(pts[0].t);
      for (var i = 1; i < pts.length; i++) { refine(pts[i - 1], pts[i], 0); out.push(pts[i].t); }
      return out;
    }

    // порядок как в Shape3D: сторона, от стрингера к рейлу, «змейкой»; сначала Y < оси
    var firstSign = side === 'deck' ? -1 : 1;
    [firstSign, -firstSign].forEach(function (sign) {
      var k = 0;
      ranges.forEach(function (r) {
        r.u.forEach(function (u) {
          var pts = lineTool(r, u, sign);
          if (k % 2 === 1) pts.reverse();
          passes.push({ kind: 'line', pts: pts });
          k++;
        });
      });
    });
    if (s.stringer) {
      var sp = [];
      for (var q = 0; q <= 400; q++) { var X = fr.p(L * 10 * q / 400, 0, 0)[0]; sp.push([X, s.Yc, cloud.drop(X, s.Yc, cut)]); }
      if (passes.length % 2 === 1) sp.reverse();
      passes.push({ kind: 'stringer', pts: sp });
    }
    // ---------- подрезка торца стрингера у хвоста (только дек) ----------
    if (side === 'deck' && s.endCut) {
      var xe = s.X0 - cut.R + 0.4, zt = fr.p(0, 0, model.zd(0) * 10)[2], zbt = fr.p(0, 0, model.zb(0) * 10)[2] - 5;
      var yw = s.D / 4;
      passes.push({ kind: 'endcut', pts: [[xe, s.Yc + yw, zt], [xe, s.Yc + yw, zbt], [xe, s.Yc - yw, zbt], [xe, s.Yc - yw, zt]] });
    }

    // ---------- черновая по контуру: слои вокруг доски, мосты у носа и хвоста ----------
    var zMin = function () { return -Infinity; }, stepped = function (p) { return p; };
    if (s.rough || s.bridges) {
      var rough = [];
      // высота апекса (низ черновой): по средней части доски
      var zApex = Infinity;
      for (var ia = 0; ia <= 40; ia++) {
        var xa = L * (0.1 + 0.8 * ia / 40), ca = model.sectionCtrl(xa).P[a];
        zApex = Math.min(zApex, fr.p(xa * 10, ca[0] * 10, ca[1] * 10)[2]);
      }
      var Xb = Math.max(s.xMin, s.X0 - cut.R - s.roughMargin - 10);
      var Xf = fr.p(L * 10, 0, model.zd(L) * 10)[0] + cut.R + s.roughMargin + 10;
      var xsR = [];
      for (var xr = Xf; xr > Xb; xr -= 5) xsR.push(xr);
      xsR.push(Xb);
      // мосты: горизонтальные перемычки толщиной bridgeH и длиной bridgeL от торца хвоста и от носа,
      // посередине толщины доски на конце. Черновая в этих зонах не опускается в перемычку.
      var frD = new Frame(s, 'deck');
      // перемычка: посередине толщины конца доски, но не толще самого конца (у тонкого носа)
      function plate(x) {
        var c = frD.p(x * 10, 0, model.zb(x) * 10), d = frD.p(x * 10, 0, model.zd(x) * 10), mid = (c[2] + d[2]) / 2;
        return { X: (c[0] + d[0]) / 2, lo: Math.max(c[2], mid - s.bridgeH / 2), hi: Math.min(d[2], mid + s.bridgeH / 2) };
      }
      var pT = plate(0), pN = plate(L);
      var zones = s.bridges ? [[pT.X - s.bridgeL, pT.X, pT], [pN.X, pN.X + s.bridgeL, pN]] : [];
      // ниже какой высоты фреза не может опускаться в X (координаты этой стороны): фреза не задевает перемычку
      zMin = function (X) {
        for (var q = 0; q < zones.length; q++) {
          var zz = zones[q];
          if (X > zz[0] - cut.R && X < zz[1] + cut.R) return side === 'deck' ? zz[2].hi : s.Tb - zz[2].lo;
        }
        return -Infinity;
      };
      // наименьшее расстояние от оси, на котором фреза на высоте Z не касается доски (с запасом)
      function clearW(X, Z, sg) {
        var lo = 0, hi = 450;
        Z -= s.roughMargin;                        // запас по высоте тот же, что и сбоку
        if (cloud.drop(X, s.Yc + sg * lo, cut) <= Z) return 0;
        for (var it = 0; it < 30; it++) {
          var m = (lo + hi) / 2;
          if (cloud.drop(X, s.Yc + sg * m, cut) <= Z && cloud.drop(X, s.Yc + sg * (m + 2), cut) <= Z) hi = m; else lo = m;
        }
        return hi;
      }
      // путь со ступеньками: вверх — до перехода, вниз — после
      stepped = function (pts) {
        var o = [pts[0]];
        for (var i = 1; i < pts.length; i++) {
          var c = o[o.length - 1], n = pts[i];
          if (n[2] > c[2] + 0.01) o.push([c[0], c[1], n[2]]);
          else if (n[2] < c[2] - 0.01) o.push([n[0], n[1], c[2]]);
          o.push(n);
        }
        return o;
      };
      var levels = [];
      for (var zl = s.Tb - s.roughStep; zl > zApex + 0.5; zl -= s.roughStep) levels.push(zl);
      levels.push(zApex);
      levels.forEach(function (Z) {
        var wP = xsR.map(function (X) { return clearW(X, Z, 1); });
        var wN = xsR.map(function (X) { return clearW(X, Z, -1); });
        for (var k = s.roughLoops - 1; k >= 0; k--) {
          var off = s.roughMargin + k * s.roughLoopStep;
          // петля вокруг доски: +Y от носа к хвосту, поперёк за хвостом, −Y к носу, поперёк перед носом
          var pP = xsR.map(function (X, i) { return [X, s.Yc + wP[i] + off, Math.max(Z, zMin(X))]; });
          var pN = xsR.slice().reverse().map(function (X, i) { var j = xsR.length - 1 - i; return [X, s.Yc - wN[j] - off, Math.max(Z, zMin(X))]; });
          rough.push({ kind: 'rough', pts: stepped(pP.concat(pN, [pP[0]])) });
        }
      });
      rough.forEach(function (p) { p.noDirect = true; });
      // чистовые и стрингер тоже не режут перемычки (торец стрингера — режет, он узкий)
      passes.forEach(function (p) {
        if (p.kind === 'endcut') return;
        p.pts = stepped(p.pts.map(function (q) { var z = zMin(q[0]); return z > q[2] ? [q[0], q[1], z] : q; }));
      });
      if (s.rough) passes = rough.concat(passes);
    }

    // последняя страховка: где отрезок всё же задевает поверхность (углы хвоста и носа),
    // дробим его через 0.5 мм и поднимаем фрезу по «опусканию»
    passes.forEach(function (p) {
      if (p.kind === 'plug') return;               // карман пробки режется ниже поверхности намеренно
      var o = [p.pts[0]];
      for (var i = 1; i < p.pts.length; i++) {
        var A = p.pts[i - 1], B = p.pts[i];
        if (!chordOk(A, B)) {
          var len = Math.hypot(B[0] - A[0], B[1] - A[1]), m = Math.max(2, Math.ceil(len / 0.25)), dr = [], k;
          for (k = 0; k <= m; k++) dr.push(cloud.drop(A[0] + (B[0] - A[0]) * k / m, A[1] + (B[1] - A[1]) * k / m, cut));
          var up0 = Math.max(dr[0], dr[1]);
          if (up0 > A[2] + 0.01) o.push([A[0], A[1], up0]);                   // сначала вертикально вверх
          for (k = 1; k < m; k++) {
            var t = k / m, X = A[0] + (B[0] - A[0]) * t, Y = A[1] + (B[1] - A[1]) * t, Z = A[2] + (B[2] - A[2]) * t;
            // с запасом по соседним точкам: у отвесных стенок (торец хвоста, рейл) фреза идёт выше
            o.push([X, Y, Math.max(Z, dr[k - 1], dr[k], dr[k + 1])]);
          }
          var up1 = Math.max(dr[m - 1], dr[m]);
          if (up1 > B[2] + 0.01) o.push([B[0], B[1], up1]);                   // потом вертикально вниз
        }
        o.push(B);
      }
      p.pts = o;
    });
    // ---------- карманы пробок плавников (только дно, в конце программы) ----------
    if (side === 'bot' && s.plugs) {
      boxes(model.board).forEach(function (bx) {
        // высота поверхности дна под точкой (по облаку точек, без фрезы)
        function surfZ(X, Y) {
          var c = cloud.cell, best = -Infinity, r = 3;
          for (var i = Math.floor((X - r) / c); i <= Math.floor((X + r) / c); i++)
            for (var j = Math.floor((Y - r) / c); j <= Math.floor((Y + r) / c); j++) {
              var aa = cloud.map[i + ',' + j]; if (!aa) continue;
              for (var k = 0; k < aa.length; k++) if (Math.hypot(aa[k][0] - X, aa[k][1] - Y) <= r) best = Math.max(best, aa[k][2]);
            }
          return best;
        }
        bx.places.forEach(function (pl) {
          // ось кармана: от заднего центра к переднему, с углом развала (toe)
          var half = Math.max(0, (bx.len - bx.wid) / 2), ca = Math.cos(pl.ang), sa = Math.sin(pl.ang);
          var e1 = fr.p(pl.x - half * ca, pl.y - half * sa, 0), e2 = fr.p(pl.x + half * ca, pl.y + half * sa, 0);
          var rr = Math.max(0, bx.wid / 2 - cut.R);                  // радиус обхода контура
          var ax = e2[0] - e1[0], ay = e2[1] - e1[1], al = Math.hypot(ax, ay) || 1; ax /= al; ay /= al;
          var nx = -ay, ny = ax, pts = [];
          function floorZ(X, Y) { return surfZ(X, Y) - bx.depth; }
          var top = surfZ(e1[0], e1[1]);
          pts.push([e1[0], e1[1], top + 2]);
          for (var zz = top - s.roughStep; zz > floorZ(e1[0], e1[1]); zz -= s.roughStep) pts.push([e1[0], e1[1], zz]);
          pts.push([e1[0], e1[1], floorZ(e1[0], e1[1])]);
          pts.push([e2[0], e2[1], floorZ(e2[0], e2[1])]);
          if (rr > 0.3) {
            // обход: полукруг вокруг переднего центра, прямая, полукруг вокруг заднего, прямая
            var ang0 = Math.atan2(ny, nx), q, N = 24;
            var loop = [];
            for (q = 0; q <= N; q++) { var t = ang0 - Math.PI * q / N; loop.push([e2[0] + rr * Math.cos(t), e2[1] + rr * Math.sin(t)]); }
            for (q = 0; q <= N; q++) { var t2 = ang0 + Math.PI - Math.PI * q / N; loop.push([e1[0] + rr * Math.cos(t2), e1[1] + rr * Math.sin(t2)]); }
            loop.push(loop[0]);
            pts.push([loop[0][0], loop[0][1], floorZ(loop[0][0], loop[0][1])]);
            loop.forEach(function (l) { pts.push([l[0], l[1], floorZ(l[0], l[1])]); });
          }
          var last = pts[pts.length - 1];
          pts.push([last[0], last[1], top + 2]);
          passes.push({ kind: 'plug', pts: pts, noDirect: true });
        });
      });
    }

    // переходы между проходами: прямо, если не врезаемся, иначе через подъём
    for (var j = 1; j < passes.length; j++) {
      var e = passes[j - 1].pts, b0 = passes[j].pts[0], a0 = e[e.length - 1];
      passes[j].direct = !passes[j].noDirect && Math.hypot(b0[0] - a0[0], b0[1] - a0[1]) <= s.D * 2 && chordOk(a0, b0) && cloud.drop((a0[0] + b0[0]) / 2, (a0[1] + b0[1]) / 2, cut) <= (a0[2] + b0[2]) / 2 + TOL;
    }
    return { passes: passes, gouge: gouge, side: side };
  };

  // ---------- вставки (пробки плавников) из файла: только те, что фрезеруются на дне ----------
  function boxes(board) {
    var out = [], B = board.B;
    for (var i = 0; i < 64; i++) {
      var n = B.getElementsByTagName('Box_' + i)[0]; if (!n) continue;
      var bx = n.getElementsByTagName('Box')[0] || n;
      if (num(bx, 'CutCNC') !== 1 || num(bx, 'Face') !== 1) continue;
      var pc = bx.getElementsByTagName('PointCenter')[0];
      var x = num(pc, 'x') * 10, y = num(pc, 'y') * 10, ang = or(num(bx, 'AngleOz'), 0);
      var b = { name: (bx.getElementsByTagName('Name')[0] || {}).textContent || '', len: num(bx, 'Length') * 10,
                wid: num(bx, 'Width') * 10, depth: num(bx, 'Height') * 10, places: [] };
      if (num(bx, 'Central') === 1 || Math.abs(y) < 0.01) b.places.push({ x: x, y: 0, ang: 0 });
      else {
        // развал: передний конец ближе к оси
        b.places.push({ x: x, y: Math.abs(y), ang: -Math.abs(ang) });
        if (num(bx, 'Even') === 1) b.places.push({ x: x, y: -Math.abs(y), ang: Math.abs(ang) });
      }
      if (isFinite(b.len) && isFinite(b.wid) && isFinite(b.depth)) out.push(b);
    }
    return out;
  }
  TS.cncBoxes = boxes;

  // ---------- G-code (формат постпроцессора AKU/APS из настроек Ильи) ----------
  function f4(v) { return v.toFixed(4); }
  TS.cncGcode = function (res, s, meta) {
    var out = [];
    out.push('; -----------------------------------------------');
    out.push('; Tentacle Shaper - ' + (meta.name || ''));
    out.push('; Date : ' + new Date().toISOString().slice(0, 19).replace('T', ' ') + ' UTC');
    out.push('; Description : ' + (meta.desc || '') + ' ' + (res.side === 'deck' ? 'Deck' : 'Bottom'));
    out.push('; Cutter : bull nose D' + s.D + ' R' + s.r1 + ' R' + s.R2 + ' mm');
    out.push('; -----------------------------------------------');
    out.push('G0 Z0.'); out.push('G0 X0. Y0. Z0.'); out.push('F' + s.feedHead); out.push('G1 G21'); out.push('M3'); out.push('');
    var safe = s.Tb + s.safeZ, last = null;
    out.push('Z' + f4(safe) + ' F' + s.feed);                // сначала вверх, потом в сторону
    res.passes.forEach(function (p) {
      var a = p.pts[0];
      if (!last || !p.direct) {
        // переезд над бланком
        var z = safe;
        if (last) out.push('X' + f4(last[0]) + ' Y' + f4(last[1]) + ' Z' + f4(z));
        out.push('X' + f4(a[0]) + ' Y' + f4(a[1]) + ' Z' + f4(z));
      }
      p.pts.forEach(function (q) { out.push('X' + f4(q[0]) + ' Y' + f4(q[1]) + ' Z' + f4(q[2])); });
      last = p.pts[p.pts.length - 1];
    });
    if (last) out.push('X' + f4(last[0]) + ' Y' + f4(last[1]) + ' Z' + f4(safe));
    out.push('M5'); out.push('X0.0000 Y0.0000 Z0.0000'); out.push('M2');
    return out.join('\r\n') + '\r\n';
  };

  TS.CncFrame = Frame; TS.Cutter = Cutter;
})(window.TS = window.TS || {});
