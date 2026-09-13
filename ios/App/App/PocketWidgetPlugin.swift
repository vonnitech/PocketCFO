import Capacitor
import WidgetKit

@objc(PocketWidgetPlugin)
public class PocketWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "PocketWidgetPlugin"
    public let jsName = "PocketWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise)
    ]
    private var storage: UserDefaults? { UserDefaults(suiteName: "group.app.pocketcfo.mobile") }

    @objc func update(_ call: CAPPluginCall) {
        guard let storage = storage else { call.reject("Widget storage unavailable"); return }
        let hidden = call.getBool("hidden") ?? true
        let snapshot: [String: Any] = [
            "version": 1,
            "amountText": hidden ? "" : (call.getString("amountText") ?? ""),
            "hidden": hidden,
            "updatedAt": call.getDouble("updatedAt") ?? 0,
            "expiresAt": call.getDouble("expiresAt") ?? 0
        ]
        do {
            let data = try JSONSerialization.data(withJSONObject: snapshot)
            storage.set(data, forKey: "snapshot")
            WidgetCenter.shared.reloadTimelines(ofKind: "ClearedTodayWidget")
            call.resolve()
        } catch { call.reject("Could not save widget") }
    }

    @objc func clear(_ call: CAPPluginCall) {
        storage?.removeObject(forKey: "snapshot")
        WidgetCenter.shared.reloadTimelines(ofKind: "ClearedTodayWidget")
        call.resolve()
    }
}
