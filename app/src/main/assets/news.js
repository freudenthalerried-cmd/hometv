'use strict';
/* News: live channels (official broadcaster streams, checked on this device before they are shown), whole
   news shows from the Mediatheken and official YouTube news channels. English ones get subtitles switched on.
   Uses helpers from index.html / home.js at runtime. */
// [Name, https stream, 'en' = English → subtitles on]
var NEWS_LIVE = [['ORF 2', 'https://orf2-247.mdn.ors.at/orf/orf2/qxa-247/manifest.m3u8'],
  ['ServusTV (Servus Nachrichten)', 'https://stv-live.akamaized.net/hls/live/2031011/lingeoSTVATwebPri/master.m3u8'],
  ['tagesschau24', 'https://tagesschau.akamaized.net/hls/live/2020115/tagesschau/tagesschau_1/master.m3u8'],
  ['DW News (English)', 'https://dwamdstream102.akamaized.net/hls/live/2015525/dwstream102/master.m3u8', 'en']];
var NEWS_MV = [['ZIB – ORF', 'zib', 'tt', 600, 'orf'], ['Tagesschau', 'tagesschau', 'tt', 600, 'ard'],
  ['heute journal', 'heute journal', 'tt', 1200], ['Tagesthemen', 'tagesthemen', 'tt', 1200], ['Weltspiegel', 'weltspiegel', 'tt', 1500]];
var NEWS_YT = [['tagesschau', 'UC5NOEUbkLheQcaaRldYW5GA'], ['ZDFheute Nachrichten', 'UCeqKIgPQfNInOswGRWt48kQ'],
  ['DW News (English, Untertitel)', 'UCknLrEdhRCp1aegoMqRaCZg', 'en'], ['BBC News (English, Untertitel)', 'UC16niRr50-MSBwiO3YDb3RA', 'en']];

var LIVE_PAGE = [[/orf/, 'https://tv.orf.at/'], [/stv-live|servus/, 'https://www.servustv.com/'], [/tagesschau/, 'https://www.tagesschau.de/'],
  [/dw/, 'https://www.dw.com/en/']];
function liveItem(r) {
  var u = r[1] + (r[2] === 'en' ? '#subs' : ''); // the player switches subtitles on for '#subs'
  return {id:'live:' + r[0], src:'live', channel:'LIVE', title:r[0], topic:'Live-TV', desc:r[2] === 'en' ? 'Englisch, mit Untertiteln (falls der Sender welche mitschickt)' : '',
    page:LIVE_PAGE.filter(function (x) { return x[0].test(r[1]); }).map(function (x) { return x[1]; })[0] || '', // its logo/picture
    urls:[u], embed:u, length_sec:0, keywords:'', views:0, rate:0, default_thumb:{src:''}, thumbs:[]};
}
function news() {
  begin(); msg('Lade Nachrichten …'); finish();
  var specs = NEWS_MV.map(function (r) { return {mv:1, page:1, q:r[1], f:r[2] === 'ttd' ? TTD : TT, min:r[3], ch:r[4]}; });
  var servus = myApps().filter(function (a) { return /servus/i.test(a[0] + a[1]); });
  Promise.all([playable(NEWS_LIVE.map(liveItem), true)].concat(specs.map(movies),
      NEWS_YT.map(function (c) { return ytFeed(c[0], c[1], c[2] === 'en'); }))).then(function (res) {
    if (view !== 'news') return;
    [].slice.call($('rows').querySelectorAll('.msg')).forEach(function (m) { m.remove(); });
    addRow('Live-TV – nur Sender, die gerade auf diesem Gerät laufen', res[0]);
    if (servus.length) addRow('', servus.map(function (a) { return ['▶ ' + a[0] + ' öffnen', function () { A.launch(a[1]); }]; }), 'btn');
    NEWS_MV.forEach(function (r, i) { addRow(r[0], res[1 + i], null, specs[i]); });
    NEWS_YT.forEach(function (c, i) { addRow(c[0], res[1 + NEWS_MV.length + i]); });
    if (lines.length < 2) msg('Gerade keine Nachrichten erreichbar.');
    if (L === 0 && lines.length > 1) L = 1;
    focus();
  });
}

/* ---------- update log (Einstellungen → Update-Protokoll) ---------- */
function logUpd(text) {
  var l = load('updLog', []);
  if (l.length && l[0][1] === text) l[0][0] = Date.now(); // same message again: just refresh the time
  else l.unshift([Date.now(), text]);
  save('updLog', l.slice(0, 60));
}
function updLogView() {
  begin();
  var l = load('updLog', []);
  addRow('Update-Protokoll · Version v' + curVer() + ' · Inhalte v' + contentVer, [['Nach Update suchen', function () { checkUpdate(true); }],
    ['Protokoll leeren', function () { save('updLog', []); updLogView(); }]], 'btn');
  if (!l.length) msg('Noch keine Einträge.');
  l.forEach(function (e) {
    var d = new Date(e[0]);
    msg(d.toLocaleDateString('de-AT') + ' ' + ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2) + ' – ' + e[1]);
  });
  finish();
}
