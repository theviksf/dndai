import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { modelId, messages, systemPrompt, maxTokens = 5000, apiKey, responseFormat } = req.body;
  
  try {
    const key = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || '';
    
    if (!key) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': req.headers.referer || req.headers.origin || 'https://dnd-game.vercel.app',
        'X-Title': 'D&D Adventure Game',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: modelId,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
        route: 'fallback',
        ...(responseFormat === 'json_object' ? {
          response_format: { type: 'json_object' },
          plugins: [{ id: 'response-healing' }],
        } : {}),
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      return res.status(502).json({ error: 'The model returned no final response. Retry or choose a different model.' });
    }
    res.json({
      content,
      usage: data.usage,
      model: data.model
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
