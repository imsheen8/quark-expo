import * as ImagePicker from 'expo-image-picker';
import { Image, Pressable, View } from 'react-native';
import { Button, Field, Icon, Screen, T } from '../../src/components/ui/kit';
import { deleteImages, saveImage } from '../../src/lib/images';
import { toast } from '../../src/store/data';
import { useSettings } from '../../src/store/settings';
import { useColors } from '../../src/theme';

export default function Profile() {
  const c = useColors();
  const { profile, patch } = useSettings();
  const set = (p: Partial<typeof profile>) => patch({ profile: { ...useSettings.getState().profile, ...p } });

  const dropOld = () => { const old = useSettings.getState().profile.avatar; if (old) void deleteImages([{ id: '', mime: '', uri: old }]); };

  const pick = async () => {
    try {
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true, allowsEditing: true, aspect: [1, 1] });
      if (r.canceled) return;
      const a = r.assets[0];
      if (!a.base64) return toast('تعذّر قراءة الصورة');
      const ref = await saveImage(a.base64, a.mimeType || 'image/jpeg');
      dropOld();
      set({ avatar: ref.uri });
    } catch {
      toast('تعذّر اختيار الصورة');
    }
  };
  const remove = () => { dropOld(); set({ avatar: undefined }); };

  return (
    <Screen title="الملف الشخصي">
      <View style={{ alignItems: 'center', gap: 12 }}>
        <Pressable onPress={pick} accessibilityLabel="تغيير الصورة" style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: c.surface2, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1, borderColor: c.border }}>
          {profile.avatar ? <Image source={{ uri: profile.avatar }} style={{ width: 96, height: 96 }} /> : <Icon name="user" size={40} color={c.text2} />}
        </Pressable>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button small kind="soft" icon="image" title={profile.avatar ? 'تغيير الصورة' : 'رفع صورة'} onPress={pick} />
          {profile.avatar ? <Button small kind="danger" title="إزالة" onPress={remove} /> : null}
        </View>
      </View>
      <T size={13} color="muted">تُرسل هذه المعلومات للنموذج ضمن التعليمات ليخاطبك بالطريقة التي تفضّلها. تبقى على جهازك، والصورة تظهر في الشريط الجانبي فقط.</T>
      <Field label="الاسم" value={profile.name} onChangeText={(t) => set({ name: t })} autoCapitalize="words" />
      <Field label="اللقب / الاسم المفضّل" value={profile.nick} onChangeText={(t) => set({ nick: t })} />
    </Screen>
  );
}
