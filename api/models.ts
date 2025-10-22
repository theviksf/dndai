import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { apiKey } = req.body;
    const key = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || '';
    
    if (!key) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        'Authorization': `Bearer ${key}`,
      }
    });
    
    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
}
