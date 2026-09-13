package app.pocketcfo.mobile;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PocketWidgetPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
