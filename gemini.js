// Vercel Serverless Function с подробным логированием ошибок
export default async function handler(req, res) {
  // Настройка заголовков CORS для предотвращения блокировок браузером
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Обработка CORS предзапроса
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Допустим только метод POST' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("КРИТИЧЕСКАЯ ОШИБКА: Переменная GEMINI_API_KEY отсутствует в окружении Vercel!");
    return res.status(500).json({ 
      error: 'API-ключ не настроен на Vercel! Перейдите в Settings -> Environment Variables и добавьте GEMINI_API_KEY с вашим ключом из Google AI Studio, после чего сделайте Redeploy.' 
    });
  }

  const { payload, endpointType } = req.body;
  if (!payload) {
    return res.status(400).json({ error: 'Отсутствует тело payload в запросе.' });
  }

  // Используем гарантированно стабильные и доступные модели
  const modelText = "gemini-1.5-flash";
  const modelTts = "gemini-2.5-flash-preview-tts";
  
  let url = "";
  if (endpointType === "text") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${modelText}:generateContent?key=${apiKey}`;
  } else if (endpointType === "tts") {
    url = `https://generativelanguage.googleapis.com/v1beta/models/${modelTts}:generateContent?key=${apiKey}`;
  } else {
    return res.status(400).json({ error: 'Неверный тип endpointType. Допустимы "text" или "tts"' });
  }

  try {
    console.log(`Отправка запроса к Google Gemini API (${endpointType})...`);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Ошибка от Google Gemini API (Статус ${response.status}):`, errText);
      let parsedError;
      try {
        parsedError = JSON.parse(errText);
      } catch (e) {}
      
      const errorMessage = parsedError?.error?.message || errText || "Неизвестная ошибка Google API";
      return res.status(response.status).json({ 
        error: `Google Gemini API вернул ошибку: ${errorMessage} (Статус ${response.status}). Убедитесь, что ваш API-ключ активен и не имеет ограничений по региону.` 
      });
    }

    const data = await response.json();
    console.log("Успешный ответ от Google Gemini API получен.");

    if (endpointType === "tts") {
      return res.status(200).json(data);
    } else {
      const textResponse = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResponse) {
        console.error("Структура ответа Google API не содержит текста:", JSON.stringify(data));
        return res.status(500).json({ error: 'ИИ вернул пустой ответ или структура ответа изменилась.' });
      }

      // Возвращаем чистый текст. Фронтенд сам разберется, парсить его как JSON или выводить как текст.
      return res.status(200).json({ text: textResponse });
    }
  } catch (error) {
    console.error("Исключение в обработчике бэкенда Vercel:", error);
    return res.status(500).json({ error: `Внутренняя ошибка сервера Vercel: ${error.message}` });
  }
}