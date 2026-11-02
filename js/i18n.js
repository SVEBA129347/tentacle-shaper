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
      hint2d: 'Тяните оранжевые точки — доска меняется. Колесо — масштаб, перетаскивание фона — сдвиг, двойной щелчок — весь вид, щелчок — сечение здесь.',
      hint3d: 'Левая кнопка — вращать, правая — сдвиг, колесо — масштаб.',
      mm: 'мм', l: 'л', err: 'Не удалось открыть файл', points: 'Точки сечения',
      stage: 'Готово: просмотр, правка, CNC. Проверка на станке — впереди.',
      save: 'Сохранить .s3dx', saveTip: 'Сохранить .s3dx (Ctrl+S)', undo: 'Отменить (Ctrl+Z)', redo: 'Вернуть (Ctrl+Shift+Z)',
      rockerMode: 'Рокер', thickMode: 'Толщина', outline: 'Контур', rockerCurve: 'Рокер (низ стрингера)', deckCurve: 'Верх стрингера (толщина)', deckRocker: 'Рокер дека', deckContour: 'Дек', botContour: 'Дно', rmAD: 'апекс–дек', rmT: 'по оси', rmAB: 'апекс над низом', rmV: 'V/конкейв', rmRail: 'рейл от оси',
      thickCurve: 'Толщина', point: 'точка', tangent: 'касательная', sliceEdit: 'правка сечения',
      sliceHint: 'выберите сечение кнопкой справа, чтобы его править',
      discard: 'Есть несохранённые изменения. Открыть другой файл без сохранения?',
      cnc: 'CNC', cncCutter: 'Фреза (bull nose), мм', cncLines: 'Линии на сторону', cncPlace: 'Доска на станке, мм / °', cncFeed: 'Подача',
      cD: 'Диаметр', cR1: 'Радиус угла', cR2: 'Радиус дна', cNDeck: 'Дек', cNBot: 'Дно', cNRail: 'Рейл',
      cVarMax: 'Сужение дека', cVarMaxBot: 'Сужение дна (−1 нет)', cNPts: 'Точек на линию',
      cX0: 'Хвост от упора X', cYc: 'Ось доски Y', cTb: 'Толщина бланка', cTilt: 'Наклон, °', cZ0: 'Высота Z0',
      cLevel: 'Концы дека ровно', cCenter: 'По центру бланка', cStringer: 'Проход по стрингеру',
      cFeed: 'Рабочая, мм/мин', cFeedHead: 'В шапке F', cSafeZ: 'Подъём над бланком',
      cCalc: 'Рассчитать', cSaveDeck: 'G-code дека', cSaveBot: 'G-code дна', cDeck: 'Дек', cBot: 'Дно',
      cTopView: 'Траектории, вид сверху (координаты станка)', cSideView: 'Доска в бланке, вид сбоку',
      cGapBot: 'Запас снизу в бланке', cGapTop: 'Запас сверху в бланке', cOutOfBlank: 'Доска выходит за бланк!',
      cPasses: 'проходов', cPoints: 'точек', cMeters: 'м', cMin: 'мин', cNotYet: 'Нажмите «Рассчитать».',
      cWarn: 'Программа ещё не проверена на станке. Сначала — прогон в воздухе (Z выше бланка), потом пена. Толщину бланка измерьте.',
      cPlugs: 'Карманы пробок плавников (дно)',
      cncRough: 'Черновая и мосты, мм', cRoughStep: 'Шаг по высоте', cRoughMargin: 'Припуск до доски', cRoughLoops: 'Проходов вокруг',
      cRoughLoopStep: 'Шаг между проходами', cBridgeL: 'Мост: длина от торца', cBridgeH: 'Мост: толщина',
      cRough: 'Черновая по контуру', cBridges: 'Мосты у носа и хвоста', cEndCut: 'Подрезать торец стрингера у хвоста (дек)',
      sizeBtn: 'Размеры…', smartBtn: 'Задать в точке…', sizeTitle: 'Размеры доски, мм', szNow: 'сейчас', szNew: 'новое',
      szMode: 'При изменении длины', szSide: 'толщина и рокер пропорционально (Constant side)', szProp: 'всё пропорционально (Constant proportions)',
      szRocker: 'только рокер пропорционально (Constant rocker)', szNone: 'ничего не менять', szZ: 'При изменении толщины рокер пропорционально (Constant Z)',
      apply: 'Применить', cancel: 'Отмена', close: 'Закрыть', volTitle: 'Подбор объёма', volNow: 'Сейчас', volT: 'толщиной', volW: 'шириной',
      volTW: 'толщиной и шириной', volGo: 'Подобрать', volBusy: 'Считаю…', volFail: 'Не получается в пределах ±40 % размера.', volDone: 'Готово:',
      smartTitle: 'Задать размер в точке', smAt: 'на', smMoved: 'сдвинута точка', smHint: 'Двигается ближайшая опорная точка кривой (контур, верх или низ стрингера); остальная доска плавно подстраивается. Ctrl+Z — отмена.',
      tSmooth: 'Плавная', tCorner: 'Излом', tAxis: 'Горизонт./верт.', delPt: 'Удалить точку', slAdd: '+ Сечение здесь', slDel: 'Удалить сечение', slX: 'X сечения',
      noPtSlice: 'В сечениях точки не добавляются: у всех сечений должно быть одинаковое число точек.',
      deckFit: 'Верх стрингера приближён кривой Безье с точностью',
      editHint: 'Стрелки — сдвиг на 0.1 мм, с Shift — на 1 мм. Двойной щелчок по линии — новая точка, Del — удалить точку. Esc — снять выбор.'
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
      hint2d: 'Drag the orange points to reshape. Wheel — zoom, drag background — pan, double click — fit, click — slice here.',
      hint3d: 'Left button — rotate, right — pan, wheel — zoom.',
      mm: 'mm', l: 'L', err: 'Cannot open file', points: 'Slice points',
      stage: 'Done: viewer, editor, CNC. Machine test is next.',
      save: 'Save .s3dx', saveTip: 'Save .s3dx (Ctrl+S)', undo: 'Undo (Ctrl+Z)', redo: 'Redo (Ctrl+Shift+Z)',
      rockerMode: 'Rocker', thickMode: 'Thickness', outline: 'Outline', rockerCurve: 'Rocker (stringer bottom)', deckCurve: 'Stringer top (thickness)', deckRocker: 'Deck rocker', deckContour: 'Deck', botContour: 'Bottom', rmAD: 'apex–deck', rmT: 'center', rmAB: 'apex above bottom', rmV: 'V/concave', rmRail: 'rail from axis',
      thickCurve: 'Thickness', point: 'point', tangent: 'tangent', sliceEdit: 'editing slice',
      sliceHint: 'pick a slice with the buttons on the right to edit it',
      discard: 'There are unsaved changes. Open another file without saving?',
      cnc: 'CNC', cncCutter: 'Cutter (bull nose), mm', cncLines: 'Lines per side', cncPlace: 'Board on machine, mm / °', cncFeed: 'Feed',
      cD: 'Diameter', cR1: 'Corner radius', cR2: 'Bottom radius', cNDeck: 'Deck', cNBot: 'Bottom', cNRail: 'Rail',
      cVarMax: 'Deck narrowing', cVarMaxBot: 'Bottom narrowing (−1 none)', cNPts: 'Points per line',
      cX0: 'Tail from stop X', cYc: 'Board axis Y', cTb: 'Blank thickness', cTilt: 'Tilt, °', cZ0: 'Height Z0',
      cLevel: 'Level deck ends', cCenter: 'Center in blank', cStringer: 'Stringer pass',
      cFeed: 'Cutting, mm/min', cFeedHead: 'Header F', cSafeZ: 'Clearance above blank',
      cCalc: 'Compute', cSaveDeck: 'Deck G-code', cSaveBot: 'Bottom G-code', cDeck: 'Deck', cBot: 'Bottom',
      cTopView: 'Toolpaths, top view (machine coordinates)', cSideView: 'Board in blank, side view',
      cGapBot: 'Blank margin below', cGapTop: 'Blank margin above', cOutOfBlank: 'Board is outside the blank!',
      cPasses: 'passes', cPoints: 'points', cMeters: 'm', cMin: 'min', cNotYet: 'Press “Compute”.',
      cWarn: 'Not yet tested on the machine. First an air run (Z above the blank), then foam. Measure the blank thickness.',
      cPlugs: 'Fin plug pockets (bottom)',
      cncRough: 'Roughing and bridges, mm', cRoughStep: 'Depth step', cRoughMargin: 'Stock to board', cRoughLoops: 'Loops around',
      cRoughLoopStep: 'Loop spacing', cBridgeL: 'Bridge: length from end', cBridgeH: 'Bridge: thickness',
      cRough: 'Outline roughing', cBridges: 'Bridges at nose and tail', cEndCut: 'Cut stringer end at tail (deck)',
      sizeBtn: 'Size…', smartBtn: 'Set at point…', sizeTitle: 'Board size, mm', szNow: 'now', szNew: 'new',
      szMode: 'When length changes', szSide: 'thickness and rocker proportional (Constant side)', szProp: 'all proportional (Constant proportions)',
      szRocker: 'rocker only proportional (Constant rocker)', szNone: 'change nothing else', szZ: 'When thickness changes, rocker proportional (Constant Z)',
      apply: 'Apply', cancel: 'Cancel', close: 'Close', volTitle: 'Volume wizard', volNow: 'Now', volT: 'by thickness', volW: 'by width',
      volTW: 'by thickness and width', volGo: 'Fit', volBusy: 'Computing…', volFail: 'Not reachable within ±40 % of size.', volDone: 'Done:',
      smartTitle: 'Set a size at a point', smAt: 'at', smMoved: 'moved point', smHint: 'The nearest control point of the curve (outline, stringer top or bottom) moves; the rest of the board follows smoothly. Ctrl+Z to undo.',
      tSmooth: 'Smooth', tCorner: 'Corner', tAxis: 'Horiz./vert.', delPt: 'Delete point', slAdd: '+ Slice here', slDel: 'Delete slice', slX: 'Slice X',
      noPtSlice: 'Points are not added to slices: all slices must have the same number of points.',
      deckFit: 'Stringer top approximated by a Bezier curve within',
      editHint: 'Arrows move 0.1 mm, with Shift 1 mm. Double click on a curve adds a point, Del deletes it. Esc — deselect.'
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
