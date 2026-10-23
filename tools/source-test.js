'use strict';
/* Quellen-Test (GitHub Actions, real internet). Uses the app's own code: index.html runs in Chrome with a bridge that
   fetches through Node, so search (SRC[k].get), filtering (okVid) and the pre-check (adultProbe) are exactly the app's.
   Then every video is played in Chrome with the app's inject.js and the app's ad blocking (lists read from
   MainActivity.java): strict first, then normal - the same steps as on the Fire TV.
   Output: Markdown table in the job summary + source-test.json. */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const ROOT = path.join(__dirname, '..'), ASSETS = path.join(ROOT, 'app/src/main/assets');
const JAVA = fs.readFileSync(path.join(ROOT, 'app/src/main/java/at/sf/abendkino/MainActivity.java'), 'utf8');
const UA = /String UA =\s*"([^"]+)"/.exec(JAVA)[1];
const ALLOWED = /String\[\] ALLOWED = \{([^}]+)\}/.exec(JAVA)[1].match(/"([^"]+)"/g).map(x => x.slice(1, -1));
const AD_HOSTS = new RegExp(/AD_HOSTS = Pattern\.compile\(([\s\S]+?)\);/.exec(JAVA)[1].match(/"((?:[^"\\]|\\.)*)"/g).map(x => JSON.parse(x)).join(''));
const MEDIA = /\.(mp4|m3u8|ts|m4s|webm|m4a|aac|mp3)(\?|$)/;
const INJECT = fs.readFileSync(path.join(ASSETS, 'inject.js'), 'utf8');
const PER_SOURCE = +process.env.PER_SOURCE || 8;
const QUERIES = (process.env.QUERIES || 'couple,german,amateur').split(',');

const get = (u, o = {}) => fetch(u, {headers: {'User-Agent': UA, ...(o.headers || {})}, redirect: 'follow', signal: AbortSignal.timeout(15000)});
async function reachable(u) {
  try {
    const r = await get(u, {headers: {Range: 'bytes=0-1'}});
    const ct = r.headers.get('content-type') || '';
    return (r.status === 200 || r.status === 206) && !ct.startsWith('text/html');
  } catch (e) { return false; }
}
async function appPage(browser) {
  const p = await browser.newPage();
  await p.exposeFunction('__nodeGet', async u => { try { const r = await get(u); return [r.status === 200, await r.text()]; } catch (e) { return [false, String(e.message)]; } });
  await p.exposeFunction('__nodeCheck', async l => Promise.all(JSON.parse(l).map(reachable)));
  await p.addInitScript(() => {
    const st = {onlyVerified: 'false'};
    window.Android = {version: () => 999, load: k => st[k] || '', save: (k, v) => { st[k] = v; }, keyboard() {}, exit() {}, apps: () => '[]',
      get: (u, cb) => window.__nodeGet(u).then(r => window.__cb(cb, r[0], r[1])),
      post: (u, b, cb) => window.__cb(cb, false, ''),
      check: (l, cb) => window.__nodeCheck(l).then(r => window.__cb(cb, true, JSON.stringify(r)))};
  });
  await p.goto('file://' + path.join(ASSETS, 'index.html'));
  await p.waitForTimeout(1500);
  return p;
}
async function play(browser, v, strict) {
  const ctx = await browser.newContext({userAgent: UA, viewport: {width: 1280, height: 720}});
  let ads = 0; const blocked = {};
  await ctx.route('**/*', route => {
    const u = route.request().url(); let h = '';
    try { h = new URL(u).hostname.toLowerCase(); } catch (e) { }
    if (MEDIA.test(u.toLowerCase()) || /^(data|blob):/.test(u)) return route.continue();
    const ok = strict ? ALLOWED.some(a => h === a || h.endsWith('.' + a)) : !AD_HOSTS.test(h);
    if (!ok) { if (AD_HOSTS.test(h)) ads++; else blocked[h] = 1; return route.fulfill({status: 200, body: ''}); }
    return route.continue();
  });
  const p = await ctx.newPage();
  const t0 = Date.now(); let res = {ok: false, why: 'startet nicht'};
  try {
    await p.goto(v.embed, {waitUntil: 'load', timeout: 20000});
    await p.evaluate('window.__start=0;' + INJECT);
    for (let i = 0; i < (strict ? 12 : 8); i++) {
      await p.waitForTimeout(1000);
      const info = await p.evaluate(() => { const e = document.getElementById('__own') || document.querySelector('video');
        return {s: window.__ak_info ? window.__ak_info().s : '', cur: e ? e.currentTime : 0, h: e ? e.videoHeight : 0, own: !!document.getElementById('__own'), url: window.__ak_url || ''}; });
      if (info.cur > 0.5) { res = {ok: true, sec: Math.round((Date.now() - t0) / 1000), height: info.h, own: info.own, file: info.url.replace(/\?.*/, '').slice(-50)}; break; }
      if (info.s === 'error') { res = {ok: false, why: 'Player-Fehler'}; break; }
      res.why = 'startet nicht (' + (info.s || 'keine Seite') + ')';
    }
  } catch (e) { res = {ok: false, why: String(e.message || e).split('\n')[0].slice(0, 70)}; }
  res.ads = ads; if (!res.ok) res.blocked = Object.keys(blocked).slice(0, 5).join(' ');
  await ctx.close();
  return res;
}

