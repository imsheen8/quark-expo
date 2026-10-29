package __APP_ID__;

import com.facebook.react.ReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ViewManager;

import java.util.Collections;
import java.util.List;

/** يسجّل وحدة البريد الأصلية (IMAP/SMTP) داخل التطبيق — تُضاف إلى MainApplication بواسطة plugins/withQuarkNative.js. */
public class QuarkMailPackage implements ReactPackage {
    @Override
    public List<NativeModule> createNativeModules(ReactApplicationContext ctx) {
        return Collections.<NativeModule>singletonList(new QuarkMailModule(ctx));
    }

    @Override
    public List<ViewManager> createViewManagers(ReactApplicationContext ctx) {
        return Collections.<ViewManager>emptyList();
    }
}
