package __APP_ID__;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** جسر JS ← جافا: NativeModules.QuarkMail.call(path, jsonBody) يعيد JSON نصيًا بنفس صيغة بوابة البريد. */
public class QuarkMailModule extends ReactContextBaseJavaModule {
    private static final ExecutorService POOL = Executors.newCachedThreadPool();

    public QuarkMailModule(ReactApplicationContext ctx) {
        super(ctx);
    }

    @Override
    public String getName() {
        return "QuarkMail";
    }

    @ReactMethod
    public void call(final String path, final String body, final Promise promise) {
        POOL.execute(new Runnable() {
            @Override
            public void run() {
                try {
                    promise.resolve(QuarkMailCore.call(path, body));
                } catch (Throwable t) {
                    promise.reject("E_MAIL", QuarkMailCore.explain(t), t);
                }
            }
        });
    }
}
