package __APP_ID__;

import com.sun.mail.imap.IMAPFolder;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.SocketTimeoutException;
import java.net.UnknownHostException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Properties;
import java.util.TimeZone;
import java.util.UUID;

import javax.mail.AuthenticationFailedException;
import javax.mail.FetchProfile;
import javax.mail.Flags;
import javax.mail.Folder;
import javax.mail.Message;
import javax.mail.MessagingException;
import javax.mail.Multipart;
import javax.mail.Part;
import javax.mail.Session;
import javax.mail.Store;
import javax.mail.Transport;
import javax.mail.UIDFolder;
import javax.mail.internet.InternetAddress;
import javax.mail.internet.MimeMessage;
import javax.mail.internet.MimeUtility;
import javax.mail.search.AndTerm;
import javax.mail.search.BodyTerm;
import javax.mail.search.FlagTerm;
import javax.mail.search.FromStringTerm;
import javax.mail.search.OrTerm;
import javax.mail.search.RecipientStringTerm;
import javax.mail.search.SearchTerm;
import javax.mail.search.SubjectTerm;

/**
 * منطق البريد داخل التطبيق (IMAP/SMTP عبر JavaMail لأندرويد) — يطابق عقد بوابة بايثون القديمة:
 * call("mail/<op>", jsonBody) ← JSON نصي. لا خادم وسيط ولا منفذ خارجي.
 */
final class QuarkMailCore {
    private QuarkMailCore() {}

    /* ---------------- مدخل ---------------- */

    static String call(String path, String body) throws Exception {
        JSONObject in = new JSONObject(body == null || body.isEmpty() ? "{}" : body);
        JSONObject a = in.optJSONObject("acct");
        switch (path) {
            case "health": return new JSONObject().put("ok", true).put("version", "native").put("token", false).toString();
            case "mail/test": return test(a).toString();
            case "mail/folders": return folders(a).toString();
            case "mail/list": return list(a, in).toString();
            case "mail/read": return read(a, in).toString();
            case "mail/send": return send(a, in).toString();
            case "mail/draft": return draft(a, in).toString();
            case "mail/mark": return mark(a, in).toString();
            case "mail/delete": return delete(a, in).toString();
            case "mail/archive": return archive(a, in).toString();
            default: throw new IllegalArgumentException("عملية بريد غير معروفة: " + path);
        }
    }

    /** رسالة خطأ عربية مفهومة */
    static String explain(Throwable t) {
        Throwable c = t;
        for (int i = 0; i < 6 && c != null; i++, c = c.getCause()) {
            if (c instanceof AuthenticationFailedException) return "فشل تسجيل الدخول: تحقّق من البريد وكلمة المرور (Gmail وiCloud وYahoo يتطلبون «كلمة مرور التطبيق»). " + safe(c.getMessage());
            if (c instanceof UnknownHostException) return "تعذّر العثور على الخادم «" + safe(c.getMessage()) + "». تحقّق من اسم الخادم ومن الإنترنت.";
            if (c instanceof SocketTimeoutException) return "انتهت مهلة الاتصال بالخادم. تحقّق من الإنترنت أو من المنفذ.";
            if (c instanceof ConnectException) return "رفض الخادم الاتصال. تحقّق من المنفذ ونوع التشفير (SSL/STARTTLS).";
            if (c instanceof javax.net.ssl.SSLException) return "فشل التشفير (SSL): " + safe(c.getMessage()) + ". جرّب تبديل SSL/STARTTLS أو المنفذ.";
        }
        String m = t.getMessage();
        return m == null || m.isEmpty() ? t.getClass().getSimpleName() : m;
    }

    private static String safe(String s) { return s == null ? "" : s; }

    /* ---------------- جلسات واتصال ---------------- */

