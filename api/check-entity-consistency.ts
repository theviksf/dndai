import type { VercelRequest, VercelResponse } from '@vercel/node';

// Robust JSON parsing helpers (copied from parser guardrails)
function sanitizeJSON(jsonString: string): string {
  // Remove BOM
  let cleaned = jsonString.replace(/^\uFEFF/, '');
  
  // Normalize curly quotes to straight quotes using unicode ranges
  cleaned = cleaned.replace(/[\u201C\u201D]/g, '"'); // " " to "
  cleaned = cleaned.replace(/[\u2018\u2019]/g, "'"); // ' ' to '
  
  // Remove trailing commas before closing braces/brackets
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  
  return cleaned.trim();
}

function extractAndParseJSON(content: string): any {
  const rawContent = content.trim();
  
  // Strategy 1: Try to extract from code fences
  const allFences = rawContent.matchAll(/```([a-zA-Z]*)\s*([\s\S]*?)\s*```/g);
  const fencedBlocks = Array.from(allFences);
  
  for (const match of fencedBlocks) {
    const candidate = match[2].trim();
    if (candidate.startsWith('{') || candidate.startsWith('[')) {
      try {
        const sanitized = sanitizeJSON(candidate);
        const parsed = JSON.parse(sanitized);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      } catch (e) {
        continue;
      }
    }
  }
  
  // Strategy 2: Try raw content if it looks like JSON
  if (rawContent.startsWith('{') || rawContent.startsWith('[')) {
    try {
      const sanitized = sanitizeJSON(rawContent);
      const parsed = JSON.parse(sanitized);
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch (e) {
      // Continue to next strategy
    }
  }
  
  // Strategy 3: Try to find the first balanced JSON object using brace counting
  let braceCount = 0;
  let startIndex = -1;
  
  for (let i = 0; i < rawContent.length; i++) {
    if (rawContent[i] === '{') {
      if (braceCount === 0) startIndex = i;
      braceCount++;
    } else if (rawContent[i] === '}') {
      braceCount--;
      if (braceCount === 0 && startIndex !== -1) {
        try {
          const candidate = rawContent.substring(startIndex, i + 1);
          const sanitized = sanitizeJSON(candidate);
          const parsed = JSON.parse(sanitized);
          if (parsed && typeof parsed === 'object') {
            return parsed;
          }
        } catch (e) {
          // Continue searching
        }
        startIndex = -1;
      }
    }
  }
  
  throw new Error('No valid JSON found in checker response');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { systemPrompt, entity, entityType, backstory, model, apiKey } = req.body;
    const key = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || '';
    
    if (!key) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    // Build the full prompt
    const fullPrompt = `${systemPrompt}\n\nEntity Type: ${entityType}\n\nEntity Data:\n${JSON.stringify(entity, null, 2)}\n\nBackstory:\n${backstory}\n\nPlease analyze the backstory and return JSON with entity updates that align with the backstory. Remember to return ONLY raw JSON with an "entityUpdates" field.`;
    
    console.log('[CHECKER] Checking consistency for', entityType, 'using model', model);
    
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
        max_tokens: 500,
        temperature: 0.3,
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[CHECKER] OpenRouter API error:', errorData);
      return res.status(response.status).json({
        error: `OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`,
        fullPrompt,
        rawResponse: JSON.stringify(errorData, null, 2)
      });
    }
    
    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    console.log('[CHECKER] Raw response:', rawContent.substring(0, 200));
    
    // Parse JSON response using robust guardrails
    let parsedData;
    try {
      parsedData = extractAndParseJSON(rawContent);
    } catch (parseError) {
      console.error('[CHECKER] Failed to parse JSON:', parseError);
      return res.status(500).json({
        error: 'Failed to parse checker JSON from LLM response',
        fullPrompt,
        rawResponse: rawContent
      });
    }
    
    // Validate that entityUpdates exists
    if (!parsedData.entityUpdates && parsedData.entityUpdates !== null) {
      console.warn('[CHECKER] No entityUpdates field in response, returning empty updates');
      parsedData.entityUpdates = {};
    }
    
    // Normalize objectives: convert string arrays to proper objective objects
    if (parsedData.entityUpdates?.objectives && Array.isArray(parsedData.entityUpdates.objectives)) {
      parsedData.entityUpdates.objectives = parsedData.entityUpdates.objectives.map((obj: any) => {
        // If it's already an object with text and completed, return as-is
        if (typeof obj === 'object' && obj !== null && 'text' in obj && 'completed' in obj) {
          return obj;
        }
        // If it's a string or object without proper structure, convert it
        return {
          text: typeof obj === 'string' ? obj : (obj.text || String(obj)),
          completed: typeof obj === 'object' && obj !== null ? (obj.completed || false) : false
        };
      });
    }
    
    res.json({
      entityUpdates: parsedData.entityUpdates,
      usage: data.usage,
      model: data.model,
      fullPrompt,
      rawResponse: rawContent
    });
  } catch (error: any) {
    console.error('[CHECKER] Error:', error.message);
    res.status(500).json({ 
      error: error.message,
      fullPrompt: req.body.systemPrompt || 'Prompt not available',
      rawResponse: JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
    });
  }
}
