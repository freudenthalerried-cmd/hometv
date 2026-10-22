'use strict';
/* Interaktiver Film (private area): you decide how the story goes. Every decision plays a matching scene - a tested
   video found with the scene's search words - and when it ends (or Zurück) the story continues with the next decision.
   Node: {t:story text, c:[[choice, next node, search words], …]}; a node without choices is an ending. */
var FILMS = [
  {n:'Wochenende in der Berghütte', s:{
    start:{t:'Freitagabend. Ihr kommt in der verschneiten Hütte an, draußen tobt der Sturm, drinnen ist es warm. Ihr habt zwei Tage nur für euch.',
      c:[['Gleich vor den Kamin', 'kamin', 'romantic couple fireplace'], ['Zuerst in die Sauna', 'sauna', 'sauna couple'], ['Ein Glas Wein und Massage', 'massage', 'sensual massage couple']]},
    kamin:{t:'Das Feuer knistert, die Decke ist weich. Langsam wird aus dem Kuscheln mehr …',
      c:[['Zärtlich und langsam', 'nacht', 'passionate romantic sex'], ['Leidenschaftlich', 'nacht', 'passionate couple'], ['Sie übernimmt die Führung', 'nacht', 'cowgirl couple']]},
    sauna:{t:'Heiß, dampfend, nur ein Handtuch. Der Schweiß perlt, die Blicke werden länger.',
      c:[['Gleich hier weiter', 'nacht', 'sauna sex'], ['Abkühlen im Schnee, dann ins Bett', 'nacht', 'couple bedroom passionate']]},
    massage:{t:'Warmes Öl, ruhige Musik. Die Hände wandern immer weiter.',
      c:[['Weiter massieren lassen', 'nacht', 'oil massage sensual'], ['Die Rollen tauschen', 'nacht', 'massage couple romantic']]},
    nacht:{t:'Später in der Nacht. Ihr liegt erschöpft und glücklich nebeneinander – aber das Wochenende hat gerade erst begonnen.',
      c:[['Morgens im Bett weitermachen', 'morgen', 'morning sex couple'], ['Unter der Dusche', 'morgen', 'shower sex couple']]},
    morgen:{t:'Sonntag. Frühstück im Bett, Schnee vor dem Fenster. Was für ein Wochenende.', c:[]}
  }},
  {n:'Das erste Date', s:{
    start:{t:'Ein Abendessen, gute Gespräche, ein Funkeln in den Augen. Vor ihrer Haustür bleibt sie stehen: „Kommst du noch auf ein Glas mit hoch?“',
      c:[['Ja – küssen schon im Stiegenhaus', 'wohnung', 'kissing passionate couple'], ['Ja – ganz gentleman-like', 'wohnung', 'romantic date sex']]},
    wohnung:{t:'Die Tür fällt ins Schloss. Der Wein bleibt unberührt.',
      c:[['Gleich auf der Couch', 'ende', 'couch sex couple'], ['Ins Schlafzimmer tragen', 'ende', 'romantic bedroom sex'], ['Sie hat Dessous an …', 'ende', 'lingerie sex']]},
    ende:{t:'Am Morgen riecht es nach Kaffee. „Wann sehen wir uns wieder?“', c:[]}
  }},
  {n:'Der Urlaub', s:{
    start:{t:'Eine Woche Sonne, Meer und keine Verpflichtungen. Das Hotelzimmer hat einen Balkon mit Meerblick.',
      c:[['Am einsamen Strand', 'abend', 'beach sex couple'], ['Am Pool', 'abend', 'pool sex couple'], ['Auf dem Balkon', 'abend', 'balcony sex']]},
    abend:{t:'Abends, nach dem Essen, warme Luft und ein paar Cocktails zu viel.',
      c:[['Romantisch im Zimmer', 'ende', 'romantic hotel sex'], ['Wild und hemmungslos', 'ende', 'hotel room passionate'], ['Mit Spiegel …', 'ende', 'mirror sex couple']]},
    ende:{t:'Der letzte Tag. Ihr nehmt euch vor: nächstes Jahr wieder.', c:[]}
  }}
];
var filmNow = null; // {f:film, node, pending, query, tries}
function film() {
  filmNow = null;
  begin();
  msg('Interaktiver Film: Du entscheidest, wie es weitergeht. Zu jeder Entscheidung läuft eine passende, geprüfte Szene – danach geht die Geschichte weiter.');
  addRow('Geschichte wählen', FILMS.map(function (f) { return ['🎬 ' + f.n, function () { filmNode(f, 'start'); }]; }), 'btn');
  finish();
}
function filmNode(f, id) {
  var n = f.s[id]; if (!n) return film();
  filmNow = {f:f, node:id};
  begin();
  msg('🎬 ' + f.n);
  msg(n.t);
  if (n.c.length) addRow('Wie geht es weiter?', n.c.map(function (c) { return [c[0], function () { filmScene(c); }]; }), 'btn');
  else addRow('— Ende —', [['↻ Nochmal von vorn', function () { filmNode(f, 'start'); }], ['Andere Geschichte', function () { film(); }]], 'btn');
  finish();
  if (lines.length > 1) { L = lines.length - 1; focus(); }
}
// one scene: a good, tested video for the choice (not one seen in this story yet)
function filmScene(c) {
  var st = filmNow; if (!st) return;
  st.pending = c[1]; st.query = c[2]; st.tries = 0; st.used = st.used || {};
  toast('Szene wird gesucht …');
  filmPlay();
}
function filmPlay() {
  var st = filmNow;
  api({query:st.query, order:'top-rated'}).then(function (l) {
    l = l.filter(function (v) { var c = adultOk[v.id]; return !st.used[v.id] && !(c && !c[0]); });
    if (!l.length) { toast('Keine passende Szene gefunden – weiter in der Geschichte'); return filmNext(); }
    var v = l[Math.floor(Math.random() * Math.min(5, l.length))];
    st.used[v.id] = 1; st.playing = v.id;
    play(v);
  }).catch(function () { toast('Szene nicht erreichbar'); filmNext(); });
}
function filmNext() { var st = filmNow; if (st && st.pending) { var p = st.pending; st.pending = null; filmNode(st.f, p); } }
// called when the player closes: a scene that did not play is replaced, otherwise the story goes on
function filmClosed(id) {
  var st = filmNow;
  if (!st || !st.pending || st.playing !== id) return false;
  if (P.bad[id] && st.tries++ < 3) { setTimeout(filmPlay, 300); return true; }
  setTimeout(filmNext, 300);
  return true;
}