    private static Session imapSession(JSONObject a) {
        String sec = a.optString("imap_sec", "ssl");
        String proto = "ssl".equals(sec) ? "imaps" : "imap";
        String pre = "mail." + proto + ".";
        Properties p = new Properties();
        p.put("mail.store.protocol", proto);
        p.put(pre + "connectiontimeout", "15000");
        p.put(pre + "timeout", "40000");
        p.put(pre + "writetimeout", "40000");
        p.put(pre + "peek", "true"); // قراءة المحتوى لا تضع علامة «مقروء» تلقائيًا
        if ("ssl".equals(sec)) p.put(pre + "ssl.checkserveridentity", "true");
        if ("starttls".equals(sec)) {
            p.put(pre + "starttls.enable", "true");
            p.put(pre + "starttls.required", "true");
            p.put(pre + "ssl.checkserveridentity", "true");
        }
        return Session.getInstance(p);
    }

    private static Store openStore(JSONObject a) throws MessagingException {
        Session s = imapSession(a);
        Store st = s.getStore();
        st.connect(a.optString("imap_host"), a.optInt("imap_port", 993), a.optString("user"), a.optString("pass"));
        return st;
    }

    private static Session smtpSession(JSONObject a) {
        String sec = a.optString("smtp_sec", "ssl");
        Properties p = new Properties();
        for (String pre : new String[]{"mail.smtp.", "mail.smtps."}) {
            p.put(pre + "auth", "true");
            p.put(pre + "connectiontimeout", "15000");
            p.put(pre + "timeout", "40000");
            p.put(pre + "writetimeout", "40000");
            p.put(pre + "localhost", "localhost");
            if ("starttls".equals(sec)) {
                p.put(pre + "starttls.enable", "true");
                p.put(pre + "starttls.required", "true");
            }
            if (!"none".equals(sec)) p.put(pre + "ssl.checkserveridentity", "true");
        }
        return Session.getInstance(p);
    }

    private static Transport openTransport(Session s, JSONObject a) throws MessagingException {
        Transport t = s.getTransport("ssl".equals(a.optString("smtp_sec", "ssl")) ? "smtps" : "smtp");
        t.connect(a.optString("smtp_host"), a.optInt("smtp_port", 465), a.optString("user"), a.optString("pass"));
        return t;
    }

    private static IMAPFolder open(Store st, String name, boolean write) throws MessagingException {
        IMAPFolder f = (IMAPFolder) st.getFolder(name == null || name.isEmpty() ? "INBOX" : name);
        if (!f.exists()) throw new MessagingException("المجلد غير موجود: " + name);
        f.open(write ? Folder.READ_WRITE : Folder.READ_ONLY);
        return f;
    }

    private static void closeQuietly(Folder f) { try { if (f != null && f.isOpen()) f.close(false); } catch (Exception ignored) {} }
    private static void closeQuietly(Store s) { try { if (s != null) s.close(); } catch (Exception ignored) {} }

    /* ---------------- المجلدات والأدوار ---------------- */

    private static String roleOf(IMAPFolder f) throws MessagingException {
        String full = f.getFullName();
        if ("INBOX".equalsIgnoreCase(full)) return "inbox";
        for (String at : f.getAttributes()) {
            String x = at.toLowerCase(Locale.ROOT);
            if (x.equals("\\sent")) return "sent";
            if (x.equals("\\drafts")) return "drafts";
            if (x.equals("\\trash")) return "trash";
            if (x.equals("\\junk")) return "junk";
            if (x.equals("\\archive")) return "archive";
            if (x.equals("\\all")) return "all";
            if (x.equals("\\flagged")) return "flagged";
            if (x.equals("\\important")) return "important";
        }
        String n = f.getName().toLowerCase(Locale.ROOT);
        if (n.equals("sent") || n.equals("sent items") || n.equals("sent mail") || n.equals("sent messages")) return "sent";
        if (n.equals("drafts") || n.equals("draft")) return "drafts";
        if (n.equals("trash") || n.equals("deleted items") || n.equals("deleted messages") || n.equals("bin")) return "trash";
        if (n.equals("junk") || n.equals("spam") || n.equals("junk email") || n.equals("junk e-mail") || n.equals("bulk mail")) return "junk";
        if (n.equals("archive") || n.equals("archives")) return "archive";
        return "";
    }

