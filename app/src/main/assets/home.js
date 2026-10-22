'use strict';
/* HomeTV: dashboard (clock, weather, news), public sections (films, news, music …) and the private
   area behind a decoy password prompt (press OK three times quickly). Uses helpers from index.html at runtime. */
var unlocked = false;
var PUB_TABS = [['dash','Home'],['fav','★ Favoriten'],['movies','Filme'],['news','News'],['yt','YouTube'],['learn','Lernen'],['search','🎤 Suche'],['priv','Privat'],['set','⚙']];
var PRIV_TABS = [['dash','← Home'],['home','Für dich'],['rand','Zufall'],['cats','Kategorien'],['search','🎤 Suche'],['mine','Liste'],['games','Spiele'],['set','⚙']];
var PRIV_VIEWS = {priv:1, home:1, rand:1, cats:1, cat:1, mine:1, games:1};

/* ---------- decoy password gate ---------- */
var gateOn = false, gateTarget = 'home', gateClicks = 0, gateT = null;
function showGate(target) {
  gateTarget = target === 'priv' ? 'home' : target;
  gateOn = true; gateClicks = 0;
  $('gpw').textContent = ''; $('gmsg').textContent = '';
  $('gate').style.display = 'flex';
}
function hideGate() { gateOn = false; clearTimeout(gateT); $('gate').style.display = 'none'; }
function gateKey(k) {
  if (k !== 'Enter') return;
  gateClicks++;
  clearTimeout(gateT);
  if (gateClicks >= 3) {
    hideGate();
    unlocked = true; go(gateTarget);
    return;
  }
  $('gpw').textContent = new Array(gateClicks + 1).join('● ');
  $('gmsg').textContent = '';
  // a single press looks like a wrong password
  gateT = setTimeout(function () { gateClicks = 0; $('gpw').textContent = ''; $('gmsg').textContent = 'Passwort falsch'; }, 900);
}

/* ---------- dashboard ---------- */
var WX = {0:['☀️','Sonnig'], 1:['🌤','Heiter'], 2:['⛅','Wolkig'], 3:['☁️','Bedeckt'], 45:['🌫','Nebel'], 48:['🌫','Nebel'],
  51:['🌦','Niesel'], 53:['🌦','Niesel'], 55:['🌦','Niesel'], 61:['🌧','Regen'], 63:['🌧','Regen'], 65:['🌧','Starkregen'],
  66:['🌧','Eisregen'], 67:['🌧','Eisregen'], 71:['🌨','Schnee'], 73:['🌨','Schnee'], 75:['❄️','Starker Schnee'], 77:['🌨','Schnee'],
  80:['🌦','Schauer'], 81:['🌧','Schauer'], 82:['⛈','Starke Schauer'], 85:['🌨','Schneeschauer'], 86:['🌨','Schneeschauer'],
  95:['⛈','Gewitter'], 96:['⛈','Gewitter'], 99:['⛈','Gewitter']};
var DAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
function wx(c) { return WX[c] || ['🌡', '']; }
function wxLoc() { return load('wxloc', {name:'Ried in der Riedmark', lat:48.27, lon:14.53}); }

function tickClock() {
  var d = new Date();
  $('dclock').textContent = ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
  $('ddate').textContent = d.toLocaleDateString('de-AT', {weekday:'long', day:'numeric', month:'long'});
}
setInterval(function () { if (view === 'dash') tickClock(); }, 15000);

function loadWeather() {
  var loc = wxLoc();
  http('https://api.open-meteo.com/v1/forecast?latitude=' + loc.lat + '&longitude=' + loc.lon +
       '&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min' +
       '&timezone=auto&forecast_days=4').then(function (t) {
    var d = JSON.parse(t), c = d.current, w = wx(c.weather_code), dl = d.daily;
    $('dwx').textContent = w[0] + ' ' + Math.round(c.temperature_2m) + '°  ' + w[1] + ' · Wind ' + Math.round(c.wind_speed_10m) + ' km/h · ' + loc.name;
    $('dfc').innerHTML = dl.time.map(function (day, i) {
      return '<span><b>' + (i ? DAYS[new Date(day).getDay()] : 'Heute') + '</b> ' + wx(dl.weather_code[i])[0] + ' ' +
        Math.round(dl.temperature_2m_min[i]) + '–' + Math.round(dl.temperature_2m_max[i]) + '°</span>';
    }).join('');
  }).catch(function () { $('dwx').textContent = 'Wetter gerade nicht verfügbar'; });
}

