# Crow Go

منصة ويب (PWA) للسماسرة والوسطاء الميدانيين في مصر — عقارات، عربيات، دليفري
وغيرها. الوسيط بيسجل عروضه وبيانات المالك بشكل سري، يطلع "مجلة" عروض (صفحة
صورة لكل عرض) لنشرها على واتساب وفيسبوك، يتابع طلبات الزبائن، ويدير اشتراكه
وإحالاته.

## ⚠️ قبل أي حاجة تانية — اقرأ ده

هذا المستودع فيه نوعين من الملفات، ومعاملتهم مختلفة تمامًا:

1. **ملفات التطبيق** (`.html`, `.js`, `.css`, `.json`, الصور) — رفعها على
   GitHub **كفاية** لتحديث الموقع على Vercel تلقائيًا.
2. **ملفات قاعدة البيانات** (`database/*.sql`) — رفعها على GitHub **لا يغيّر
   أي حاجة في قاعدة بياناتك الحقيقية على Supabase**. دي مجرد "وصفة" مكتوبة.
   القاعدة الحقيقية ما بتتغيرش غير لو حد فتح **SQL Editor في لوحة Supabase
   بنفسه** ونفّذ الملف فعليًا.

**لو حد قال لك "رفعت كل حاجة على GitHub" — ده مش معناه إن الثغرات اتقفلت.**
اتأكد بالخطوات اللي تحت.

### ✅ قائمة رفع الملفات (متنساش حاجة)

لو بترفع الملفات يدوي عن طريق محرر GitHub (سحب وإفلات)، المجلدات المتداخلة
زي `supabase/functions/admin-reset-pin/` سهل جدًا تتنسى. اتأكد إن كل ده
موجود فعليًا في المستودع بعد الرفع:

- [ ] `database/schema.sql`
- [ ] `database/crowgo-hardening.sql`
- [ ] `database/storage.sql`
- [ ] `supabase/functions/admin-reset-pin/index.ts`
- [ ] `supabase/functions/admin-ban-account/index.ts`
- [ ] `docs/fixes-applied-report4.md`
- [ ] باقي الملفات (`index.html`, `app.js`, `waseet.js`, `admin.js`, `style.css`, إلخ)

### ✅ خطوات قاعدة البيانات (لازم حد يعملها من لوحة Supabase، مش من GitHub)

1. افتح **SQL Editor** في Supabase وشغّل استعلامات المراجعة الأولى المكتوبة
   في أول `database/crowgo-hardening.sql` (جدول `admins`، المدفوعات
   المشبوهة، الاشتراكات البعيدة بشكل غريب). لو لقيت حاجة غريبة، نضّفها
   وغيّر باسورد الأدمن.
2. نفّذ `database/crowgo-hardening.sql` كامل.
3. نفّذ `database/storage.sql`.
4. عدّ السياسات للتأكد:
   ```sql
   select tablename, count(*) from pg_policies where schemaname='public' group by 1;
   ```
   المتوقع: `profiles` 2، `payments` 2، `orders` 4، `products` 4، وواحدة
   لكل من `product_images`، `referrals`، `pin_reset_audit`، `admin_audit_log`.
   أي رقم أكبر معناه إن فيه سياسة قديمة لسه موجودة بتفتح ثغرة.
5. افتح **Dashboard > Advisors > Security Advisor** وتأكد إن
   "RLS Disabled in Public" مابقاش فيه `admins` ولا أي جدول تاني.
6. انشر الـ Edge Functions:
   ```bash
   supabase functions deploy admin-reset-pin
   supabase functions deploy admin-ban-account
   ```

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
| `admin.js` | لوحة السوبر أدمن (الوسطاء، المدفوعات، التمديد، الإلغاء/التفعيل، المعاينة) |
| `style.css` | كل تنسيقات الواجهة |
| `manifest.json` | إعدادات PWA |
| `service-worker.js` / `offline.html` | تثبيت على الموبايل + دعم محدود بدون نت |
| `privacy.html` | مسودة سياسة خصوصية (**راجعها مع محامي قبل الإطلاق**) |
| `database/schema.sql` | بناء قاعدة بيانات **جديدة من الصفر** (مشروع تطوير فاضي) |
| `database/crowgo-hardening.sql` | ترقية قاعدة البيانات **الحقيقية الحالية** — آمن تشغّله أكتر من مرة |
| `database/storage.sql` | سياسات تخزين الصور — شغّله بعد أي من الملفين فوق |
| `supabase/functions/admin-reset-pin/` | Edge Function لإعادة تعيين PIN وسيط |
| `supabase/functions/admin-ban-account/` | Edge Function لمنع/رفع منع دخول حساب |
| `docs/fixes-applied-report4.md` | خريطة كل مشكلة في تقرير 27 نوفمبر وحالتها دلوقتي |