    private static String roleLabel(String role, String fallback) {
        switch (role) {
            case "inbox": return "الوارد";
            case "sent": return "المرسلة";
            case "drafts": return "المسودات";
            case "trash": return "المحذوفات";
            case "junk": return "المزعجة";
            case "archive": return "الأرشيف";
            case "all": return "كل البريد";
            case "flagged": return "المميّزة";
            case "important": return "المهمة";
            default: return fallback;
        }
    }

    private static int roleRank(String role) {
        List<String> order = Arrays.asList("inbox", "sent", "drafts", "archive", "all", "junk", "trash");
        int i = order.indexOf(role);
        return i < 0 ? 99 : i;
    }

    /** يحصر المجلدات القابلة للقراءة مع أدوارها */
    private static List<IMAPFolder> listFolders(Store st) throws MessagingException {
        List<IMAPFolder> out = new ArrayList<>();
        for (Folder f : st.getDefaultFolder().list("*")) {
            if ((f.getType() & Folder.HOLDS_MESSAGES) == 0) continue;
            out.add((IMAPFolder) f);
        }
        return out;
    }

    private static Map<String, String> roleMap(Store st) throws MessagingException {
        Map<String, String> m = new HashMap<>();
        for (IMAPFolder f : listFolders(st)) {
            String r = roleOf(f);
            if (!r.isEmpty() && !m.containsKey(r)) m.put(r, f.getFullName());
        }
        m.put("inbox", "INBOX");
        return m;
    }

    private static boolean isGmail(JSONObject a) { return a.optString("imap_host").toLowerCase(Locale.ROOT).contains("gmail") || a.optString("imap_host").toLowerCase(Locale.ROOT).contains("googlemail"); }

    /* ---------------- العمليات ---------------- */

    private static JSONObject test(JSONObject a) throws Exception {
        Store st = openStore(a);
        closeQuietly(st);
        JSONObject r = new JSONObject().put("imap", true);
        if (a.optString("smtp_host").isEmpty()) return r.put("smtp", JSONObject.NULL);
        try {
            Transport t = openTransport(smtpSession(a), a);
            t.close();
            r.put("smtp", true);
        } catch (Exception e) {
            r.put("smtp", false).put("smtp_error", explain(e));
        }
        return r;
    }

    private static JSONObject folders(JSONObject a) throws Exception {
        Store st = openStore(a);
        try {
            List<JSONObject> rows = new ArrayList<>();
            final Map<String, Integer> rank = new HashMap<>();
            for (IMAPFolder f : listFolders(st)) {
                String role = roleOf(f);
                if ("flagged".equals(role) || "important".equals(role)) continue;
                int unseen = -1, total = -1;
                try { unseen = f.getUnreadMessageCount(); total = f.getMessageCount(); } catch (Exception ignored) {}
                String delim = "";
                try { delim = String.valueOf(f.getSeparator()); } catch (Exception ignored) {}
                JSONObject o = new JSONObject().put("name", f.getFullName()).put("label", roleLabel(role, f.getName())).put("role", role).put("delim", delim);
                if (unseen >= 0) o.put("unseen", unseen);
                if (total >= 0) o.put("total", total);
                rows.add(o);
                rank.put(f.getFullName(), roleRank(role));
            }
            Collections.sort(rows, new java.util.Comparator<JSONObject>() {
                @Override public int compare(JSONObject x, JSONObject y) {
                    int c = rank.get(x.optString("name")) - rank.get(y.optString("name"));
                    return c != 0 ? c : x.optString("label").compareToIgnoreCase(y.optString("label"));
                }
            });
            JSONArray arr = new JSONArray();
            for (JSONObject o : rows) arr.put(o);
            return new JSONObject().put("folders", arr);
        } finally { closeQuietly(st); }
    }

