'use strict';
/* Quellen-Test (runs on GitHub Actions, real internet): asks the same official APIs as the app, then for each video
   1) loads the embed page like the app's pre-check, 2) asks the video file itself, 3) plays it in real Chrome with the
   app's inject.js and ad blocking (strict, then normal) - exactly the steps the Fire TV does.
   Output: Markdown table in the job summary + source-test.json. */
const fs = require('fs');
const { chromium } = require('playwright');
const UA = 'Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const INJECT = fs.readFileSync(__dirname + '/../app/src/main/assets/inject.js', 'utf8');
const PER_SOURCE = +process.env.PER_SOURCE || 8;
const QUERIES = (process.env.QUERIES || 'couple,german,amateur').split(',');
const SOURCES = {
  ph: {name: 'Pornhub', api: 'https://www.pornhub.com/webmasters/search?', thumb: 'large_hd', embed: 'https://www.pornhub.com/embed/'},
  rt: {name: 'RedTube', api: 'https://api.redtube.com/?data=redtube.Videos.searchVideos&output=json&', thumb: 'big', embed: 'https://embed.redtube.com/?id='},
  yp: {name: 'YouPorn', api: 'https://www.youporn.com/api/webmasters/search?', thumb: 'big', embed: 'https://www.youporn.com/embed/'}
};
const ALLOWED = ['pornhub.com', 'phncdn.com', 'redtube.com', 'rdtcdn.com', 'youporn.com', 'ypncdn.com', 'cdnjs.cloudflare.com',
  'ajax.googleapis.com', 'jsdelivr.net'];
const AD_HOSTS = /(exoclick|exosrv|exdynsrv|trafficjunky|trafficfactory|juicyads|popads|popcash|propeller|adnxs|doubleclick|googlesyndication|googletagmanager|google-analytics|adtng|tsyndicate|realsrv|magsrv|ad-maven|clickadu|hilltopads|trafficstars|adspyglass|adsterra|onclick|pushnami|dtscout|mgid|taboola|outbrain|syndication|popunder|adserver|^ads?\.|\.ads?\.)/;
const MEDIA = /\.(mp4|m3u8|ts|m4s|webm|m4a|aac|mp3)(\?|$)/;
const ADULT_BAD = /(video (has been|was) (removed|deleted|disabled)|has been flagged|removed (at|due)|is (private|unavailable|not available)|nicht (mehr )?verfügbar|not available in your (country|region)|copyright|dmca|widevine|drm[_-]?protected)/i;

const get = (u, o = {}) => fetch(u, {headers: {'User-Agent': UA, ...(o.headers || {})}, redirect: 'follow', signal: AbortSignal.timeout(15000)});
const secs = d => typeof d === 'number' ? d : String(d || '').split(':').reduce((s, x) => s * 60 + (+x || 0), 0);

