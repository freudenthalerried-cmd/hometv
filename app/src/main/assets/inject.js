(function () {
  if (window.__ak) return;
  window.__ak = 1;
  var st = document.createElement('style');
  st.textContent =
    'html,body{background:#000!important;overflow:hidden!important}' +
    'body *{visibility:hidden!important}' +
    'video{visibility:visible!important;position:fixed!important;left:0!important;top:0!important;' +
    'width:100vw!important;height:100vh!important;max-width:none!important;z-index:2147483646!important;' +
    'object-fit:contain!important;background:#000!important}' +
    '#__osd{visibility:visible!important;position:fixed;left:50%;bottom:8vh;transform:translateX(-50%);' +
    'z-index:2147483647;font:600 4vh sans-serif;color:#fff;background:rgba(0,0,0,.7);padding:1.2vh 2.4vh;' +
    'border-radius:1vh;opacity:0;transition:opacity .3s}' +
    '#__bar{visibility:visible!important;position:fixed;left:0;bottom:0;height:.6vh;background:#e50914;' +
    'z-index:2147483647;opacity:0;transition:opacity .3s}' +
    // small preview picture while seeking, persistent state line (Pause / Lädt / Springe)
    'video#__pv{display:none;visibility:visible!important;position:fixed!important;left:auto!important;top:auto!important;right:4vw!important;' +
    'bottom:16vh!important;width:26vw!important;height:14.6vw!important;z-index:2147483647!important;border:.4vh solid #fff!important;border-radius:1vh}' +
    '#__hold{visibility:visible!important;position:fixed;right:3vw;top:4vh;z-index:2147483647;font:600 3.6vh sans-serif;color:#fff;' +
    'background:rgba(0,0,0,.7);padding:1vh 2vh;border-radius:1vh;opacity:0;transition:opacity .3s}' +
    '.akown video:not(#__own):not(#__pv){display:none!important}';
  document.documentElement.appendChild(st);

  var osd = document.createElement('div'); osd.id = '__osd';
  var bar = document.createElement('div'); bar.id = '__bar';
  var hold = document.createElement('div'); hold.id = '__hold';
  document.documentElement.appendChild(osd);
  document.documentElement.appendChild(bar);
  document.documentElement.appendChild(hold);

  function v() { return document.getElementById('__own') || document.querySelector('video:not(#__pv)'); }
  function fmt(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (x < 10 ? '0' : '') + x;
  }
  function show(t, frac) {
    var e = v();
    osd.textContent = t;
    if (frac != null) bar.style.width = frac * 100 + '%';
    else if (e && e.duration) bar.style.width = (e.currentTime / e.duration * 100) + '%';
    osd.style.opacity = 1; bar.style.opacity = 1;
    clearTimeout(osd.t);
    osd.t = setTimeout(function () { osd.style.opacity = 0; bar.style.opacity = 0; }, 1800);
  }

  /* Pornhub / RedTube: their player shows ads before and during the video. The page already lists the video
     files (mediaDefinitions), so the best one (720p and up where offered) plays in a plain <video> instead. */
  function mgDefs() {
    for (var k in window) {
      try { var o = window[k]; if (/^flashvars|^playervars/i.test(k) && o && o.mediaDefinitions) return o.mediaDefinitions; } catch (x) { }
    }
    var h = document.documentElement.innerHTML, i = h.indexOf('"mediaDefinitions":');
    if (i < 0) return null;
    i = h.indexOf('[', i);
    for (var j = i, d = 0, q = false; j < h.length; j++) { // bracket matching, strings skipped
      var c = h[j];
      if (q) { if (c === '\\') j++; else if (c === '"') q = false; }
      else if (c === '"') q = true;
      else if (c === '[') d++;
      else if (c === ']' && --d === 0) { try { return JSON.parse(h.slice(i, j + 1)); } catch (x) { return null; } }
    }
    return null;
  }
  function qn(d) { return parseInt(Array.isArray(d.quality) ? 0 : d.quality) || 0; }
  function own(url, hls) {
    [].slice.call(document.querySelectorAll('video')).forEach(function (x) { try { x.pause(); x.removeAttribute('src'); x.load(); } catch (e) { } });
    document.documentElement.className += ' akown';
    var e = document.createElement('video'); e.id = '__own'; e.autoplay = true; e.setAttribute('playsinline', '');
    document.body.appendChild(e);
    window.__ak_url = url;
    started = false; clearInterval(iv); iv = setInterval(tick, 500); // start (and resume) our own video
    if (hls && !e.canPlayType('application/vnd.apple.mpegurl')) {
      var sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js';
      sc.onload = function () { var h = new Hls(); h.loadSource(url); h.attachMedia(e); };
      document.documentElement.appendChild(sc);
    } else e.src = url;
  }
  setTimeout(function () { // after the start-up code below is set up
  var defs = /pornhub|redtube/.test(location.hostname) && mgDefs();
  if (defs && defs.length) {
    var hl = defs.filter(function (d) { return d.format === 'hls' && typeof d.videoUrl === 'string' && d.videoUrl; }).sort(function (a, b) { return qn(b) - qn(a); });
    var mp = defs.filter(function (d) { return d.format === 'mp4' && typeof d.videoUrl === 'string' && d.videoUrl; });
    var useHls = function () { if (hl.length) own(hl[0].videoUrl, true); };
    if (mp.length && (mp[0].remote || /get_media/.test(mp[0].videoUrl))) {
      fetch(mp[0].videoUrl, {credentials:'include'}).then(function (r) { return r.json(); }).then(function (l) {
        l = (Array.isArray(l) ? l : []).filter(function (x) { return x.videoUrl; }).sort(function (a, b) { return qn(b) - qn(a); });
        if (l.length && (qn(l[0]) >= 480 || !hl.length)) own(l[0].videoUrl, false); else useHls();
      }).catch(useHls);
    } else if (mp.length) own(mp.sort(function (a, b) { return qn(b) - qn(a); })[0].videoUrl, false);
    else useHls();
  }
  }, 0);

  // Start playback automatically and pick the highest quality the player offers.
  var started = false, userPaused = false, clicks = 0;
  // players often start muted (autoplay) and mute again later: keep the sound on for the first 30 s
  var UNMUTE = '.vjs-mute-control.vjs-vol-0,[class*="unmute"],[class*="Unmute"],.mgp_volume.mgp_muted,[aria-label*="nmute"],' +
    '[title*="nmute"],[title*="Ton an"],.ytp-unmute';
  var soundTicks = 0;
  function keepSound() {
    var e = v();
    if (e && (e.muted || e.volume < 0.05)) {
      var u = document.querySelector(UNMUTE);
      if (u) u.click();
      e.muted = false; e.volume = 1;
    }
  }
  var sv = setInterval(function () { keepSound(); if (++soundTicks > 60) clearInterval(sv); }, 500);
  var PLAY = '.ytp-large-play-button,.vjs-big-play-button,.mgp_playIcon,.mgp_bigPlay,[class*="bigPlay"],[class*="big-play"],' +
    '[class*="play-button"],[class*="playButton"],[class*="playbtn"]';
  function tick() {
    var e = v();
    // some players (Pornhub/RedTube) only start through their own play button
    if (!e || (e.paused && !userPaused && !started && clicks < 6)) {
      var b = document.querySelector(PLAY);
      if (b) { b.click(); clicks++; }
      if (!e) return;
    }
    e.muted = false;
    if (!started && e.paused && !userPaused) {
      var p = e.play(); if (p && p.catch) p.catch(function () {});
    }
    if (!started && !e.paused) {
      started = true;
      window.__ak_state = 'playing';
      if (window.__start > 0) { e.currentTime = window.__start; window.__start = 0; } // continue watching
      show('▶ ' + fmt(e.currentTime) + ' / ' + fmt(e.duration));
      // pick the highest quality the player's menu offers
      var q = [].slice.call(document.querySelectorAll('.vjs-menu-item,[data-quality],[class*="quality"] li,[class*="Quality"] li,.mgp_qualitiesMenu li,[data-res]'))
        .map(function (i) { return {el:i, q:parseInt((i.getAttribute('data-quality') || i.getAttribute('data-res') || i.textContent).replace(/\D+/g, '')) || 0}; })
        .filter(function (x) { return x.q >= 480 && x.q <= 2160; })
        .sort(function (a, b) { return b.q - a.q; });
      if (q.length) { q[0].el.click(); show('Qualität: ' + q[0].q + 'p'); }
    }
    if (started) clearInterval(iv);
  }
  var iv = setInterval(tick, 500);

  /* Seeking: ◀ ▶ ▲ ▼ move a target (with a preview picture for normal video files); after a moment, or with OK,
     it jumps there and simply keeps playing. */
  var seekT = null, seekTimer = 0, pv = null;
  function preview(t) {
    var e = v(), src = e && (e.currentSrc || e.src);
    if (!src || /^blob:/.test(src)) return; // HLS streams have no cheap preview
    if (!pv) {
      pv = document.createElement('video'); pv.id = '__pv'; pv.muted = true; pv.preload = 'auto'; pv.setAttribute('playsinline', '');
      document.documentElement.appendChild(pv);
    }
    if (pv.getAttribute('src') !== src) pv.setAttribute('src', src);
    pv.style.display = 'block';
    try { pv.currentTime = t; } catch (x) { }
  }
  function seekBy(dt, sym) {
    var e = v(); if (!e) return;
    var d = e.duration;
    if (!d || !isFinite(d)) { show('● LIVE'); return; }
    seekT = Math.max(0, Math.min(d - 2, (seekT == null ? e.currentTime : seekT) + dt));
    show(sym + ' ' + fmt(seekT) + ' / ' + fmt(d), seekT / d);
    preview(seekT);
    clearTimeout(seekTimer);
    seekTimer = setTimeout(seekGo, 1300);
  }
  function seekGo() {
    clearTimeout(seekTimer);
    var e = v(); if (!e || seekT == null) return;
    e.currentTime = seekT; seekT = null;
    if (pv) pv.style.display = 'none';
    userPaused = false;
    var p = e.play(); if (p && p.catch) p.catch(function () {});
  }
  // always visible: is it paused, loading or jumping?
  function holdMsg(t) { hold.textContent = t; hold.style.opacity = t ? 1 : 0; }
  setInterval(function () {
    var e = v(); if (!e || e.__akw) return;
    e.__akw = 1;
    e.addEventListener('waiting', function () { holdMsg('⏳ Lädt …'); });
    e.addEventListener('seeking', function () { holdMsg('⏩ Springe …'); });
    e.addEventListener('playing', function () { holdMsg(''); });
    e.addEventListener('pause', function () { if (!e.ended && started) holdMsg('❚❚ Pause – OK = weiter'); });
    e.addEventListener('ended', function () { holdMsg('■ Ende'); });
  }, 1000);

  window.__ctl = function (c) {
    var e = v(); if (!e) return;
    keepSound();
    var d = e.duration || 1e9;
    if (c === 'toggle' && seekT != null) return seekGo();
    switch (c) {
      case 'toggle':
        if (e.paused) { userPaused = false; e.play(); show('▶ ' + fmt(e.currentTime) + ' / ' + fmt(d)); }
        else { userPaused = true; e.pause(); show('❚❚ ' + fmt(e.currentTime) + ' / ' + fmt(d)); }
        break;
      case 'pause': userPaused = true; e.pause(); break;
      case 'fwd': seekBy(15, '»'); break;
      case 'back': seekBy(-15, '«'); break;
      case 'ffwd': seekBy(120, '»»'); break;
      case 'fback': seekBy(-120, '««'); break;
    }
  };
  // progress for the native status line: novideo -> found (buffering) -> playing / error
  var watched = null;
  window.__ak_info = function () {
    var e = v(), b = 0;
    if (e && e !== watched) { watched = e; e.addEventListener('error', function () { if (!started) window.__ak_state = 'error'; }); }
    try { if (e && e.buffered.length && e.duration) b = Math.round(e.buffered.end(e.buffered.length - 1) / e.duration * 100); } catch (x) { }
    return {s:window.__ak_state === 'playing' || window.__ak_state === 'error' ? window.__ak_state : (e ? 'found' : 'novideo'),
      cur:e ? e.currentTime : 0, buf:b, url:window.__ak_url || ''};
  };
  window.__pos = function () { var e = v(); return e ? Math.round(e.currentTime) : 0; };
})();
