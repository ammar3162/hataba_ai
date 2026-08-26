// Vercel Serverless Function — /api/chat
// وسيط آمن للتواصل مع Anthropic API لحماية مفتاح الـ API من التسريب للمتصفح.

export default async function handler(req, res) {
  // 1. التحقق من نوع الطلب
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'طريقة الطلب غير مسموح بها (POST فقط)' });
  }

  // 2. التحقق من وجود مفتاح الـ API (يُقرأ من ملف .env محلياً أو من Vercel إنتاجياً)
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('خطأ: ANTHROPIC_API_KEY غير موجود في متغيرات البيئة');
    return res.status(500).json({ 
      error: 'خطأ في إعدادات السيرفر: مفتاح الـ API مفقود' 
    });
  }

  // 3. التحقق من صحة البيانات القادمة من الجسم (Body)
  const { system, messages } = req.body || {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ 
      error: 'البيانات غير صالحة: حقل "messages" مطلوب ويجب أن يكون مصفوفة' 
    });
  }

  try {
    // 4. إعداد إعدادات الطلب للـ API الخارجي
    const endpoint = 'https://api.anthropic.com/v1/messages';
    const modelId = 'claude-sonnet-5'; 
    
    const requestBody = {
      model: modelId,
      max_tokens: 400,
      system: system || undefined,
      messages,
    };

    const requestHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };

    // 5. إرسال الطلب إلى Anthropic API
    const apiResponse = await fetch(endpoint, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });

    const responseData = await apiResponse.json();

    // 6. معالجة أخطاء الـ API
    if (!apiResponse.ok) {
      const errorMessage = responseData?.error?.message || 'حدث خطأ غير متوقع من Anthropic API';
      console.error(`Anthropic API Error ${apiResponse.status}:`, errorMessage);
      return res.status(apiResponse.status).json({ error: errorMessage });
    }

    // 7. استخراج النص من استجابة الـ API
    const textBlock = (responseData.content || []).find((block) => block.type === 'text');
    
    if (!textBlock || !textBlock.text) {
      console.error('خطأ: لم يتم العثور على نص في رد النموذج', responseData);
      return res.status(500).json({ 
        error: 'رد النموذج فارغ أو لا يحتوي على نص' 
      });
    }

    // 8. تنظيف النص من علامات الـ Markdown (إن وجدت) وتجهيزه للـ JSON
    const cleanText = textBlock.text
      .trim()
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/gm, '')
      .trim();

    // 9. محاولة تحويل النص إلى كائن JSON
    let parsedJson;
    try {
      parsedJson = JSON.parse(cleanText);
    } catch (parseError) {
      console.error('فشل تحليل JSON:', parseError.message, '\nالنص الأصلي:', cleanText);
      return res.status(500).json({ 
        error: 'رد النموذج ليس بصيغة JSON صالحة',
        details: parseError.message,
        raw: cleanText 
      });
    }

    // 10. إرجاع الاستجابة النهائية بنجاح
    return res.status(200).json(parsedJson);

  } catch (error) {
    // 11. التقاط أي أخطاء غير متوقعة أثناء تنفيذ الكود
    console.error('خطأ داخلي في السيرفر (Catch Block):', error);
    return res.status(500).json({ 
      error: 'حدث خطأ داخلي في الخادم',
      details: error.message 
    });
  }
}
