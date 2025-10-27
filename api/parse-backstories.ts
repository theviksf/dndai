import type { VercelRequest, VercelResponse } from '@vercel/node';

// Helper functions for robust JSON parsing
function sanitizeBackstoryJSON(jsonString: string): string {
  // Remove BOM
  let cleaned = jsonString.replace(/^\uFEFF/, '');
  
  // Normalize curly quotes to straight quotes using unicode ranges
  cleaned = cleaned.replace(/[\u201C\u201D]/g, '"'); // " " to "
  cleaned = cleaned.replace(/[\u2018\u2019]/g, "'"); // ' ' to '
  
  // Remove trailing commas before closing braces/brackets
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
  // Track whether we're inside a string to avoid counting braces in string literals
  let braceCount = 0;
  let startIndex = -1;
  let inString = false;
  let escapeNext = false;
  
  for (let i = 0; i < rawContent.length; i++) {
    const char = rawContent[i];
    
    // Handle escape sequences
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    // Track string boundaries (double quotes only, as JSON uses double quotes)
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    // Only count braces outside of strings
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
        max_tokens: 4000,
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
    
    // Check if response was truncated due to token limit
    if (data.choices[0].finish_reason === 'length') {
      console.warn('[BACKSTORY PARSER] Response truncated due to max_tokens limit');
      return res.status(500).json({
        error: 'Backstory parser response exceeded token limit. Response was truncated. Try reducing the number of entities or simplifying backstories.',
        fullPrompt,
        rawResponse: rawContent,
        finishReason: 'length'
      });
    }
    
    console.log('[BACKSTORY PARSER] Raw response length:', rawContent.length);
    console.log('[BACKSTORY PARSER] Raw response preview:', rawContent.substring(0, 300));
    
    // Parse JSON response using robust extraction and parsing
    let parsedData;
    try {
      parsedData = extractAndParseBackstoryJSON(rawContent);
      console.log('[BACKSTORY PARSER] Successfully parsed JSON from response');
      console.log('[BACKSTORY PARSER] Parsed data keys:', Object.keys(parsedData));
    } catch (parseError: any) {
      console.error('[BACKSTORY PARSER] Failed to extract valid JSON:', parseError.message);
      console.error('[BACKSTORY PARSER] Raw response:', rawContent);
      return res.status(500).json({
        error: 'LLM returned non-JSON response. The model ignored JSON-only instructions and returned narrative text instead.',
        fullPrompt,
        rawResponse: rawContent
      });
    }
    
    // Transform LLM response to expected format
    // LLM may return different structures, so normalize to entityUpdates format
    let entityUpdates: any;
    
    if (parsedData.entityUpdates) {
      // LLM followed the exact format
      console.log('[BACKSTORY PARSER] LLM followed entityUpdates format directly');
      entityUpdates = parsedData.entityUpdates;
    } else {
      // LLM returned alternative format - transform it
      console.log('[BACKSTORY PARSER] Transforming LLM response to entityUpdates format');
      console.log('[BACKSTORY PARSER] Source data structure:', {
        hasNpcs: !!parsedData.npcs,
        hasCompanions: !!parsedData.companions,
        hasParty: !!parsedData.party,
        hasCurrentLocation: !!parsedData.current_location,
        hasLocation: !!parsedData.location,
        hasLocations: !!parsedData.locations,
        hasQuests: !!parsedData.quests
      });
      entityUpdates = {
        npcs: [] as any[],
        companions: [] as any[],
        locations: [] as any[],
        quests: [] as any[]
      };
      
      // Map npcs array
      if (Array.isArray(parsedData.npcs)) {
        entityUpdates.npcs = parsedData.npcs.map((npc: any) => ({
          id: npc.id || npc.name?.toLowerCase().replace(/\s+/g, '-'),
          updates: npc.updates || npc
        }));
      }
      
      // Map companions/party array
      const companionsArray = parsedData.companions || parsedData.party || [];
      if (Array.isArray(companionsArray)) {
        entityUpdates.companions = companionsArray.map((comp: any) => ({
          id: comp.id || comp.name?.toLowerCase().replace(/\s+/g, '-'),
          updates: comp.updates || comp
        }));
      }
      
      // Map locations (could be current_location, location, or locations array)
      if (parsedData.current_location) {
        const locData = parsedData.current_location;
        entityUpdates.locations.push({
          id: locData.id || (locData.name ? locData.name.toLowerCase().replace(/\s+/g, '-') : 'current'),
          updates: locData
        });
      } else if (parsedData.location && !Array.isArray(parsedData.location)) {
        const locData = parsedData.location;
        entityUpdates.locations.push({
          id: locData.id || (locData.name ? locData.name.toLowerCase().replace(/\s+/g, '-') : 'current'),
          updates: locData
        });
      }
      
      if (Array.isArray(parsedData.locations)) {
        entityUpdates.locations.push(...parsedData.locations.map((loc: any) => {
          const locData = loc.updates || loc;
          return {
            id: loc.id || (locData.name ? locData.name.toLowerCase().replace(/\s+/g, '-') : 'unknown-location'),
            updates: locData
          };
        }));
      }
      
      // Map quests array
      if (Array.isArray(parsedData.quests)) {
        entityUpdates.quests = parsedData.quests.map((quest: any) => ({
          id: quest.id || quest.title?.toLowerCase().replace(/\s+/g, '-'),
          updates: quest.updates || quest
        }));
      }
    }
    
    // Normalize entity updates to ensure arrays
    if (!Array.isArray(entityUpdates.npcs)) entityUpdates.npcs = [];
    if (!Array.isArray(entityUpdates.companions)) entityUpdates.companions = [];
    if (!Array.isArray(entityUpdates.locations)) entityUpdates.locations = [];
    if (!Array.isArray(entityUpdates.quests)) entityUpdates.quests = [];
    
    const updateCounts = {
      npcs: entityUpdates.npcs.length,
      companions: entityUpdates.companions.length,
      locations: entityUpdates.locations.length,
      quests: entityUpdates.quests.length
    };
    
    console.log('[BACKSTORY PARSER] Entity updates extracted:', updateCounts);
    
    // Log detailed update information for debugging
    if (updateCounts.npcs > 0) {
      console.log('[BACKSTORY PARSER] NPC updates:', entityUpdates.npcs.map((u: any) => ({
        id: u.id,
        updateFields: Object.keys(u.updates || {})
      })));
    }
    if (updateCounts.companions > 0) {
      console.log('[BACKSTORY PARSER] Companion updates:', entityUpdates.companions.map((u: any) => ({
        id: u.id,
        updateFields: Object.keys(u.updates || {})
      })));
    }
    if (updateCounts.locations > 0) {
      console.log('[BACKSTORY PARSER] Location updates:', entityUpdates.locations.map((u: any) => ({
        id: u.id,
        updateFields: Object.keys(u.updates || {})
      })));
    }
    if (updateCounts.quests > 0) {
      console.log('[BACKSTORY PARSER] Quest updates:', entityUpdates.quests.map((u: any) => ({
        id: u.id,
        updateFields: Object.keys(u.updates || {})
      })));
    }
    
    if (updateCounts.npcs === 0 && updateCounts.companions === 0 && updateCounts.locations === 0 && updateCounts.quests === 0) {
      console.warn('[BACKSTORY PARSER] WARNING: No entity updates extracted from backstories');
      console.warn('[BACKSTORY PARSER] This may indicate the LLM did not find extractable details or misunderstood the task');
    }
    
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
