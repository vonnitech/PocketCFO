package app.pocketcfo.mobile;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import org.json.JSONObject;

@CapacitorPlugin(name = "PocketWidget")
public class PocketWidgetPlugin extends Plugin {
    @PluginMethod
    public void update(PluginCall call) {
        try {
            boolean hidden = Boolean.TRUE.equals(call.getBoolean("hidden", true));
            JSONObject snapshot = new JSONObject();
            snapshot.put("version", 1);
            snapshot.put("hidden", hidden);
            snapshot.put("amountText", hidden ? "" : call.getString("amountText", ""));
            snapshot.put("updatedAt", call.getData().optLong("updatedAt", 0));
            snapshot.put("expiresAt", call.getData().optLong("expiresAt", 0));
            // Synchronous replacement prevents a privacy toggle/sign-out from
            // leaving an old amount queued behind the widget refresh.
            boolean saved = getContext().getSharedPreferences("pocket_widget", 0)
                .edit().putString("snapshot", snapshot.toString()).commit();
            if (!saved) { call.reject("Could not save widget"); return; }
            ClearedTodayWidget.refreshAll(getContext());
            call.resolve();
        } catch (Exception error) { call.reject("Could not update widget"); }
    }

    @PluginMethod
    public void clear(PluginCall call) {
        boolean cleared = getContext().getSharedPreferences("pocket_widget", 0).edit().clear().commit();
        if (!cleared) { call.reject("Could not clear widget"); return; }
        ClearedTodayWidget.refreshAll(getContext());
        call.resolve();
    }
}