    private static JSONObject list(JSONObject a, JSONObject in) throws Exception {
        String folder = in.optString("folder", "INBOX");
        int page = Math.max(0, in.optInt("page", 0));
        int size = Math.min(100, Math.max(1, in.optInt("size", 30)));
        String q = in.optString("q", "").trim();
        String filter = in.optString("filter", "all");
        Store st = openStore(a);
        IMAPFolder f = null;
        try {
            f = open(st, folder, false);
            Message[] page_msgs;
            int total;
            if (!q.isEmpty() || !"all".equals(filter)) {
                List<SearchTerm> terms = new ArrayList<>();
                if ("unread".equals(filter)) terms.add(new FlagTerm(new Flags(Flags.Flag.SEEN), false));
                if ("flagged".equals(filter)) terms.add(new FlagTerm(new Flags(Flags.Flag.FLAGGED), true));
                if (!q.isEmpty()) terms.add(new OrTerm(new SearchTerm[]{
                        new SubjectTerm(q), new FromStringTerm(q), new RecipientStringTerm(Message.RecipientType.TO, q), new BodyTerm(q)}));
                SearchTerm t = terms.size() == 1 ? terms.get(0) : new AndTerm(terms.toArray(new SearchTerm[0]));
                Message[] found = f.search(t);
                total = found.length;
                int from = page * size, to = Math.min(total, from + size);
                List<Message> sel = new ArrayList<>();
                for (int i = total - 1 - from; i >= total - to && i >= 0; i--) sel.add(found[i]);
                page_msgs = sel.toArray(new Message[0]);
            } else {
                int n = f.getMessageCount();
                total = n;
                int end = n - page * size;
                if (end < 1) {
                    page_msgs = new Message[0];
                } else {
                    int start = Math.max(1, end - size + 1);
                    Message[] got = f.getMessages(start, end);
                    List<Message> rev = new ArrayList<>(Arrays.asList(got));
                    Collections.reverse(rev);
                    page_msgs = rev.toArray(new Message[0]);
                }
            }
            if (page_msgs.length > 0) {
                FetchProfile fp = new FetchProfile();
                fp.add(FetchProfile.Item.ENVELOPE);
                fp.add(FetchProfile.Item.FLAGS);
                fp.add(UIDFolder.FetchProfileItem.UID);
                f.fetch(page_msgs, fp);
            }
            JSONArray rows = new JSONArray();
            for (Message m : page_msgs) {
                JSONObject o = new JSONObject();
                o.put("uid", f.getUID(m));
                Address0 fr = firstAddr(m.getFrom());
                o.put("from", new JSONObject().put("name", fr.name).put("addr", fr.addr));
                o.put("to", addrList(m.getRecipients(Message.RecipientType.TO)));
                String subj = m.getSubject();
                o.put("subject", subj == null ? "" : subj);
                Date d = m.getSentDate() != null ? m.getSentDate() : m.getReceivedDate();
                o.put("date", iso(d));
                o.put("unread", !m.isSet(Flags.Flag.SEEN));
                o.put("flagged", m.isSet(Flags.Flag.FLAGGED));
                rows.put(o);
            }
            boolean more = (page + 1) * size < total;
            return new JSONObject().put("rows", rows).put("total", total).put("more", more);
        } finally { closeQuietly(f); closeQuietly(st); }
    }

    private static JSONObject read(JSONObject a, JSONObject in) throws Exception {
        String folder = in.optString("folder", "INBOX");
        long uid = in.optLong("uid");
        boolean markSeen = in.optBoolean("mark_seen", true);
        Store st = openStore(a);
        IMAPFolder f = null;
        try {
            f = open(st, folder, markSeen);
            Message m = f.getMessageByUID(uid);
            if (m == null) throw new MessagingException("الرسالة غير موجودة (ربما حُذفت).");
            Body b = new Body();
            walk(m, b);
            if (markSeen && !m.isSet(Flags.Flag.SEEN)) {
                try { m.setFlag(Flags.Flag.SEEN, true); } catch (Exception ignored) {}
            }
            JSONObject o = new JSONObject();
            Address0 fr = firstAddr(m.getFrom());
            o.put("from", new JSONObject().put("name", fr.name).put("addr", fr.addr));
            o.put("to", addrList(m.getRecipients(Message.RecipientType.TO)));
            o.put("cc", addrList(m.getRecipients(Message.RecipientType.CC)));
            o.put("reply_to", addrList(m.getReplyTo()));
            String subj = m.getSubject();
            o.put("subject", subj == null ? "" : subj);
            Date d = m.getSentDate() != null ? m.getSentDate() : m.getReceivedDate();
            o.put("date", iso(d));
            o.put("text", b.text.toString().trim());
            String html = b.html.toString();
            o.put("html", html.length() > 600000 ? html.substring(0, 600000) : html);
            String[] mid = m.getHeader("Message-ID");
            o.put("msgid", mid != null && mid.length > 0 ? mid[0] : "");
            String[] refs = m.getHeader("References");
            o.put("references", refs != null && refs.length > 0 ? refs[0].replaceAll("\\s+", " ").trim() : "");
            JSONArray at = new JSONArray();
            for (int i = 0; i < b.atts.size(); i++) at.put(b.atts.get(i));
            o.put("attachments", at);
            return o;
        } finally { closeQuietly(f); closeQuietly(st); }
    }

