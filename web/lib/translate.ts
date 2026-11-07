'use client';
// Translation (demo phrasebook), ported from js/devices.js, js/privacy.js and js/superapp.js.
// Production would use an on-device or encrypted translation model; the demo translates common phrases.
import { toast } from './overlay';

export const LANG_LIST: [string, string][] = [['en', 'English'], ['te', 'Telugu'], ['hi', 'Hindi'], ['ta', 'Tamil'], ['kn', 'Kannada'], ['ml', 'Malayalam'], ['mr', 'Marathi'], ['bn', 'Bengali'], ['gu', 'Gujarati'], ['pa', 'Punjabi'], ['or', 'Odia'], ['ur', 'Urdu'], ['ar', 'Arabic'], ['fr', 'French'], ['es', 'Spanish'], ['de', 'German'], ['zh', 'Chinese'], ['ja', 'Japanese']];
const MORE_LANGS: string[] = ['Assamese', 'Konkani', 'Maithili', 'Manipuri', 'Nepali', 'Sanskrit', 'Sindhi', 'Santali', 'Dogri', 'Bhojpuri', 'Kashmiri', 'Afrikaans', 'Albanian', 'Amharic', 'Armenian', 'Azerbaijani', 'Basque', 'Belarusian', 'Bosnian', 'Bulgarian', 'Burmese', 'Catalan', 'Cebuano', 'Chinese (Traditional)', 'Croatian', 'Czech', 'Danish', 'Dutch', 'Esperanto', 'Estonian', 'Filipino', 'Finnish', 'Galician', 'Georgian', 'Greek', 'Haitian Creole', 'Hausa', 'Hawaiian', 'Hebrew', 'Hmong', 'Hungarian', 'Icelandic', 'Igbo', 'Indonesian', 'Irish', 'Italian', 'Javanese', 'Kazakh', 'Khmer', 'Kinyarwanda', 'Korean', 'Kurdish', 'Kyrgyz', 'Lao', 'Latin', 'Latvian', 'Lithuanian', 'Luxembourgish', 'Macedonian', 'Malagasy', 'Malay', 'Maltese', 'Maori', 'Mongolian', 'Norwegian', 'Pashto', 'Persian', 'Polish', 'Portuguese', 'Romanian', 'Russian', 'Samoan', 'Serbian', 'Sesotho', 'Shona', 'Sinhala', 'Slovak', 'Slovenian', 'Somali', 'Sundanese', 'Swahili', 'Swedish', 'Tajik', 'Tatar', 'Thai', 'Turkish', 'Turkmen', 'Ukrainian', 'Uyghur', 'Uzbek', 'Vietnamese', 'Welsh', 'Xhosa', 'Yiddish', 'Yoruba', 'Zulu'];
MORE_LANGS.forEach((n) => { if (!LANG_LIST.some((l) => l[1] === n)) LANG_LIST.push(['x-' + n.toLowerCase().replace(/[^a-z]+/g, '-'), n]); });

