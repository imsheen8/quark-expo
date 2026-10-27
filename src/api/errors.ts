/** رسائل أخطاء عربية مفهومة من ردّ المزوّد */
export function httpErrorText(status: number, body: string): string {
  let msg = '';
  try {
    const j = JSON.parse(body);
    msg = j?.error?.message || j?.message || (Array.isArray(j) ? j[0]?.error?.message : '') || body;
  } catch {
    msg = body;
  }
  msg = String(msg || '').slice(0, 400);
  let pre = '';
  if (status === 400 && /context|maximum.*tokens|too long|too many tokens/i.test(msg)) pre = 'تجاوزت المحادثة نافذة سياق النموذج. ';
  else if (status === 401 || status === 403) pre = 'مفتاح API مرفوض أو بلا صلاحية. ';
  else if (status === 402) pre = 'الرصيد غير كافٍ. ';
  else if (status === 404) pre = 'النموذج أو العنوان غير موجود، تأكد من معرّف النموذج وعنوان الخدمة. ';
  else if (status === 408 || status === 504) pre = 'انتهت مهلة الاتصال. ';
  else if (status === 429) pre = 'تجاوزت حد الطلبات أو أن الخدمة مزدحمة. ';
  else if (status >= 500) pre = 'خطأ في خادم المزوّد. ';
  return `(${status}) ${pre}${msg}`.trim();
}

export function netErrorText(e: unknown, url: string): string {
  const m = e instanceof Error ? e.message : String(e);
  const local = /localhost|127\.0\.0\.1|192\.168\.|10\.\d+\.|\.local\b/.test(url);
  if (/network|failed|fetch|connect|refused|unreachable|timed? ?out/i.test(m)) {
    return local
      ? 'تعذّر الاتصال بالخادم المحلي. تأكد أنه يعمل وأن العنوان هو عنوان الجهاز على شبكتك (وليس localhost) وأن الجدار الناري يسمح بالاتصال.'
      : 'تعذّر الاتصال بالإنترنت أو بعنوان الخدمة. تحقق من الشبكة ومن صحة العنوان.';
  }
  return m;
}
