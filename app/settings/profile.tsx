import { Field, Screen, T } from '../../src/components/ui/kit';
import { useSettings } from '../../src/store/settings';

export default function Profile() {
  const { profile, patch } = useSettings();
  const set = (p: Partial<typeof profile>) => patch({ profile: { ...profile, ...p } });
  return (
    <Screen title="الملف الشخصي">
      <T size={13} color="muted">تُرسل هذه المعلومات للنموذج ضمن التعليمات ليخاطبك بالطريقة التي تفضّلها. تبقى على جهازك.</T>
      <Field label="الاسم" value={profile.name} onChangeText={(t) => set({ name: t })} autoCapitalize="words" />
      <Field label="اللقب / الاسم المفضّل" value={profile.nick} onChangeText={(t) => set({ nick: t })} />
    </Screen>
  );
}
