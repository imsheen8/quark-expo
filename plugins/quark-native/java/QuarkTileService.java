package __APP_ID__;

import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.drawable.Icon;
import android.net.Uri;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;

/** زر «QUARK AI» في الإعدادات السريعة: يفتح محادثة جديدة مع لوحة المفاتيح. */
public class QuarkTileService extends TileService {
    private void launch() {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("quarkai://a/chat"));
        i.setPackage(getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (Build.VERSION.SDK_INT >= 34) {
            startActivityAndCollapse(PendingIntent.getActivity(this, 6, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE));
        } else {
            startActivityAndCollapse(i);
        }
    }

    @Override
    public void onStartListening() {
        super.onStartListening();
        Tile t = getQsTile();
        if (t == null) return;
        t.setState(Tile.STATE_INACTIVE);
        t.setLabel(getString(R.string.tile_label));
        t.setIcon(Icon.createWithResource(this, R.drawable.ic_stat_quark));
        t.updateTile();
    }

    @Override
    public void onClick() {
        super.onClick();
        if (isLocked()) {
            unlockAndRun(new Runnable() { @Override public void run() { launch(); } });
        } else {
            launch();
        }
    }
}
