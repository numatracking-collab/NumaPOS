import express from 'express';

const router = express.Router();

router.post('/ad-specs', async (req, res) => {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY no configurada en .env' });
  }

  try {
    // Groq usa el mismo formato que OpenAI — solo cambia la URL y el modelo
    const body = {
      ...req.body,
      model: 'llama-3.3-70b-versatile',  // gratis, muy capaz para JSON
    };

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('Groq error:', data);
      return res.status(response.status).json(data);
    }

    // Groq devuelve formato OpenAI → convertir al formato Anthropic que espera el frontend
    const text = data.choices?.[0]?.message?.content ?? '';
    res.json({
      content: [{ type: 'text', text }],
    });

  } catch (err) {
    console.error('Proxy error:', err);
    res.status(500).json({ error: err.message });
  }
});

export default router;