/* PUBLISH: candidates from every category (CATS of the app), each played for real; only what ran in 720p+ goes into
   verified.json, which the app shows in "Nur geprüfte Videos" mode. */
async function publish(browser, app) {
  const PER_QUERY = +process.env.PER_QUERY || 3, MAX = +process.env.MAX_VIDEOS || 120;
  const queries = ['all'].concat(await app.evaluate(() => CATS.map(c => c[1])));
  const pool = new Map();
  for (const q of queries) {
    const l = await app.evaluate(q => api({query: q, order: 'top-rated'}).then(l => l.slice(0, 15).map(v => ({id: v.id, src: v.src, title: v.title, sec: v.length_sec,
      embed: v.embed, thumb: v.default_thumb.src, kw: String(v.keywords || '').split(', ').slice(0, 8).join(', ')}))), q).catch(() => []);
    let added = 0;
    for (const v of l) {
      if (pool.has(v.id)) { pool.get(v.id).cats.push(q); continue; }
      if (added < PER_QUERY && pool.size < MAX) { pool.set(v.id, {...v, cats: q === 'all' ? [] : [q]}); added++; }
    }
  }
  const ok = [], stats = {};
  for (const v of pool.values()) {
    const s = stats[v.src] = stats[v.src] || {n: 0, ok: 0};
    s.n++;
    const pre = await app.evaluate(v => adultProbe(v).catch(e => 'Fehler'), v);
    let pl = {ok: false};
    if (!/bad|lowq|nofile/.test(pre)) { pl = await play(browser, v, true); if (!pl.ok) pl = await play(browser, v, false); }
    if (pl.ok && pl.height >= 700) { s.ok++; ok.push({...v, h: pl.height}); }
    console.log('PUBLISH', v.src, v.id, pre, pl.ok ? pl.height + 'p' : pl.why);
    if (!pl.ok && (s.diag = (s.diag || 0) + 1) <= 2) { // why: page, file list, HLS answer as seen from here
      try {
        const r = await get(v.embed), h = await r.text(), hl = /setVideoHLS\(\s*['"]([^'"]+)/.exec(h);
        let hs = '';
        if (hl) { const r2 = await get(hl[1]); hs = r2.status + ' ' + (await r2.text()).slice(0, 60).replace(/\s+/g, ' '); }
        console.log('DIAG', v.src, 'seite', r.status, r.url.slice(0, 70), 'len', h.length, 'hls', hl ? hl[1].slice(0, 60) : '-', hs,
          /captcha|cf-chl|Just a moment|verify you are human/i.test(h) ? 'SPERRE/CAPTCHA' : '');
      } catch (e) { console.log('DIAG', v.src, 'Fehler', String(e.message).slice(0, 80)); }
    }
  }
  /* a source where nothing at all ran here is most likely blocking this test server, not broken on the Fire TV:
     its videos from the last list (at most 3 days old) stay in */
  try {
    const prev = await (await get('https://github.com/freudenthalerried-cmd/hometv/releases/download/firetv/verified.json')).json();
    if (prev && prev.v && Date.now() - prev.t < 3 * 864e5) {
      Object.keys(stats).filter(k => stats[k].n >= 5 && stats[k].ok === 0).forEach(k => {
        const keep = prev.v.filter(x => x.src === k && !ok.some(y => y.id === x.id));
        stats[k].kept = keep.length; ok.push(...keep);
        console.log('BEHALTEN', k, keep.length, 'aus der letzten Liste (Quelle hier komplett gesperrt?)');
      });
    }
  } catch (e) { console.log('letzte Liste nicht lesbar', e.message); }
  const out = {t: Date.now(), n: ok.length, stats, v: ok};
  fs.writeFileSync('verified.json', JSON.stringify(out));
  let md = `## Geprüft-Liste: ${ok.length} von ${pool.size} Videos laufen in 720p+\n\n| Quelle | läuft | getestet |\n|---|---|---|\n`;
  Object.keys(stats).forEach(k => { md += `| ${k} | ${stats[k].ok}${stats[k].kept ? ' (+' + stats[k].kept + ' behalten)' : ''} | ${stats[k].n} |\n`; });
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log(md);
}

/* PROBE: new source candidates - does the search answer, does a video page carry a file, does it really play
   (app player, normal ad blocking)? Only candidates that play get built into the app. */
const CANDIDATES = [
  ['Eporner (Videoseite)', 'https://www.eporner.com/api/v2/video/search/?query=couple&per_page=5&thumbsize=big&order=top-weekly&format=json', /"url":"(https:[^"]+)"/, m => m.replace(/\\\//g, '/')],
  ['xHamster', 'https://xhamster.com/search/couple', /href="(https:\/\/xhamster\.com\/videos\/[^"]+)"/, m => m],
  ['PornTrex', 'https://www.porntrex.com/search/couple/', /href="(https:\/\/www\.porntrex\.com\/video\/[^"]+)"/, m => m],
  ['Tnaflix', 'https://www.tnaflix.com/search?what=couple', /href="(\/[a-z0-9-]+\/[^"]*video\d+)"/, m => 'https://www.tnaflix.com' + m],
  ['YouJizz', 'https://www.youjizz.com/search/couple-1.html', /href="(\/videos\/[^"]+\.html)"/, m => 'https://www.youjizz.com' + m],
  ['Porn.com', 'https://www.porn.com/videos/search?q=couple', /href="(\/videos\/[a-z0-9-]+-\d+)"/, m => 'https://www.porn.com' + m],
  ['SunPorno', 'https://www.sunporno.com/search/couple/', /href="(https:\/\/www\.sunporno\.com\/videos\/\d+\/?)"/, m => m],
  ['Txxx', 'https://txxx.com/search/?s=couple', /href="(\/videos\/\d+\/[^"]+)"/, m => 'https://txxx.com' + m],
  ['HClips', 'https://hclips.com/search/?s=couple', /href="(\/videos\/\d+\/[^"]+)"/, m => 'https://hclips.com' + m],
  ['Upornia', 'https://upornia.com/search/?q=couple', /href="(\/videos\/\d+\/[^"]+)"/, m => 'https://upornia.com' + m]
];
async function probe(browser) {
  let md = '## Neue Quellen-Kandidaten\n\n| Seite | Suche | Video-Seite | Abspielen |\n|---|---|---|---|\n';
  for (const [name, url, re, toVideo] of CANDIDATES) {
    let row = [name, '', '', ''];
    try {
      const r = await get(url); const t = await r.text(); const m = re.exec(t);
      row[1] = r.status + (t.includes('Just a moment') ? ' Cloudflare' : '') + (m ? ' ✓' : ' keine Treffer');
      if (m) {
        const vu = toVideo(m[1]); const r2 = await get(vu);
        row[2] = r2.status + ' ' + vu.slice(0, 60);
        const pl = await play(browser, {embed: vu}, false);
        row[3] = pl.ok ? `✅ ${pl.height}p nach ${pl.sec}s${pl.own ? ', eigener Player' : ', Seiten-Player'}` : '❌ ' + pl.why;
      }
    } catch (e) { row[3] = 'Fehler ' + String(e.message || e).slice(0, 60); }
    console.log('PROBE', row.join(' | '));
    md += '| ' + row.join(' | ') + ' |\n';
  }
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
}

