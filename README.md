# Crow Go

منصة ويب (PWA) للسماسرة والوسطاء الميدانيين في مصر — عقارات، عربيات، دليفري
وغيرها. الوسيط بيسجل عروضه وبيانات المالك بشكل سري، يطلع "مجلة" عروض (صفحة
صورة لكل عرض) لنشرها على واتساب وفيسبوك، يتابع طلبات الزبائن، ويدير اشتراكه
وإحالاته.

هذا الفرع (`fix/admins-rls-and-hardening`) يطبّق الإصلاحات الواردة في تقرير
فحص الكود "المراجعة الثالثة" بتاريخ 2026-11-25 (33 مشكلة مفتوحة وقتها: 4
حرجة، 10 عالية، 12 متوسطة، 7 منخفضة). راجع
[`docs/fixes-applied-report3.md`](docs/fixes-applied-report3.md) لمعرفة أي
مشكلة اتصلحت في الكود وأيها محتاجة خطوة يدوية منك في لوحة Supabase.

## ⚠️ لو بتقرأ ده قبل ما تعمل أي حاجة تانية

**جدول `admins` في القاعدة الحية كان من غير أي حماية (RLS) خالص.** أي حد —
حتى زائر مش مسجل دخول — كان يقدر يضيف نفسه كأدمن بسطر واحد في Developer
Tools. لو لسه مطبقتش `database/crowgo-hardening.sql`، ده أول حاجة تعملها.
التفاصيل في `docs/fixes-applied-report3.md`.

## البنية التقنية

