/**
 * Бессерверная функция-прокси для безопасного обращения к API Gemini.
 * Предотвращает утечку API-ключа в браузере клиента.
 */
export default async function handler(req, res) {
  // Настройка CORS заголовков (позволяет делать запросы откуда угодно, включая GitHub Pages)
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Обработка предварительного CORS-запроса (Preflight request)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Разрешен только метод POST' });
  }

  try {
    const { payload, endpointType } = req.body;
    
    // Получаем секретный ключ из переменных окружения Vercel
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ 
        error: 'На сервере не настроена переменная окружения GEMINI_API_KEY. Добавьте её в настройках Vercel.' 
      });
    }

    // Определяем модель в зависимости от назначения
    const model = endpointType === 'tts' 
      ? 'gemini-2.5-flash-preview-tts' 
      : 'gemini-2.5-flash-preview-09-2025';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    // Отправляем защищенный запрос в Google API
    const apiResponse = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!apiResponse.ok) {
      const errText = await apiResponse.text();
      return res.status(apiResponse.status).json({ error: `Ошибка Google API: ${errText}` });
    }

    const data = await apiResponse.json();
    return res.status(200).json(data);

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
