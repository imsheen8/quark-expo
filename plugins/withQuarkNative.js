/* إضافة Expo: تولّد عند `expo prebuild` ودجتات الشاشة الرئيسية (4×2 و2×2) واختصارات الأيقونة (الضغط المطوّل)
   وبلاطة الإعدادات السريعة. كل زر يفتح رابطًا عميقًا quarkai://a/<action> يعالجه مسار app/a/[action].tsx. */
const { withAndroidManifest, withDangerousMod, withMainApplication, withAppBuildGradle } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'quark-native');

function copyDir(from, to, map) {
  fs.mkdirSync(to, { recursive: true });
  for (const f of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, f.name), b = path.join(to, f.name);
    if (f.isDirectory()) copyDir(a, b, map);
    else fs.writeFileSync(b, map(fs.readFileSync(a, 'utf8')));
  }
}

function withFiles(config) {
  return withDangerousMod(config, ['android', async (cfg) => {
    const id = cfg.android && cfg.android.package;
    if (!id) throw new Error('quark-native: android.package غير مضبوط في app.json');
    const sub = (s) => s.replace(/__APP_ID__/g, id);
    const root = cfg.modRequest.platformProjectRoot;
    const main = path.join(root, 'app/src/main');
    copyDir(path.join(SRC, 'java'), path.join(main, 'java', ...id.split('.')), sub);
    copyDir(path.join(SRC, 'res'), path.join(main, 'res'), sub);
    return cfg;
  }]);
}

const has = (arr, name) => (arr || []).some((x) => x.$ && x.$['android:name'] === name);

function widgetReceiver(name, xml) {
  return {
    $: { 'android:name': name, 'android:exported': 'true', 'android:label': '@string/quark_widget_name' },
    'intent-filter': [{ action: [{ $: { 'android:name': 'android.appwidget.action.APPWIDGET_UPDATE' } }] }],
    'meta-data': [{ $: { 'android:name': 'android.appwidget.provider', 'android:resource': '@xml/' + xml } }],
  };
}

function withManifest(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application[0];
    app.receiver = app.receiver || [];
    app.service = app.service || [];
    if (!has(app.receiver, '.QuarkWidget')) app.receiver.push(widgetReceiver('.QuarkWidget', 'quark_widget_info'));
    if (!has(app.receiver, '.QuarkWidget2')) app.receiver.push(widgetReceiver('.QuarkWidget2', 'quark_widget_small_info'));
    if (!has(app.service, '.QuarkTileService')) {
      app.service.push({
        $: {
          'android:name': '.QuarkTileService', 'android:exported': 'true', 'android:label': '@string/tile_label',
          'android:icon': '@drawable/ic_stat_quark', 'android:permission': 'android.permission.BIND_QUICK_SETTINGS_TILE',
        },
        'intent-filter': [{ action: [{ $: { 'android:name': 'android.service.quicksettings.action.QS_TILE' } }] }],
      });
    }
    const main = (app.activity || []).find((a) => a.$['android:name'] === '.MainActivity');
    if (main) {
      main['meta-data'] = main['meta-data'] || [];
      if (!has(main['meta-data'], 'android.app.shortcuts')) {
        main['meta-data'].push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/quark_shortcuts' } });
      }
    }
    return cfg;
  });
}

/* البريد المدمج (IMAP/SMTP): تسجيل الحزمة في MainApplication + مكتبة JavaMail لأندرويد في Gradle */
function withMailPackage(config) {
  return withMainApplication(config, (cfg) => {
    const src = cfg.modResults.contents;
    if (!src.includes('QuarkMailPackage')) {
      const re = /PackageList\(this\)\.packages\.apply\s*\{/;
      if (!re.test(src)) throw new Error('quark-native: تعذّر العثور على PackageList في MainApplication — حدّث withMailPackage');
      cfg.modResults.contents = src.replace(re, (m) => m + '\n          add(QuarkMailPackage())');
    }
    return cfg;
  });
}

function withMailGradle(config) {
  return withAppBuildGradle(config, (cfg) => {
    let g = cfg.modResults.contents;
    if (!g.includes('android-mail')) {
      g = g.replace(/^dependencies\s*\{/m, (m) => m + "\n    implementation 'com.sun.mail:android-mail:1.6.7'\n    implementation 'com.sun.mail:android-activation:1.6.7'");
    }
    if (!g.includes('quark-mail-excludes')) {
      g = g.replace(/^android\s*\{/m, (m) => m + "\n    // quark-mail-excludes: ملفات ترخيص مكررة داخل مكتبات JavaMail\n    packagingOptions {\n        resources {\n            excludes += ['META-INF/LICENSE*', 'META-INF/NOTICE*', 'META-INF/DEPENDENCIES', 'META-INF/*.kotlin_module']\n        }\n    }");
    }
    cfg.modResults.contents = g;
    return cfg;
  });
}

module.exports = (config) => withMailGradle(withMailPackage(withManifest(withFiles(config))));
