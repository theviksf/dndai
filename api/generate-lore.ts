import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { systemPrompt, context, gameState, model, apiKey } = req.body;
    const key = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || '';
    
    if (!key) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    // Build the full prompt with game context - request markdown directly
    const fullPrompt = `${systemPrompt}\n\n# Current Game Context\n\n${context}\n\nGenerate comprehensive world lore based on the current game context. Write your response in rich Markdown format with headers, paragraphs, and lists as appropriate. Do NOT use JSON - write the lore content directly as formatted text.`;
    
    console.log('[LORE GEN] Generating world lore using model', model);
    
    // Call OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': req.headers.referer || req.headers.origin || 'https://dnd-game.vercel.app',
        'X-Title': 'D&D Adventure Game',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model || 'deepseek/deepseek-chat-v3.1',
        messages: [
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.7,
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[LORE GEN] OpenRouter API error:', errorData);
      return res.status(response.status).json({
        error: `OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`,
        fullPrompt,
        rawResponse: JSON.stringify(errorData, null, 2)
      });
    }
    
    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    console.log('[LORE GEN] Raw response:', rawContent.substring(0, 200));
    
    // Use the raw content directly as markdown - no JSON parsing needed
    let worldLore = rawContent.trim();
    
    // Remove markdown code fences if present
    worldLore = worldLore.replace(/^```(?:markdown|md)?\s*\n/i, '').replace(/\n```\s*$/i, '');
    
    res.json({
      worldLore,
      usage: data.usage,
      model: data.model,
      fullPrompt,
      rawResponse: rawContent
    });
  } catch (error: any) {
    console.error('[LORE GEN] Error:', error.message);
    res.status(500).json({ 
      error: error.message,
      fullPrompt: req.body.systemPrompt || 'Prompt not available',
      rawResponse: JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
    });
  }
}
