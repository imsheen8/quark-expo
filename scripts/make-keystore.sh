#!/usr/bin/env bash
# ينشئ مفتاح توقيع ثابتًا ويطبع القيم الأربع لأسرار GitHub. شغّله مرة واحدة واحتفظ بالملف وكلمة السر:
# إن ضاع المفتاح فلن تستطيع تحديث التطبيق فوق النسخة المثبتة.
# الاستعمال:  bash scripts/make-keystore.sh [اسم_المستعار] [كلمة_السر]
set -euo pipefail
command -v keytool >/dev/null || { echo "keytool غير موجود. في Termux: pkg install openjdk-17"; exit 1; }
ALIAS="${1:-quark}"
PASS="${2:-$(head -c 24 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 20)}"
OUT="quark-release.jks"
[ -e "$OUT" ] && { echo "الملف $OUT موجود أصلًا؛ لن أستبدله. انقله أو احذفه أولًا."; exit 1; }
keytool -genkeypair -v -storetype PKCS12 -keystore "$OUT" -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=QUARK AI, O=Krazos, C=IQ" >/dev/null 2>&1
echo "تم إنشاء $OUT"
echo
echo "أضف هذه الأسرار في GitHub: Settings ← Secrets and variables ← Actions ← New repository secret"
echo "  ANDROID_KEY_ALIAS         = $ALIAS"
echo "  ANDROID_KEYSTORE_PASSWORD = $PASS"
echo "  ANDROID_KEY_PASSWORD      = $PASS"
echo "  ANDROID_KEYSTORE_BASE64   = (القيمة الطويلة في الملف quark-release.jks.b64)"
base64 -w0 "$OUT" > "$OUT.b64" 2>/dev/null || base64 "$OUT" | tr -d '\n' > "$OUT.b64"
echo
echo "افتح $OUT.b64 وانسخ محتواه كاملًا (سطر واحد) كقيمة ANDROID_KEYSTORE_BASE64."
echo "احفظ $OUT وكلمة السر في مكان آمن خارج المستودع (لا ترفعهما إلى GitHub)."
