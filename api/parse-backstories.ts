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
    
    // Build the full prompt
    const fullPrompt = `${systemPrompt}\n\n${context}`;
    
    console.log('[BACKSTORY PARSER] Parsing backstories for entity updates using model', model);
    
    // Call OpenRouter with strict JSON enforcement
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
            role: 'system',
            content: 'YOU ARE A JSON-ONLY API. You MUST respond with ONLY raw JSON. NO narrative text, NO code fences, NO explanations. Start with { and end with }. If you write anything except valid JSON, you have FAILED your task.'
          },
          {
            role: 'user',
            content: fullPrompt
          }
        ],
        max_tokens: 2000,
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[BACKSTORY PARSER] OpenRouter API error:', errorData);
      return res.status(response.status).json({
        error: `OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`,
        fullPrompt,
        rawResponse: JSON.stringify(errorData, null, 2)
      });
    }
    
    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    console.log('[BACKSTORY PARSER] Raw response:', rawContent.substring(0, 200));
    
    // Parse JSON response with multiple fallback strategies
    let parsedData;
    try {
      // Strategy 1: Try direct JSON parse first (best case with response_format)
      parsedData = JSON.parse(rawContent);
    } catch (e1) {
      try {
        // Strategy 2: Try to extract JSON from code fences
        const jsonMatch = rawContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (jsonMatch) {
          parsedData = JSON.parse(jsonMatch[1]);
        } else {
          throw new Error('No code fence found');
        }
      } catch (e2) {
        try {
          // Strategy 3: Try to find any JSON object in the response
          const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedData = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No JSON object found');
          }
        } catch (e3) {
          console.error('[BACKSTORY PARSER] All JSON parsing strategies failed');
          console.error('[BACKSTORY PARSER] Raw response:', rawContent);
          return res.status(500).json({
            error: 'LLM returned non-JSON response. The model ignored JSON-only instructions and returned narrative text instead.',
            fullPrompt,
            rawResponse: rawContent
          });
        }
      }
    }
    
    // Ensure proper structure
    const entityUpdates = parsedData.entityUpdates || { npcs: [], companions: [], locations: [], quests: [] };
    
    // Normalize entity updates to ensure arrays
    if (!Array.isArray(entityUpdates.npcs)) entityUpdates.npcs = [];
    if (!Array.isArray(entityUpdates.companions)) entityUpdates.companions = [];
    if (!Array.isArray(entityUpdates.locations)) entityUpdates.locations = [];
    if (!Array.isArray(entityUpdates.quests)) entityUpdates.quests = [];
    
    res.json({
      entityUpdates,
      summary: parsedData.summary || 'No updates extracted',
      usage: data.usage,
      model: data.model,
      fullPrompt,
      rawResponse: rawContent
    });
  } catch (error: any) {
    console.error('[BACKSTORY PARSER] Error:', error.message);
    res.status(500).json({ 
      error: error.message,
      fullPrompt: req.body.systemPrompt || 'Prompt not available',
      rawResponse: JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
    });
  }
}
