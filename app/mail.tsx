import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { gwConfigured, mailArchive, mailDelete, mailFolders, mailList, mailMark, mailRead, mailSend, type Folder } from '../src/api/gateway';
import { fmtMailDate, MAIL_PROMPTS, displayName, parseAddr, quoteBody, replySubject, splitRecipients, validateCompose, type MailFull, type MailHead } from '../src/api/mailCore';
import { ask } from '../src/api/engines';
import { Markdown } from '../src/components/chat/Markdown';
import { Button, Chip, Empty, Field, IconButton, Screen, Sheet, T } from '../src/components/ui/kit';
import { toast } from '../src/store/data';
import { useMail } from '../src/store/features';
import { useColors } from '../src/theme';

type Full = Awaited<ReturnType<typeof mailRead>>;

export default function MailScreen() {
  const c = useColors();
  const r = useRouter();
  const { accounts, activeId, setActive, folder, setFolder, cache, setCache, addContacts, contacts } = useMail();
  const acct = accounts.find((a) => a.id === activeId) ?? accounts[0];
  const [folders, setFolders] = useState<Folder[]>([]);
  const [rows, setRows] = useState<MailHead[]>([]);
  const [q, setQ] = useState('');
  const [unread, setUnread] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState<Full | null>(null);
  const [ai, setAi] = useState<{ title: string; text: string; busy: boolean } | null>(null);
  const [comp, setComp] = useState<{ to: string; subject: string; text: string; reply?: Full } | null>(null);
  const key = acct ? acct.id + '|' + folder : '';

  const load = useCallback(async () => {
    if (!acct) return;
    setLoading(true); setErr('');
    try {
      const l = await mailList(acct, { folder, q, filter: unread ? 'unread' : 'all' });
      setRows(l.rows);
      if (!q && !unread) setCache(key, l.rows);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    setLoading(false);
  }, [acct, folder, q, unread, key, setCache]);

  useEffect(() => { setRows(cache[key] ?? []); }, [key]);
  useEffect(() => { void load(); }, [acct?.id, folder, unread]);
  useEffect(() => { if (acct && gwConfigured()) mailFolders(acct).then(setFolders).catch(() => {}); }, [acct?.id]);

  const open = async (h: MailHead) => {
    if (!acct) return;
    try { setMsg(await mailRead(acct, folder, h.uid)); setRows((p) => p.map((x) => (x.uid === h.uid ? { ...x, seen: true } : x))); } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  };
  const runAI = async (kind: 'summarize' | 'translate') => {
    if (!msg) return;
    setAi({ title: kind === 'summarize' ? 'ملخص' : 'ترجمة', text: '', busy: true });
    try { setAi({ title: kind === 'summarize' ? 'ملخص' : 'ترجمة', text: await ask(MAIL_PROMPTS[kind](msg as MailFull)), busy: false }); } catch (e) { setAi({ title: 'خطأ', text: e instanceof Error ? e.message : String(e), busy: false }); }
  };
  const draftReply = async () => {
    if (!msg) return;
    setComp({ to: msg.replyTo, subject: replySubject(msg.subject), text: '', reply: msg });
    setMsg(null);
    try { const t = await ask(MAIL_PROMPTS.reply(msg as MailFull, ''), '', undefined, undefined, 1200); setComp((p) => (p ? { ...p, text: t + quoteBody(msg.from, msg.date, msg.body) } : p)); } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  };
  const act = async (fn: 'delete' | 'archive' | 'unread') => {
    if (!acct || !msg) return;
    try {
      if (fn === 'delete') await mailDelete(acct, folder, [msg.uid]); else if (fn === 'archive') await mailArchive(acct, folder, [msg.uid]); else await mailMark(acct, folder, [msg.uid], 'unread');
      setRows((p) => p.filter((x) => x.uid !== msg.uid || fn === 'unread'));
      setMsg(null);
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  };
  const send = async () => {
    if (!acct || !comp) return;
    const bad = validateCompose(comp.to, comp.subject, comp.text);
    if (bad) return toast(bad);
    try {
      await mailSend(acct, { to: splitRecipients(comp.to), subject: comp.subject, text: comp.text, inReplyTo: comp.reply?.msgid, references: comp.reply ? `${comp.reply.references} ${comp.reply.msgid}`.trim() : undefined, replyUid: comp.reply?.uid, replyFolder: folder });
      addContacts(splitRecipients(comp.to).map((x) => parseAddr(x).email));
      toast('أُرسلت الرسالة');
      setComp(null);
    } catch (e) { toast(e instanceof Error ? e.message : String(e)); }
  };

  if (!gwConfigured() || !acct) return (
    <Screen title="البريد" menu>
      <Empty icon="mail" title="البريد غير مُعدّ" sub="يحتاج بوابة QUARK (بايثون) وحساب IMAP/SMTP" />
      <Button title="إعداد البريد" onPress={() => r.push('/settings/mail')} />
    </Screen>
  );
  return (
    <Screen title="البريد" menu scroll={false} pad={false} right={<><IconButton name="edit" label="رسالة جديدة" onPress={() => setComp({ to: '', subject: '', text: '' })} /><IconButton name="settings" label="إعدادات" onPress={() => r.push('/settings/mail')} /></>}>
      <View style={{ padding: 12, gap: 8 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {accounts.length > 1 ? accounts.map((a) => <Chip key={a.id} icon="user" label={a.label} active={a.id === acct.id} onPress={() => setActive(a.id)} />) : null}
          {(folders.length ? folders : [{ name: 'INBOX', label: 'الوارد', role: 'inbox' }]).map((f) => <Chip key={f.name} label={f.role === 'inbox' ? 'الوارد' : f.label} active={f.name === folder} onPress={() => setFolder(f.name)} />)}
          <Chip icon="eye-off" label="غير المقروء" active={unread} onPress={() => setUnread(!unread)} />
        </ScrollView>
        <Field placeholder="بحث…" value={q} onChangeText={setQ} onSubmitEditing={load} returnKeyType="search" />
      </View>
      {err ? <T size={13} color="danger" style={{ padding: 12 }}>{err}</T> : null}
      <FlatList
        data={rows}
        keyExtractor={(m) => m.uid}
        refreshing={loading}
        onRefresh={load}
        ListEmptyComponent={loading ? <ActivityIndicator color={c.accent} style={{ marginTop: 40 }} /> : <Empty icon="inbox" title="لا رسائل" />}
        renderItem={({ item }) => (
          <Pressable onPress={() => open(item)} style={({ pressed }) => ({ padding: 14, gap: 3, borderBottomWidth: 1, borderBottomColor: c.border, backgroundColor: pressed ? c.surface2 : 'transparent' })}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <T size={14} weight={item.seen ? 'regular' : 'bold'} numberOfLines={1} style={{ flex: 1 }}>{displayName(item.from)}</T>
              <T size={11.5} color="muted">{fmtMailDate(item.date)}</T>
            </View>
            <T size={13} weight={item.seen ? 'regular' : 'medium'} color={item.seen ? 'text2' : 'text'} numberOfLines={1}>{item.subject}</T>
          </Pressable>
        )}
      />

      <Sheet visible={!!msg} onClose={() => setMsg(null)} title={msg?.subject} full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          <T size={12.5} color="text2" selectable>من: {msg?.from}{'\n'}إلى: {msg?.to}{msg?.cc ? '\nنسخة: ' + msg.cc : ''}{'\n'}{msg ? new Date(msg.date).toLocaleString('ar') : ''}</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Chip icon="corner-up-left" label="رد" onPress={() => msg && (setComp({ to: msg.replyTo, subject: replySubject(msg.subject), text: quoteBody(msg.from, msg.date, msg.body), reply: msg }), setMsg(null))} />
            <Chip icon="zap" label="رد ذكي" onPress={draftReply} />
            <Chip icon="align-left" label="لخّص" onPress={() => runAI('summarize')} />
            <Chip icon="globe" label="ترجم" onPress={() => runAI('translate')} />
            <Chip icon="archive" label="أرشفة" onPress={() => act('archive')} />
            <Chip icon="trash-2" label="حذف" onPress={() => act('delete')} />
          </View>
          {msg?.attachments?.length ? <T size={12} color="muted">مرفقات: {msg.attachments.map((a) => a.name).join('، ')}</T> : null}
          <T size={14.5} selectable style={{ lineHeight: 24 }}>{msg?.body}</T>
        </ScrollView>
      </Sheet>
      <Sheet visible={!!ai} onClose={() => setAi(null)} title={ai?.title}>
        <ScrollView contentContainerStyle={{ padding: 16 }}>{ai?.busy ? <ActivityIndicator color={c.accent} /> : <Markdown text={ai?.text ?? ''} />}</ScrollView>
      </Sheet>
      <Sheet visible={!!comp} onClose={() => setComp(null)} title="رسالة جديدة" full>
        <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
          <Field label="إلى" ltr autoCapitalize="none" value={comp?.to ?? ''} onChangeText={(t) => setComp({ ...comp!, to: t })} />
          {comp && comp.to && !comp.to.includes('@') ? <ScrollView horizontal>{contacts.filter((x) => x.includes(comp.to)).slice(0, 5).map((x) => <Chip key={x} label={x} onPress={() => setComp({ ...comp, to: x })} />)}</ScrollView> : null}
          <Field label="الموضوع" value={comp?.subject ?? ''} onChangeText={(t) => setComp({ ...comp!, subject: t })} />
          <Field label="النص" multiline style={{ minHeight: 220 }} value={comp?.text ?? ''} onChangeText={(t) => setComp({ ...comp!, text: t })} />
          <Button title="إرسال" icon="send" onPress={send} />
        </ScrollView>
      </Sheet>
    </Screen>
  );
}
