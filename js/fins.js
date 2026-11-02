/* Tentacle Shaper — пробки плавников: расстояние до рейла, схождение (как в Shape3D)
 * и мастер «Плавники и пробки» (сингл, твин, трастер, квад, 4+1, лиш-пробка). GPL v3.
 * Shape3D меряет от опорной точки пробки (PointRef):
 *   до рейла = полуширина контура в X опорной точки − её Y;
 *   схождение = расстояние по X от опорной точки до точки на стрингере, куда смотрит пробка.
 * Проверено на файлах DS 133 и Short Томаса (DistRail и PtConvergence совпали до 0.001 см).
 */
(function (TS) {
  'use strict';

  var G = TS.finGeo = {
    rail: function (o, m) { var P = TS.boxPts(o); return m.halfW(P.pref[0]) - Math.abs(P.pref[1]); },
    setRail: function (o, m, d) {
      if (o.central) return;
      var s = o.y < 0 ? -1 : 1;
      if (Math.abs(o.y) < 1e-6) o.y = 1;
      for (var i = 0; i < 4; i++) {
        var P = TS.boxPts(o), k = Math.abs(P.pref[1]) - Math.abs(o.y);
        o.y = s * Math.max(0, m.halfW(P.pref[0]) - d - k);
      }
    },
    conv: function (o) {
      if (Math.abs(o.ang) < 1e-5) return Infinity;
      return Math.abs(TS.boxPts(o).pref[1]) / Math.tan(Math.abs(o.ang));
    },
    setConv: function (o, c) {
      if (!isFinite(c) || c <= 0 || o.central) { o.ang = 0; return; }
      for (var i = 0; i < 5; i++) o.ang = Math.atan(Math.abs(TS.boxPts(o).pref[1]) / c);
    }
  };

  // ---------- мастер ----------
  var $ = function (id) { return document.getElementById(id); };
  // размеры пробок из файлов Ильи (см): DS 133 и Short Томаса
  var SYS = { ds133: [9.75, 4.5, 1.55], short: [7.9, 2.7, 1.6] };
  // начальные места (см) — сняты с Short Томаса (квад + центр); от рейла и схождение — как в Shape3D
  var DEF = { front: [37.6, 2.74, 199.9], rear: [20.5, 5.21, 200.2], center: [15.5], leash: [5.0, 2.7, 1.6] };
  var SETS = {
    single: { center: 1 }, twin: { front: 1 }, thruster: { front: 1, center: 1 },
    quad: { front: 1, rear: 1 }, five: { front: 1, rear: 1, center: 1 }
  };
  var cur = 'thruster';

  function f1(v) { return isFinite(v) ? (Math.round(v * 10) / 10).toString() : ''; }
  function val(id) { var v = parseFloat(String($(id).value).replace(',', '.')); return isFinite(v) ? v : NaN; }
  function fins(b) { return (b.boxes || []).filter(function (o) { return o.style !== 4 && o.face === 1; }); }

  // взять значения из пробок доски (если они есть), иначе — начальные
  function fill() {
    var st = TS.state, b = st.board, m = st.model, f = fins(b);
    var pairs = f.filter(function (o) { return !o.central && Math.abs(o.y) > 1e-6; }).sort(function (a, c) { return c.x - a.x; });
    var cen = f.filter(function (o) { return o.central || Math.abs(o.y) < 1e-6; })[0];
    function put(row, o, d) {
      $('fw' + row + 'X').value = f1((o ? o.x : d[0]) * 10);
      if ($('fw' + row + 'R')) $('fw' + row + 'R').value = f1((o ? G.rail(o, m) : d[1]) * 10);
      if ($('fw' + row + 'C')) { var c = o ? G.conv(o) : d[2]; $('fw' + row + 'C').value = isFinite(c) ? f1(c * 10) : ''; }
    }
    put('F', pairs[0], DEF.front);
    put('B', pairs.length > 1 ? pairs[pairs.length - 1] : null, DEF.rear);
    put('M', cen, DEF.center);
    var lp = (b.boxes || []).filter(function (o) { return o.style === 4; })[0];
    $('fwLX').value = f1((lp ? lp.x : DEF.leash[0]) * 10);
    $('fwLD').value = f1((lp ? lp.wid : DEF.leash[1]) * 10);
    $('fwLH').value = f1((lp ? lp.depth : DEF.leash[2]) * 10);
    $('fwLeash').checked = false;
    var sz = f[0] ? [f[0].len, f[0].wid, f[0].depth] : SYS.ds133;
    $('fwSys').value = f[0] ? 'file' : 'ds133';
    setSize(sz);
    if (pairs.length >= 2 && cen) cur = 'five'; else if (pairs.length >= 2) cur = 'quad';
    else if (pairs.length && cen) cur = 'thruster'; else if (pairs.length) cur = 'twin'; else if (cen) cur = 'single';
    showSet();
  }
  function setSize(s) { $('fwLen').value = f1(s[0] * 10); $('fwWid').value = f1(s[1] * 10); $('fwDep').value = f1(s[2] * 10); }
  function showSet() {
    var bt = $('fwSet').querySelectorAll('button');
    for (var i = 0; i < bt.length; i++) bt[i].classList.toggle('on', bt[i].getAttribute('data-set') === cur);
    var S = SETS[cur];
    $('fwRowF').hidden = !S.front; $('fwRowB').hidden = !S.rear; $('fwRowM').hidden = !S.center;
  }

  function apply() {
    var st = TS.state, b = st.board, ed = st.ed, m = st.model, S = SETS[cur];
    var L = val('fwLen') / 10, W = val('fwWid') / 10, D = val('fwDep') / 10;
    if (!(L > 0 && W > 0 && D > 0)) { $('fwMsg').textContent = TS.t('fwBad'); return; }
    ed.begin();
    // старые убираем в конце: новые копируются с них (формат файла сохраняется)
    var rm = $('fwReplace').checked ? fins(b) : [];
    function put(name, x, rail, conv, pair) {
      if (!isFinite(x)) return;
      var i = ed.addBox(x / 10, pair ? 10 : 0, 'fin'), o = b.boxes[i];
      ed.boxSet(i, { len: Math.max(L, W), wid: W, depth: D, face: 1, cut: true, even: !!pair, central: !pair, name: name, x: x / 10 });
      if (pair) {
        for (var k = 0; k < 3; k++) { G.setConv(o, conv / 10); G.setRail(o, m, (isFinite(rail) ? rail : 30) / 10); }
      }
      ed.boxSet(i, {});
    }
    if (S.front) put('Fin_sides', val('fwFX'), val('fwFR'), val('fwFC'), true);
    if (S.rear) put('Fin_rear', val('fwBX'), val('fwBR'), val('fwBC'), true);
    if (S.center) put('Fin_center', val('fwMX'), NaN, NaN, false);
    if ($('fwLeash').checked) {
      (b.boxes || []).forEach(function (o) { if (o.style === 4) rm.push(o); });
      var dia = val('fwLD') / 10, i = ed.addBox(val('fwLX') / 10, 0, 'round');
      ed.boxSet(i, { wid: dia, len: dia, depth: val('fwLH') / 10, face: 0, central: true, cut: true });
    }
    b.boxes = b.boxes.filter(function (o) { return rm.indexOf(o) < 0; });
    st.selBox = null; TS.appHeavy();
    $('fwMsg').textContent = TS.t('fwDone');
  }

  TS.finsUI = {
    open: function () { if (!TS.state.board) return; fill(); $('fwMsg').textContent = ''; $('dlgFins').hidden = false; },
    init: function () {
      $('finsBtn').addEventListener('click', TS.finsUI.open);
      $('fwClose').addEventListener('click', function () { $('dlgFins').hidden = true; });
      $('fwSet').addEventListener('click', function (e) { var s = e.target.getAttribute('data-set'); if (s) { cur = s; showSet(); } });
      $('fwSys').addEventListener('change', function () {
        var v = $('fwSys').value, f = fins(TS.state.board)[0];
        if (v === 'file' && f) setSize([f.len, f.wid, f.depth]); else if (SYS[v]) setSize(SYS[v]);
      });
      $('fwGo').addEventListener('click', apply);
    }
  };
})(window.TS = window.TS || {});
