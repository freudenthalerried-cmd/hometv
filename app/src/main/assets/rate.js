'use strict';
/* "Gefällt mir", 1–5 star ratings and "Ähnliche" — all feed the taste profiles that sort the rows.
   Adult videos feed P.tags (private area), Mediathek films feed P.mtags (topic + channel), YouTube only stores the rating. */
var RATE_W = {1:-3, 2:-1.5, 3:0.5, 4:2, 5:4};
var actOn = false, actV = null, actRows = [], actR = 0, actI = 0;

function capKeys(o, n) { var k = Object.keys(o); if (k.length > n) delete o[k[0]]; }
function stars(n) { return '★★★★★'.slice(0, n) + '☆☆☆☆☆'.slice(0, 5 - n); }

function mvTags(v) {
  return [v.topic ? 't:' + String(v.topic).toLowerCase() : '', v.channel ? 'c:' + String(v.channel).toLowerCase() : ''].filter(Boolean);
}
function learnMv(v, w) {
  var t = P.mtags || (P.mtags = {});
  for (var k in t) { t[k] *= 0.985; if (Math.abs(t[k]) < 0.05) delete t[k]; }
  mvTags(v).forEach(function (g) { t[g] = (t[g] || 0) + w; });
}
function mvAffinity(v) {
  var t = P.mtags || {}, s = 0;
  mvTags(v).forEach(function (g) { s += t[g] || 0; });
  return s;
}
// keep the newest-first order mostly, lift what was rated / liked well, push watched films back
function mvPersonal(list) {
  return list.map(function (v, i) { return {v:v, s:-i * 0.05 + mvAffinity(v) - (P.watched[v.id] ? 3 : 0)}; })
    .sort(function (a, b) { return b.s - a.s; }).map(function (x) { return x.v; });
}
function mvTopTopics(n) {
  var t = P.mtags || {};
  return Object.keys(t).filter(function (k) { return k.indexOf('t:') === 0 && t[k] > 0; })
    .sort(function (a, b) { return t[b] - t[a]; }).slice(0, n).map(function (k) { return k.slice(2); });
}
function profileLearn(v, w) {
  if (!w) return;
  if (v.src === 'mv') learnMv(v, w);
  else if (v.src !== 'yt' && v.src !== 'live') learn(v, w);
}

function rateVideo(v, n) {
  P.rate = P.rate || {};
  var prev = P.rate[v.id];
  profileLearn(v, RATE_W[n] - (prev ? RATE_W[prev] : 0)); // re-rating replaces the old weight
  P.rate[v.id] = n;
  capKeys(P.rate, 3000);
  save('profile', P);
  toast('Bewertet: ' + stars(n) + (n >= 4 ? ' – mehr davon kommt' : n <= 2 ? ' – kommt seltener' : ''));
  refreshCard(v);
}
function likeVideo(v) {
  P.likes = P.likes || {};
  if (P.likes[v.id]) { delete P.likes[v.id]; profileLearn(v, -3); toast('Gefällt mir entfernt'); }
  else { P.likes[v.id] = 1; profileLearn(v, 3); toast('👍 Gefällt mir – Ähnliches kommt öfter'); }
  capKeys(P.likes, 3000);
  save('profile', P);
  refreshCard(v);
}
function favToggle(v) {
  if (isFav(v.id)) { P.favs = P.favs.filter(function (x) { return x.id !== v.id; }); profileLearn(v, -2); toast('Aus Meine Liste entfernt'); }
  else { P.favs.unshift(slim(v)); profileLearn(v, 3); toast('♥ Zu Meine Liste hinzugefügt'); }
  save('profile', P);
  refreshCard(v);
}
function badge(v) { return ''; } // ratings are no longer shown
function refreshCard(v) {
  [].slice.call(document.querySelectorAll('.card')).forEach(function (e) {
    if (!e._v || e._v.id !== v.id) return;
    var b = e.querySelector('.rk'); if (b) b.remove();
    var f = e.querySelector('.fav'); if (f) f.remove();
    e.insertAdjacentHTML('beforeend', badge(v) + (isFav(v.id) ? '<span class="fav">♥</span>' : ''));
  });
  var ln = lines[L], cur = ln && ln.items[ln.i];
  if (cur && cur._v && cur._v.id === v.id) hero(v);
}

