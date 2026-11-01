/* Tentacle Shaper — тексты интерфейса RU / EN. GPL v3. */
(function (TS) {
  'use strict';
  var D = {
    ru: {
      open: 'Открыть .s3dx', design: 'Проектирование', view3d: '3D',
      drop: 'Перетащите файл доски .s3dx сюда или нажмите «Открыть .s3dx».',
      dropNote: 'Файл открывается только у вас в браузере и никуда не отправляется.',
      top: 'Вид сверху', side: 'Вид сбоку', slice: 'Сечение',
      dims: 'Размеры', length: 'Длина', width: 'Ширина', thick: 'Толщина', volume: 'Объём',
      lengthDev: 'по стрингеру', at: 'на', zero: 'Нулевая точка',
      tailRocker: 'Рокер хвоста', noseRocker: 'Рокер носа',
      fromTail: 'от хвоста', fromNose: 'от носа', rocker: 'Рокер',
      volFile: 'в файле (Shape3D)', volOur: 'наш расчёт',
      slices: 'Сечения', sliceAt: 'Сечение на', fromTailShort: 'от хвоста',
      wire: 'Сетка', reset: 'Сбросить вид', vexag: 'по высоте ×',
      hint2d: 'Колесо — масштаб, перетаскивание — сдвиг, двойной щелчок — весь вид. Щелчок сверху или сбоку — сечение в этом месте.',
      hint3d: 'Левая кнопка — вращать, правая — сдвиг, колесо — масштаб.',
      mm: 'мм', l: 'л', err: 'Не удалось открыть файл', points: 'Точки сечения',
      stage: 'Этап 1: просмотр доски. Правка и CNC — следующие этапы.'
    },
    en: {
      open: 'Open .s3dx', design: 'Design', view3d: '3D',
      drop: 'Drop a .s3dx board file here or press “Open .s3dx”.',
      dropNote: 'The file is opened only in your browser and is not uploaded anywhere.',
      top: 'Top view', side: 'Side view', slice: 'Slice',
      dims: 'Dimensions', length: 'Length', width: 'Width', thick: 'Thickness', volume: 'Volume',
      lengthDev: 'along stringer', at: 'at', zero: 'Zero point',
      tailRocker: 'Tail rocker', noseRocker: 'Nose rocker',
      fromTail: 'from tail', fromNose: 'from nose', rocker: 'Rocker',
      volFile: 'in file (Shape3D)', volOur: 'our calculation',
      slices: 'Slices', sliceAt: 'Slice at', fromTailShort: 'from tail',
      wire: 'Wireframe', reset: 'Reset view', vexag: 'vertical ×',
      hint2d: 'Wheel — zoom, drag — pan, double click — fit. Click in top or side view to cut a slice there.',
      hint3d: 'Left button — rotate, right — pan, wheel — zoom.',
      mm: 'mm', l: 'L', err: 'Cannot open file', points: 'Slice points',
      stage: 'Stage 1: board viewer. Editing and CNC come next.'
    }
  };
  var lang = 'ru';
  try { lang = localStorage.getItem('ts-lang') || (navigator.language || 'ru').slice(0, 2); } catch (e) {}
  if (!D[lang]) lang = 'en';

  TS.t = function (k) { return (D[lang] && D[lang][k]) || D.en[k] || k; };
  TS.lang = function () { return lang; };
  TS.setLang = function (l) {
    lang = D[l] ? l : 'en';
    try { localStorage.setItem('ts-lang', lang); } catch (e) {}
    TS.applyI18n();
  };
  TS.applyI18n = function () {
    document.documentElement.lang = lang;
    var els = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) els[i].textContent = TS.t(els[i].getAttribute('data-i18n'));
    var tl = document.querySelectorAll('[data-i18n-title]');
    for (var j = 0; j < tl.length; j++) tl[j].title = TS.t(tl[j].getAttribute('data-i18n-title'));
  };
})(window.TS = window.TS || {});