    private static MimeMessage compose(final Session s, JSONObject a, JSONObject in) throws Exception {
        final String from = a.optString("from");
        final String domain = from.contains("@") ? from.substring(from.indexOf('@') + 1) : "localhost";
        MimeMessage msg = new MimeMessage(s) {
            @Override protected void updateMessageID() throws MessagingException {
                setHeader("Message-ID", "<" + UUID.randomUUID().toString() + "@" + domain + ">");
            }
        };
        String display = a.optString("display");
        msg.setFrom(display.isEmpty() || display.equals(from) ? new InternetAddress(from) : new InternetAddress(from, display, "UTF-8"));
        addRecipients(msg, Message.RecipientType.TO, in.optJSONArray("to"));
        addRecipients(msg, Message.RecipientType.CC, in.optJSONArray("cc"));
        msg.setSubject(in.optString("subject", ""), "UTF-8");
        msg.setText(in.optString("text", ""), "UTF-8");
        msg.setSentDate(new Date());
        String irt = in.optString("in_reply_to", "");
        if (!irt.isEmpty()) msg.setHeader("In-Reply-To", irt);
        String refs = in.optString("references", "");
        if (!refs.isEmpty()) msg.setHeader("References", refs);
        return msg;
    }

    private static void addRecipients(MimeMessage msg, Message.RecipientType type, JSONArray arr) throws MessagingException {
        if (arr == null) return;
        for (int i = 0; i < arr.length(); i++) {
            String s = arr.optString(i, "").trim();
            if (s.isEmpty()) continue;
            msg.addRecipients(type, InternetAddress.parse(s, false));
        }
    }

    private static JSONObject send(JSONObject a, JSONObject in) throws Exception {
        Session s = smtpSession(a);
        MimeMessage msg = compose(s, a, in);
        if (msg.getAllRecipients() == null || msg.getAllRecipients().length == 0) throw new MessagingException("أضف مستلمًا واحدًا على الأقل.");
        msg.saveChanges();
        Transport t = openTransport(s, a);
        try { t.sendMessage(msg, msg.getAllRecipients()); } finally { try { t.close(); } catch (Exception ignored) {} }

        // ما بعد الإرسال: حفظ نسخة في «المرسلة» ووسم الرد — أي فشل هنا لا يُفشل الإرسال
        String smtpHost = a.optString("smtp_host").toLowerCase(Locale.ROOT);
        boolean autoSaves = smtpHost.contains("gmail") || smtpHost.contains("office365") || smtpHost.contains("outlook") || smtpHost.contains("hotmail");
        boolean save = in.optBoolean("save_sent", true) && !autoSaves;
        long replyUid = in.optLong("reply_uid", 0);
        String replyFolder = in.optString("reply_folder", "");
        if (save || (replyUid > 0 && !replyFolder.isEmpty())) {
            Store st = null;
            try {
                st = openStore(a);
                if (save) {
                    String sent = roleMap(st).get("sent");
                    if (sent != null) {
                        msg.setFlag(Flags.Flag.SEEN, true);
                        IMAPFolder sf = (IMAPFolder) st.getFolder(sent);
                        sf.appendMessages(new Message[]{msg});
                    }
                }
                if (replyUid > 0 && !replyFolder.isEmpty()) {
                    IMAPFolder rf = open(st, replyFolder, true);
                    try {
                        Message rm = rf.getMessageByUID(replyUid);
                        if (rm != null) rm.setFlag(Flags.Flag.ANSWERED, true);
                    } finally { closeQuietly(rf); }
                }
            } catch (Exception ignored) {
            } finally { closeQuietly(st); }
        }
        return new JSONObject().put("ok", true);
    }