export const PHRASES: Record<string, Record<string, string>> = {
  'how are you': { te: 'మీరు ఎలా ఉన్నారు?', hi: 'आप कैसे हैं?', ta: 'எப்படி இருக்கிறீர்கள்?', kn: 'ಹೇಗಿದ್ದೀರಿ?', ml: 'സുഖമാണോ?', mr: 'तुम्ही कसे आहात?', bn: 'আপনি কেমন আছেন?', gu: 'તમે કેમ છો?', pa: 'ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ?', or: 'ଆପଣ କେମିତି ଅଛନ୍ତି?', ur: 'آپ کیسے ہیں؟', ar: 'كيف حالك؟', fr: 'Comment allez-vous ?', es: '¿Cómo estás?', de: 'Wie geht es dir?', zh: '你好吗？', ja: 'お元気ですか？' },
  'i will come tomorrow': { te: 'నేను రేపు వస్తాను.', hi: 'मैं कल आऊंगा।', ta: 'நான் நாளை வருவேன்.', kn: 'ನಾನು ನಾಳೆ ಬರುತ್ತೇನೆ.', ml: 'ഞാൻ നാളെ വരും.', mr: 'मी उद्या येईन.', bn: 'আমি কাল আসব।', gu: 'હું કાલે આવીશ.', pa: 'ਮੈਂ ਕੱਲ੍ਹ ਆਵਾਂਗਾ।', or: 'ମୁଁ କାଲି ଆସିବି।', ur: 'میں کل آؤں گا۔', ar: 'سآتي غدًا.', fr: 'Je viendrai demain.', es: 'Vendré mañana.', de: 'Ich komme morgen.', zh: '我明天来。', ja: '明日行きます。' },
  'i am fine': { te: 'నేను బాగున్నాను.', hi: 'मैं ठीक हूँ।', ta: 'நான் நன்றாக இருக்கிறேன்.', kn: 'ನಾನು ಚೆನ್ನಾಗಿದ್ದೇನೆ.', ml: 'എനിക്ക് സുഖമാണ്.', mr: 'मी ठीक आहे.', bn: 'আমি ভালো আছি।', gu: 'હું મજામાં છું.', pa: 'ਮੈਂ ਠੀਕ ਹਾਂ।', or: 'ମୁଁ ଭଲ ଅଛି।', ur: 'میں ٹھیک ہوں۔', ar: 'أنا بخير.', fr: 'Je vais bien.', es: 'Estoy bien.', de: 'Mir geht es gut.', zh: '我很好。', ja: '元気です。' },
  'thank you': { te: 'ధన్యవాదాలు', hi: 'धन्यवाद', ta: 'நன்றி', kn: 'ಧನ್ಯವಾದಗಳು', ml: 'നന്ദി', mr: 'धन्यवाद', bn: 'ধন্যবাদ', gu: 'આભાર', pa: 'ਧੰਨਵਾਦ', or: 'ଧନ୍ୟବାଦ', ur: 'شکریہ', ar: 'شكرًا', fr: 'Merci', es: 'Gracias', de: 'Danke', zh: '谢谢', ja: 'ありがとう' },
  'good morning': { te: 'శుభోదయం', hi: 'सुप्रभात', ta: 'காலை வணக்கம்', kn: 'ಶುಭೋದಯ', ml: 'സുപ്രഭാതം', mr: 'सुप्रभात', bn: 'সুপ্রভাত', gu: 'સુપ્રભાત', pa: 'ਸ਼ੁਭ ਸਵੇਰ', or: 'ଶୁଭ ସକାଳ', ur: 'صبح بخیر', ar: 'صباح الخير', fr: 'Bonjour', es: 'Buenos días', de: 'Guten Morgen', zh: '早上好', ja: 'おはようございます' },
  'see you soon': { te: 'త్వరలో కలుద్దాం', hi: 'जल्द मिलते हैं', ta: 'விரைவில் சந்திப்போம்', kn: 'ಬೇಗ ಭೇಟಿಯಾಗೋಣ', ml: 'ഉടൻ കാണാം', mr: 'लवकरच भेटू', bn: 'শীঘ্রই দেখা হবে', gu: 'જલ્દી મળીએ', pa: 'ਜਲਦੀ ਮਿਲਦੇ ਹਾਂ', or: 'ଶୀଘ୍ର ଦେଖା ହେବ', ur: 'جلد ملتے ہیں', ar: 'أراك قريبًا', fr: 'À bientôt', es: 'Hasta pronto', de: 'Bis bald', zh: '回头见', ja: 'またね' },
  'where are you': { te: 'మీరు ఎక్కడ ఉన్నారు?', hi: 'आप कहाँ हैं?', ta: 'நீங்கள் எங்கே இருக்கிறீர்கள்?', kn: 'ನೀವು ಎಲ್ಲಿದ್ದೀರಿ?', ml: 'നിങ്ങൾ എവിടെയാണ്?', mr: 'तुम्ही कुठे आहात?', bn: 'আপনি কোথায়?', gu: 'તમે ક્યાં છો?', pa: 'ਤੁਸੀਂ ਕਿੱਥੇ ਹੋ?', or: 'ଆପଣ କେଉଁଠି ଅଛନ୍ତି?', ur: 'آپ کہاں ہیں؟', ar: 'أين أنت؟', fr: 'Où es-tu ?', es: '¿Dónde estás?', de: 'Wo bist du?', zh: '你在哪里？', ja: 'どこにいますか？' },
};
const ALIASES: Record<string, string> = {
  'ఎలా ఉన్నారు': 'how are you', 'ఎలా ఉన్నావు': 'how are you', 'कैसे हो': 'how are you', 'आप कैसे हो': 'how are you', 'how r u': 'how are you',
  'im fine': 'i am fine', 'i m fine': 'i am fine', 'i am good': 'i am fine', 'నేను బాగున్నా': 'i am fine', 'thanks': 'thank you', 'see you': 'see you soon',
};

export const normPhrase = (s: string) => String(s).toLowerCase().replace(/\p{Extended_Pictographic}|[^\p{L}\p{M}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
export function phraseKey(piece: string): string | null {
  const n = normPhrase(piece);
  if (!n) return null;
  if (ALIASES[n]) return ALIASES[n];
  if (PHRASES[n]) return n;
  return Object.keys(PHRASES).find((k) => Object.values(PHRASES[k]).some((v) => normPhrase(v) === n)) || null;
}
export const englishOf = (k: string) => k[0].toUpperCase() + k.slice(1).replace(/\bi\b/g, 'I') + (/^(how|where)/.test(k) ? '?' : '.');
export function phraseIn(k: string, lang: string): string | undefined { return lang === 'en' ? englishOf(k) : PHRASES[k]?.[lang]; }
/** Sentence-by-sentence phrasebook translation; null if any sentence is unknown (demo limitation). */
export function translateSentences(text: string, to: string): string | null {
  const parts = String(text).split(/(?<=[.?!।])\s+/).filter((x) => normPhrase(x));
  if (!parts.length) return null;
  const out = parts.map((p) => { const k = phraseKey(p); return k ? phraseIn(k, to) : null; });
  return out.every(Boolean) ? out.join(' ') : null;
}
/** Translate a message: whole-phrase match first, then sentence by sentence (same matching as live translation). */
export function translateText(text: string, to: string): { text: string } | null {
  const n = normPhrase(text);
  let key = Object.keys(PHRASES).find((k) => n === k || n.startsWith(k + ' ') || n.endsWith(' ' + k));
  if (!key) key = Object.keys(PHRASES).find((k) => Object.values(PHRASES[k]).some((v) => normPhrase(v) === n));
  if (key) {
    if (to === 'en') return { text: key[0].toUpperCase() + key.slice(1) + (/how|where/.test(key) ? '?' : '.') };
    if (PHRASES[key][to]) return { text: PHRASES[key][to] };
  }
  const s = translateSentences(text, to);
  return s ? { text: s } : null;
}
export const langName = (k: string) => (LANG_LIST.find((l) => l[0] === k) || [k, k])[1];

export function readAloud(text: string) {
  if (!('speechSynthesis' in window)) return toast('Text-to-voice is not supported in this browser');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/\p{Extended_Pictographic}/gu, ''));
  u.lang = /[ఀ-౿]/.test(text) ? 'te-IN' : /[ऀ-ॿ]/.test(text) ? 'hi-IN' : /[஀-௿]/.test(text) ? 'ta-IN' : 'en-IN';
  speechSynthesis.speak(u);
  toast('🔊 Reading aloud');
}
