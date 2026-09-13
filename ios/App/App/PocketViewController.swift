import Capacitor

class PocketViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(PocketWidgetPlugin())
    }
}