(async () => {
  const geo = await get('https://ipinfo.io/json').then(r => r.json()).catch(() => ({}));
  const browser = await chromium.launch({...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {channel: 'chrome'}),
    args: ['--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files']});
  const app = await appPage(browser);
  if (process.env.PUBLISH) { await publish(browser, app); await browser.close(); return; }
  if (process.env.PROBE) { await probe(browser); await browser.close(); return; }
  const names = await app.evaluate(() => Object.keys(SRC).map(k => [k, SRC[k].name]));
  const rows = [], apiErr = {};
  if (process.env.DEBUG) { // which qualities: embed page vs. normal watch page, HLS levels
    const quals = async u => {
      const h = await (await get(u)).text(); const out = [];
      const re = /"videoUrl"\s*:\s*"([^"]+)"(?:[^}]*?"quality"\s*:\s*"?(\d*))?/g; let m;
      while ((m = re.exec(h))) {
        let v = m[1].replace(/\\\//g, '/'); if (v[0] === '/') v = new URL(v, u).href;
        if (/get_media|\/media\/(hls|mp4)/.test(v)) { try { const l = await (await get(v)).json(); (Array.isArray(l) ? l : []).forEach(x => out.push('liste:' + x.quality + (/m3u8/.test(x.videoUrl) ? 'hls' : 'mp4'))); } catch (e) { out.push('liste:fehler'); } }
        else out.push((m[2] || '?') + (/m3u8/.test(v) ? 'hls' : 'mp4'));
      }
      const hl = /setVideoHLS\(\s*['"]([^'"]+)/.exec(h);
      if (hl) { const t = await (await get(hl[1])).text().catch(() => ''); out.push('hls-stufen:' + (t.match(/RESOLUTION=\d+x(\d+)|hls-(\d+)p/g) || []).join(',')); }
      return out.join(' ');
    };
    for (const [k, watch] of [['ph', id => 'https://www.pornhub.com/view_video.php?viewkey=' + id], ['rt', id => 'https://www.redtube.com/' + id], ['xn', null], ['xv', null]]) {
      const l = await app.evaluate(k => SRC[k].get({query: 'german', order: 'top-rated'}).then(l => l.slice(0, 3).map(v => [v.id.split(':')[1], v.embed]), () => []), k);
      for (const [id, embed] of l) console.log('DEBUG Q', k, id, 'einbettung:', await quals(embed).catch(e => 'fehler'), watch ? '| videoseite: ' + await quals(watch(id)).catch(e => 'fehler') : '');
    }
  }
  if (process.env.DEBUG) { // why XVideos finds nothing / where XNXX pages redirect to
    for (const u of ['https://www.xvideos.com/?k=couple&sort=rating&p=0', 'https://www.xvideos.com/?k=couple']) {
      const r = await get(u); const t = await r.text();
      console.log('DEBUG XV', r.status, r.url, 'len', t.length, 'thumb-block:', t.split('thumb-block').length - 1, 'video.:', (t.match(/href="\/video\.?[a-z0-9]+\//g) || []).length);
      const i = t.indexOf('thumb-block'); if (i >= 0) console.log('DEBUG XV BLOCK', t.slice(i, i + 900).replace(/\s+/g, ' '));
    }
  }
  for (const [k] of names) {
    const vids = [], seen = {};
    for (const q of QUERIES) {
      const r = await app.evaluate(([k, q]) => SRC[k].get({query: q, order: 'top-rated'}).then(l => ({list: l.filter(okVid).map(v => ({id: v.id, src: v.src, title: v.title, sec: v.length_sec, embed: v.embed, thumb: !!v.default_thumb.src}))}), e => ({err: String(e).slice(0, 120)})), [k, q]);
      if (r.err) { apiErr[k] = r.err; continue; }
      if (!r.list.length) apiErr[k] = apiErr[k] || 'keine Treffer für „' + q + '“';
      r.list.forEach(v => { if (!seen[v.id] && vids.length < PER_SOURCE) { seen[v.id] = 1; vids.push(v); } });
    }
    for (const v of vids) {
      const pre = await app.evaluate(v => adultProbe(v).catch(e => 'Fehler: ' + e), v);
      let pl = {ok: false, why: 'Vorab-Prüfung: ' + pre};
      if (pre !== 'bad' && pre !== 'lowq') { pl = await play(browser, v, true); if (!pl.ok) { const p2 = await play(browser, v, false); p2.second = true; if (p2.ok) pl = p2; } }
      if (process.env.DEBUG && /REDIRECTS/.test(pl.why || '')) { let u = v.embed; for (let i = 0; i < 5; i++) { const r = await fetch(u, {headers: {'User-Agent': UA}, redirect: 'manual'}).catch(() => null); if (!r) break; console.log('DEBUG REDIR', r.status, u.slice(0, 90), '->', (r.headers.get('location') || '').slice(0, 90), (r.headers.get('set-cookie') || '').slice(0, 60)); if (!r.headers.get('location')) break; u = new URL(r.headers.get('location'), u).href; } }
      rows.push({...v, pre, play: pl});
      console.log(k, v.id, v.sec + 's', 'thumb:' + v.thumb, 'pre:' + pre, JSON.stringify(pl));
    }
  }
  await browser.close();
  const sum = {};
  rows.forEach(r => { const s = sum[r.src] = sum[r.src] || {n: 0, ok: 0, preOk: 0, agree: 0}; s.n++; if (r.play.ok) s.ok++;
    if (r.pre === 'ok' || r.pre === 'unknown') s.preOk++; if (!/bad|nofile|lowq/.test(r.pre) === r.play.ok) s.agree++; if (r.play.ok && r.play.height >= 700) s.hd = (s.hd || 0) + 1; });
  let md = `## Quellen-Test\nRunner-Standort: ${geo.city || '?'}, ${geo.region || ''} ${geo.country || '?'} – am Fire TV in Österreich kann es abweichen.\n\n`;
  md += '| Quelle | läuft | davon 720p+ | getestet | Vorab-Prüfung stimmt | Hinweis |\n|---|---|---|---|---|---|\n';
  names.forEach(([k, n]) => { const s = sum[k] || {n: 0, ok: 0, agree: 0}; md += `| ${n} | ${s.ok} | ${s.hd || 0} | ${s.n} | ${s.agree}/${s.n} | ${apiErr[k] || ''} |\n`; });
  md += '\n| Quelle | Video | Länge | Vorab | Abspielen |\n|---|---|---|---|---|\n';
  rows.forEach(r => {
    const pl = r.play.ok ? `✅ nach ${r.play.sec}s, ${r.play.height}p${r.play.own ? ', eigener Player' : ''}${r.play.second ? ', 2. Versuch' : ''}` : '❌ ' + r.play.why + (r.play.blocked ? ' [gesperrt: ' + r.play.blocked + ']' : '');
    md += `| ${(names.find(x => x[0] === r.src) || [])[1]} | ${String(r.title).slice(0, 40).replace(/\|/g, '/')} | ${Math.round(r.sec / 60)} min | ${r.pre} | ${pl} |\n`;
  });
  fs.writeFileSync('source-test.json', JSON.stringify({geo, sum, apiErr, rows}, null, 1));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log('\n' + md);
})();