## التشغيل محلياً

التطبيق ملفات ثابتة بالكامل، مفيش build خطوة:

```bash
python3 -m http.server 8080
```

ثم افتح `http://localhost:8080`.

## إعداد Supabase — تفاصيل إضافية

### لو بتبني مشروع تطوير جديد من الصفر

شغّل `database/schema.sql` ثم `database/storage.sql`. كل الجداول والدوال
والـ RLS والـ Triggers فيهم.

### إنشاء أول أدمن (خطوة يدوية دايمًا، مفيش طريقة تانية)

جدول `admins` مقفول بالكامل بـ RLS من غير أي policy قراءة، فمفيش طريقة
تعمله من المتصفح أو من كود عادي:

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
- **تفعيل CAPTCHA** (Cloudflare Turnstile، مدعومة في Supabase) من
  Authentication Settings.
- **تقليل محاولات الدخول** من Rate Limits.

## النشر على Vercel

- `.vercelignore` بيمنع نشر `/database` و`/supabase` و`/docs` — متشيلهوش.
- `vercel.json` فيه Security Headers أساسية (X-Frame-Options،
  X-Content-Type-Options، Referrer-Policy). **من غير Content-Security-Policy
  عمداً**: التطبيق لسه بيستخدم `onclick="..."` جوه الـ HTML في أغلب الشاشات
  (ماعدا لوحة الأدمن اللي بقت `data-id` + `addEventListener`)، وCSP حقيقية
  هتمنع كل الـ onclick دي وتبوظ التطبيق. لازم تحويل كل الـ onclick لـ
  addEventListener الأول.

## طريقة التطوير الموصى بيها

النمط الحالي هو تعديل مباشر على `main` من محرر GitHub. ده سبب أساسي في
ظهور ملفات ناقصة (زي `supabase/functions/` اللي ضاعت أكتر من مرة) وتكرار
كود. الأفضل: فرع `dev` للتجربة، ومشروع Supabase منفصل للتطوير، ونشر من
`main` بس بعد قائمة اختبار القبول (موجودة في تقرير 27 نوفمبر، قسم 9).

## الحدود المعروفة بعد هذا التحديث

- `icon.png` (384 KB، أيقونة PWA مقاس 512×512) لسه كبيرة الحجم. حاولت
  أعيد ضغطها لكن الأدوات المتاحة في البيئة اللي كتبت فيها الملف ده
  (sips بس، من غير ImageMagick أو pillow) بتزود الحجم مش بتقلله — محتاج
  أداة ضغط PNG حقيقية (pngquant/optipng) من جهاز فيه الأدوات دي.
- أيقونة الـ PWA من غير نسخة "maskable" بهامش آمن حقيقي (محتاج تصميم).
- رفع الصور لسه ممكن يبوظ على Safari/آيفون (WebP مش مدعومة في كل نسخ Safari).
- توليد المجلة لسه صفحة كاملة لكل عرض — بطيء لو عندك عروض كتير.
- بيانات المالك السرية لسه في نفس جدول `products`، والـ bucket لسه عام —
  ده قرار معماري أكبر (جدول منفصل + روابط موقّعة) مؤجل لمرحلة لاحقة.
- مفيش اختبارات آلية (Playwright أو غيرها).
- مفيش Postgres محلي ولا Docker في البيئة اللي كتبت فيها هذه الملفات، فملفات
  SQL اتكتبت بعناية من غير تشغيل فعلي من هذه الجلسة. جرّبها على مشروع
  تطوير قبل القاعدة الحقيقية.

راجع `docs/fixes-applied-report4.md` لحالة كل مشكلة بالتفصيل.
