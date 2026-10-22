'use strict';
/* Favourite shows ("Meine Sendungen") with their newest episodes, YouTube search (for shows of private channels such as
   ServusTV or RTL, filtered to the official channel) and the learning videos section. Uses helpers from index.html. */
// {n:name, mv:Mediathek search, ch:broadcaster, yt:YouTube search, own:channel name must match, cid:YouTube channel id}
var SHOWS_DEF = [{n:'Pufpaffs Happy Hour', mv:'pufpaff'}, {n:'Oberösterreich heute', mv:'oberösterreich heute', ch:'orf'},
  {n:'Servus Nachrichten', yt:'Servus Nachrichten', own:'servus'}, {n:'Der Wegscheider', yt:'Der Wegscheider', own:'servus'},
  {n:'Das Sommerhaus der Stars', yt:'Sommerhaus der Stars', own:'rtl'}, {n:'Die Geissens', yt:'Die Geissens', own:'rtl|geiss'}];
function myShows() { return load('shows', SHOWS_DEF); }
function isShow(n) { return myShows().some(function (s) { return s.n === n; }); }
function addShow(s) {
  var l = myShows();
  if (l.some(function (x) { return x.n.toLowerCase() === s.n.toLowerCase(); })) return toast('„' + s.n + '“ ist schon in deinen Sendungen');
  l.unshift(s); save('shows', l.slice(0, 40)); showCache = {};
  toast('★ „' + s.n + '“ zu deinen Sendungen hinzugefügt');
}
function delShow(n) { save('shows', myShows().filter(function (s) { return s.n !== n; })); }

/* ---------- YouTube search (device side, no API key) ---------- */
var AGO = {sekunde:1, second:1, minute:60, stunde:3600, hour:3600, tag:86400, day:86400, woche:604800, week:604800,
  monat:2592000, month:2592000, jahr:31536000, year:31536000};
function ytSearch(q, own, min, byDate) {
  return http('https://www.youtube.com/results?hl=de&gl=AT' + (byDate ? '&sp=CAI%253D' : '') + '&search_query=' + encodeURIComponent(q)).then(function (t) {
    var m = t.match(/ytInitialData\s*=\s*(\{[\s\S]+?\});\s*<\/script>/), out = [];
    if (!m) return [];
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      if (o.videoRenderer) out.push(o.videoRenderer);
      for (var k in o) walk(o[k]);
    })(JSON.parse(m[1]));
    var re = own ? new RegExp(own, 'i') : null, now = Date.now() / 1000;
    return out.map(function (r) {
      var txt = function (x) { return x ? x.simpleText || (x.runs || []).map(function (y) { return y.text; }).join('') : ''; };
      var by = txt(r.ownerText || r.longBylineText), len = txt(r.lengthText).split(':').reduce(function (a, b) { return a * 60 + (+b || 0); }, 0);
      var ago = /(\d+)\s*([a-zä]+)/i.exec(txt(r.publishedTimeText)) || [], unit = String(ago[2] || '').toLowerCase().replace(/(e?n|s)$/, '');
      if (!/^[\w-]{11}$/.test(r.videoId || '') || (re && !re.test(by)) || len < (min || 0)) return null;
      return {id:'yt:' + r.videoId, src:'yt', channel:by, title:txt(r.title), desc:'', date:now - (+ago[1] || 0) * (AGO[unit] || 0), length_sec:len,
        keywords:'', views:0, rate:0, embed:'https://www.youtube-nocookie.com/embed/' + r.videoId + '?autoplay=1&rel=0&modestbranding=1',
        check:'https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + r.videoId),
        default_thumb:{src:'https://i.ytimg.com/vi/' + r.videoId + '/hqdefault.jpg'}, thumbs:[]};
    }).filter(function (v) { return v && !P.bad[v.id]; });
  }).then(playable).catch(function () { return []; });
}