    private static JSONObject draft(JSONObject a, JSONObject in) throws Exception {
        MimeMessage msg = compose(smtpSession(a), a, in);
        msg.saveChanges();
        Store st = openStore(a);
        try {
            String dr = roleMap(st).get("drafts");
            if (dr == null) throw new MessagingException("لا يوجد مجلد مسودات في هذا الحساب.");
            msg.setFlag(Flags.Flag.DRAFT, true);
            ((IMAPFolder) st.getFolder(dr)).appendMessages(new Message[]{msg});
        } finally { closeQuietly(st); }
        return new JSONObject().put("ok", true);
    }

    private static long[] uids(JSONObject in) {
        JSONArray u = in.optJSONArray("uids");
        long[] out = new long[u == null ? 0 : u.length()];
        for (int i = 0; i < out.length; i++) out[i] = u.optLong(i);
        return out;
    }

    private static Message[] byUids(IMAPFolder f, long[] u) throws MessagingException {
        Message[] ms = f.getMessagesByUID(u);
        List<Message> ok = new ArrayList<>();
        for (Message m : ms) if (m != null) ok.add(m);
        return ok.toArray(new Message[0]);
    }

    private static void moveTo(Store st, IMAPFolder from, Message[] ms, String dest) throws MessagingException {
        if (ms.length == 0) return;
        from.copyMessages(ms, st.getFolder(dest));
        from.setFlags(ms, new Flags(Flags.Flag.DELETED), true);
        from.expunge();
    }

    private static JSONObject mark(JSONObject a, JSONObject in) throws Exception {
        String folder = in.optString("folder", "INBOX");
        String op = in.optString("op", "read");
        Store st = openStore(a);
        IMAPFolder f = null;
        try {
            f = open(st, folder, true);
            Message[] ms = byUids(f, uids(in));
            switch (op) {
                case "read": f.setFlags(ms, new Flags(Flags.Flag.SEEN), true); break;
                case "unread": f.setFlags(ms, new Flags(Flags.Flag.SEEN), false); break;
                case "flag": f.setFlags(ms, new Flags(Flags.Flag.FLAGGED), true); break;
                case "unflag": f.setFlags(ms, new Flags(Flags.Flag.FLAGGED), false); break;
                case "spam": {
                    String junk = roleMap(st).get("junk");
                    if (junk == null) throw new MessagingException("لا يوجد مجلد للرسائل المزعجة في هذا الحساب.");
                    if (!junk.equals(f.getFullName())) moveTo(st, f, ms, junk);
                    break;
                }
                default: throw new IllegalArgumentException("إجراء غير معروف: " + op);
            }
            return new JSONObject().put("ok", true);
        } finally { closeQuietly(f); closeQuietly(st); }
    }

    private static JSONObject delete(JSONObject a, JSONObject in) throws Exception {
        String folder = in.optString("folder", "INBOX");
        Store st = openStore(a);
        IMAPFolder f = null;
        try {
            f = open(st, folder, true);
            Message[] ms = byUids(f, uids(in));
            String trash = roleMap(st).get("trash");
            if (trash == null || trash.equals(f.getFullName())) {
                // لا سلة، أو نحن داخلها: حذف نهائي
                f.setFlags(ms, new Flags(Flags.Flag.DELETED), true);
                f.expunge();
            } else {
                moveTo(st, f, ms, trash);
            }
            return new JSONObject().put("ok", true);
        } finally { closeQuietly(f); closeQuietly(st); }
    }

