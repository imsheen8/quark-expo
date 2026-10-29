import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { gwHealth, mailTest, nativeMail } from '../../src/api/gateway';
import { guessPreset, isEmail, MAIL_PRESETS, type MailAccount } from '../../src/api/mailCore';
import { Button, Field, Group, IconButton, Row, Screen, Sheet, T } from '../../src/components/ui/kit';
import { toast } from '../../src/store/data';
import { useMail } from '../../src/store/features';
import { useSettings } from '../../src/store/settings';

const blank = (): Omit<MailAccount, 'id'> => ({ label: '', email: '', imapHost: '', imapPort: 993, smtpHost: '', smtpPort: 465, user: '', pass: '', ssl: true });

export default function MailSettings() {
  const gw = useSettings((s) => s.gw);
  const patch = useSettings((s) => s.patch);
  const { accounts, addAccount, updateAccount, removeAccount } = useMail();
  const [ed, setEd] = useState<(Omit<MailAccount, 'id'> & { id?: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const checkGw = async () => {
    setBusy(true);
    try { const h = await gwHealth(); toast(`البوابة تعمل (v${h.version ?? '?'})`); } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  const onEmail = (t: string) => {
    const pr = guessPreset(t);
    setEd((p) => ({ ...p!, email: t, user: p!.user || t, ...(pr && !p!.imapHost ? MAIL_PRESETS[pr] : {}) }));
  };
  const save = async () => {
    if (!ed || !isEmail(ed.email) || !ed.imapHost || !ed.pass) return toast('أكمل البريد وكلمة المرور وخادم IMAP');
    const a = { ...ed, label: ed.label || ed.email };
    setBusy(true);
    try {
      const t = await mailTest({ ...a, id: 'x' });
      if (!t.imap) throw new Error('فشل الاتصال بـ IMAP');
      if (t.smtp === false) toast('IMAP يعمل لكن SMTP فشل: ' + (t.smtp_error || ''));
      if (ed.id) updateAccount(ed.id, a); else addAccount(a);
      setEd(null);
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
    setBusy(false);
  };
  return (
    <Screen title="البريد" right={<IconButton name="plus" label="حساب" onPress={() => setEd(blank())} />}>
      {nativeMail() ? (
        <T size={13} color="text2">البريد مدمج في التطبيق ويتصل بخادم بريدك مباشرة (IMAP/SMTP) دون أي بوابة أو خادم وسيط. أضف حسابك أدناه. بالنسبة لـ Gmail وiCloud وYahoo استخدم «كلمة مرور التطبيق» لا كلمة المرور العادية.</T>
      ) : (
        <>
          <T size={13} color="text2">هذه النسخة لا تحوي وحدة البريد المدمجة (تعمل على نسخة أندرويد المبنية بـ APK)، لذلك يمرّ البريد عبر بوابة QUARK خارجية. ضع عنوانها هنا، ورمزها إن وُجد. بالنسبة لـ Gmail استخدم «كلمة مرور التطبيق».</T>
          <Group title="البوابة">
            <View style={{ padding: 12, gap: 10 }}>
              <Field label="عنوان البوابة" ltr placeholder="http://127.0.0.1:8080" autoCapitalize="none" value={gw.url} onChangeText={(t) => patch({ gw: { ...gw, url: t } })} />
              <Field label="الرمز (اختياري)" ltr secureTextEntry value={gw.token} onChangeText={(t) => patch({ gw: { ...gw, token: t } })} />
              <Button title="اختبار البوابة" kind="soft" onPress={checkGw} loading={busy} />
            </View>
          </Group>
        </>
      )}
      <Group title="الحسابات">
        {accounts.map((a) => <Row key={a.id} icon="mail" title={a.label} sub={a.email} onPress={() => setEd(a)} />)}
        <Row icon="plus" title="إضافة حساب" onPress={() => setEd(blank())} />
      </Group>
      <Sheet visible={!!ed} onClose={() => setEd(null)} title="حساب بريد" full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
          <Field label="البريد" ltr autoCapitalize="none" keyboardType="email-address" value={ed?.email ?? ''} onChangeText={onEmail} />
          <Field label="اسم الحساب" value={ed?.label ?? ''} onChangeText={(t) => setEd({ ...ed!, label: t })} />
          <Field label="المستخدم" ltr autoCapitalize="none" value={ed?.user ?? ''} onChangeText={(t) => setEd({ ...ed!, user: t })} />
          <Field label="كلمة المرور / كلمة مرور التطبيق" ltr secureTextEntry value={ed?.pass ?? ''} onChangeText={(t) => setEd({ ...ed!, pass: t })} />
          <Field label="خادم IMAP" ltr autoCapitalize="none" value={ed?.imapHost ?? ''} onChangeText={(t) => setEd({ ...ed!, imapHost: t })} />
          <Field label="منفذ IMAP" ltr keyboardType="number-pad" value={String(ed?.imapPort ?? 993)} onChangeText={(t) => setEd({ ...ed!, imapPort: +t || 993 })} />
          <Field label="خادم SMTP" ltr autoCapitalize="none" value={ed?.smtpHost ?? ''} onChangeText={(t) => setEd({ ...ed!, smtpHost: t })} />
          <Field label="منفذ SMTP" ltr keyboardType="number-pad" value={String(ed?.smtpPort ?? 465)} onChangeText={(t) => setEd({ ...ed!, smtpPort: +t || 465 })} />
          <Button title="اختبار وحفظ" onPress={save} loading={busy} />
          {ed?.id ? <Button title="حذف الحساب" kind="danger" onPress={() => { removeAccount(ed.id!); setEd(null); }} /> : null}
        </ScrollView>
      </Sheet>
    </Screen>
  );
}