- **الواجهة:** HTML/CSS/JavaScript عادي (Vanilla)، من غير Framework أو أداة بناء.
- **الخلفية:** [Supabase](https://supabase.com) — Auth، Postgres، Storage.
  المشروع الحالي: `qonffvfaxjtzfaozvsng`.
- **توليد الصور:** [html2canvas](https://html2canvas.hertzen.com/).
- **الاستضافة:** [Vercel](https://crow-go.vercel.app).

## خريطة الملفات

| الملف | الدور |
|---|---|
| `index.html` | كل الشاشات والنوافذ المنبثقة |
| `app.js` | الاتصال بـ Supabase، أدوات مساعدة، الدخول/التسجيل، استرجاع الجلسة |
| `waseet.js` | قلب التطبيق: العروض، المجلة، الطلبات، الاشتراك، الإحالات |
| `admin.js` | لوحة السوبر أدمن (الوسطاء، المدفوعات، التمديد، الإلغاء، المعاينة) |
| `style.css` | كل تنسيقات الواجهة |
| `manifest.json` | إعدادات PWA |
| `service-worker.js` / `offline.html` | تثبيت على الموبايل + دعم محدود بدون نت |
| `privacy.html` | مسودة سياسة خصوصية (**راجعها مع محامي قبل الإطلاق**) |
| `database/schema.sql` | **لبناء قاعدة بيانات جديدة من الصفر** (مشروع تطوير فاضي) |
| `database/crowgo-hardening.sql` | **لازم تتشغل يدوياً** على مشروع Supabase الحقيقي الحالي |
| `supabase/functions/admin-reset-pin/` | Edge Function لإعادة تعيين PIN وسيط — تحتاج نشر يدوي |
| `supabase/functions/admin-ban-account/` | Edge Function لمنع دخول حساب ملغي — تحتاج نشر يدوي |

لا يوجد مجلد `supabase/migrations/` ولا فرع اسمه غير الموجود في هذه القائمة —
أي ملف قديم بيشاور على حاجة تانية غير كده كان غلط وده هو التصحيح.

## التشغيل محلياً

التطبيق ملفات ثابتة بالكامل، مفيش build خطوة:

```bash
python3 -m http.server 8080
# أو: npx serve .
```

ثم افتح `http://localhost:8080`.

## إعداد Supabase

### لو بتصلّح المشروع الحقيقي الموجود

> ⚠️ جرّب على نسخة/مشروع تطوير منفصل الأول لو أمكن. التقرير نفسه جرّب كل ده
> على نسخة محلية من القاعدة بهجمات حقيقية قبل ما ينصح بيه.

1. **قبل أي حاجة:** افتح SQL Editor وشغّل:
   ```sql
   select * from public.admins;
   select * from public.payments where status = 'confirmed' or amount <= 0;
   select id, subscription_end from public.profiles where subscription_end > now() + interval '400 days';
   ```
   راجع أي نتيجة غريبة (ممكن تكون دليل إن حد استغل الثغرة فعلاً) قبل ما تكمل.
2. **شغّل `database/crowgo-hardening.sql`** كامل في SQL Editor (أو
   `supabase db push` لو مربوط بالمشروع). الملف نفسه فيه شرح كل قسم.
3. **شغّل سياسات Storage** (آخر قسم في نفس الملف) — منفصلة لأنها محتاجة
   الـ bucket `product-images` يكون موجود بالفعل (وهو موجود).
4. **انشر الـ Edge Functions:**
   ```bash
   supabase functions deploy admin-reset-pin
   supabase functions deploy admin-ban-account
   ```
5. **افتح Supabase Dashboard > Advisors > Security Advisor** وتأكد إن
   "RLS Disabled in Public" مابقاش فيه `admins` ولا أي جدول تاني.
6. **اعمل `.vercelignore`** (موجود بالفعل في المستودع) بيمنع نشر `/database`
   و`/supabase` على الموقع العام — كان `database/schema.sql` متاح للتحميل
   من `crow-go.vercel.app/database/schema.sql` لأي حد.

### لو بتبني مشروع تطوير جديد من الصفر

شغّل `database/schema.sql` كامل (ده بيبني كل حاجة: الجداول، RLS، الدوال،
الـ Triggers) ثم اتبع خطوات 3-5 فوق.

### خطوة لازم تتعمل يدوي دايماً (مفيش طريقة تانية)

إنشاء أول أدمن — الجدول مقفول بالكامل بـ RLS من غير أي policy قراءة، فمفيش
طريقة تعمله من المتصفح أو من كود عادي:

1. اعمل حساب في **Authentication > Users** بإيميل وباسورد قويين (مش رقم
   موبايل وهمي).
2. شغّل في SQL Editor:
   ```sql
   insert into public.admins (user_id) values ('<auth.users.id بتاعك>');
   ```

### إعدادات لوحة Supabase (مش SQL)

- **إيقاف "Confirm Email"** من Authentication > Providers > Email — طالما
  التطبيق لسه بيسجل الوسطاء بإيميل وهمي (`<phone>@crowgo.local`)، تفعيل
  تأكيد الإيميل هيكسر التسجيل والدخول بصمت.
- **تفعيل CAPTCHA** (Turnstile أو hCaptcha) من Authentication Settings.
- **تقليل محاولات الدخول** من Rate Limits.

## النشر على Vercel

- `.vercelignore` بيمنع نشر `/database` و`/supabase` و`/docs` — متشيلهوش.
- `vercel.json` فيه Security Headers أساسية (X-Frame-Options،
  X-Content-Type-Options، Referrer-Policy). **من غير Content-Security-Policy
  عمداً**: التطبيق لسه بيستخدم `onclick="..."` جوه الـ HTML في أغلب الشاشات
  (ماعدا لوحة الأدمن اللي بقت `data-id` + `addEventListener`)، وCSP حقيقية
  هتمنع كل الـ onclick دي وتبوظ التطبيق. لازم تحويل كل الـ onclick لـ
  addEventListener الأول.

## الحدود المعروفة بعد هذا الفرع

- كل الإصلاحات اللي محتاجة قاعدة بيانات حقيقية **مكتوبة وجاهزة لكن مش
  مطبّقة من هذه الجلسة** — مفيش بيانات اعتماد لقاعدة بياناتك هنا أصلاً، ومش
  المفروض تتشارك مفتاح service role مع أي أداة.
- مفيش Postgres محلي ولا Docker في البيئة اللي كتبت فيها الملفات دي، فعلى
  عكس التقرير (اللي جرّب كل حاجة على نسخة محلية فعلية)، ملف
  `crowgo-hardening.sql` اتكتب بعناية من غير تشغيل فعلي — جرّبه على مشروع
  تطوير قبل القاعدة الحقيقية.
- رفع الصور لسه ممكن يبوظ على Safari/آيفون (WebP مش مدعومة في كل نسخ Safari).
- توليد المجلة لسه صفحة كاملة لكل عرض — بطيء لو عندك عروض كتير.
- بيانات المالك السرية لسه في نفس جدول `products`، والـ bucket لسه عام —
  ده قرار معماري أكبر (جدول منفصل + روابط موقّعة) مؤجل لمرحلة لاحقة.
- أيقونة الـ PWA من غير نسخة "maskable" بهامش آمن حقيقي (محتاج تصميم).
- مفيش اختبارات آلية (Playwright أو غيرها).

راجع قائمة اختبار القبول الكاملة في تقرير 25 نوفمبر (قسم 13) قبل أي إطلاق فعلي.
