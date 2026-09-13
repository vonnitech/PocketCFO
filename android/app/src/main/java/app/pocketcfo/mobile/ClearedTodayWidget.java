package app.pocketcfo.mobile;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.widget.RemoteViews;
import org.json.JSONObject;

public class ClearedTodayWidget extends AppWidgetProvider {
    private static final String REFRESH = "app.pocketcfo.mobile.WIDGET_REFRESH";

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        refreshAll(context);
    }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (REFRESH.equals(action) || Intent.ACTION_DATE_CHANGED.equals(action)
            || Intent.ACTION_TIME_CHANGED.equals(action) || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            refreshAll(context);
        }
    }

    public static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, ClearedTodayWidget.class));
        JSONObject snapshot = null;
        try {
            String value = context.getSharedPreferences("pocket_widget", 0).getString("snapshot", null);
            if (value != null) snapshot = new JSONObject(value);
        } catch (Exception ignored) { }
        long now = System.currentTimeMillis();
        boolean valid = snapshot != null && snapshot.optInt("version") == 1
            && snapshot.optLong("expiresAt") > now && snapshot.optLong("updatedAt") <= now;
        boolean hidden = snapshot != null && snapshot.optBoolean("hidden", true);
        for (int id : ids) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.cleared_today_widget);
            String amount = hidden ? "••••" : valid ? snapshot.optString("amountText", "—") : "—";
            String detail = snapshot == null ? "Open Pocket CFO to get started"
                : hidden ? "Amount hidden"
                : !valid ? "Open to refresh today's amount"
                : "Updated " + android.text.format.DateFormat.getTimeFormat(context)
                    .format(new java.util.Date(snapshot.optLong("updatedAt")));
            views.setTextViewText(R.id.widget_amount, amount);
            views.setTextViewText(R.id.widget_detail, detail);
            views.setOnClickPendingIntent(R.id.widget_root, openApp(context, "home", 10));
            views.setOnClickPendingIntent(R.id.widget_log_spend, openApp(context, "spend", 11));
            manager.updateAppWidget(id, views);
        }
        AlarmManager alarm = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent refresh = PendingIntent.getBroadcast(context, 12,
            new Intent(context, ClearedTodayWidget.class).setAction(REFRESH),
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        if (alarm != null) {
            alarm.cancel(refresh);
            if (valid && ids.length > 0) {
                alarm.set(AlarmManager.RTC, snapshot.optLong("expiresAt"), refresh);
            }
        }
    }

    private static PendingIntent openApp(Context context, String destination, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse("app.pocketcfo.mobile://" + destination))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        return PendingIntent.getActivity(context, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }
}