/* headlines slide in from the right every 7 s, with the article's picture (og:image) */
var newsT = 0, newsI = 0;
function loadNews() {
  http('https://rss.orf.at/news.xml').then(function (t) {
    var doc = new DOMParser().parseFromString(t, 'text/xml');
    var tag = function (el, n) { var x = el.getElementsByTagNameNS('*', n)[0]; return x ? x.textContent : ''; };
    var items = [].slice.call(doc.getElementsByTagNameNS('*', 'item')).slice(0, 8).map(function (it) {
      var enc = it.getElementsByTagNameNS('*', 'enclosure')[0] || it.getElementsByTagNameNS('*', 'content')[0];
      return {t:tag(it, 'title'), l:tag(it, 'link'), img:enc ? enc.getAttribute('url') || '' : ''};
    }).filter(function (x) { return x.t; });
    $('dtrack').innerHTML = items.map(function (x) { return '<div class="ns"><i></i><b></b></div>'; }).join('');
    var sl = [].slice.call($('dtrack').children);
    items.forEach(function (x, i) {
      sl[i].querySelector('b').textContent = x.t;
      var pic = function (u) { if (/^https:\/\//.test(u)) sl[i].querySelector('i').style.backgroundImage = 'url("' + u.replace(/"/g, '') + '")'; };
      if (x.img) pic(x.img);
      else if (/^https:\/\//.test(x.l)) http(x.l).then(function (h) {
        pic(((h.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || [])[1] || '').replace(/&amp;/g, '&'));
      }).catch(function () { });
    });
    $('ddots').innerHTML = items.map(function () { return '<i></i>'; }).join('');
    newsI = 0; slideNews(0);
    clearInterval(newsT);
    newsT = setInterval(function () { if (view === 'dash' && items.length) slideNews((newsI + 1) % items.length); }, 7000);
  }).catch(function () { $('dtrack').innerHTML = ''; });
}
function slideNews(i) {
  newsI = i;
  $('dtrack').style.transform = 'translateX(' + (-100 * i) + '%)';
  [].slice.call($('ddots').children).forEach(function (d, k) { d.className = k === i ? 'on' : ''; });
}

function dash() {
  unlocked = false; // back home = everything locked again
  begin();
  tickClock(); loadWeather(); loadNews();
  var T = function (label, k, fn) { return [label, fn || function () { go(k); }, tileOf(k)]; };
  addRow('', [T('★ Favoriten', 'fav'), T('🎬 Filme', 'movies'), T('📰 Nachrichten', 'news'), T('🎓 Lernen', 'learn'), T('😂 Comedy', 'comedy'),
    T('🎵 Musik', 'radio'), T('▶ YouTube', 'yt'), T('🌿 Entspannung', 'relax'), T('🎤 Suche', '', function () { voiceSearch(); }),
    T('🔒 Privat', 'priv-none', function () { go('priv'); }), T('⚙️ Einstellungen', 'set-none', function () { go('set'); })], 'tile');
  newCount().then(function (n) { // how many new episodes of the favourite shows
    if (!n || view !== 'dash') return;
    var t = [].slice.call(document.querySelectorAll('.tile')).filter(function (e) { return e.textContent === '★ Favoriten'; })[0];
    if (t) t.textContent = '★ Favoriten · ' + n + ' neu';
  });
  var apps = myApps();
  if (apps.length) addRow('Deine Apps', apps.map(function (a) { return [a[2] ? '' : '▶ ' + a[0], function () { stopRadio(); A.launch(a[1]); }, a[2]]; }), 'tile');
  finish();
  // below the tiles: one row per section to scroll down through, always in the same order
  var tok = ++dashTok;
  DASH_ROWS().map(function (r) { return [r, r[1]().catch(function () { return []; })]; }).reduce(function (p, x) {
    return p.then(function () { return x[1].then(function (list) { if (view === 'dash' && tok === dashTok) addRow(x[0][0], list, null, x[0][2]); }); });
  }, Promise.resolve());
}
var dashTok = 0;
function mvSpec(q, f, min) { return {mv:1, page:1, q:q, f:f, min:min}; }
function DASH_ROWS() {
  var byDate = function (l) { return l.sort(function (a, b) { return (b.date || 0) - (a.date || 0); }); };
  var row = function (title, spec) { return [title, function () { return movies(spec); }, spec]; };
  return [
    ['🆕 Neu bei deinen Favoriten', function () { return Promise.all(myShows().map(episodes)).then(function (r) { return byDate([].concat.apply([], r).filter(function (v) { return v.neu; })); }); }],
    row('🎬 Neu in den Mediatheken', mvSpec('spielfilm', TT)),
    ['📰 Nachrichten', function () {
      return Promise.all(NEWS_MV.slice(0, 2).map(function (r) { return movies({mv:1, page:1, q:r[1], f:TT, min:r[3], ch:r[4]}); }))
        .then(function (r) { return byDate([].concat.apply([], r)); });
    }],
    row('🎞 Dokus', mvSpec('terra x', TT, 2400)),
    row('😂 Comedy', mvSpec('heute-show', TT, 1200)),
    ['▶ YouTube', function () { return ytFeed(YT_TUBE[0][0], YT_TUBE[0][1]); }],
    row('🎓 Lernen', mvSpec('planet schule', TTD, 600)),
    row('🌿 Entspannung', mvSpec('natur', TTD, 2400))
  ];
}

/* ---------- radio ---------- */
var RADIO = [
  ['Ö3', 'https://orf-live.ors-shoutcast.at/oe3-q2a'], ['FM4', 'https://orf-live.ors-shoutcast.at/fm4-q2a'],
  ['Ö1', 'https://orf-live.ors-shoutcast.at/oe1-q2a'], ['Radio Oberösterreich', 'https://orf-live.ors-shoutcast.at/ooe-q2a'],
  ['Radio Salzburg', 'https://orf-live.ors-shoutcast.at/sbg-q2a'], ['Radio Wien', 'https://orf-live.ors-shoutcast.at/wie-q2a'],
  ['Kronehit', 'https://secureonair.krone.at/kronehit-hp.mp3'], ['Antenne Bayern', 'https://stream.antenne.de/antenne'],
  ['Bayern 3', 'https://dispatcher.rndfnk.com/br/br3/live/mp3/mid']
];
var radioAudio = null, radioName = '';
function playRadio(st) {
  if (radioName === st[0]) return stopRadio();
  stopRadio();
  radioAudio = new Audio(st[1]);
  radioName = st[0];
  radioAudio.play().catch(function () { toast('Sender nicht erreichbar'); stopRadio(); });
  radioAudio.onerror = function () { toast(st[0] + ' gerade nicht erreichbar'); stopRadio(); };
  $('np').textContent = '♫ ' + st[0] + ' – nochmal OK zum Stoppen';
  $('np').style.display = 'block';
}
function stopRadio() {
  if (radioAudio) { radioAudio.pause(); radioAudio.src = ''; radioAudio = null; }
  radioName = '';
  $('np').style.display = 'none';
}
// ad-free mood streams (SomaFM is listener-supported, Radio Swiss runs without ads); editable via content.json "music"
var MUSIC = [
  ['Romantisch & Lounge', [['SomaFM Lush', 'https://ice1.somafm.com/lush-128-mp3'], ['Radio Swiss Jazz', 'https://stream.srg-ssr.ch/m/rsj/mp3_128'],
    ['SomaFM Secret Agent', 'https://ice1.somafm.com/secretagent-128-mp3']]],
  ['Chillout', [['SomaFM Groove Salad', 'https://ice1.somafm.com/groovesalad-128-mp3'], ['SomaFM Drone Zone', 'https://ice1.somafm.com/dronezone-128-mp3']]],
  ['Klassik & Pop', [['Radio Swiss Classic', 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128'], ['Radio Swiss Pop', 'https://stream.srg-ssr.ch/m/rsp/mp3_128']]]
];
function allStations() { return [].concat.apply([], MUSIC.map(function (g) { return g[1]; })).concat(RADIO); }
function radio() {
  var keep = view === 'radio' && lines[L] ? [L, lines[L].i] : null;
  begin();
  addRow('', [['🌿 Natur & Entspannung', function () { go('relax'); }]], 'tile');
  MUSIC.concat([['Radio Österreich & Bayern', RADIO]]).forEach(function (g) {
    addRow(g[0] + ' – OK = abspielen / stoppen', g[1].map(function (st) {
      return [(radioName === st[0] ? '♫ ' : '') + st[0], function () { playRadio(st); radio(); }];
    }), 'tile');
  });
  finish();
  if (keep && lines[keep[0]]) { L = keep[0]; lines[L].i = keep[1]; focus(); }
}

/* ---------- Natur & Entspannung: calm nature films from the Mediatheken, optional lounge music while browsing ---------- */
var RELAX = [['Natur pur', 'natur', 'ttd', 2400], ['Universum', 'universum', 'tt', 2400], ['Expeditionen ins Tierreich', 'expeditionen ins tierreich', 'tt', 2400],
  ['Berge & Landschaften', 'berge', 'ttd', 2400], ['Meer & Küsten', 'meer', 'ttd', 2400]];
function relax() {
  begin();
  addRow('', [[radioName ? '♫ Musik aus' : '🎵 Lounge-Musik beim Stöbern', function () {
    if (radioName) stopRadio(); else playRadio(MUSIC[0][1][0]);
    relax();
  }]], 'tile');
  msg('Lade ruhige Naturfilme …');
  finish();
  var specs = RELAX.map(function (r) { return {mv:1, page:1, q:r[1], f:r[2] === 'ttd' ? TTD : TT, min:r[3]}; });
  Promise.all(specs.map(movies)).then(function (res) {
    if (view !== 'relax') return;
    [].slice.call($('rows').querySelectorAll('.msg')).forEach(function (m) { m.remove(); });
    RELAX.forEach(function (r, i) { addRow(r[0], mvPersonal(res[i]), null, specs[i]); });
    if (lines.length < 3) msg('Mediatheken gerade nicht erreichbar.');
  });
}

/* ---------- installed TV apps (Netflix, Prime Video, Disney+ …) ---------- */
var APP_ORDER = ['netflix', 'prime', 'disney', 'joyn', 'rtl', 'orf', 'zdf', 'ard', 'arte', 'youtube', 'wow', 'sky', 'dazn', 'magenta', 'waipu', 'zattoo', 'spotify'];
function myApps() {
  var list = [];
  try { list = JSON.parse(A.apps ? A.apps() : '[]'); } catch (e) { }
  var rank = function (a) {
    var n = (a[0] + ' ' + a[1]).toLowerCase();
    for (var i = 0; i < APP_ORDER.length; i++) if (n.indexOf(APP_ORDER[i]) >= 0) return i;
    return 99;
  };
  return list.filter(function (a) { return rank(a) < 99; }).sort(function (a, b) { return rank(a) - rank(b); }).slice(0, 12);
}

/* ---------- YouTube channel feeds (official channels, played via the privacy-friendly embed) ---------- */
var YT_COMEDY = [['heute-show auf YouTube', 'UCFqcNI0NaAA21NS9W3ExCRg']];
var NETZKINO = ['Netzkino – ganze Kinofilme gratis & legal', 'UCGkHFrwE8KEuOHPVsIOskAg'];
function ytFeed(name, id, subs) {
  return http('https://www.youtube.com/feeds/videos.xml?channel_id=' + encodeURIComponent(id)).then(function (t) {
    var doc = new DOMParser().parseFromString(t, 'text/xml');
    var tag = function (el, n) { var x = el.getElementsByTagNameNS('*', n)[0]; return x ? x.textContent : ''; };
    return [].slice.call(doc.getElementsByTagNameNS('*', 'entry')).map(function (e) {
      var vid = tag(e, 'videoId'), link = e.getElementsByTagNameNS('*', 'link')[0];
      if (!/^[\w-]{11}$/.test(vid)) return null;
      if (link && /\/shorts\//.test(link.getAttribute('href') || '')) return null; // no Shorts, only real videos
      return {id:'yt:' + vid, src:'yt', chId:id, channel:name.split(' –')[0], title:tag(e, 'title'), desc:tag(e, 'description'),
        date:Date.parse(tag(e, 'published')) / 1000 || 0, length_sec:0, keywords:'', views:0, rate:0,
        embed:'https://www.youtube-nocookie.com/embed/' + vid + '?autoplay=1&rel=0&modestbranding=1' + (subs ? '&cc_load_policy=1&cc_lang_pref=de&hl=de' : ''),
        check:'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + vid), // 200 only if embeddable
        default_thumb:{src:'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg'}, thumbs:[]};
    }).filter(function (v) { return v && !P.bad[v.id]; });
  }).then(playable).catch(function () { return []; });
}

/* ---------- YouTube section: German documentary channels + free films ---------- */
var YT_TUBE = [['Terra X Natur & Geschichte', 'UCA3mpqm67CpJ13YfA8qAnow'], ['ZDFinfo Dokus & Reportagen', 'UC7FeuS5wwfSR9IwOPkBV7SQ'],
  ['MDR DOK', 'UCFxgCHRLXmaW3YUyDsikoSw'], ['Netzkino – ganze Kinofilme', 'UCGkHFrwE8KEuOHPVsIOskAg'],
  ['ZDF heute-show', 'UCFqcNI0NaAA21NS9W3ExCRg']];
function ytView() {
  begin(); msg('Lade YouTube-Kanäle …'); finish();
  Promise.all(YT_TUBE.map(function (c) { return ytFeed(c[0], c[1]); })).then(function (res) {
    if (view !== 'yt') return;
    [].slice.call($('rows').querySelectorAll('.msg')).forEach(function (m) { m.remove(); });
    YT_TUBE.forEach(function (c, i) {
      addRow(c[0], res[i].slice().sort(function (a, b) { return (P.watched[a.id] ? 1 : 0) - (P.watched[b.id] ? 1 : 0); }));
    });
    if (lines.length < 2) msg('YouTube gerade nicht erreichbar.');
    if (L === 0 && lines.length > 1) L = 1;
    focus();
  });
}

/* ---------- Comedy: whole shows from the Mediatheken + official YouTube channels ---------- */
var COMEDY_MV = [['heute-show', 'heute-show', 'tt', 1200], ['extra 3', 'extra 3', 'tt', 1200], ['Die Anstalt', 'die anstalt', 'tt', 1800],
  ['Willkommen Österreich', 'willkommen österreich', 'tt', 1800], ['Mitternachtsspitzen', 'mitternachtsspitzen', 'tt', 1800],
  ['Kabarett', 'kabarett', 'ttd', 2400], ['Comedy & Satire', 'comedy', 'ttd', 1200]];
function comedy() {
  begin(); msg('Lade Comedy aus Mediatheken und YouTube …'); finish();
  var specs = COMEDY_MV.map(function (r) { return {mv:1, page:1, q:r[1], f:r[2] === 'ttd' ? TTD : TT, min:r[3]}; });
  Promise.all(specs.map(movies).concat(YT_COMEDY.map(function (c) { return ytFeed(c[0], c[1]); }))).then(function (res) {
    if (view !== 'comedy') return;
    [].slice.call($('rows').querySelectorAll('.msg')).forEach(function (m) { m.remove(); });
    COMEDY_MV.forEach(function (r, i) { addRow(r[0] + ' – ganze Sendungen', res[i], null, specs[i]); });
    YT_COMEDY.forEach(function (c, i) { addRow(c[0], res[COMEDY_MV.length + i]); });
    if (lines.length < 2) msg('Gerade nichts erreichbar.');
    if (L === 0 && lines.length > 1) L = 1;
    focus();
  });
}

/* ---------- text input row (weather place, favourite shows) ---------- */
function inputRow(label, ph, type) {
  var r = document.createElement('div'); r.className = 'row'; r.style.height = '12vh';
  r.innerHTML = '<h2></h2><input class="f inp" type="' + type + '">';
  r.querySelector('h2').textContent = label;
  var inp = r.querySelector('input'); inp.placeholder = ph;
  inp._act = function () { inp.focus(); A.keyboard(); };
  inp.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !inp.value) return;
    e.stopPropagation(); e.preventDefault(); inp.blur();
    L = Math.min(lines.length - 1, L + 1); focus();
  });
  $('rows').appendChild(r);
  lines.push({el:r, items:[inp], i:0});
  return inp;
}
/* ---------- weather location (settings) ---------- */
function wxLocRow() {
  var inp = inputRow('Wetter-Ort: ' + wxLoc().name + ' (neuen Ort eingeben, OK)', 'z. B. Enns', 'text');
  inp.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' || !inp.value.trim()) return;
    http('https://geocoding-api.open-meteo.com/v1/search?count=1&language=de&name=' + encodeURIComponent(inp.value.trim())).then(function (t) {
      var r = (JSON.parse(t).results || [])[0];
      if (!r) return toast('Ort nicht gefunden');
      save('wxloc', {name:r.name, lat:r.latitude, lon:r.longitude});
      toast('Wetter für ' + r.name); settings();
    }).catch(function () { toast('Ort-Suche fehlgeschlagen'); });
  }, true);
}