/* ---------- action panel (☰ on a video, or the rating question after watching) ---------- */
function openAct(v, rateOnly) {
  actV = v; actOn = true;
  var starsRow = [1, 2, 3, 4, 5].map(function (n) { return ['★' + n, function () { closeAct(); rateVideo(v, n); }]; });
  // no manual rating any more: taste comes from viewing behaviour only
  actRows = rateOnly ? [starsRow] : [[
    ['▶ Abspielen', function () { closeAct(); play(v); }],
    ['🔎 Ähnliche', function () { closeAct(); openSimilar(v); }],
    [isFav(v.id) ? '♥ Entfernen' : '♥ Merken', function () { closeAct(); favToggle(v); }]
  ]];
  actR = 0; actI = rateOnly ? 3 : 0;
  $('at').textContent = rateOnly ? 'Wie hat dir „' + v.title + '“ gefallen?' : v.title;
  $('ak').textContent = rateOnly ? '◀ ▶ Sterne wählen · OK = bewerten · Zurück = überspringen' : '◀ ▶ ▲ ▼ wählen · OK · Zurück = schließen';
  drawAct();
  $('act').style.display = 'flex';
}
function drawAct() {
  var mine = P.rate && P.rate[actV.id];
  $('ar').innerHTML = actRows.map(function (row, r) {
    return '<div class="arow">' + row.map(function (b, i) {
      return '<span class="abtn' + (r === actR && i === actI ? ' foc' : '') + (mine && b[0] === '★' + mine ? ' on' : '') + '">' + esc(b[0]) + '</span>';
    }).join('') + '</div>';
  }).join('');
}
function closeAct() { actOn = false; $('act').style.display = 'none'; }
function actKey(k) {
  var row = actRows[actR];
  if (k === 'ArrowRight') actI = Math.min(row.length - 1, actI + 1);
  else if (k === 'ArrowLeft') actI = Math.max(0, actI - 1);
  else if (k === 'ArrowDown' && actR < actRows.length - 1) { actR++; actI = Math.min(actI, actRows[actR].length - 1); }
  else if (k === 'ArrowUp' && actR > 0) { actR--; actI = Math.min(actI, actRows[actR].length - 1); }
  else if (k === 'Enter') return row[actI][1]();
  drawAct();
}

/* ---------- similar videos ---------- */
var simBack = 'home';
function openSimilar(v) {
  if (view !== 'sim') simBack = view === 'cat' ? 'cats' : view;
  view = 'sim';
  begin(); msg('Suche Ähnliches wie „' + v.title + '“ …'); finish();
  var jobs, rows;
  if (v.src === 'mv') {
    var words = String(v.title).split(/[\s:–\-()]+/).filter(function (w) { return w.length > 4; }).slice(0, 2).join(' ');
    var a = {mv:1, page:1, q:v.topic || v.title, f:TT, min:1200}, b = {mv:1, page:1, q:words || v.topic || v.title, f:TTD, min:2400};
    jobs = [movies(a), movies(b)];
    rows = [['Mehr aus „' + (v.topic || v.title) + '“', a], ['Ähnliche Themen', b]];
  } else if (v.src === 'yt') {
    jobs = [v.chId ? ytFeed(v.channel, v.chId) : Promise.resolve([])];
    rows = [['Mehr von ' + v.channel, null]];
  } else {
    var tg = tagsOf(v).slice(0, 3);
    var s1 = {query:tg.slice(0, 2).join(' ') || 'all', order:'top-rated'}, s2 = {query:tg[0] || 'all', order:'most-popular'},
        s3 = {query:tg[2] || tg[1] || 'all', order:'top-weekly'};
    jobs = [s1, s2, s3].map(api);
    rows = [['Ähnlich: ' + tg.slice(0, 2).join(' + '), s1], ['Mehr mit „' + (tg[0] || '') + '“', s2], ['Auch beliebt: „' + (tg[2] || tg[1] || '') + '“', s3]];
  }
  Promise.all(jobs).then(function (res) {
    if (view !== 'sim') return;
    begin();
    res.forEach(function (list, i) {
      list = list.filter(function (x) { return x.id !== v.id; });
      list = v.src === 'mv' ? mvPersonal(list) : v.src === 'yt' ? list : personalLight(list);
      addRow(rows[i][0], list, null, rows[i][1]);
    });
    if (lines.length < 2) msg('Nichts Ähnliches gefunden.');
    finish();
  });
}
