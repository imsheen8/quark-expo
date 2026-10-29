/* توقيع نسخة release بمفتاح ثابت إن وُجدت متغيرات البيئة التالية (تُضبط من أسرار GitHub)، وإلا يبقى توقيع debug القياسي:
   QUARK_KEYSTORE_FILE (مسار ملف .jks) · QUARK_KEYSTORE_PASSWORD · QUARK_KEY_ALIAS · QUARK_KEY_PASSWORD */
const { withAppBuildGradle } = require('@expo/config-plugins');

const MARK = '// quark-signing';
const BLOCK = `
${MARK}
def qkFile = System.getenv("QUARK_KEYSTORE_FILE")
if (qkFile) {
    android {
        signingConfigs {
            quarkRelease {
                storeFile file(qkFile)
                storePassword System.getenv("QUARK_KEYSTORE_PASSWORD")
                keyAlias System.getenv("QUARK_KEY_ALIAS")
                keyPassword System.getenv("QUARK_KEY_PASSWORD")
            }
        }
        buildTypes {
            release {
                signingConfig signingConfigs.quarkRelease
            }
        }
    }
}
`;

module.exports = (config) =>
  withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.language !== 'groovy') throw new Error('quark-signing: يتوقع build.gradle بصيغة Groovy');
    if (!cfg.modResults.contents.includes(MARK)) cfg.modResults.contents += '\n' + BLOCK;
    return cfg;
  });
