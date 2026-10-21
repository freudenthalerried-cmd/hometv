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
    'z-index:2147483647;font:600 3.2vh sans-serif;color:#fff;background:rgba(0,0,0,.7);padding:1.2vh 2.4vh;' +
    'border-radius:1vh;opacity:0;transition:opacity .3s}' +
    '#__bar{visibility:visible!important;position:fixed;left:0;bottom:0;height:.6vh;background:#e50914;' +
    'z-index:2147483647;opacity:0;transition:opacity .3s}';
  document.documentElement.appendChild(st);

  var osd = document.createElement('div'); osd.id = '__osd';
  var bar = document.createElement('div'); bar.id = '__bar';
  document.documentElement.appendChild(osd);
  document.documentElement.appendChild(bar);

  function v() { return document.querySelector('video'); }
  function fmt(s) {
    s = Math.max(0, Math.floor(s || 0));
    var h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (x < 10 ? '0' : '') + x;
  }
  function show(t) {
    var e = v();
    osd.textContent = t;
    if (e && e.duration) bar.style.width = (e.currentTime / e.duration * 100) + '%';
    osd.style.opacity = 1; bar.style.opacity = 1;
    clearTimeout(osd.t);
    osd.t = setTimeout(function () { osd.style.opacity = 0; bar.style.opacity = 0; }, 1800);
  }

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
  var iv = setInterval(function () {
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
        .filter(function (x) { return x.q >= 360 && x.q <= 2160; })
        .sort(function (a, b) { return b.q - a.q; });
      if (q.length) { q[0].el.click(); show('Qualität: ' + q[0].q + 'p'); }
    }
    if (started) clearInterval(iv);
  }, 500);

  window.__ctl = function (c) {
    var e = v(); if (!e) return;
    keepSound();
    var d = e.duration || 1e9;
    switch (c) {
      case 'toggle':
        if (e.paused) { userPaused = false; e.play(); show('▶ ' + fmt(e.currentTime) + ' / ' + fmt(d)); }
        else { userPaused = true; e.pause(); show('❚❚ ' + fmt(e.currentTime) + ' / ' + fmt(d)); }
        break;
      case 'pause': userPaused = true; e.pause(); break;
      case 'fwd': e.currentTime = Math.min(d - 2, e.currentTime + 15); show('» ' + fmt(e.currentTime) + ' / ' + fmt(d)); break;
      case 'back': e.currentTime = Math.max(0, e.currentTime - 15); show('« ' + fmt(e.currentTime) + ' / ' + fmt(d)); break;
      case 'ffwd': e.currentTime = Math.min(d - 2, e.currentTime + 120); show('»» ' + fmt(e.currentTime) + ' / ' + fmt(d)); break;
      case 'fback': e.currentTime = Math.max(0, e.currentTime - 120); show('«« ' + fmt(e.currentTime) + ' / ' + fmt(d)); break;
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
