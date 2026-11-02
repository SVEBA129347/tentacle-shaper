/* Tentacle Shaper — страница «Серф-культура» (…/#culture): коллекция того, что вдохновляет.
 * Новые находки добавляются в массив ITEMS (присылают через «Предложить находку» → GitHub). GPL v3.
 * Только наши тексты, факты и ссылки на первоисточники; чужие рисунки не копируем. */
(function (TS) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var REPO = 'https://github.com/SVEBA129347/tentacle-shaper';

  // kind: comic | film | book | music | other; from — кто прислал
  var ITEMS = [
    {
      id: 'goodvibes', kind: 'comic', years: '1973–1981', star: true,
      title: { ru: 'Captain Goodvibes — «Стальной свин»', en: 'Captain Goodvibes — "the Pig of Steel"' },
      by: { ru: 'Тони Эдвардс (Tony Edwards), Австралия', en: 'Tony Edwards, Australia' },
      text: {
        ru: 'Свин-серфер из комиксов австралийского журнала Tracks. Появился в мае 1973 года и выходил до июля 1981-го. По сюжету — свиная отбивная, которую мутировал взрыв на атомной станции. Энциклопедия серфинга называет его «пьющим, курящим и говорящим как есть свином с рылом в форме трубы». В 1992 году журнал Surfing Life включил его в «50 самых влиятельных серферов Австралии» — персонажа комикса! Были книги, короткая анимация в фильме «Crystal Voyager» (1973), радиошоу на сиднейском Double J (озвучивал сам Эдвардс), пластинка и календари. Сборник всех выпусков — «My Life As A Pork Chop, 1973–1981» (2011).',
        en: 'A surfing pig from the Australian magazine Tracks, published from May 1973 to July 1981. The story: a pork chop mutated by a nuclear plant explosion. The Encyclopedia of Surfing calls him a "hard-drinking, drug-taking, straight-talking pig with a tunnel-shaped snout". In 1992 Surfing Life named him among "Australia\'s 50 Most Influential Surfers" — a cartoon character! There were books, a short animation in "Crystal Voyager" (1973), a radio show on Sydney\'s Double J voiced by Edwards himself, a record and calendars. The full anthology is "My Life As A Pork Chop, 1973–1981" (2011).'
      },
      note: {
        ru: 'Отсюда слоган Tentaclesurf — Good Vibes Department. Спасибо, Тони Эдвардс!',
        en: 'This is where the Tentaclesurf slogan — Good Vibes Department — comes from. Thank you, Tony Edwards!'
      },
      links: [['Wikipedia', 'https://en.wikipedia.org/wiki/Captain_Goodvibes'], ['Stab: A Brief History of Surf Cartoons', 'https://stabmag.com/style/a-brief-history-of-surf-cartoons']]
    },
    {
      id: 'endless', kind: 'film', years: '1966',
      title: { ru: 'The Endless Summer — «Бесконечное лето»', en: 'The Endless Summer' },
      by: { ru: 'Брюс Браун (Bruce Brown), США', en: 'Bruce Brown, USA' },
      text: {
        ru: 'Документальный фильм о том, как двое серферов, Майк Хинсон и Роберт Огаст, едут вокруг света вслед за летом в поисках идеальной волны. Фильм сделал серфинг мечтой для людей, которые никогда не видели океан, а его красно-жёлтая афиша стала одной из самых узнаваемых картинок серф-культуры.',
        en: 'A documentary about two surfers, Mike Hynson and Robert August, travelling around the world following the summer in search of the perfect wave. It made surfing a dream for people who had never seen the ocean, and its red-and-yellow poster became one of the best-known images of surf culture.'
      },
      links: [['Wikipedia', 'https://en.wikipedia.org/wiki/The_Endless_Summer']]
    },
    {
      id: 'crystal', kind: 'film', years: '1973',
      title: { ru: 'Crystal Voyager', en: 'Crystal Voyager' },
      by: { ru: 'Дэвид Элфик (David Elfick), Джордж Гриноф (George Greenough), Австралия', en: 'David Elfick, George Greenough, Australia' },
      text: {
        ru: 'Фильм о Джордже Гринофе — серфере и изобретателе, который сам строил доски, плавники и камеры. Знаменит съёмкой изнутри трубы волны под музыку Pink Floyd «Echoes». В нём же — короткая анимационная вставка с Captain Goodvibes.',
        en: 'A film about George Greenough, a surfer and inventor who built his own boards, fins and cameras. Famous for footage from inside the barrel set to Pink Floyd\'s "Echoes". It also has a short animated Captain Goodvibes sequence.'
      },
      links: [['Wikipedia', 'https://en.wikipedia.org/wiki/Crystal_Voyager']]
    }
  ];
  var KIND = { comic: { ru: 'комикс', en: 'comic' }, film: { ru: 'фильм', en: 'film' }, book: { ru: 'книга', en: 'book' }, music: { ru: 'музыка', en: 'music' }, other: { ru: 'другое', en: 'other' } };

  function L(o) { return o[TS.lang() === 'en' ? 'en' : 'ru'] || o.ru; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function suggestUrl() {
    var en = TS.lang() === 'en';
    var body = en
      ? 'What is it (comic, film, book, music, a person, a thing):\n\nTitle and author:\n\nYear:\n\nWhy it inspires you (a few lines):\n\nLinks (where to read / watch):\n\nPhoto — your own (attach it here), please do not copy other people\'s artwork.\n\nHow to sign you on the page (name / nickname / city):'
      : 'Что это (комикс, фильм, книга, музыка, человек, вещь):\n\nНазвание и автор:\n\nГод:\n\nЧем вдохновляет (пара строк):\n\nСсылки (где почитать / посмотреть):\n\nФото — только своё (прикрепите сюда), чужие рисунки не копируем.\n\nКак подписать вас на странице (имя / ник / город):';
    return REPO + '/issues/new?title=' + encodeURIComponent((en ? 'Surf culture: ' : 'Серф-культура: ')) + '&body=' + encodeURIComponent(body);
  }

  function card(it) {
    var links = (it.links || []).map(function (l) { return '<a href="' + esc(l[1]) + '" target="_blank" rel="noopener">' + esc(l[0]) + ' ↗</a>'; }).join('');
    return '<article class="cu-card' + (it.star ? ' star' : '') + '">' +
      '<div class="cu-meta"><span class="cu-kind">' + esc(L(KIND[it.kind] || KIND.other)) + '</span><span>' + esc(it.years || '') + '</span></div>' +
      '<h3>' + esc(L(it.title)) + '</h3><div class="cu-by">' + esc(L(it.by)) + '</div>' +
      (it.img ? '<img class="cu-img" src="' + esc(it.img) + '" alt="' + esc(L(it.title)) + '">' : '') +
      '<p>' + esc(L(it.text)) + '</p>' +
      (it.note ? '<p class="cu-note">' + esc(L(it.note)) + '</p>' : '') +
      '<div class="cu-links">' + links + (it.from ? '<span class="cu-from">' + esc(TS.t('cuFrom')) + ' ' + esc(it.from) + '</span>' : '') + '</div>' +
      '</article>';
  }

  function render() {
    var el = $('culturePage'); if (!el) return;
    el.innerHTML =
      '<div class="cu-wrap">' +
      '<div class="cu-hero"><img src="img/badge.svg" alt="" class="fin-badge"><div><div class="cu-kicker">Tentaclesurf</div><h1>Good Vibes Department</h1>' +
        '<p class="lead">' + TS.t('cuLead') + '</p></div></div>' +
      '<div class="cu-book"><div class="cu-photo" id="cuPhoto"><span>' + TS.t('cuPhoto') + '</span></div>' +
        '<div><h2>' + TS.t('cuStoryT') + '</h2><p>' + TS.t('cuStory') + '</p></div></div>' +
      '<div class="cu-head"><h2>' + TS.t('cuColT') + '</h2><div class="fin-btns"><a class="btnlink primary" href="' + suggestUrl() + '" target="_blank" rel="noopener">' + TS.t('cuAdd') + '</a><button id="cuCopy">' + TS.t('finCopy') + '</button></div></div>' +
      '<p class="small">' + TS.t('cuRules') + '</p>' +
      '<div class="cu-grid">' + ITEMS.map(card).join('') + '</div>' +
      '</div>';
    // фото книги появится, когда файл будет в img/culture/
    var im = new Image();
    im.onload = function () { var ph = $('cuPhoto'); if (ph) { ph.innerHTML = ''; im.alt = 'Captain Goodvibes'; ph.appendChild(im); ph.classList.add('has'); } };
    im.src = 'img/culture/goodvibes-book.jpg';
    $('cuCopy').addEventListener('click', function () {
      var url = location.href.split('#')[0] + '#culture';
      try { navigator.clipboard.writeText(url); this.textContent = TS.t('finCopied'); } catch (e) { prompt('', url); }
    });
  }

  TS.cultureUI = { init: render, show: function () {}, lang: render, items: ITEMS };
})(window.TS = window.TS || {});
