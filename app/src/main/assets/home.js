'use strict';
/* HomeTV: dashboard (clock, weather, news), public sections (films, cameras, radio) and the private
   area behind a decoy password prompt (press OK three times quickly). Uses helpers from index.html at runtime. */
var unlocked = false;
var PUB_TABS = [['dash','Home'],['movies','Filme'],['comedy','Comedy'],['cams','Kameras'],['radio','Radio'],['search','🎤 Suche'],['priv','Privat'],['set','Einstellungen']];
var PRIV_TABS = [['dash','← Home'],['home','Für dich'],['rand','Zufall'],['cats','Kategorien'],['search','🎤 Suche'],['mine','Meine Liste'],['games','Paar-Spiele'],['set','Einstellungen']];
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
  if (gateClicks >= 3) { hideGate(); unlocked = true; go(gateTarget); return; }
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

function loadNews() {
  http('https://rss.orf.at/news.xml').then(function (t) {
    var doc = new DOMParser().parseFromString(t, 'text/xml');
    var items = [].slice.call(doc.getElementsByTagName('item')).slice(0, 6);
    var ul = $('dnews'); ul.innerHTML = '';
    items.forEach(function (it) {
      var ti = it.getElementsByTagName('title')[0];
      if (!ti) return;
      var li = document.createElement('li'); li.textContent = ti.textContent; ul.appendChild(li);
    });
  }).catch(function () { $('dnews').innerHTML = ''; });
}

function dash() {
  unlocked = false;
  begin();
  tickClock(); loadWeather(); loadNews();
  addRow('', [['🎬 Filme', function () { go('movies'); }], ['😂 Comedy', function () { go('comedy'); }], ['📷 Kameras', function () { go('cams'); }],
    ['📻 Radio', function () { go('radio'); }], ['🎤 Suche', function () { voiceSearch(); }],
    ['🔒 Privat', function () { go('priv'); }], ['⚙️ Einstellungen', function () { go('set'); }]], 'tile');
  var cl = load('cams', []);
  if (cl.length) addRow('Kameras', cl.map(function (c, i) { return ['📷 ' + c.name, function () { openCam(i); }]; }), 'tile');
  var apps = myApps();
  if (apps.length) addRow('Deine Apps', apps.map(function (a) { return ['▶ ' + a[0], function () { stopRadio(); A.launch(a[1]); }]; }), 'tile');
  finish();
  movies({mv:1, q:'spielfilm', f:TT, page:1}).then(function (list) {
    if (view === 'dash' && list.length) addRow('Neu in den Mediatheken', list, null, {mv:1, q:'spielfilm', f:TT, page:1});
  });
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
function radio() {
  begin();
  addRow('Radio – OK = abspielen / stoppen (läuft weiter, während du in der App unterwegs bist)',
    RADIO.map(function (st) { return [(radioName === st[0] ? '♫ ' : '') + st[0], function () { var i = lines[L].i; playRadio(st); radio(); lines[1].i = i; focus(); }]; }), 'tile');
  finish();
}

/* ---------- Tapo cameras (RTSP via the camera account, home network only) ---------- */
function openCam(i) {
  var cl = load('cams', []);
  if (!cl[i]) return;
  stopRadio();
  if (A.camera) A.camera(JSON.stringify(cl), i); else toast('Für Kameras bitte zuerst die App aktualisieren');
}
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
function cams() {
  begin();
  var cl = load('cams', []);
  if (cl.length) addRow('Kameras – OK = live · im Vollbild ◀ ▶ = nächste Kamera, OK = HD/SD',
    cl.map(function (c, i) { return ['📷 ' + c.name, function () { openCam(i); }]; }), 'tile');
  else msg('Noch keine Kamera eingetragen.');
  var n = inputRow('Neue Kamera: Name', 'z. B. Garten', 'text');
  var ip = inputRow('IP-Adresse (Tapo-App → Kamera → Geräteinfo)', 'z. B. 192.168.0.50', 'text');
  var us = inputRow('Benutzer des Kamerakontos', 'Tapo-App → Kamera → Erweitert → Kamerakonto', 'text');
  var pw = inputRow('Passwort des Kamerakontos', 'bleibt nur auf diesem Fire TV gespeichert', 'password');
  addRow('', [['Kamera speichern', function () {
    var host = ip.value.trim();
    if (!n.value.trim() || !/^[A-Za-z0-9.\-]+$/.test(host) || !us.value) return toast('Bitte Name, IP und Benutzer ausfüllen');
    cl.push({name:n.value.trim().slice(0, 30), ip:host, user:us.value, pass:pw.value});
    save('cams', cl); toast('Kamera gespeichert'); cams();
  }]], 'btn');
  if (cl.length) addRow('Kamera entfernen', cl.map(function (c, i) {
    return ['✕ ' + c.name, function () { cl.splice(i, 1); save('cams', cl); toast('Entfernt'); cams(); }];
  }), 'btn');
  msg('Funktioniert nur im selben WLAN wie die Kameras. In der Tapo-App unter Kamera → Einstellungen → Erweiterte Einstellungen → Kamerakonto Benutzer und Passwort anlegen.');
  finish();
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
function ytFeed(name, id) {
  return http('https://www.youtube.com/feeds/videos.xml?channel_id=' + encodeURIComponent(id)).then(function (t) {
    var doc = new DOMParser().parseFromString(t, 'text/xml');
    var tag = function (el, n) { var x = el.getElementsByTagNameNS('*', n)[0]; return x ? x.textContent : ''; };
    return [].slice.call(doc.getElementsByTagNameNS('*', 'entry')).map(function (e) {
      var vid = tag(e, 'videoId');
      if (!/^[\w-]{11}$/.test(vid)) return null;
      return {id:'yt:' + vid, src:'yt', chId:id, channel:name.split(' –')[0], title:tag(e, 'title'), desc:tag(e, 'description'),
        date:Date.parse(tag(e, 'published')) / 1000 || 0, length_sec:0, keywords:'', views:0, rate:0,
        embed:'https://www.youtube-nocookie.com/embed/' + vid + '?autoplay=1&rel=0&modestbranding=1',
        default_thumb:{src:'https://i.ytimg.com/vi/' + vid + '/hqdefault.jpg'}, thumbs:[]};
    }).filter(function (v) { return v && !P.bad[v.id]; });
  }).catch(function () { return []; });
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
