/* Tentacle Shaper — «умные» функции (как Smart Functions в Shape3D): задать ширину, толщину или рокер
 * на нужном расстоянии от хвоста или носа; окно размеров и подбор объёма. GPL v3.
 */
(function (TS) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  function fmt(v, d) { return isFinite(v) ? (+v).toFixed(d === undefined ? 1 : d) : '—'; }

  // значение величины what на расстоянии d мм (вдоль стрингера) от хвоста/носа
  function valueAt(b, what, d, from) {
    var m = new TS.Model(b), ms = m.measures([0]), S = ms.lengthDev;
    var x = ms.xAtArc(from === 'nose' ? Math.max(0, S - d) : Math.min(S, d));
    var v = what === 'width' ? 20 * m.halfW(x) : what === 'thick' ? ms.perpThick(x) : 10 * (m.zb(x) - ms.minZ);
    return { v: v, x: x };
  }

  // подвинуть ближайшую по X опорную точку нужной кривой так, чтобы величина стала нужной (метод секущих)
  TS.smartSet = function (b, ed, what, d, from, target) {
    var key = what === 'width' ? 'otl' : what === 'thick' ? 'deck' : 'bot';
    var c = ed.curve(key), iv = key === 'otl' ? 1 : 2;
    var x = valueAt(b, what, d, from).x, n = c.P.length, L = b.length, best = -1;
    // концы двигаем, только если точка у самого конца (10 % длины), иначе — ближайшую внутреннюю
    if (x < 0.1 * L) best = 0; else if (x > 0.9 * L) best = n - 1;
    else for (var i = 1; i < n - 1; i++) if (best < 0 || Math.abs(c.P[i][0] - x) < Math.abs(c.P[best][0] - x)) best = i;
    if (best < 0) best = x < L / 2 ? 0 : n - 1;
    function f(v) { ed.move(key, best, 'P', c.P[best][0], v, false); return valueAt(b, what, d, from).v - target; }
    var v0 = c.P[best][iv], f0 = valueAt(b, what, d, from).v - target, v1 = v0 + (f0 > 0 ? -0.1 : 0.1), f1 = f(v1);
    for (var it = 0; it < 12 && Math.abs(f1) > 0.005; it++) {
      if (Math.abs(f1 - f0) < 1e-9) break;
      var v2 = v1 - f1 * (v1 - v0) / (f1 - f0);
      v0 = v1; f0 = f1; v1 = v2; f1 = f(v1);
    }
    ed.renormSlices(); ed.sync();
    return { point: best + 1, error: f1 };
  };

  // ---------- окно размеров ----------
  var base = null;
  function openSize() {
    var st = TS.state; if (!st.board) return;
    var c = TS.resizeMeasure(st.board);
    base = c;
    $('szL0').textContent = fmt(c.L); $('szW0').textContent = fmt(c.W); $('szT0').textContent = fmt(c.T);
    $('szTr0').textContent = fmt(c.tr); $('szNr0').textContent = fmt(c.nr);
    $('szL').value = fmt(c.L); $('szW').value = fmt(c.W); $('szT').value = fmt(c.T); $('szTr').value = fmt(c.tr); $('szNr').value = fmt(c.nr);
    $('volNow').textContent = fmt(c.m.volume(), 2) + ' ' + TS.t('l');
    $('volT').value = fmt(c.m.volume(), 2); $('volMsg').textContent = '';
    $('dlgSize').hidden = false;
  }
  function num(id) { return parseFloat($(id).value.replace(',', '.')); }
  function onLength() {
    var k = num('szL') / base.L, mode = $('szMode').value;
    if (!isFinite(k)) return;
    if (mode === 'prop') { $('szW').value = fmt(base.W * k); }
    if (mode === 'prop' || mode === 'side') { $('szT').value = fmt(base.T * k); }
    if (mode !== 'none') { $('szTr').value = fmt(base.tr * k); $('szNr').value = fmt(base.nr * k); }
  }
  function onThick() {
    if (!$('szZ').checked) return;
    var k = num('szT') / base.T; if (!isFinite(k)) return;
    $('szTr').value = fmt(base.tr * k); $('szNr').value = fmt(base.nr * k);
  }
  function applySize() {
    var st = TS.state, ed = st.ed;
    var tg = { L: num('szL'), W: num('szW'), T: num('szT'), tr: num('szTr'), nr: num('szNr') };
    // не трогаем то, что не изменили
    ['L', 'W', 'T', 'tr', 'nr'].forEach(function (k) { if (Math.abs(tg[k] - base[k]) < 0.05) tg[k] = NaN; });
    ed.begin();
    TS.resizeTo(st.board, ed, tg);
    $('dlgSize').hidden = true;
    TS.appHeavy();
  }
  function volumeGo() {
    var st = TS.state, ed = st.ed, t = num('volT'); if (!isFinite(t)) return;
    $('volMsg').textContent = TS.t('volBusy');
    setTimeout(function () {
      ed.begin();
      var k = TS.volumeFit(st.board, ed, t, $('volWhat').value, base);
      if (k === null) { ed.doUndo(); $('volMsg').textContent = TS.t('volFail'); return; }
      var c = TS.resizeMeasure(st.board);
      $('volMsg').textContent = TS.t('volDone') + ' ' + fmt(c.m.volume(), 2) + ' ' + TS.t('l') + ' · ' +
        TS.t('width') + ' ' + fmt(c.W) + ' · ' + TS.t('thick') + ' ' + fmt(c.T) + ' ' + TS.t('mm');
      $('volNow').textContent = fmt(c.m.volume(), 2) + ' ' + TS.t('l');
      TS.appHeavy();
    }, 30);
  }

  // ---------- окно «задать в точке» ----------
  function smartNow() {
    var st = TS.state; if (!st.board) return;
    var r = valueAt(st.board, $('smWhat').value, num('smD'), $('smFrom').value);
    $('smNow').textContent = TS.t('szNow') + ': ' + fmt(r.v, 2) + ' ' + TS.t('mm');
    if (document.activeElement !== $('smV')) $('smV').value = fmt(r.v, 2);
  }
  function smartApply() {
    var st = TS.state, ed = st.ed, v = num('smV'); if (!isFinite(v)) return;
    ed.begin();
    var r = TS.smartSet(st.board, ed, $('smWhat').value, num('smD'), $('smFrom').value, v);
    TS.appHeavy(); smartNow();
    $('smNow').textContent += ' · ' + TS.t('smMoved') + ' ' + r.point;
  }

  TS.smartUI = {
    init: function () {
      $('sizeBtn').addEventListener('click', openSize);
      $('szCancel').addEventListener('click', function () { $('dlgSize').hidden = true; });
      $('szApply').addEventListener('click', applySize);
      $('szL').addEventListener('input', onLength);
      $('szT').addEventListener('input', onThick);
      $('volGo').addEventListener('click', volumeGo);
      $('smartBtn').addEventListener('click', function () { $('dlgSmart').hidden = false; smartNow(); });
      $('smClose').addEventListener('click', function () { $('dlgSmart').hidden = true; });
      ['smWhat', 'smD', 'smFrom'].forEach(function (id) { $(id).addEventListener('change', smartNow); });
      $('smApply').addEventListener('click', smartApply);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { $('dlgSize').hidden = true; $('dlgSmart').hidden = true; }
      });
    }
  };
})(window.TS = window.TS || {});
