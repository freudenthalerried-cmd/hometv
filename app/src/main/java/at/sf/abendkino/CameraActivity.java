package at.sf.abendkino;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.media3.common.MediaItem;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.exoplayer.rtsp.RtspMediaSource;
import androidx.media3.ui.PlayerView;

import org.json.JSONArray;
import org.json.JSONObject;

/** Fullscreen live view of the Tapo cameras over RTSP (camera account, home network). ◀ ▶ switch, OK = HD/SD. */
public class CameraActivity extends Activity {
    private PlayerView view;
    private TextView label;
    private ExoPlayer player;
    private JSONArray cams = new JSONArray();
    private int idx = 0;
    private boolean hd = true;

    @Override
    protected void onCreate(Bundle b) {
        super.onCreate(b);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        try { cams = new JSONArray(getIntent().getStringExtra("cams")); } catch (Exception ignored) { }
        idx = getIntent().getIntExtra("index", 0);

        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        view = new PlayerView(this);
        view.setUseController(false);
        root.addView(view, new FrameLayout.LayoutParams(-1, -1));
        label = new TextView(this);
        label.setTextColor(Color.WHITE);
        label.setTextSize(20);
        label.setBackgroundColor(0x99000000);
        label.setPadding(24, 12, 24, 12);
        FrameLayout.LayoutParams lp = new FrameLayout.LayoutParams(-2, -2, Gravity.TOP | Gravity.START);
        lp.setMargins(32, 32, 0, 0);
        root.addView(label, lp);
        setContentView(root);
        if (cams.length() == 0) finish(); else start();
    }

    private void start() {
        release();
        JSONObject c = cams.optJSONObject(idx);
        if (c == null) { finish(); return; }
        final String name = c.optString("name", "Kamera");
        String host = c.optString("ip", "");
        if (!host.matches("[A-Za-z0-9.\\-]+")) { label.setText(name + " – ungültige IP-Adresse"); return; }
        // Tapo: stream1 = full resolution, stream2 = low resolution
        String url = "rtsp://" + Uri.encode(c.optString("user", "")) + ":" + Uri.encode(c.optString("pass", ""))
                + "@" + host + ":554/" + (hd ? "stream1" : "stream2");
        player = new ExoPlayer.Builder(this).build();
        view.setPlayer(player);
        player.setMediaSource(new RtspMediaSource.Factory().setForceUseRtpTcp(true).createMediaSource(MediaItem.fromUri(url)));
        player.addListener(new Player.Listener() {
            @Override
            public void onPlayerError(PlaybackException e) {
                label.setText(name + " – keine Verbindung (gleiches WLAN? Kamerakonto richtig?)");
            }
        });
        player.setPlayWhenReady(true);
        player.prepare();
        label.setText(name + (hd ? " · HD" : " · SD") + (cams.length() > 1 ? "   ◀ ▶ Kamera" : "") + "   OK = HD/SD   Zurück = Ende");
    }

    private void release() {
        if (player != null) { player.release(); player = null; }
    }

    @Override
    public boolean onKeyDown(int k, KeyEvent e) {
        int n = cams.length();
        switch (k) {
            case KeyEvent.KEYCODE_DPAD_LEFT: idx = (idx - 1 + n) % n; start(); return true;
            case KeyEvent.KEYCODE_DPAD_RIGHT: idx = (idx + 1) % n; start(); return true;
            case KeyEvent.KEYCODE_DPAD_CENTER: case KeyEvent.KEYCODE_ENTER: hd = !hd; start(); return true;
            default: return super.onKeyDown(k, e);
        }
    }

    @Override
    protected void onStop() {
        super.onStop();
        release();
        finish();
    }
}
