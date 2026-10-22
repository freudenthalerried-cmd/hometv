'use strict';
/* HomeTV: dashboard (clock, weather, news), public sections (films, cameras, radio) and the private
   area behind a decoy password prompt (press OK three times quickly). Uses helpers from index.html at runtime. */
var unlocked = false;
var camOk = false; // cameras sit behind the same 3× OK gate, separately from the private area
var PUB_TABS = [['dash','Home'],['movies','Filme'],['comedy','Comedy'],['cams','Kameras'],['radio','Musik'],['search','🎤 Suche'],['priv','Privat'],['set','Einstellungen']];
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
    if (gateTarget === 'cams') { camOk = true; go('cams'); }
    else if (gateTarget.indexOf('cam:') === 0) { camOk = true; openCam(+gateTarget.slice(4)); }
    else { unlocked = true; go(gateTarget); }
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
  unlocked = false; camOk = false; // back home = everything locked again
  begin();
  tickClock(); loadWeather(); loadNews();
  addRow('', [['🎬 Filme', function () { go('movies'); }], ['😂 Comedy', function () { go('comedy'); }], ['📷 Kameras', function () { go('cams'); }],
    ['🎵 Musik', function () { go('radio'); }], ['🔥 Kaminfeuer', function () { openFire(); }], ['🎤 Suche', function () { voiceSearch(); }],
    ['🔒 Privat', function () { go('priv'); }], ['⚙️ Einstellungen', function () { go('set'); }]], 'tile');
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
  $('np').style.display = fireOn ? 'none' : 'block'; // the fireplace shows its own info line
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
  addRow('', [['🔥 Kaminfeuer mit Musik', function () { openFire(); }]], 'tile');
  MUSIC.concat([['Radio Österreich & Bayern', RADIO]]).forEach(function (g) {
    addRow(g[0] + ' – OK = abspielen / stoppen', g[1].map(function (st) {
      return [(radioName === st[0] ? '♫ ' : '') + st[0], function () { playRadio(st); radio(); }];
    }), 'tile');
  });
  finish();
  if (keep && lines[keep[0]]) { L = keep[0]; lines[L].i = keep[1]; focus(); }
}

/* ---------- Kaminfeuer: procedural fire on a small canvas (scaled up = soft glow) + synthesized crackling ---------- */
var fireOn = false, fireRAF = 0, fireMusic = 0, fctx = null, fGain = null, fPop = 0, fVol = 0.6;
var FIRE_MUSIC = [null, ['SomaFM Lush', 'https://ice1.somafm.com/lush-128-mp3'], ['Radio Swiss Jazz', 'https://stream.srg-ssr.ch/m/rsj/mp3_128'],
  ['Radio Swiss Classic', 'https://stream.srg-ssr.ch/m/rsc_de/mp3_128']];
