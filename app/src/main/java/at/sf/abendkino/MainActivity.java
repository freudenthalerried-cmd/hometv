package at.sf.abendkino;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.KeyEvent;
import android.view.View;
import android.view.WindowManager;
import android.view.inputmethod.InputMethodManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import android.widget.FrameLayout;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Pattern;

public class MainActivity extends Activity {

    private static final String UA =
            "Mozilla/5.0 (Linux; Android 9; AFTMM) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

    // Normal mode: block well-known ad / tracking networks.
    private static final Pattern AD_HOSTS = Pattern.compile(
            "(exoclick|exosrv|exdynsrv|trafficjunky|trafficfactory|juicyads|popads|popcash|propeller|adnxs|"
                    + "doubleclick|googlesyndication|googletagmanager|google-analytics|adtng|tsyndicate|realsrv|"
                    + "magsrv|ad-maven|clickadu|hilltopads|trafficstars|adspyglass|adsterra|onclick|pushnami|"
                    + "dtscout|mgid|taboola|outbrain|syndication|popunder|adserver|^ads?\\.|\\.ads?\\.)");
    // Strict mode: only the video sites themselves and their CDNs may load anything.
    private static final String[] ALLOWED = {"eporner.com", "pornhub.com", "phncdn.com", "redtube.com", "rdtcdn.com",
            "cdnjs.cloudflare.com", "ajax.googleapis.com", "jsdelivr.net",
            "youtube-nocookie.com", "youtube.com", "ytimg.com", "googlevideo.com", "ggpht.com", "gstatic.com",
            "akamaihd.net", "akamaized.net", "zdf.de", "ard.de", "ardmediathek.de", "arte.tv", "3sat.de", "orf.at", "srf.ch"};
    private static final Pattern MEDIA = Pattern.compile("\\.(mp4|m3u8|ts|m4s|webm)(\\?|$)");

    private FrameLayout root;
    private WebView ui;
    private WebView player;
    private SharedPreferences prefs;
    private final ExecutorService pool = Executors.newFixedThreadPool(4);
    private final ExecutorService checkPool = Executors.newFixedThreadPool(8);
    private String playingId = "";
    private String playingHost = "";
    private int playStart = 0;
    private String playingUrl = "";
    private String directHtml = null; // set while a broadcaster film plays in our own <video> page
    private boolean lenient = false;  // second attempt with the normal instead of the strict ad blocker
    private String lastInfo = "\"\""; // JSON string "state|url" from the player page
    // 15 s after start: if nothing plays, retry once with the lenient blocker, then tell the user
    private final Runnable watchdog = new Runnable() {
        @Override public void run() {
            if (!playerVisible()) return;
            player.evaluateJavascript("(function(){var v=document.querySelector('video');"
                    + "return ((v&&v.currentTime>0)||window.__ak_state==='playing'?'ok':String(window.__ak_state||'none'))"
                    + "+'|'+String(window.__ak_url||'')})()", r -> {
                lastInfo = r == null ? "\"\"" : r;
                if (r != null && r.startsWith("\"ok")) { reportResult(true); return; }
                if (directHtml == null && strict && !lenient) {
                    lenient = true;
                    Toast.makeText(MainActivity.this, "Zweiter Versuch ohne strengen Werbeblocker …", Toast.LENGTH_LONG).show();
                    player.loadUrl(playingUrl);
                    handler.postDelayed(watchdog, 15000);
                } else {
                    Toast.makeText(MainActivity.this, "Video nicht verfügbar – wird künftig ausgeblendet", Toast.LENGTH_LONG).show();
                    reportResult(false);
                    closePlayer();
                }
            });
        }
    };
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable sleepRun = this::finish;
    private volatile boolean strict = true;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        prefs = getSharedPreferences("ak", MODE_PRIVATE);
        strict = !"0".equals(prefs.getString("strict", "1"));

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        ui = new WebView(this);
        setup(ui);
        ui.getSettings().setAllowFileAccess(true);
        ui.addJavascriptInterface(new Bridge(), "Android");
        ui.setWebViewClient(new WebViewClient());
        root.addView(ui, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        ui.loadUrl("file:///android_asset/index.html");
        ui.requestFocus();
    }

