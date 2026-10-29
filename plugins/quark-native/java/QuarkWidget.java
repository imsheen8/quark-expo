package __APP_ID__;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.content.res.Configuration;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.net.Uri;
import android.os.Bundle;
import android.widget.RemoteViews;

/** ودجت 4×2: شريط «اكتب رسالة» وأزرار الكاميرا والمعرض والإملاء ومحادثة جديدة. الألوان تتبع وضع النظام (فاتح/داكن). كل زر يفتح رابطًا عميقًا quarkai://a/<action>. */
public class QuarkWidget extends AppWidgetProvider {
    static boolean dark(Context c) {
        return (c.getResources().getConfiguration().uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES;
    }

    static PendingIntent act(Context c, String action, int code) {
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("quarkai://a/" + action));
        i.setPackage(c.getPackageName());
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(c, code, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    static Bitmap round(int w, int h, float r, int color) {
        w = Math.max(8, w); h = Math.max(8, h);
        Bitmap b = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
        Paint p = new Paint(Paint.ANTI_ALIAS_FLAG);
        p.setColor(color);
        new Canvas(b).drawRoundRect(new RectF(0, 0, w, h), r, r, p);
        return b;
    }

    static void update(Context ctx, AppWidgetManager mgr, int id) {
        boolean dk = dark(ctx);
        int bg = Color.parseColor(dk ? "#1C1C1C" : "#F3F1EA"), pill = Color.parseColor(dk ? "#2A2A2A" : "#FFFFFF");
        int btn = pill, fg = Color.parseColor(dk ? "#ECECEC" : "#1F1E1C"), hint = Color.parseColor(dk ? "#8B8B8B" : "#8A867B");
        float d = ctx.getResources().getDisplayMetrics().density;
        Bundle o = mgr.getAppWidgetOptions(id);
        int wDp = o != null ? o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 250) : 250;
        int hDp = o != null ? o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110) : 110;
        if (wDp < 100) wDp = 250;
        if (hDp < 60) hDp = 110;
        int pad = Math.round(10 * d), gap = Math.round(8 * d);
        int W = Math.round(wDp * d), H = Math.round(hDp * d);
        int rowH = Math.max(8, (H - 2 * pad - gap) / 2);
        int btnW = Math.max(8, (W - 2 * pad - 3 * gap) / 4);

        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_quark);
        v.setImageViewBitmap(R.id.qw_bg, round(W, H, 28 * d, bg));
        v.setImageViewBitmap(R.id.qw_pill_bg, round(W - 2 * pad, rowH, 26 * d, pill));
        Bitmap b = round(btnW, rowH, 20 * d, btn);
        v.setImageViewBitmap(R.id.qw_cam_bg, b);
        v.setImageViewBitmap(R.id.qw_photo_bg, b);
        v.setImageViewBitmap(R.id.qw_mic_bg, b);
        v.setImageViewBitmap(R.id.qw_new_bg, b);
        v.setTextColor(R.id.qw_hint, hint);
        v.setInt(R.id.qw_cam_ic, "setColorFilter", fg);
        v.setInt(R.id.qw_photo_ic, "setColorFilter", fg);
        v.setInt(R.id.qw_mic_ic, "setColorFilter", fg);
        v.setInt(R.id.qw_new_ic, "setColorFilter", fg);
        v.setOnClickPendingIntent(R.id.qw_pill, act(ctx, "chat", 1));
        v.setOnClickPendingIntent(R.id.qw_cam, act(ctx, "camera", 2));
        v.setOnClickPendingIntent(R.id.qw_photo, act(ctx, "photo", 3));
        v.setOnClickPendingIntent(R.id.qw_mic, act(ctx, "mic", 4));
        v.setOnClickPendingIntent(R.id.qw_new, act(ctx, "new", 5));
        mgr.updateAppWidget(id, v);
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager mgr, int[] ids) {
        for (int id : ids) update(context, mgr, id);
    }

    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager mgr, int id, Bundle newOptions) {
        update(context, mgr, id);
    }
}