/* ---------- favourites view ---------- */
var showCache = {};
function episodes(s) {
  var c = showCache[s.n];
  if (c && Date.now() - c[0] < 18e5) return Promise.resolve(c[1]);
  return Promise.all([s.mv ? movies({mv:1, page:1, q:s.mv, f:TT, min:600, ch:s.ch}) : [], s.yt ? ytSearch(s.yt, s.own, 300, true) : [],
      s.cid ? ytFeed(s.n, s.cid) : []]).then(function (r) {
    var l = uniq(r[0].concat(r[1], r[2])).sort(function (a, b) { return (b.date || 0) - (a.date || 0); }).slice(0, 24);
    l.forEach(function (v) { v.neu = !P.watched[v.id] && v.date > Date.now() / 1000 - 14 * 86400; }); // NEU = last 14 days, not watched
    showCache[s.n] = [Date.now(), l];
    return l;
  });
}
function newCount() {
  return Promise.all(myShows().map(episodes)).then(function (res) {
    return res.reduce(function (n, l) { return n + l.filter(function (v) { return v.neu; }).length; }, 0);
  });
}
function favs() {
  begin(); msg('Lade deine Sendungen …'); finish();
  var shows = myShows();
  Promise.all(shows.map(episodes)).then(function (res) {
    if (view !== 'fav') return;
    begin();
    var neu = [].concat.apply([], res).filter(function (v) { return v.neu; }).sort(function (a, b) { return b.date - a.date; });
    addRow('🆕 Neu hinzugefügt bei deinen Sendungen', neu);
    var pub = P.favs.filter(function (v) { return v.src === 'mv' || v.src === 'yt'; });
    addRow('♥ Gemerkt (☰ = bewerten / entfernen)', pub);
    var top = P.hist.filter(function (v) { return (v.src === 'mv' || v.src === 'yt') && P.rate && P.rate[v.id] >= 4; });
    addRow('★ Am besten bewertet', top);
    shows.forEach(function (s, i) { addRow('★ ' + s.n, res[i]); });
    var inp = inputRow('Sendung hinzufügen (Name, OK)', 'z. B. Universum, Bergdoktor, Bauer sucht Frau …', 'text');
    inp.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' || !inp.value.trim()) return;
      var n = inp.value.trim().slice(0, 40);
      addShow({n:n, mv:n.toLowerCase(), yt:n}); favs();
    }, true);
    addRow('Sendung entfernen', shows.map(function (s) { return ['✕ ' + s.n, function () { delShow(s.n); toast('Entfernt'); favs(); }]; }), 'btn');
    msg('Tipp: Bei jedem Film ☰ drücken → „Sendung abonnieren“, „Merken“ oder mit Sternen bewerten.');
    finish();
  });
}

/* ---------- learning videos ---------- */
var LEARN_MV = [['planet schule', 'planet schule', 'ttd', 600], ['alpha Lernen', 'alpha lernen', 'ttd', 600], ['Quarks', 'quarks', 'tt', 1200],
  ['Terra X Lesch & Co', 'lesch', 'tt', 600], ['nano (3sat)', 'nano', 'tt', 1200, '3sat'], ['Planet Wissen', 'planet wissen', 'tt', 1800],
  ['Wissen macht Ah!', 'wissen macht ah', 'tt', 600]];
var LEARN_YT = [['simpleclub', 'simpleclub', 'simpleclub'], ['MrWissen2go', 'mrwissen2go', 'mrwissen2go'], ['Kurzgesagt', 'kurzgesagt', 'kurzgesagt']];
function learnView() {
  begin(); msg('Lade Lernvideos …'); finish();
  var specs = LEARN_MV.map(function (r) { return {mv:1, page:1, q:r[1], f:r[2] === 'ttd' ? TTD : TT, min:r[3], ch:r[4]}; });
  Promise.all(specs.map(movies).concat(LEARN_YT.map(function (r) { return ytSearch(r[1], r[2], 180, false); }))).then(function (res) {
    if (view !== 'learn') return;
    [].slice.call($('rows').querySelectorAll('.msg')).forEach(function (m) { m.remove(); });
    LEARN_MV.forEach(function (r, i) { addRow(r[0], res[i], null, specs[i]); });
    LEARN_YT.forEach(function (r, i) { addRow(r[0] + ' (YouTube)', res[LEARN_MV.length + i]); });
    if (lines.length < 2) msg('Gerade nichts erreichbar.');
    if (L === 0 && lines.length > 1) L = 1;
    focus();
  });
}
