import type { VercelRequest, VercelResponse } from '@vercel/node';

// Helper functions for robust JSON parsing (same as parse-backstories.ts)
function sanitizeBackstoryJSON(jsonString: string): string {
  let cleaned = jsonString.replace(/^\uFEFF/, '');
  cleaned = cleaned.replace(/[\u201C\u201D]/g, '"');
  cleaned = cleaned.replace(/[\u2018\u2019]/g, "'");
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
  return cleaned.trim();
}

function extractAndParseBackstoryJSON(content: string): any {
  const rawContent = content.trim();
  
  // Strategy 1: Try to extract from code fences
  const allFences = rawContent.matchAll(/```([a-zA-Z]*)\s*([\s\S]*?)\s*```/g);
  const fencedBlocks = Array.from(allFences);
  
  for (const match of fencedBlocks) {
    const candidate = match[2].trim();
    if (candidate.startsWith('{') || candidate.startsWith('[')) {
      try {
        const sanitized = sanitizeBackstoryJSON(candidate);
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
      const sanitized = sanitizeBackstoryJSON(rawContent);
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
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < rawContent.length; i++) {
    const char = rawContent[i];
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{') {
        if (braceCount === 0) startIndex = i;
        braceCount++;
      } else if (char === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          try {
            const candidate = rawContent.substring(startIndex, i + 1);
            const sanitized = sanitizeBackstoryJSON(candidate);
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
  }
  
  throw new Error('No valid JSON found in backstory parser response');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { systemPrompt, context, entityType, entity, model, apiKey } = req.body;
    const key = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || '';
    
    if (!key) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    // Build the full prompt
    const fullPrompt = `${systemPrompt}\n\n${context}`;
    
    console.log('[BACKSTORY PARSER SINGLE] Parsing single', entityType, 'backstory using model', model);
    
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
        max_tokens: 2000, // Reduced since we're parsing one entity
        temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[BACKSTORY PARSER SINGLE] OpenRouter API error:', errorData);
      return res.status(response.status).json({
        error: `OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`,
        fullPrompt,
        rawResponse: JSON.stringify(errorData, null, 2)
      });
    }
    
    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    console.log('[BACKSTORY PARSER SINGLE] Raw response length:', rawContent.length);
    
    // Parse JSON response
    let parsedData;
    try {
      parsedData = extractAndParseBackstoryJSON(rawContent);
      console.log('[BACKSTORY PARSER SINGLE] Successfully parsed JSON from response');
    } catch (parseError: any) {
      console.error('[BACKSTORY PARSER SINGLE] Failed to extract valid JSON:', parseError.message);
      return res.status(500).json({
        error: 'LLM returned non-JSON response',
        fullPrompt,
        rawResponse: rawContent
      });
    }
    
    // Return the parsed single entity update
    res.json({
      entityType: parsedData.entityType || entityType,
      entityId: parsedData.entityId || entity.id,
      updates: parsedData.updates || {},
      summary: parsedData.summary || 'No updates extracted',
      usage: data.usage,
      model: data.model,
      fullPrompt,
      rawResponse: rawContent
    });
  } catch (error: any) {
    console.error('[BACKSTORY PARSER SINGLE] Error:', error.message);
    res.status(500).json({ 
      error: error.message,
      fullPrompt: req.body.systemPrompt || 'Prompt not available',
      rawResponse: JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
    });
  }
}
