// Vercel Serverless Function — /api/chat
// يمسك مفتاح Anthropic من متغيرات البيئة على السيرفر (ما ينكشف للمتصفح أبداً)
// ويستخدم ملف .env أو Vercel > Settings > Environment Variables باسم ANTHROPIC_API_KEY

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY غير موجود في متغيرات البيئة على Vercel' });
    return;
  }

  try {
    const { system, messages } = req.body || {};
    if (!messages || !Array.isArray(messages)) {
      res.status(400).json({ error: 'messages مطلوبة' });
      return;
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        // تأكد من هذا المعرف في https://docs.claude.com/en/docs/about-claude/models قبل الإطلاق
        model: 'claude-sonnet-5',
        max_tokens: 400,
        system,
        messages,
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data?.error?.message || 'خطأ من Anthropic API' });
      return;
    }

    const textBlock = (data.content || []).find((c) => c.type === 'text');
    if (!textBlock) {
      res.status(500).json({ error: 'ما فيه نص في رد النموذج' });
      return;
    }

    const clean = textBlock.text
      .trim()
      .replace(/^```json/i, '')
      .replace(/^```/, '')
      .replace(/```$/, '')
      .trim();

    let parsed;
    try {
      parsed = JSON.parse(clean);
    } catch (e) {
      res.status(500).json({ error: 'رد النموذج مو JSON صالح', raw: clean });
      return;
    }

    res.status(200).json(parsed);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