    private void setup(WebView w) {
        w.setBackgroundColor(Color.BLACK);
        WebSettings s = w.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setUserAgentString(UA);
    }

    private WebView player() {
        if (player != null) return player;
        player = new WebView(this);
        setup(player);
        player.getSettings().setSupportMultipleWindows(true); // popups go to onCreateWindow -> dropped
        player.getSettings().setJavaScriptCanOpenWindowsAutomatically(false);
        player.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onCreateWindow(WebView v, boolean d, boolean g, android.os.Message m) {
                return false;
            }
        });
        player.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView v, WebResourceRequest r) {
                return blocked(r.getUrl()) ? empty() : null;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
                // only the embed player's own host may load, every click-through / ad redirect is swallowed
                String h = r.getUrl().getHost();
                return h == null || !(h.equals(playingHost) || h.endsWith("." + playingHost));
            }

            @Override
            public void onPageFinished(WebView v, String url) {
                v.evaluateJavascript("window.__start=" + playStart + ";" + asset("inject.js"), null);
            }
        });
        player.setVisibility(View.GONE);
        root.addView(player, new FrameLayout.LayoutParams(-1, -1));
        return player;
    }

    private boolean blocked(Uri u) {
        String h = u.getHost() == null ? "" : u.getHost().toLowerCase();
        String url = u.toString().toLowerCase();
        if (MEDIA.matcher(url).find()) return false;
        if (directHtml != null) return false; // broadcaster CDNs, no ads
        if (strict && !lenient) {
            for (String a : ALLOWED) if (h.equals(a) || h.endsWith("." + a)) return false;
            return true;
        }
        return AD_HOSTS.matcher(h).find();
    }

    private static WebResourceResponse empty() {
        return new WebResourceResponse("text/plain", "utf-8", new ByteArrayInputStream(new byte[0]));
    }

    private String asset(String name) {
        try (InputStream in = getAssets().open(name)) {
            return new String(read(in), "UTF-8");
        } catch (Exception e) {
            return "";
        }
    }

    private static byte[] read(InputStream in) throws java.io.IOException {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
        return o.toByteArray();
    }

    private void openPlayer(String url, String id, int start) {
        playingId = id;
        playStart = start;
        String h = Uri.parse(url).getHost();
        String[] parts = h == null ? new String[0] : h.split("\\.");
        // site domain (e.g. embed.redtube.com -> redtube.com) so same-site redirects still work
        playingHost = parts.length >= 2 ? parts[parts.length - 2] + "." + parts[parts.length - 1] : String.valueOf(h);
        playingUrl = url;
        directHtml = null;
        lenient = false;
        WebView p = player();
        p.onResume();
        p.loadUrl(url);
        p.setVisibility(View.VISIBLE);
        p.requestFocus();
        handler.removeCallbacks(watchdog);
        handler.postDelayed(watchdog, 15000);
    }

    /** Plays direct video URLs (Mediathek films) in a minimal page: tries each URL in turn, HLS via hls.js. */
    private void openDirect(JSONArray urls, String id, int start) {
        playingId = id;
        playStart = start;
        playingHost = "";
        lenient = false;
        directHtml = "<!doctype html><html><head><meta name=viewport content='width=device-width'>"
                + "<script src='https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js'></script></head>"
                + "<body style='margin:0;background:#000'><video id=v autoplay playsinline style='width:100vw;height:100vh'></video><script>"
                + "var U=" + urls.toString() + ",i=0,v=document.getElementById('v');window.__ak_state='loading';"
                + "function next(){if(i>=U.length){window.__ak_state='error';return;}var u=U[i++];"
                + "window.__ak_url=u;if(/\\.m3u8/.test(u)&&!v.canPlayType('application/vnd.apple.mpegurl')&&window.Hls&&Hls.isSupported()){"
                + "var h=new Hls();h.loadSource(u);h.attachMedia(v);h.on(Hls.Events.ERROR,function(e,d){if(d.fatal){h.destroy();next();}});}"
                + "else{v.src=u;}var p=v.play();if(p&&p.catch)p.catch(function(){});}"
                + "v.addEventListener('error',next);v.addEventListener('playing',function(){window.__ak_state='playing';});next();"
                + "</script></body></html>";
        WebView p = player();
        p.onResume();
        p.loadDataWithBaseURL("https://abendkino.app/", directHtml, "text/html", "UTF-8", null);
        p.setVisibility(View.VISIBLE);
        p.requestFocus();
        handler.removeCallbacks(watchdog);
        handler.postDelayed(watchdog, 20000);
    }

    /** Tells the UI whether the current video really played, so broken ones get hidden. */
    private void reportResult(boolean ok) {
        ui.evaluateJavascript("window.onPlayResult&&onPlayResult(" + JSONObject.quote(playingId) + "," + ok + "," + lastInfo + ")", null);
    }

    /** Is the video really reachable from this device (geo blocks, expired films)? Asks for 2 bytes only. */
    private static boolean reachable(String url) {
        try {
            HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
            c.setConnectTimeout(6000);
            c.setReadTimeout(6000);
            c.setRequestProperty("User-Agent", UA);
            c.setRequestProperty("Range", "bytes=0-1");
            int code = c.getResponseCode();
            String type = String.valueOf(c.getContentType());
            c.disconnect();
            return (code == 200 || code == 206) && !type.startsWith("text/html");
        } catch (Exception e) {
            return false;
        }
    }

    private void closePlayer() {
        handler.removeCallbacks(watchdog);
        directHtml = null;
        player.evaluateJavascript("window.__pos?window.__pos():0", v -> {
            int sec = 0;
            try { sec = (int) Double.parseDouble(v); } catch (Exception ignored) { }
            player.loadUrl("about:blank");
            player.onPause();
            player.setVisibility(View.GONE);
            ui.requestFocus();
            ui.evaluateJavascript("onPlayerClosed(" + JSONObject.quote(playingId) + "," + sec + ")", null);
        });
    }

    private boolean playerVisible() {
        return player != null && player.getVisibility() == View.VISIBLE;
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent e) {
        int k = e.getKeyCode();
        if (playerVisible()) {
            if (e.getAction() != KeyEvent.ACTION_DOWN) return true;
            String c = null;
            switch (k) {
                case KeyEvent.KEYCODE_BACK: closePlayer(); return true;
                case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER:
                case KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE: case KeyEvent.KEYCODE_MEDIA_PLAY:
                case KeyEvent.KEYCODE_MEDIA_PAUSE: c = "toggle"; break;
                case KeyEvent.KEYCODE_DPAD_RIGHT: case KeyEvent.KEYCODE_MEDIA_FAST_FORWARD: c = "fwd"; break;
                case KeyEvent.KEYCODE_DPAD_LEFT: case KeyEvent.KEYCODE_MEDIA_REWIND: c = "back"; break;
                case KeyEvent.KEYCODE_DPAD_UP: c = "ffwd"; break;
                case KeyEvent.KEYCODE_DPAD_DOWN: c = "fback"; break;
                default: return super.dispatchKeyEvent(e);
            }
            player.evaluateJavascript("window.__ctl&&window.__ctl('" + c + "')", null);
            return true;
        }
        if (k == KeyEvent.KEYCODE_BACK) {
            if (e.getAction() == KeyEvent.ACTION_DOWN)
                ui.evaluateJavascript("onBack()", v -> { if (!"true".equals(v)) finish(); });
            return true;
        }
        if (k == KeyEvent.KEYCODE_MEDIA_REWIND) { // ⏪ = voice search (dictate with the keyboard's mic)
            if (e.getAction() == KeyEvent.ACTION_DOWN) ui.evaluateJavascript("voiceSearch()", null);
            return true;
        }
        if (k == KeyEvent.KEYCODE_MENU) {
            if (e.getAction() == KeyEvent.ACTION_DOWN) ui.evaluateJavascript("onMenu()", null);
            return true;
        }
        return super.dispatchKeyEvent(e);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(sleepRun);
        if (player != null) player.destroy();
        ui.destroy();
        super.onDestroy();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (playerVisible()) player.evaluateJavascript("window.__ctl&&window.__ctl('pause')", null);
    }

    private void updateState(String st) {
        final String js = "window.onUpdate&&onUpdate(" + JSONObject.quote(st) + ")";
        runOnUiThread(() -> ui.evaluateJavascript(js, null));
    }

    public class Bridge {
        @JavascriptInterface
        public String load(String key) { return prefs.getString(key, ""); }

        @JavascriptInterface
        public void save(String key, String val) {
            prefs.edit().putString(key, val).apply();
            if ("strict".equals(key)) strict = !"0".equals(val);
        }

        @JavascriptInterface
        public void get(final String url, final String cb) {
            pool.execute(() -> {
                boolean ok = false;
                String body;
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(8000);
                    c.setReadTimeout(12000);
                    c.setRequestProperty("User-Agent", UA);
                    try (InputStream in = c.getInputStream()) { body = new String(read(in), "UTF-8"); }
                    ok = c.getResponseCode() == 200;
                } catch (Exception ex) {
                    body = String.valueOf(ex.getMessage());
                }
                final String js = "__cb(" + JSONObject.quote(cb) + "," + ok + "," + JSONObject.quote(body) + ")";
                runOnUiThread(() -> ui.evaluateJavascript(js, null));
            });
        }

        /** POST with a plain-text body (used for the Mediathek search). Answer goes to __cb like get(). */
        @JavascriptInterface
        public void post(final String url, final String data, final String cb) {
            pool.execute(() -> {
                boolean ok = false;
                String body;
                try {
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(8000);
                    c.setReadTimeout(15000);
                    c.setRequestMethod("POST");
                    c.setDoOutput(true);
                    c.setRequestProperty("User-Agent", UA);
                    c.setRequestProperty("Content-Type", "text/plain");
                    try (OutputStream out = c.getOutputStream()) { out.write(data.getBytes("UTF-8")); }
                    try (InputStream in = c.getInputStream()) { body = new String(read(in), "UTF-8"); }
                    ok = c.getResponseCode() == 200;
                } catch (Exception ex) {
                    body = String.valueOf(ex.getMessage());
                }
                final String js = "__cb(" + JSONObject.quote(cb) + "," + ok + "," + JSONObject.quote(body) + ")";
                runOnUiThread(() -> ui.evaluateJavascript(js, null));
            });
        }

        /** Checks a list of video URLs in parallel; answers __cb with a JSON array of booleans. */
        @JavascriptInterface
        public void check(final String urlsJson, final String cb) {
            pool.execute(() -> {
                JSONArray res = new JSONArray();
                try {
                    JSONArray in = new JSONArray(urlsJson);
                    java.util.List<java.util.concurrent.Callable<Boolean>> jobs = new java.util.ArrayList<>();
                    for (int i = 0; i < in.length() && i < 200; i++) {
                        final String u = in.optString(i, "");
                        jobs.add(() -> reachable(u));
                    }
                    for (java.util.concurrent.Future<Boolean> f : checkPool.invokeAll(jobs)) res.put(f.get());
                } catch (Exception ignored) { }
                final String js = "__cb(" + JSONObject.quote(cb) + ",true," + JSONObject.quote(res.toString()) + ")";
                runOnUiThread(() -> ui.evaluateJavascript(js, null));
            });
        }

        /** Opens the native RTSP live view for the saved Tapo cameras, starting with camera {@code index}. */
        @JavascriptInterface
        public void camera(final String camsJson, final int index) {
            runOnUiThread(() -> startActivity(new Intent(MainActivity.this, CameraActivity.class)
                    .putExtra("cams", camsJson).putExtra("index", index)));
        }

        /** Installed TV apps as JSON [[label, package], ...] for the launcher row. */
        @JavascriptInterface
        public String apps() {
            JSONArray out = new JSONArray();
            try {
                android.content.pm.PackageManager pm = getPackageManager();
                Intent i = new Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LEANBACK_LAUNCHER);
                for (android.content.pm.ResolveInfo r : pm.queryIntentActivities(i, 0)) {
                    String p = r.activityInfo.packageName;
                    if (!p.equals(getPackageName())) out.put(new JSONArray().put(String.valueOf(r.loadLabel(pm))).put(p));
                }
            } catch (Exception ignored) { }
            return out.toString();
        }

        @JavascriptInterface
        public void launch(final String pkg) {
            runOnUiThread(() -> {
                android.content.pm.PackageManager pm = getPackageManager();
                Intent i = pm.getLeanbackLaunchIntentForPackage(pkg);
                if (i == null) i = pm.getLaunchIntentForPackage(pkg);
                if (i != null) startActivity(i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            });
        }

        @JavascriptInterface
        public void playDirect(final String urlsJson, final String id, final int start) {
            JSONArray out = new JSONArray();
            try {
                JSONArray in = new JSONArray(urlsJson);
                for (int i = 0; i < in.length() && out.length() < 6; i++) {
                    String u = in.optString(i, "");
                    if (u.startsWith("https://") || u.startsWith("http://")) out.put(u);
                }
            } catch (Exception ignored) { }
            if (out.length() == 0) return;
            runOnUiThread(() -> openDirect(out, id, start));
        }

        @JavascriptInterface
        public void play(final String url, final String id, final int start) {
            runOnUiThread(() -> openPlayer(url, id, start));
        }

        /** Sleep timer: closes the app after the given minutes, 0 = off. */
        @JavascriptInterface
        public void sleep(final int minutes) {
            handler.removeCallbacks(sleepRun);
            if (minutes > 0) handler.postDelayed(sleepRun, minutes * 60000L);
        }

        @JavascriptInterface
        public void keyboard() {
            runOnUiThread(() -> {
                InputMethodManager im = (InputMethodManager) getSystemService(Context.INPUT_METHOD_SERVICE);
                im.showSoftInput(ui, InputMethodManager.SHOW_IMPLICIT);
            });
        }

        @JavascriptInterface
        public int version() {
            try { return getPackageManager().getPackageInfo(getPackageName(), 0).versionCode; }
            catch (Exception e) { return 0; }
        }

        /** Downloads the APK and hands it to the system installer. Progress goes to JS onUpdate(state). */
        @JavascriptInterface
        public void update(final String url) {
            if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
                updateState("permission");
                runOnUiThread(() -> startActivity(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + getPackageName()))));
                return;
            }
            pool.execute(() -> {
                try {
                    // before Android 7 the installer can only read a world-readable file:// path
                    File f = Build.VERSION.SDK_INT >= 24 ? ApkProvider.file(MainActivity.this)
                            : new File(getExternalCacheDir(), "update.apk");
                    HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
                    c.setConnectTimeout(10000);
                    c.setReadTimeout(30000);
                    int total = c.getContentLength(), done = 0, n, last = -1;
                    byte[] buf = new byte[65536];
                    try (InputStream in = c.getInputStream(); OutputStream out = new FileOutputStream(f)) {
                        while ((n = in.read(buf)) > 0) {
                            out.write(buf, 0, n);
                            done += n;
                            int pct = total > 0 ? done * 100 / total : 0;
                            if (pct / 10 != last) { last = pct / 10; updateState(pct + "%"); }
                        }
                    }
                    Uri uri = Build.VERSION.SDK_INT >= 24
                            ? Uri.parse("content://" + ApkProvider.AUTHORITY + "/update.apk") : Uri.fromFile(f);
                    Intent i = new Intent(Intent.ACTION_VIEW);
                    i.setDataAndType(uri, "application/vnd.android.package-archive");
                    i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
                    updateState("install");
                    runOnUiThread(() -> startActivity(i));
                } catch (Exception e) {
                    updateState("error");
                }
            });
        }

        @JavascriptInterface
        public void exit() { runOnUiThread(MainActivity.this::finish); }
    }
}
