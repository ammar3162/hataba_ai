/* ══════════════════════════════════════════
   حالة التطبيق
   ══════════════════════════════════════════ */
let cart = [];
let currentScreen = 'landing';
let activeCategory = 'new';
let deliveryType = 'delivery';
let conversationHistory = [];
let apiAvailable = true;
const ai = new HatabaAI(); // إنشاء نسخة من الذكاء المحلي

/* ══════════════════════════════════════════
   أمر النظام الذكي (System Prompt) لـ Anthropic
   هذا هو السر لجعل الشات "مقيد بالمطعم وذكياً"
   ══════════════════════════════════════════ */
const SYSTEM_PROMPT = `أنت 'حطبة'، ذكاء اصطناعي يعمل كويتر (مساعد طلبات) في مطعم حطبة للبرقر الفاخر في السعودية.
قواعدك الصارمة:
1. التركيز المطلق: أنت لا تعرف شيئاً عن العالم الخارجي. لا تجب عن السياسة، الرياضة، البرمجة، الطقس، الأفلام، أو أي موضوع لا علاقة له بالأكل ومطعم حطبة.
2. الرد الذكي على الأسئلة الخارجية: إذا سألك المستخدم سؤالاً خارجياً، أجب بذكاء، روح مرحة، ولهجة سعودية طبيعية ترفض فيها الإجابة بلطف وتسخر قليلاً من نفسك لأنك تعرف البرقر فقط، ثم اعكس السؤال فوراً للمنيو. (مثال: "يا غالي أنا حافظ قائمة المنيو مو أخبار الرياضة، خلني أضبط لك وجبة بدل كذا").
3. اللهجة: سعودية فصحى مبسطة (تخاطب الذكر بـ: يا صاحبي/يا غالي، وتخاطب الأنثى بـ: حبيبتي/يا هلا).
4. صيغة الرد: يجب أن تكون إجابتك دائماً وبشكل حصري بصيغة JSON فقط. لا تكتب أي نص خارج JSON.
5. هيكل JSON المطلوب:
{
  "text": "رسالتك النصية هنا",
  "products": [],
  "quickActions": ["زر 1", "زر 2"]
}
- مصفوفة products: تُملأ فقط إذا كنت تنصح بمنتج محدد من المنيو (استخدم الـ id الخاص بالمنتج)، وإلا فاتركها فارغة [].
- مصفوفة quickActions: ضع فيها 3 أزرار سريعة تقترحها على المستخدم للرد.`;

/* ══════════════════════════════════════════
   دالة الاتصال بـ Anthropic API
   ══════════════════════════════════════════ */
async function callAnthropicAPI(userMessage) {
  try {
    conversationHistory.push({ role: 'user', content: userMessage });
    
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system: SYSTEM_PROMPT,
        messages: conversationHistory
      })
    });

    if (!response.ok) {
      throw new Error('API Error');
    }

    const data = await response.json();
    
    // حفظ رد المساعد في التاريخ
    if (data.text) {
      conversationHistory.push({ role: 'assistant', content: data.text });
    }

    return data;
  } catch (error) {
    console.error('API Failed, falling back to local AI', error);
    apiAvailable = false;
    return null;
  }
}

/* ══════════════════════════════════════════
   دالة إرسال الرسالة الرئيسية
   ══════════════════════════════════════════ */
async function sendMessage(overrideText) {
  const input = document.getElementById('chatInput');
  const text = overrideText || input.value.trim();
  if (!text) return;

  input.value = '';
  appendMessage('user', text);
  showTyping();

  let aiResponse = null;

  // 1. محاولة الاتصال بالذكاء الاصطناعي الحقيقي أولاً
  if (apiAvailable) {
    aiResponse = await callAnthropicAPI(text);
  }

  // 2. إذا فشل الـ API، نستخدم الذكاء المحلي (Fallback)
  if (!aiResponse) {
    // نمرر النص للذكاء المحلي الذي قمت أنت ببرمجته
    const localResult = ai.process(text);
    aiResponse = {
      text: localResult?.text || "تمام، وش تبغى تأكل؟",
      products: localResult?.products || [],
      quickActions: localResult?.quickActions || ['أبي بيف', 'أبي تشيكن', 'المنيو']
    };
  }

  hideTyping();
  
  // 3. عرض الرد
  if (aiResponse.text) appendMessage('ai', aiResponse.text);
  
  // 4. عرض المنتجات إذا وُجدت (اختياري حسب تصميمك)
  if (aiResponse.products && aiResponse.products.length > 0) {
    aiResponse.products.forEach(pId => {
      const prod = MENU.find(m => m.id === pId);
      if (prod) renderProductCard(prod);
    });
  }

  // 5. تحديث الأزرار السريعة
  renderQuickActions(aiResponse.quickActions || []);
  
  // التمرير للأسفل
  scrollToBottom();
}

