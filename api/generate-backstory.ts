import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { systemPrompt, context, entity, entityType, model, apiKey } = req.body;
    const key = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || '';
    
    if (!key) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    // Build the full prompt
    const fullPrompt = `${systemPrompt}\n\n# Context for this ${entityType}\n\n${context}\n\n# Entity to create backstory for:\n${JSON.stringify(entity, null, 2)}\n\nGenerate a detailed, rich backstory for this ${entityType}. Remember to return ONLY raw JSON with a "backstory" field.`;
    
    console.log('[BACKSTORY GEN] Generating backstory for', entityType, 'using model', model);
    
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
        max_tokens: 3000,
        temperature: 0.8,
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[BACKSTORY GEN] OpenRouter API error:', errorData);
      return res.status(response.status).json({
        error: `OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`,
        fullPrompt,
        rawResponse: JSON.stringify(errorData, null, 2)
      });
    }
    
    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    // Check if response was truncated due to token limit
    if (data.choices[0].finish_reason === 'length') {
      console.warn('[BACKSTORY GEN] Response truncated due to max_tokens limit');
      return res.status(500).json({
        error: 'Backstory generation exceeded token limit. Response was truncated.',
        fullPrompt,
        rawResponse: rawContent,
        finishReason: 'length'
      });
    }
    
    console.log('[BACKSTORY GEN] Raw response:', rawContent.substring(0, 200));
    
    // Parse JSON response
    let parsedData;
    try {
      // Try to extract JSON from code fences if present
      const jsonMatch = rawContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                        rawContent.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
      parsedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('[BACKSTORY GEN] Failed to parse JSON:', parseError);
      return res.status(500).json({
        error: 'Failed to parse backstory JSON from LLM response',
        fullPrompt,
        rawResponse: rawContent
      });
    }
    
    // Handle backstory: convert object to string if needed
    let backstory = parsedData.backstory || null;
    if (backstory && typeof backstory === 'object') {
      // LLM returned object instead of string - convert to readable text
      console.log('[BACKSTORY GEN] Converting object backstory to string');
      backstory = Object.entries(backstory)
        .map(([key, value]) => {
          const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          return `**${label}**: ${value}`;
        })
        .join('\n\n');
    }
    
    res.json({
      backstory,
      usage: data.usage,
      model: data.model,
      fullPrompt,
      rawResponse: rawContent
    });
  } catch (error: any) {
    console.error('[BACKSTORY GEN] Error:', error.message);
    res.status(500).json({ 
      error: error.message,
      fullPrompt: req.body.systemPrompt || 'Prompt not available',
      rawResponse: JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
    });
  }
}