    private static JSONObject archive(JSONObject a, JSONObject in) throws Exception {
        String folder = in.optString("folder", "INBOX");
        Store st = openStore(a);
        IMAPFolder f = null;
        try {
            f = open(st, folder, true);
            Message[] ms = byUids(f, uids(in));
            if (isGmail(a)) {
                // في Gmail يكفي حذف الرسالة من الوارد لتبقى في «كل البريد»
                f.setFlags(ms, new Flags(Flags.Flag.DELETED), true);
                f.expunge();
            } else {
                Map<String, String> roles = roleMap(st);
                String arch = roles.containsKey("archive") ? roles.get("archive") : roles.get("all");
                if (arch == null) throw new MessagingException("لا يوجد مجلد أرشيف في هذا الحساب.");
                if (arch.equals(f.getFullName())) throw new MessagingException("الرسالة في الأرشيف أصلًا.");
                moveTo(st, f, ms, arch);
            }
            return new JSONObject().put("ok", true);
        } finally { closeQuietly(f); closeQuietly(st); }
    }

    /* ---------------- أدوات ---------------- */

    private static final class Address0 { String name = ""; String addr = ""; }

    private static Address0 firstAddr(javax.mail.Address[] arr) {
        Address0 r = new Address0();
        if (arr != null && arr.length > 0) {
            if (arr[0] instanceof InternetAddress) {
                InternetAddress ia = (InternetAddress) arr[0];
                r.name = ia.getPersonal() == null ? "" : ia.getPersonal();
                r.addr = ia.getAddress() == null ? "" : ia.getAddress();
            } else {
                r.addr = arr[0].toString();
            }
        }
        return r;
    }

    private static JSONArray addrList(javax.mail.Address[] arr) throws Exception {
        JSONArray out = new JSONArray();
        if (arr == null) return out;
        for (javax.mail.Address x : arr) {
            JSONObject o = new JSONObject();
            if (x instanceof InternetAddress) {
                InternetAddress ia = (InternetAddress) x;
                o.put("name", ia.getPersonal() == null ? "" : ia.getPersonal()).put("addr", ia.getAddress() == null ? "" : ia.getAddress());
            } else {
                o.put("name", "").put("addr", x.toString());
            }
            out.put(o);
        }
        return out;
    }

    private static String iso(Date d) {
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US);
        f.setTimeZone(TimeZone.getTimeZone("UTC"));
        return f.format(d == null ? new Date(0) : d);
    }

    private static final class Body {
        final StringBuilder text = new StringBuilder();
        final StringBuilder html = new StringBuilder();
        final List<JSONObject> atts = new ArrayList<>();
        int n = 0;
    }

    private static void walk(Part p, Body b) throws Exception {
        if (p.isMimeType("multipart/*")) {
            Multipart mp = (Multipart) p.getContent();
            for (int i = 0; i < mp.getCount(); i++) walk(mp.getBodyPart(i), b);
            return;
        }
        String disp = p.getDisposition();
        String fn = p.getFileName();
        boolean attachment = Part.ATTACHMENT.equalsIgnoreCase(disp) || (fn != null && !fn.isEmpty()) || p.isMimeType("message/rfc822");
        if (attachment) {
            String name = fn == null ? "attachment" : fn;
            try { name = MimeUtility.decodeText(name); } catch (Exception ignored) {}
            b.atts.add(new JSONObject().put("index", b.n).put("name", name).put("size", Math.max(0, p.getSize())));
            b.n++;
            return;
        }
        if (p.isMimeType("text/plain")) {
            if (b.text.length() > 0) b.text.append("\n");
            b.text.append(textOf(p));
        } else if (p.isMimeType("text/html")) {
            b.html.append(textOf(p));
        }
    }

    private static String textOf(Part p) {
        try {
            Object c = p.getContent();
            if (c instanceof String) return (String) c;
        } catch (Exception ignored) {}
        try (InputStream in = p.getInputStream()) {
            ByteArrayOutputStream o = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int r;
            while ((r = in.read(buf)) > 0) o.write(buf, 0, r);
            return new String(o.toByteArray(), "UTF-8");
        } catch (Exception e) {
            return "";
        }
    }
}
