'use strict';
/* Paar-Spiele: everything runs in the #game overlay. Level 1 = romantisch, 2 = prickelnd, 3 = heiß.
   Higher levels also draw from the lower ones so the evening can build up. */
var Games = (function () {
  var LEVELS = ['Romantisch', 'Prickelnd', 'Heiß'];
  var PL = ['Spieler 1', 'Spieler 2'];

  var DICE = {
    act: [
      ['Küsse', 'Streichle', 'Massiere', 'Puste sanft auf', 'Kitzle zärtlich', 'Berühre mit den Fingerspitzen'],
      ['Küsse langsam', 'Knabbere zart an', 'Lecke sanft über', 'Streichle mit einem Eiswürfel', 'Massiere mit Öl', 'Berühre nur mit den Lippen'],
      ['Verwöhne mit der Zunge', 'Sauge zärtlich an', 'Beiße ganz sanft in', 'Küsse leidenschaftlich', 'Streichle mit warmem Atem', 'Verwöhne ohne Hände']
    ],
    part: [
      ['den Hals', 'das Ohrläppchen', 'den Nacken', 'die Hände', 'den Rücken', 'die Lippen'],
      ['den Bauch', 'die Innenseite der Oberschenkel', 'die Brust', 'den unteren Rücken', 'die Schultern', 'den Po'],
      ['eine Stelle deiner Wahl', 'die empfindlichste Stelle', 'die Brustwarzen', 'die Leiste', 'den Intimbereich', 'eine Stelle, die dein Partner wählt']
    ],
    how: ['10 Sekunden', '30 Sekunden', '1 Minute', 'mit verbundenen Augen', 'ganz langsam', 'bis dein Partner „Stopp“ sagt']
  };

  var TRUTH = [
    ['Was war dein erster Gedanke, als du mich gesehen hast?', 'Welcher Moment mit mir war der romantischste?', 'Was findest du an mir am anziehendsten?',
     'Wo würdest du mit mir gern ein Wochenende verbringen?', 'Welches Kleidungsstück von mir magst du am liebsten?', 'Wann hast du dich zuletzt nach mir gesehnt?',
     'Was war unser schönster Kuss?', 'Welche Berührung von mir genießt du am meisten?', 'Was wolltest du mir schon lange sagen?',
     'Welches Lied erinnert dich an uns?'],
    ['Wovon hast du zuletzt geträumt, in dem ich vorkam?', 'Welche Stelle an deinem Körper ist am empfindlichsten?', 'Was macht dich bei mir sofort an?',
     'Welches Outfit sollte ich öfter tragen?', 'Wo war der aufregendste Ort, an dem wir uns geküsst haben?', 'Was würdest du gern einmal mit mir ausprobieren?',
     'Was war dein heißester Gedanke heute?', 'Welche Fantasie hast du noch nie ausgesprochen?', 'Was magst du lieber: langsam oder wild?',
     'Welcher Film hat dich schon einmal richtig angemacht?'],
    ['Was ist deine geheimste Fantasie mit mir?', 'Welcher war unser bester gemeinsamer Moment im Bett – und warum?', 'Was soll ich heute Nacht unbedingt mit dir machen?',
     'An welchem ungewöhnlichen Ort würdest du gern mit mir schlafen?', 'Welche Stellung magst du am liebsten?', 'Was törnt dich am meisten an, wenn ich es sage?',
     'Was würdest du gern einmal mit mir filmen oder fotografieren?', 'Welches Spielzeug würdest du gern ausprobieren?', 'Wie würdest du mich am liebsten wecken?',
     'Was war das Frechste, das du je über mich gedacht hast?']
  ];
  var DARE = [
    ['Gib deinem Partner einen langen, langsamen Kuss.', 'Massiere deinem Partner 1 Minute die Schultern.', 'Flüstere deinem Partner drei Komplimente ins Ohr.',
     'Tanzt eng umschlungen zu einem Lied.', 'Küsse deinem Partner zärtlich den Hals.', 'Halte die Hand deines Partners und schaut euch 30 Sekunden in die Augen.',
     'Streichle deinem Partner durchs Haar, bis er/sie lächelt.', 'Gib deinem Partner 10 Küsse an 10 verschiedenen Stellen im Gesicht.'],
    ['Ziehe ein Kleidungsstück deiner Wahl aus.', 'Ziehe deinem Partner ein Kleidungsstück aus – nur mit den Zähnen.', 'Küsse deinen Partner vom Hals bis zum Bauchnabel.',
     'Massiere deinem Partner mit Öl den Rücken – 2 Minuten.', 'Verbinde deinem Partner die Augen und küsse ihn/sie an drei überraschenden Stellen.',
     'Mach deinem Partner einen kleinen Strip zu einem Lied seiner Wahl.', 'Setz dich auf den Schoß deines Partners und küsse ihn/sie 1 Minute.',
     'Beschreibe flüsternd, was du heute Nacht mit deinem Partner machen willst.'],
    ['Ziehe deinen Partner komplett aus – ganz langsam.', 'Verwöhne deinen Partner 2 Minuten nur mit dem Mund.', 'Dein Partner darf 3 Minuten lang bestimmen, was du tust.',
     'Fessle deinem Partner sanft die Hände und verwöhne ihn/sie nach Lust.', 'Zeig deinem Partner, wie du dich am liebsten berührst.',
     'Probiert die nächste Stellung aus dem Stellungs-Roulette aus.', 'Verwöhne deinen Partner mit einem Eiswürfel – überall, wo er/sie möchte.',
     'Küsse deinen Partner von den Füßen aufwärts, so weit er/sie es zulässt.']
  ];
  var CARDS = [
    [['Kuschelt euch eng aneinander und atmet gemeinsam ruhig.', 60], ['Massiere die Hände deines Partners.', 90], ['Küsst euch ohne Hände.', 45],
     ['Streichle den Rücken deines Partners mit den Fingerspitzen.', 60], ['Erzähle, was du an deinem Partner liebst – ohne Pause.', 45],
     ['Fußmassage für deinen Partner.', 120]],
    [['Küsse den Nacken deines Partners, er/sie darf sich nicht bewegen.', 60], ['Ölmassage am Rücken – bis zum Po.', 120],
     ['Ihr dürft euch nur mit den Lippen berühren.', 60], ['Streichle die Innenseite der Oberschenkel deines Partners.', 45],
     ['Beide ziehen ein Kleidungsstück aus und küssen sich.', 30], ['Verbinde die Augen deines Partners und verwöhne ihn/sie.', 90]],
    [['Verwöhne deinen Partner mit dem Mund – er/sie bestimmt das Tempo.', 120], ['Dein Partner liegt still, du darfst alles.', 120],
     ['Kein Höhepunkt erlaubt – necke deinen Partner bis zur Grenze.', 90], ['Nackt in Löffelchenstellung kuscheln und streicheln.', 120],
     ['Gegenseitiges Verwöhnen mit den Händen.', 120], ['Probiert eine neue Stellung aus.', 180]]
  ];
  var NEVER = [
    ['… jemanden beim ersten Date geküsst.', '… einen Liebesbrief geschrieben.', '… im Regen geküsst.', '… von meinem Partner geträumt.',
     '… beim Kuscheln eingeschlafen.', '… heimlich das Parfum/Shirt meines Partners gerochen.', '… ein Date komplett vergessen.'],
    ['… beim Sex lachen müssen.', '… nackt geschwommen.', '… sexy Fotos verschickt.', '… im Auto rumgemacht.', '… Dessous für jemanden gekauft.',
     '… im Kino rumgeknutscht.', '… an Sex gedacht, während jemand mit mir redete.'],
    ['… Sex an einem öffentlichen Ort gehabt.', '… ein Sexspielzeug benutzt.', '… beim Sex gefilmt oder fotografiert.', '… eine Fantasie mit mehreren Personen gehabt.',
     '… mich beim Sex fesseln lassen.', '… es dreimal in einer Nacht getan.', '… einen Porno mit dem Partner geschaut.']
  ];
  var POS = [
    ['Löffelchen', 'Beide liegen seitlich, eng aneinander – sehr nah und zärtlich.'],
    ['Missionar', 'Klassisch, viel Augenkontakt und Küsse.'],
    ['Reiterin / Reiter', 'Eine Person sitzt oben und bestimmt Tempo und Tiefe.'],
    ['Lotus', 'Im Sitzen eng umschlungen, gesichtszugewandt – sehr intim.'],
    ['Hündchen', 'Von hinten auf allen Vieren – intensiv.'],
    ['Umgekehrte Reiterin', 'Oben sitzend, mit dem Rücken zum Partner.'],
    ['Stehend', 'An eine Wand gelehnt – spontan und leidenschaftlich.'],
    ['Bauchlage', 'Eine Person liegt auf dem Bauch, die andere darüber.'],
    ['Schmetterling', 'Eine Person liegt an der Bettkante, die andere steht davor.'],
    ['Sitzend am Stuhl', 'Eine Person sitzt, die andere setzt sich auf den Schoß.'],
    ['69', 'Gegenseitiges Verwöhnen mit dem Mund.'],
    ['Freie Wahl', 'Ihr entscheidet – aber diesmal mit verbundenen Augen.']
  ];
  var MASSAGE = [
    ['Macht es euch bequem, dimmt das Licht. Dein Partner liegt auf dem Bauch.', 30],
    ['Wärme deine Hände und lege sie ruhig auf den Rücken deines Partners.', 30],
    ['Streiche mit flachen Händen langsam vom unteren Rücken zu den Schultern.', 60],
    ['Knete sanft die Schultern und den Nacken.', 90],
    ['Fahre mit den Fingerspitzen die Wirbelsäule entlang – hoch und runter.', 60],
    ['Massiere den unteren Rücken mit kreisenden Bewegungen.', 60],
    ['Streichle über Po und Oberschenkel bis zu den Kniekehlen.', 60],
    ['Massiere die Füße – jede Zehe einzeln.', 90],
    ['Dein Partner dreht sich um. Streichle Bauch, Brust und Arme.', 90],
    ['Beende die Massage mit Küssen, wo immer du möchtest.', 60],
    ['Tauscht die Rollen – jetzt bist du dran.', 0]
  ];

  var WWE = [
    ['… beim Kuscheln einschlafen?', '… den Jahrestag vergessen?', '… beim Kochen das Essen anbrennen lassen?', '… im Kino weinen?',
     '… spontan einen Kurzurlaub buchen?', '… einen Liebesbrief schreiben?', '… zuerst „Ich liebe dich“ sagen?', '… beim Tanzen auf die Füße treten?'],
    ['… den ersten Schritt machen?', '… im Restaurant unter dem Tisch füßeln?', '… heimlich ein sexy Foto schicken?', '… Dessous als Überraschung tragen?',
     '… beim Duschen Gesellschaft wollen?', '… eine zweideutige Nachricht an die falsche Person schicken?', '… einen Strip hinlegen?', '… mitten am Tag Lust bekommen?'],
    ['… an einem öffentlichen Ort Sex haben?', '… ein Spielzeug mit ins Schlafzimmer bringen?', '… beim Sex die Kontrolle übernehmen?', '… sich fesseln lassen?',
     '… einen ganzen Tag nackt in der Wohnung bleiben?', '… eine neue Stellung vorschlagen?', '… die Nachbarn mit Geräuschen wecken?', '… eine Fantasie zuerst aussprechen?']
  ];
  var WYR = [
    [['ein Dinner bei Kerzenlicht', 'einen Abend auf der Couch mit Film'], ['eine Woche Strandurlaub', 'eine Woche Berghütte'],
     ['jeden Morgen einen Kuss zum Aufwachen', 'jeden Abend eine Massage'], ['Händchenhalten im Regen', 'Sterne schauen in der Nacht'],
     ['Frühstück ans Bett', 'ein gekochtes Abendessen'], ['ein Liebeslied für dich', 'ein Gedicht für dich']],
    [['nur noch küssen dürfen', 'nur noch streicheln dürfen'], ['eine Massage geben', 'eine Massage bekommen'],
     ['mich in Dessous sehen', 'mich in deinem Hemd sehen'], ['ein Wochenende ohne Kleidung', 'ein Wochenende ohne Handy'],
     ['mit verbundenen Augen verwöhnt werden', 'mit gefesselten Händen verwöhnt werden'], ['morgens Lust haben', 'abends Lust haben']],
    [['die Kontrolle haben', 'die Kontrolle abgeben'], ['im Auto', 'in der Dusche'], ['ganz langsam', 'ganz wild'],
     ['Licht an', 'Licht aus'], ['laut', 'leise'], ['ein neues Spielzeug probieren', 'eine neue Stellung probieren']]
  ];
  var ROLE = {
    who: [
      ['Erstes Date: Ihr tut so, als würdet ihr euch gerade kennenlernen.', 'Urlaubsflirt an der Hotelbar.', 'Tanzlehrer/in und Tanzschüler/in.',
       'Zwei Fremde, die sich ein Taxi teilen.', 'Alte Liebe trifft sich nach Jahren wieder.'],
      ['Masseur/in und Kunde/Kundin.', 'Fotograf/in und Model.', 'Fremde im Nachtzug.', 'Nachbarn, die sich ausgesperrt haben.', 'Barkeeper/in und Gast.'],
      ['Chef/in und Assistenz nach Feierabend.', 'Hotelgast und Zimmerservice.', 'Arzt/Ärztin und Patient/in.', 'Polizist/in und Verdächtige/r.',
       'Fremde aus einer Dating-App beim ersten Treffen.']
    ],
    where: ['im Wohnzimmer', 'in der Küche', 'im Bad', 'im Schlafzimmer', 'im Flur', 'auf dem Sofa'],
    twist: ['Es darf nur geflüstert werden.', 'Einer hat die Augen verbunden.', 'Keine Hände in den ersten 5 Minuten.',
      'Wer lacht, verliert ein Kleidungsstück.', 'Ein Timer von 10 Minuten läuft.', 'Der Partner bestimmt das Ende.']
  };
  var QUIZ = [
    ['Was ist mein Lieblingsessen?', 'Wo war unser erstes Date?', 'Was ist mein Lieblingsfilm?', 'Wovor habe ich am meisten Angst?',
     'Was war mein erster Job?', 'Welches Lied singe ich unter der Dusche?', 'Wie heißt mein bester Freund / meine beste Freundin?', 'Was ist mein Traumreiseziel?'],
    ['Was trage ich am liebsten im Bett?', 'Wo werde ich am liebsten geküsst?', 'Was finde ich an dir am attraktivsten?', 'Welche Berührung macht mich schwach?',
     'Wo wäre mein Traum für ein romantisches Wochenende?', 'Was war unser schönster gemeinsamer Abend?', 'Welches Parfum mag ich an dir am liebsten?'],
    ['Welche Stellung mag ich am liebsten?', 'Was ist meine geheimste Fantasie?', 'Was soll ich im Bett öfter machen?', 'Wo würde ich gern einmal Sex haben?',
     'Was macht mich am schnellsten an?', 'Morgens, mittags oder abends – wann habe ich am meisten Lust?']
  ];
  var DEEP = [
    ['Wofür bist du in deinem Leben am dankbarsten?', 'Wie sähe für dich ein perfekter Tag aus?', 'Wann hast du zuletzt laut gelacht – und worüber?',
     'Welche Erinnerung an uns trägst du im Herzen?', 'Was möchtest du unbedingt noch erleben?', 'Was bedeutet Zuhause für dich?'],
    ['Wann hast du dich mir am nächsten gefühlt?', 'Was würdest du an uns nie ändern wollen?', 'Was wünschst du dir öfter von mir?',
     'In welchem Moment hast du dich in mich verliebt?', 'Wovor hast du in einer Beziehung am meisten Angst?', 'Was soll ich über dich wissen, das ich noch nicht weiß?'],
    ['Was gibt dir beim Sex das Gefühl, geliebt zu werden?', 'Wann hast du dich mir körperlich am nächsten gefühlt?', 'Was möchtest du mir im Bett schon lange sagen?',
     'Was brauchst du, um dich ganz fallen zu lassen?', 'Was ist für dich der schönste Moment danach?', 'Welche Berührung sagt für dich mehr als Worte?']
  ];

  // --- for couples who know each other well and want something new ---
  var YESNO = [
    ['Gemeinsam baden bei Kerzenlicht', 'Ein Wochenende ganz ohne Handy', 'Einander die Haare waschen', 'Ein Picknick nur für uns zwei',
     'Langsam tanzen im Wohnzimmer', 'Eine Ganzkörpermassage mit Öl', 'Nackt kuscheln – ohne dass mehr passieren muss', 'Ein Abend nur mit Komplimenten'],
    ['Sex an einem neuen Ort in der Wohnung', 'Eine Augenbinde', 'Ein Dessous-Abend', 'Sexy Fotos voneinander', 'Ein Striptease',
     'Gemeinsam einen erotischen Film schauen', 'Eiswürfel und warmes Öl', 'Morgens überrascht werden', 'Zweideutige Nachrichten tagsüber'],
    ['Sanftes Fesseln', 'Ein Spielzeug gemeinsam aussuchen', 'Ein Rollenspiel', 'Einer bestimmt alles für einen Abend', 'Sex im Freien (ungestört)',
     'Ein Hotelzimmer nur für eine Nacht', 'Einander beim Selbstverwöhnen zusehen', 'Ganz neue Stellungen ausprobieren', 'Richtig laut sein dürfen']
  ];
  var DATE = {
    start: ['Eine Nachricht am Nachmittag: „Heute Abend gehörst du mir.“', 'Gemeinsam kochen – barfuß und mit Musik', 'Ein Glas Wein auf dem Balkon',
      'Ein Bad mit Kerzen vorbereiten', 'Ein Lied, zu dem ihr eng tanzt', 'Ein Brief mit drei Dingen, die du an mir liebst'],
    outfit: ['Etwas, das der Partner noch nie an dir gesehen hat', 'Nur der Bademantel', 'Das Hemd des Partners', 'Schick wie beim ersten Date',
      'Dessous unter ganz normaler Kleidung', 'Barfuß und bequem'],
    place: ['Wohnzimmer mit Decken und Kissen am Boden', 'Die Küche', 'Das Badezimmer', 'Das Gästezimmer – wie ein Hotel', 'Ein Raum nur mit Kerzenlicht'],
    rule: [['Alle Handys aus', 'Nur Komplimente erlaubt'], ['Keine Hände in den ersten 10 Minuten', 'Einer hat die Augen verbunden', 'Es wird nur geflüstert'],
      ['Einer bestimmt, der andere folgt', 'Kein Höhepunkt vor Mitternacht', 'Jedes Kleidungsstück muss verdient werden']],
    finale: [['Ein Film zum Kuscheln', 'Die Massage-Reise aus den Paar-Spielen'], ['Heiße Karten (Stufe Prickelnd)', 'Eine Runde „Würdest du lieber?“'],
      ['Stellungs-Roulette', 'Der Rollenspiel-Generator', 'Ein Treffer aus dem Wunsch-Abgleich – heute ausprobiert']]
  };
  var WEEK = [
    ['Schickt euch morgens ein ehrliches Kompliment.', 'Ein 10-Sekunden-Kuss zum Abschied.', 'Kocht gemeinsam etwas, das ihr noch nie gekocht habt.',
     'Erzählt euch, was ihr am anderen bewundert.', 'Date-Abend – die Handys bleiben im anderen Zimmer.', 'Gemeinsames Bad oder Dusche.',
     'Kuscheln ohne Zeitlimit – nichts müssen.'],
    ['Eine zweideutige Nachricht tagsüber.', 'Abends 5 Minuten Nackenmassage.', 'Trag etwas, das deinen Partner überrascht.',
     'Küsst euch an einem Ort, an dem ihr es sonst nie tut.', 'Eine Runde „Würdest du lieber?“ (Stufe Prickelnd).', 'Augenbinde für 10 Minuten.',
     'Morgens überraschen statt aufstehen.'],
    ['Verrate eine Fantasie, die du noch nie erzählt hast.', 'Necken ohne Abschluss – die Spannung bleibt bis morgen.', 'Ein neuer Raum in der Wohnung.',
     'Einer bestimmt heute Abend alles.', 'Stellungs-Roulette – nur Stellungen, die ihr noch nie probiert habt.', 'Ein Spielzeug oder Hilfsmittel ausprobieren.',
     'Langsamer Sonntag: eine Stunde nur für euch zwei, ohne Plan.']
  ];
  var MEMORY = [
    ['Erzählt euch euren ersten Kuss – und stellt ihn nach.', 'Wo war euer erstes Date? Plant, dort wieder hinzugehen.',
     'Welches Lied verbindet ihr mit dem Anfang? Spielt es jetzt.', 'Was hast du dir beim ersten Treffen über mich gedacht?',
     'Welcher Urlaub war der schönste? Erzählt euch einen Moment daraus.'],
    ['Wann hattet ihr das erste Mal Lust aufeinander? Erzählt es genau.', 'Welches Outfit des anderen hat dich am meisten umgehauen?',
     'Wo habt ihr euch das erste Mal heimlich geküsst?', 'Was hat dich am Anfang an mir verrückt gemacht? Tu es heute wieder.'],
    ['Erzählt euch euer erstes Mal – und was ihr heute anders machen würdet.', 'Welche Nacht war eure beste? Stellt sie nach.',
     'Was hast du dich früher nie getraut, mir zu sagen?', 'Welche Berührung von früher vermisst du? Zeig sie mir.']
  ];
  var yn = null; // Wunsch-Abgleich state
  var WD = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  var weekDay = 0;
  function weekKey() { return Math.floor((Date.now() / 864e5 + 3) / 7); }
  function weekState() { var w = load('week', {}); if (w.k !== weekKey()) w = {k:weekKey(), done:{}}; return w; }
  function showWeek() {
    var w = weekState(), n = Object.keys(w.done).length;
    show(WD[weekDay] + (w.done[weekDay] ? ' ✓ erledigt' : ''), '', WEEK[level - 1][weekDay],
      n + ' von 7 erledigt diese Woche · OK = erledigt · ◀ ▶ = anderer Tag');
  }
  function ynShow() {
    var who = yn.phase === 1 ? PL[0] : PL[1];
    show(who + ' bewertet heimlich (' + (yn.i + 1) + '/' + yn.items.length + ')', yn.items[yn.i], '',
      '◀ Nein · ▼ Vielleicht · ▶ Ja');
  }
  function ynResult() {
    var both = [], maybe = [];
    yn.items.forEach(function (it, i) {
      var a = yn.a[i], b = yn.b[i];
      if (a === 2 && b === 2) both.push('♥ ' + it);
      else if (a && b) maybe.push('? ' + it);
    });
    var lines = both.concat(maybe).slice(0, 9);
    show('Euer Wunsch-Abgleich', both.length ? 'Das wollt ihr beide' : (maybe.length ? 'Beide vielleicht' : 'Keine Übereinstimmung'),
      lines.join('\n') || 'Probiert eine andere Stufe – oder redet darüber, was euch reizt.',
      '♥ = beide Ja · ? = mindestens einer Vielleicht · Nur Übereinstimmungen werden gezeigt · OK = neue Runde');
    yn = null;
  }

  var GAMES = [
    ['dice', 'Liebeswürfel'], ['tod', 'Wahrheit oder Pflicht'], ['cards', 'Heiße Karten'],
    ['never', 'Ich hab noch nie'], ['pos', 'Stellungs-Roulette'], ['massage', 'Massage-Reise'],
    ['wwe', 'Wer würde eher?'], ['wyr', 'Würdest du lieber?'], ['role', 'Rollenspiel'], ['quiz', 'Partner-Quiz'], ['deep', 'Nähe-Fragen'],
    ['yesno', 'Wunsch-Abgleich'], ['date', 'Date-Abend-Generator'], ['week', '7-Tage-Challenge'], ['memory', 'Weißt du noch?']
  ];
  var HELP = {
    dice:'OK = würfeln', tod:'◀ = Wahrheit · ▶ = Pflicht · ▼ = überspringen', cards:'OK = neue Karte · ▶ = Timer start/stop · ▼ = überspringen',
    never:'OK = nächste Aussage · Wer es schon getan hat, legt ein Kleidungsstück ab', pos:'OK = drehen', massage:'OK = nächster Schritt · ▶ = Timer start/stop',
    yesno:'Jeder bewertet heimlich · ◀ Nein · ▼ Vielleicht · ▶ Ja', date:'OK = neuer Abend', week:'OK = erledigt · ◀ ▶ = Tag wechseln',
    memory:'OK = nächste Erinnerung', wwe:'OK = nächste Frage', wyr:'OK = nächste Frage', role:'OK = neue Rollen', quiz:'OK = nächste Frage', deep:'OK = nächste Frage'
  };

  var g = null, level = 1, turn = 0, timer = null, left = 0, step = 0, used = {}, cardSec = 60;
  function $(id) { return document.getElementById(id); }
  function pool(src) { // all items up to the chosen level
    var out = [];
    for (var i = 0; i < level; i++) out = out.concat(src[i]);
    return out;
  }
  function pick(list, key) { // no repeats until the list is used up
    var u = used[key] || (used[key] = {});
    var all = list.map(function (x, i) { return i; });
    var free = all.filter(function (i) { return !u[i]; });
    if (!free.length) { used[key] = u = {}; free = all; }
    var i = free[Math.floor(Math.random() * free.length)];
    u[i] = 1;
    return list[i];
  }
  function beep() {
    try {
      var c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), gn = c.createGain();
      o.frequency.value = 660; gn.gain.value = 0.15; o.connect(gn); gn.connect(c.destination);
      o.start(); o.stop(c.currentTime + 0.6);
    } catch (e) { }
  }
  function stopTimer() { clearInterval(timer); timer = null; }
  function startTimer(sec, done) {
    stopTimer(); left = sec; drawTimer();
    if (!sec) return;
    timer = setInterval(function () {
      left--; drawTimer();
      if (left <= 0) { stopTimer(); beep(); if (done) done(); }
    }, 1000);
  }
  function drawTimer() {
    var e = $('gtimer'); if (!e) return;
    e.textContent = left > 0 ? Math.floor(left / 60) + ':' + ('0' + left % 60).slice(-2) : '';
  }
  function show(who, title, body, sub) {
    $('gwho').textContent = who || '';
    $('gtitle').textContent = title || '';
    $('gbody').textContent = body || '';
    $('gsub').textContent = sub || '';
    var c = $('gcard'); c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop');
  }
  function player() { return PL[turn % 2]; }

  function next(k) {
    var who = player();
    if (g === 'dice') {
      if (k !== 'Enter') return;
      var a = pick(pool(DICE.act), 'a'), p = pick(pool(DICE.part), 'p'), h = pick(DICE.how, 'h');
      show(who + ' würfelt', a + ' ' + p, h, 'Nächster Wurf: ' + PL[(turn + 1) % 2]);
      turn++;
    } else if (g === 'tod') {
      if (k === 'ArrowLeft') { show(who + ' · Wahrheit', '', pick(pool(TRUTH), 't'), 'OK = weiter zu ' + PL[(turn + 1) % 2]); turn++; }
      else if (k === 'ArrowRight') { show(who + ' · Pflicht', '', pick(pool(DARE), 'd'), 'OK = weiter zu ' + PL[(turn + 1) % 2]); turn++; }
      else if (k === 'Enter' || k === 'ArrowDown') show(player() + ' ist dran', 'Wahrheit oder Pflicht?', '◀ Wahrheit      Pflicht ▶', '');
    } else if (g === 'cards') {
      if (k === 'ArrowRight') { if (timer) stopTimer(); else startTimer(left || cardSec); return; }
      if (k !== 'Enter' && k !== 'ArrowDown') return;
      var c = pick(pool(CARDS), 'c');
      show(who + ' ist dran', '', c[0], '▶ = Timer starten');
      stopTimer(); left = cardSec = c[1]; drawTimer(); turn++;
    } else if (g === 'never') {
      if (k !== 'Enter' && k !== 'ArrowDown') return;
      show('Ich hab noch nie …', '', pick(pool(NEVER), 'n'), 'Wer es schon getan hat: ein Kleidungsstück ablegen');
    } else if (g === 'pos') {
      if (k !== 'Enter') return;
      var s = pick(POS, 'pos');
      show('Stellungs-Roulette', s[0], s[1], 'OK = nochmal drehen');
    } else if (g === 'yesno') {
      if (!yn) {
        if (k !== 'Enter') return;
        yn = {phase:1, i:0, items:pool(YESNO).slice().sort(function () { return Math.random() - 0.5; }).slice(0, 12), a:[], b:[]};
        return ynShow();
      }
      if (yn.phase === 2) { // handover screen
        if (k !== 'Enter') return;
        yn.phase = 3; yn.i = 0; return ynShow();
      }
      var v = {ArrowLeft:0, ArrowDown:1, ArrowRight:2}[k];
      if (v === undefined) return;
      (yn.phase === 1 ? yn.a : yn.b)[yn.i] = v;
      if (++yn.i < yn.items.length) return ynShow();
      if (yn.phase === 1) {
        yn.phase = 2;
        return show('Fertig, ' + PL[0] + '!', 'Fernbedienung an ' + PL[1] + ' weitergeben', 'Nicht spicken 😉', 'OK = ' + PL[1] + ' beginnt');
      }
      ynResult();
    } else if (g === 'date') {
      if (k !== 'Enter') return;
      show('Euer Date-Abend', '', 'Auftakt: ' + pick(DATE.start, 'ds') + '\nOutfit: ' + pick(DATE.outfit, 'do') + '\nOrt: ' + pick(DATE.place, 'dp') +
        '\nRegel: ' + pick(pool(DATE.rule), 'dr') + '\nFinale: ' + pick(pool(DATE.finale), 'df'), 'Fotografiert den Plan – oder überrascht den Partner damit.');
    } else if (g === 'week') {
      if (k === 'ArrowLeft') weekDay = (weekDay + 6) % 7;
      else if (k === 'ArrowRight') weekDay = (weekDay + 1) % 7;
      else if (k === 'Enter') { var w = weekState(); w.done[weekDay] = 1; save('week', w); }
      else return;
      showWeek();
    } else if (g === 'memory') {
      if (k !== 'Enter') return;
      show(who + ' beginnt', 'Weißt du noch …', pick(pool(MEMORY), 'm'), 'Danach erzählt der andere seine Version.');
      turn++;
    } else if (g === 'wwe') {
      if (k !== 'Enter') return;
      show('Wer von uns würde eher …', '', pick(pool(WWE), 'w'),
        'Auf 3 zeigen beide auf den anderen. Wer auf sich selbst zeigt, ' + (level > 1 ? 'legt ein Kleidungsstück ab.' : 'bekommt einen Kuss.'));
    } else if (g === 'wyr') {
      if (k !== 'Enter') return;
      var w = pick(pool(WYR), 'y');
      show(who + ' ist dran', 'Würdest du lieber …', w[0] + '\n– oder –\n' + w[1], 'Begründe deine Wahl. Hätte der Partner gleich gewählt? Dann gibt es einen Kuss.');
      turn++;
    } else if (g === 'role') {
      if (k !== 'Enter') return;
      show('Rollenspiel · ' + pick(ROLE.where, 'rw'), pick(pool(ROLE.who), 'r'), pick(ROLE.twist, 'rt'),
        'Vorher ein Stopp-Wort ausmachen – es gilt immer.');
    } else if (g === 'quiz') {
      if (k !== 'Enter') return;
      show(who + ' fragt, ' + PL[(turn + 1) % 2] + ' antwortet', '', pick(pool(QUIZ), 'q'), 'Falsch? Dann: ' + pick(pool(DARE), 'qd'));
      turn++;
    } else if (g === 'deep') {
      if (k !== 'Enter') return;
      show(who + ' fragt', '', pick(pool(DEEP), 'dp'), 'Schaut euch beim Antworten in die Augen. Danach fragt der andere.');
      turn++;
    } else if (g === 'massage') {
      if (k === 'ArrowRight') { if (timer) stopTimer(); else startTimer(left || MASSAGE[Math.max(0, step - 1)][1]); return; }
      if (k !== 'Enter') return;
      if (step >= MASSAGE.length) step = 0;
      var m = MASSAGE[step++];
      show('Massage-Reise · Schritt ' + step + '/' + MASSAGE.length, '', m[0], step < MASSAGE.length ? 'Weiter geht es automatisch nach dem Timer' : 'Fertig');
      startTimer(m[1], function () { next('Enter'); });
    }
  }

  function open(id) {
    g = id; turn = 0; step = 0; used = {}; stopTimer(); left = 0;
    var name = GAMES.filter(function (x) { return x[0] === id; })[0][1];
    $('game').style.display = 'flex';
    $('ghead').textContent = name + ' · ' + LEVELS[level - 1];
    $('ghelp').textContent = HELP[id] + ' · Zurück = Ende';
    drawTimer();
    var intro = {dice:'Drückt OK zum Würfeln.', tod:'', cards:'Drückt OK für die erste Karte.', never:'Drückt OK für die erste Aussage.',
      pos:'Drückt OK zum Drehen.', massage:'Drückt OK, um zu beginnen.'}[id] || 'Drückt OK, um zu beginnen.';
    yn = null;
    if (id === 'week') { weekDay = (new Date().getDay() + 6) % 7; return showWeek(); }
    if (id === 'yesno') return show('Wunsch-Abgleich', 'Jeder bewertet heimlich 12 Ideen',
      'Am Ende seht ihr nur, was ihr BEIDE wollt.\nWas nur einer will, bleibt geheim.', 'OK = ' + PL[0] + ' beginnt');
    if (id === 'tod') next('Enter');
    else show(player() + ' beginnt', name, intro, 'Alles freiwillig – jede Karte darf übersprungen werden.');
  }
  function close() { stopTimer(); g = null; $('game').style.display = 'none'; }

  return {
    GAMES:GAMES, LEVELS:LEVELS,
    level:function (l) { if (l) { level = l; save('glevel', l); } return level; },
    init:function () { level = load('glevel', 1); },
    data:function () {
      return {dice:DICE, truth:TRUTH, dare:DARE, cards:CARDS, never:NEVER, positions:POS, massage:MASSAGE,
        wwe:WWE, wyr:WYR, role:ROLE, quiz:QUIZ, deep:DEEP, yesno:YESNO, date:DATE, week:WEEK, memory:MEMORY};
    },
    // content.json override: only replaces lists that pass the type checks (plain text data only)
    setContent:function (c) {
      if (!c || typeof c !== 'object') return;
      var d = c.dice || {};
      if (levels(d.act, isText)) DICE.act = d.act;
      if (levels(d.part, isText)) DICE.part = d.part;
      if (list(d.how, isText)) DICE.how = d.how;
      if (levels(c.truth, isText)) TRUTH = c.truth;
      if (levels(c.dare, isText)) DARE = c.dare;
      if (levels(c.cards, isTimed)) CARDS = c.cards;
      if (levels(c.never, isText)) NEVER = c.never;
      if (list(c.positions, isPair)) POS = c.positions;
      if (list(c.massage, isTimed)) MASSAGE = c.massage;
      if (levels(c.wwe, isText)) WWE = c.wwe;
      if (levels(c.wyr, isPair)) WYR = c.wyr;
      var r = c.role || {};
      if (levels(r.who, isText)) ROLE.who = r.who;
      if (list(r.where, isText)) ROLE.where = r.where;
      if (list(r.twist, isText)) ROLE.twist = r.twist;
      if (levels(c.quiz, isText)) QUIZ = c.quiz;
      if (levels(c.deep, isText)) DEEP = c.deep;
      if (levels(c.yesno, isText)) YESNO = c.yesno;
      if (levels(c.memory, isText)) MEMORY = c.memory;
      if (levels(c.week, isText) && c.week.every(function (l) { return l.length === 7; })) WEEK = c.week;
      var dt = c.date || {};
      ['start', 'outfit', 'place'].forEach(function (k) { if (list(dt[k], isText)) DATE[k] = dt[k]; });
      ['rule', 'finale'].forEach(function (k) { if (levels(dt[k], isText)) DATE[k] = dt[k]; });
      used = {};
    },
    open:open, close:close,
    active:function () { return !!g; },
    key:function (k) {
      if (k === 'ArrowDown' && /^(dice|pos|massage|wwe|wyr|role|quiz|deep|date|memory)$/.test(g)) k = 'Enter'; // ▼ = skip / next
      next(k);
    }
  };
})();