async function search(k, q) {
  const s = SOURCES[k];
  const p = new URLSearchParams({search: q, ordering: 'rating', period: 'alltime', page: 1, thumbsize: s.thumb});
  const r = await get(s.api + p);
  const t = await r.text();
  let d; try { d = JSON.parse(t); } catch (e) { return {err: 'API ' + r.status + ': keine JSON-Antwort (' + t.slice(0, 80).replace(/\s+/g, ' ') + ')'}; }
  const list = (d.videos || d.video || []).map(m => m.video || m).filter(m => m && m.video_id && secs(m.duration) >= 600);
  return {list: list.map(m => ({id: k + ':' + m.video_id, src: k, title: m.title, sec: secs(m.duration), embed: s.embed + m.video_id}))};
}
function mediaUrls(h) {
  const out = [], re = /"videoUrl"\s*:\s*"([^"]+)"(?:[^}]*?"quality"\s*:\s*"?(\d*))?/g; let m;
  while ((m = re.exec(h))) out.push([m[1].replace(/\\\//g, '/'), +m[2] || 0]);
  return out.sort((a, b) => b[1] - a[1]).map(x => x[0]).filter(u => /^https:\/\//.test(u));
}
async function reachable(u) {
  try {
    const r = await get(u, {headers: {Range: 'bytes=0-1'}});
    const ct = r.headers.get('content-type') || '';
    return (r.status === 200 || r.status === 206) && !ct.startsWith('text/html') ? true : 'HTTP ' + r.status + ' ' + ct;
  } catch (e) { return String(e.message || e).slice(0, 60); }
}
async function pageAndFile(v) {
  const r = await get(v.embed); const h = await r.text();
  const urls = mediaUrls(h), good = urls.length > 0 || /setVideo(Url|HLS)/.test(h);
  if (!good && ADULT_BAD.test(h)) return {page: 'gesperrt/gelöscht: ' + (h.match(ADULT_BAD) || [''])[0]};
  if (!good) return {page: 'HTTP ' + r.status + ', keine Videodaten gefunden'};
  const direct = urls.filter(u => !/get_media/.test(u)), gm = urls.find(u => /get_media/.test(u));
  let file = 'nicht prüfbar';
  if (direct.length) file = await reachable(direct[0]);
  else if (gm) {
    try { const l = await (await get(gm)).json(); const best = (Array.isArray(l) ? l : []).filter(x => x.videoUrl).sort((a, b) => (+b.quality || 0) - (+a.quality || 0))[0];
      file = best ? await reachable(best.videoUrl) : 'get_media leer'; } catch (e) { file = 'get_media: ' + String(e.message).slice(0, 40); }
  }
  return {page: true, file};
}
async function play(browser, v, strict) {
  const ctx = await browser.newContext({userAgent: UA, viewport: {width: 1280, height: 720}});
  let blockedAds = 0; const blockedHosts = {};
  await ctx.route('**/*', route => {
    const u = route.request().url(); let h = '';
    try { h = new URL(u).hostname.toLowerCase(); } catch (e) { }
    if (MEDIA.test(u.toLowerCase()) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    const ok = strict ? ALLOWED.some(a => h === a || h.endsWith('.' + a)) : !AD_HOSTS.test(h);
    if (!ok) { if (AD_HOSTS.test(h)) blockedAds++; else blockedHosts[h] = (blockedHosts[h] || 0) + 1; return route.fulfill({status: 200, body: ''}); }
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
        return {s: window.__ak_info ? window.__ak_info().s : '', cur: e ? e.currentTime : 0, h: e ? e.videoHeight : 0, own: !!document.getElementById('__own'), err: e && e.error ? e.error.code : 0}; });
      if (info.cur > 0.5) { res = {ok: true, sec: Math.round((Date.now() - t0) / 1000), height: info.h, own: info.own, url: String(await p.evaluate(() => window.__ak_url || '')).replace(/\?.*/, '').slice(-60)}; break; }
      if (info.s === 'error') { res = {ok: false, why: 'Fehler im Player (Code ' + info.err + ')'}; break; }
      res.why = 'startet nicht (' + (info.s || 'keine Seite') + ')';
    }
  } catch (e) { res = {ok: false, why: String(e.message || e).split('\n')[0].slice(0, 70)}; }
  res.ads = blockedAds;
  if (!res.ok || process.env.DEBUG) res.blocked = Object.keys(blockedHosts).slice(0, 6).join(' ');
  await ctx.close();
  return res;
}

// candidates: is search reachable, and does a video page carry a playable file?
const CANDIDATES = [
  ['Eporner API', 'https://www.eporner.com/api/v2/video/search/?query=couple&per_page=5&thumbsize=big&order=top-weekly&format=json', /"id":"([^"]+)"/, id => 'https://www.eporner.com/embed/' + id + '/'],
  ['XVideos', 'https://www.xvideos.com/?k=couple', /href="(\/video\.?[a-z0-9]+\/[^"]+)"/, m => 'https://www.xvideos.com' + m],
  ['XNXX', 'https://www.xnxx.com/search/couple', /href="(\/video-[a-z0-9]+\/[^"]+)"/, m => 'https://www.xnxx.com' + m],
  ['Tube8 API', 'https://api.tube8.com/api.php?action=searchVideos&output=json&search=couple', /"video_id"\s*:\s*"?(\d+)/, id => 'https://www.tube8.com/embed/' + id + '/'],
  ['SpankBang', 'https://spankbang.com/s/couple/', /href="(\/[a-z0-9]+\/video\/[^"]+)"/, m => 'https://spankbang.com' + m],
  ['xHamster', 'https://xhamster.com/search/couple', /href="(https:\/\/xhamster\.com\/videos\/[^"]+)"/, m => m],
  ['HQporner', 'https://hqporner.com/?q=couple', /href="(\/hdporn\/[^"]+)"/, m => 'https://hqporner.com' + m],
  ['PornTrex', 'https://www.porntrex.com/search/couple/', /href="(https:\/\/www\.porntrex\.com\/video\/[^"]+)"/, m => m]
];
const PATTERNS = ['m3u8', '.mp4', 'setVideoHLS', 'setVideoUrlHigh', 'mediaDefinitions', 'videoUrl', 'sources', 'cf-chl', 'Just a moment', 'captcha', 'age-verif', 'not available'];
async function probe() {
  for (const [name, url, re, toVideo] of CANDIDATES) {
    try {
      const r = await get(url); const t = await r.text(); const m = re.exec(t);
      console.log('PROBE', name, 'search', r.status, 'len', t.length, 'treffer', m ? m[1].slice(0, 60) : '-', t.includes('Just a moment') ? 'CLOUDFLARE' : '');
      if (!m) continue;
      const vu = toVideo(m[1]); const r2 = await get(vu); const h = await r2.text();
      console.log('PROBE', name, 'video', r2.status, vu.slice(0, 80), PATTERNS.map(w => w + ':' + (h.split(w).length - 1)).filter(x => !/:0$/.test(x)).join(' '));
      const fm = h.match(/https?:[^"'\s]+?\.(m3u8|mp4)[^"'\s]*/);
      if (fm) { const f = fm[0].replace(/\\\//g, '/'); console.log('PROBE', name, 'datei', f.slice(0, 90), await reachable(f)); }
    } catch (e) { console.log('PROBE', name, 'Fehler', String(e.message || e).slice(0, 80)); }
  }
}
async function debug() {
  await probe();
  for (const u of ['https://www.youporn.com/api/webmasters/search?search=couple', 'https://www.youporn.com/api/webmasters/search/?search=couple',
    'https://www.youporn.com/api/webmasters/v2/search?search=couple', 'https://api.youporn.com/api/webmasters/search?search=couple']) {
    const r = await get(u).catch(e => ({status: String(e.message)})); const t = r.text ? (await r.text()).slice(0, 160).replace(/\s+/g, ' ') : '';
    console.log('DEBUG YP', r.status, u, t);
  }
  for (const k of ['rt', 'ph']) {
    const r = await search(k, 'couple'); const v = r.list && r.list[0]; if (!v) continue;
    const h = await (await get(v.embed)).text();
    const hits = ['mediaDefinition', 'videoUrl', 'm3u8', '.mp4', 'get_media', 'playervars', 'flashvars', 'html5player', 'sources', 'video_url', 'mediaDefinitions']
      .map(w => w + ':' + (h.split(w).length - 1));
    console.log('DEBUG PAGE', k, v.embed, 'len', h.length, hits.join(' '));
    for (const w of ['mediaDefinition', 'm3u8', '.mp4']) { const i = h.indexOf(w); if (i >= 0) console.log('DEBUG CTX', k, w, h.slice(Math.max(0, i - 200), i + 300).replace(/\s+/g, ' ')); }
  }
}

(async () => {
  const geo = await get('https://ipinfo.io/json').then(r => r.json()).catch(() => ({}));
  if (process.env.DEBUG) await debug();
  const browser = await chromium.launch({...(process.env.CHROME_PATH ? {executablePath: process.env.CHROME_PATH} : {channel: 'chrome'}), args: ['--autoplay-policy=no-user-gesture-required']});
  const rows = [], apiErr = {};
  for (const k of Object.keys(SOURCES)) {
    const seen = {}, vids = [];
    for (const q of QUERIES) {
      const r = await search(k, q).catch(e => ({err: String(e.message || e)}));
      if (r.err) { apiErr[k] = r.err; continue; }
      r.list.forEach(v => { if (!seen[v.id] && vids.length < PER_SOURCE) { seen[v.id] = 1; vids.push(v); } });
    }
    for (const v of vids) {
      const pf = await pageAndFile(v).catch(e => ({page: String(e.message).slice(0, 60)}));
      let pl = {ok: false, why: 'nicht versucht'};
      if (pf.page === true) { pl = await play(browser, v, true); if (!pl.ok) { const p2 = await play(browser, v, false); p2.second = true; pl = p2.ok ? p2 : pl; } }
      rows.push({...v, ...pf, play: pl});
      console.log(SOURCES[k].name, v.id, JSON.stringify(pf), JSON.stringify(pl));
    }
  }
  await browser.close();
  const sum = {};
  rows.forEach(r => { const s = sum[r.src] = sum[r.src] || {n: 0, ok: 0}; s.n++; if (r.play.ok) s.ok++; });
  let md = `## Quellen-Test\nRunner-Standort: ${geo.city || '?'}, ${geo.region || ''} ${geo.country || '?'} (${geo.org || ''}) – Ergebnisse können am Fire TV in Österreich abweichen.\n\n`;
  md += '| Quelle | läuft | getestet | API-Fehler |\n|---|---|---|---|\n';
  Object.keys(SOURCES).forEach(k => { const s = sum[k] || {n: 0, ok: 0}; md += `| ${SOURCES[k].name} | ${s.ok} | ${s.n} | ${apiErr[k] || ''} |\n`; });
  md += '\n| Quelle | Video | Seite | Datei | Abspielen |\n|---|---|---|---|---|\n';
  rows.forEach(r => {
    const pl = r.play.ok ? `✅ nach ${r.play.sec}s, ${r.play.height}p${r.play.own ? ', eigener Player' : ''}${r.play.second ? ', 2. Versuch' : ''}` : '❌ ' + r.play.why;
    md += `| ${SOURCES[r.src].name} | ${r.title.slice(0, 40).replace(/\|/g, '/')} | ${r.page === true ? '✅' : '❌ ' + r.page} | ${r.file === true ? '✅' : r.file ? '❌ ' + r.file : ''} | ${pl} |\n`;
  });
  fs.writeFileSync('source-test.json', JSON.stringify({geo, sum, apiErr, rows}, null, 1));
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log('\n' + md);
})();