/* ══════════════════════════════════════════
   محرك الذكاء الاصطناعي المحلي (Fallback)
   تم تبسيطه لأن Claude سيتولى المهام الصعبة الآن
   ══════════════════════════════════════════ */
class HatabaAI {
  constructor() { this.reset() }
  reset() {
    this.messageCount = 0;
  }

  process(msg) {
    this.messageCount++;
    const m = msg.trim();
    if (!m) return null;

    // إذا سأل عن المنيو مباشرة
    if (this.hasAny(m, ['منيو', 'المنيو', 'وش عندكم', 'اهديني'])) {
      return { text: 'تقدر تشوف المنيو كامل من الزر اللي فوق، أو قولي وش تبغى بالضبط وأنا ألخص لك.', quickActions: ['برقر بيف', 'برقر تشيكن', 'فرايز'] };
    }

    // إذا مدح أو شكر
    if (this.hasAny(m, ['شكرا', 'مشكور', 'ممتاز', 'حلوة', 'يعطيك العافية'])) {
      return { text: 'العفو يا غالي، هذا واجبنا. تبغى تضيف شيء ثاني للطلب؟', quickActions: ['لا خلصت', 'أبي فرايز', 'أبي مشروب'] };
    }

    // Default Fallback
    return { text: 'تمام، خلني أضبط لك طلبك. تبغى بيف ولا تشيكن؟', quickActions: ['بيف', 'تشيكن', 'الأكثر مبيعاً'] };
  }

  hasAny(text, keywords) {
    return keywords.some(k => text.includes(k));
  }
}

/* ══════════════════════════════════════════
   واجهة المستخدم (مساعدات العرض)
   ══════════════════════════════════════════ */
function appendMessage(sender, text) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = `msg msg-${sender === 'user' ? 'user' : 'ai'}`;
  div.innerHTML = `<div class="msg-bubble">${text}</div>`;
  container.appendChild(div);
}

function renderProductCard(product) {
  const container = document.getElementById('chatMessages');
  // هنا كود عرض كارت المنتج الذي كان عندك في الكود الأصلي
  // تم اختصاره للحفاظ على المساحة، انسخ دالة renderProductCard من كودك الأصلي
}

function renderQuickActions(actions) {
  const container = document.getElementById('quickActions');
  container.innerHTML = '';
  if (!actions || actions.length === 0) return;
  
  actions.forEach(action => {
    const btn = document.createElement('button');
    btn.className = 'qa-chip';
    btn.textContent = action;
    btn.onclick = () => sendMessage(action);
    container.appendChild(btn);
  });
}

function showTyping() {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg msg-ai';
  div.id = 'typingIndicator';
  div.innerHTML = `<div class="typing-indicator"><span></span><span></span><span></span></div>`;
  container.appendChild(div);
  scrollToBottom();
}

function hideTyping() {
  const el = document.getElementById('typingIndicator');
  if (el) el.remove();
}

function scrollToBottom() {
  const container = document.getElementById('chatMessages');
  setTimeout(() => container.scrollTop = container.scrollHeight, 100);
}

// تشغيل رسالة الترحيب عند فتح الشات
function openChat() {
  switchScreen('chat');
  if (conversationHistory.length === 0) {
    setTimeout(() => {
      sendMessage("اهلا"); // رسالة افتراضية لبدء المحادثة
    }, 500);
  }
}
