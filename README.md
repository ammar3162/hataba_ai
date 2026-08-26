# حطبة — دليل النشر على Vercel

## الملفات
- `index.html` — التطبيق كامل (الواجهة + محرك محلي احتياطي)
- `api/chat.js` — Serverless Function تتصل بكلود من طرف السيرفر

## خطوات النشر
1. ارفع هذا المجلد كامل (بما فيه مجلد `api/`) لمستودع GitHub أو باستخدام `vercel` CLI مباشرة.
2. من لوحة تحكم Vercel: **Project Settings → Environment Variables**
   أضف متغير باسم `ANTHROPIC_API_KEY` وقيمته مفتاح Anthropic API الحقيقي (تحصل عليه من console.anthropic.com).
   فعّله على البيئات الثلاث: Production, Preview, Development.
3. **Deployments → Redeploy** حتى يقرأ المتغير الجديد (المتغيرات ما تنطبق على نشر قديم تلقائياً).
4. تأكد إن **Deployment Protection** مو مفعّل على رابط الإنتاج (Settings → Deployment Protection) عشان الرابط يفتح مباشرة بدون تسجيل دخول Vercel.
5. افتح رابط الإنتاج (النطاق الرئيسي، مو رابط Preview اللي فيه هاش عشوائي).

## ملاحظة على اسم الموديل
داخل `api/chat.js` الموديل محدد كـ `claude-sonnet-5`. تأكد من صحة المعرف الحالي في
https://docs.claude.com/en/docs/about-claude/models قبل الإطلاق، لأن أسماء الموديلات تتحدث بين فترة وأخرى.

## لو ما اشتغل
- افتح Developer Tools → Network في المتصفح وشوف طلب `/api/chat`، لو رجع 500 اقرأ رسالة `error` بالرد.
- تأكد إن اسم المتغير بالضبط `ANTHROPIC_API_KEY` بدون مسافات.
- لو نسيت تعمل Redeploy بعد إضافة المتغير، هو السبب الأشيع.