function openFire() {
  stopRadio(); fireOn = true; fireMusic = 0;
  $('fire').style.display = 'block';
  startFire(); crackle(true); fireInfo();
}
function closeFire() {
  fireOn = false; cancelAnimationFrame(fireRAF); crackle(false); stopRadio();
  $('fire').style.display = 'none';
}
function fireInfo() {
  var m = FIRE_MUSIC[fireMusic];
  $('finfo').textContent = 'Musik: ' + (m ? m[0] : 'aus') + ' · OK = Musik wechseln · ▲ ▼ = Knistern ' + Math.round(fVol * 100) + ' % · Zurück = beenden';
}
function fireKey(k) {
  if (fctx && fctx.resume) fctx.resume();
  if (k === 'Enter') {
    fireMusic = (fireMusic + 1) % FIRE_MUSIC.length;
    stopRadio();
    if (FIRE_MUSIC[fireMusic]) playRadio(FIRE_MUSIC[fireMusic]);
  } else if (k === 'ArrowUp' || k === 'ArrowDown') {
    fVol = Math.max(0, Math.min(1, fVol + (k === 'ArrowUp' ? 0.2 : -0.2)));
    if (fGain) fGain.gain.value = 0.3 * fVol;
  } else return;
  fireInfo();
}
function startFire() {
  var c = $('firec'), x = c.getContext('2d'), W = c.width = 320, H = c.height = 180, ps = [], t = 0;
  (function step() {
    if (!fireOn) return;
    t += 0.05;
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = 'rgba(8,3,1,0.35)'; x.fillRect(0, 0, W, H);
    var glow = x.createRadialGradient(W / 2, H * 0.9, 5, W / 2, H * 0.9, W * 0.6);
    glow.addColorStop(0, 'rgba(120,40,5,' + (0.25 + Math.sin(t * 3) * 0.04) + ')'); glow.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = glow; x.fillRect(0, 0, W, H);
    for (var i = 0; i < 6; i++) ps.push({x:W / 2 + (Math.random() + Math.random() - 1) * W * 0.17, y:H * 0.85, vx:(Math.random() - 0.5) * 0.3,
      vy:-(0.5 + Math.random() * 0.9), r:6 + Math.random() * 10, life:1});
    if (Math.random() < 0.15) ps.push({x:W / 2 + (Math.random() - 0.5) * W * 0.25, y:H * 0.8, vx:(Math.random() - 0.5) * 0.8,
      vy:-(1.2 + Math.random()), r:1.2, life:1, ember:1});
    x.globalCompositeOperation = 'lighter';
    ps = ps.filter(function (p) { return p.life > 0; });
    ps.forEach(function (p) {
      p.x += p.vx + Math.sin(p.y * 0.08 + t) * 0.3; p.y += p.vy; p.life -= p.ember ? 0.008 : 0.02; p.r *= p.ember ? 1 : 0.985;
      var g = x.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * (p.ember ? 2 : 1));
      g.addColorStop(0, 'rgba(255,210,120,' + p.life * 0.65 + ')');
      g.addColorStop(0.4, 'rgba(255,120,20,' + p.life * 0.55 + ')');
      g.addColorStop(1, 'rgba(120,20,0,0)');
      x.fillStyle = g; x.beginPath(); x.arc(p.x, p.y, p.r * (p.ember ? 2 : 1), 0, 7); x.fill();
    });
    x.globalCompositeOperation = 'source-over';
    x.fillStyle = '#1e0f07';
    x.save(); x.translate(W / 2, H * 0.9); x.rotate(0.12); x.fillRect(-W * 0.2, -4, W * 0.4, 9); x.rotate(-0.24); x.fillRect(-W * 0.2, -4, W * 0.4, 9); x.restore();
    fireRAF = requestAnimationFrame(step);
  })();
}
function crackle(on) {
  clearTimeout(fPop);
  if (!on) { if (fctx) { try { fctx.close(); } catch (e) { } } fctx = null; fGain = null; return; }
  try { fctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  var sr = fctx.sampleRate, buf = fctx.createBuffer(1, sr * 2, sr), d = buf.getChannelData(0), last = 0;
  for (var i = 0; i < d.length; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; } // brown noise = roar
  var src = fctx.createBufferSource(); src.buffer = buf; src.loop = true;
  var lp = fctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
  fGain = fctx.createGain(); fGain.gain.value = 0.3 * fVol;
  src.connect(lp); lp.connect(fGain); fGain.connect(fctx.destination); src.start();
  (function pop() { // short filtered noise bursts = crackles
    if (!fctx) return;
    var b = fctx.createBuffer(1, Math.floor(sr * 0.03), sr), dd = b.getChannelData(0);
    for (var j = 0; j < dd.length; j++) dd[j] = (Math.random() * 2 - 1) * Math.pow(1 - j / dd.length, 4);
    var n = fctx.createBufferSource(); n.buffer = b;
    var hp = fctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1500 + Math.random() * 3000;
    var gg = fctx.createGain(); gg.gain.value = (0.05 + Math.random() * 0.3) * fVol;
    n.connect(hp); hp.connect(gg); gg.connect(fctx.destination); n.start();
    fPop = setTimeout(pop, 60 + Math.random() * (Math.random() < 0.2 ? 80 : 600));
  })();
}

/* ---------- Tapo cameras (RTSP via the camera account, home network only) ---------- */
function openCam(i) {
  var cl = load('cams', []);
  if (!cl[i]) return;
  if (!camOk && !unlocked) return showGate('cam:' + i);
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
