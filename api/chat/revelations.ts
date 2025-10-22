import type { VercelRequest, VercelResponse } from '@vercel/node';

function buildRevelationsContext(narrative: string, gameState: any): string {
  const sections: string[] = [];
  
  sections.push(`# Turn Count: ${gameState.turnCount || 0}`);
  sections.push('');
  
  // Player character
  sections.push('# Player Character');
  sections.push(`Name: ${gameState.character.name}`);
  if (gameState.character.backstory) {
    sections.push(`Backstory: ${gameState.character.backstory.substring(0, 300)}...`);
  }
  if (gameState.character.revelations && gameState.character.revelations.length > 0) {
    sections.push('Existing Revelations:');
    gameState.character.revelations.forEach((rev: any) => {
      sections.push(`- Turn ${rev.revealedAtTurn || '?'}: ${rev.text}`);
    });
  }
  sections.push('');
  
  // Companions
  if (gameState.companions && gameState.companions.length > 0) {
    sections.push('# Companions');
    gameState.companions.forEach((comp: any) => {
      sections.push(`## ${comp.name} (ID: ${comp.id})`);
      if (comp.backstory) {
        sections.push(`Backstory: ${comp.backstory.substring(0, 300)}...`);
      }
      if (comp.revelations && comp.revelations.length > 0) {
        sections.push('Existing Revelations:');
        comp.revelations.forEach((rev: any) => {
          sections.push(`- Turn ${rev.revealedAtTurn || '?'}: ${rev.text}`);
        });
      }
      sections.push('');
    });
  }
  
  // NPCs
  if (gameState.encounteredCharacters && gameState.encounteredCharacters.length > 0) {
    sections.push('# Encountered Characters (NPCs)');
    gameState.encounteredCharacters.forEach((npc: any) => {
      sections.push(`## ${npc.name} (ID: ${npc.id})`);
      if (npc.backstory) {
        sections.push(`Backstory: ${npc.backstory.substring(0, 300)}...`);
      }
      if (npc.revelations && npc.revelations.length > 0) {
        sections.push('Existing Revelations:');
        npc.revelations.forEach((rev: any) => {
          sections.push(`- Turn ${rev.revealedAtTurn || '?'}: ${rev.text}`);
        });
      }
      sections.push('');
    });
  }
  
  // Current Location
  sections.push('# Current Location');
  sections.push(`Name: ${gameState.location.name}`);
  if (gameState.location.backstory) {
    sections.push(`Backstory: ${gameState.location.backstory.substring(0, 300)}...`);
  }
  if (gameState.location.revelations && gameState.location.revelations.length > 0) {
    sections.push('Existing Revelations:');
    gameState.location.revelations.forEach((rev: any) => {
      sections.push(`- Turn ${rev.revealedAtTurn || '?'}: ${rev.text}`);
    });
  }
  sections.push('');
  
  // Previous Locations
  if (gameState.previousLocations && gameState.previousLocations.length > 0) {
    sections.push('# Previous Locations');
    gameState.previousLocations.slice(-3).forEach((loc: any) => {
      sections.push(`## ${loc.name}`);
      if (loc.backstory) {
        sections.push(`Backstory: ${loc.backstory.substring(0, 200)}...`);
      }
      if (loc.revelations && loc.revelations.length > 0) {
        sections.push('Existing Revelations:');
        loc.revelations.forEach((rev: any) => {
          sections.push(`- Turn ${rev.revealedAtTurn || '?'}: ${rev.text}`);
        });
      }
      sections.push('');
    });
  }
  
  return sections.join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { systemPrompt, narrative, gameState, model, apiKey } = req.body;
    const key = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || '';
    
    if (!key) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    // Build context with all entities that have backstories
    const context = buildRevelationsContext(narrative, gameState);
    
    // Build the full prompt
    const fullPrompt = `${systemPrompt}\n\n# Narrative Response\n\n${narrative}\n\n# Game Context\n\n${context}\n\nAnalyze the narrative and extract any revelations. Remember to return ONLY raw JSON with a "revelations" array.`;
    
    console.log('[REVELATIONS] Tracking revelations using model', model);
    
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
        max_tokens: 800,
        temperature: 0.3,
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[REVELATIONS] OpenRouter API error:', errorData);
      return res.status(response.status).json({
        error: `OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`,
        fullPrompt,
        rawResponse: JSON.stringify(errorData, null, 2)
      });
    }
    
    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    console.log('[REVELATIONS] Raw response:', rawContent.substring(0, 200));
    
    // Parse JSON response
    let parsedData;
    try {
      // Try to extract JSON from code fences if present
      const jsonMatch = rawContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                        rawContent.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
      parsedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('[REVELATIONS] Failed to parse JSON:', parseError);
      return res.status(500).json({
        error: 'Failed to parse revelations JSON from LLM response',
        fullPrompt,
        rawResponse: rawContent
      });
    }
    
    // Process revelations to map them to entities
    const rawRevelations = parsedData.revelations || [];
    const processedRevelations: any[] = [];
    
    rawRevelations.forEach((rev: any) => {
      // Check if revelation already has correct format
      if (rev.entityType && rev.entityId && rev.text) {
        processedRevelations.push(rev);
        return;
      }
      
      // Handle old/wrong format from LLM - try to map based on type and content
      const content = rev.content || rev.text || '';
      const type = rev.type || '';
      
      // Try to extract entity from content using game state context
      let entityType = null;
      let entityId = null;
      let entityName = null;
      
      // Check for location revelations
      if (type.includes('location') || type.includes('geography')) {
        if (gameState.location && content.includes(gameState.location.name)) {
          entityType = 'location';
          entityId = gameState.location.name;
          entityName = gameState.location.name;
        }
      }
      
      // Check for business revelations
      if (type.includes('business')) {
        if (gameState.businesses && gameState.businesses.length > 0) {
          const business = gameState.businesses.find((b: any) => 
            content.toLowerCase().includes(b.name.toLowerCase())
          );
          if (business) {
            entityType = 'business';
            entityId = business.id;
            entityName = business.name;
          }
        }
      }
      
      // Check for NPC revelations
      if (type.includes('relationship') || type.includes('character_trait')) {
        if (gameState.encounteredCharacters && gameState.encounteredCharacters.length > 0) {
          const npc = gameState.encounteredCharacters.find((n: any) => 
            content.toLowerCase().includes(n.name.toLowerCase())
          );
          if (npc) {
            entityType = 'npc';
            entityId = npc.id;
            entityName = npc.name;
          }
        }
      }
      
      // Check for companion revelations
      if (gameState.companions && gameState.companions.length > 0) {
        const companion = gameState.companions.find((c: any) => 
          content.toLowerCase().includes(c.name.toLowerCase())
        );
        if (companion) {
          entityType = 'companion';
          entityId = companion.id;
          entityName = companion.name;
        }
      }
      
      // Check for character revelations
      if (gameState.character && content.toLowerCase().includes(gameState.character.name.toLowerCase())) {
        entityType = 'character';
        entityId = 'character';
        entityName = gameState.character.name;
      }
      
      // If we found an entity match, add the revelation
      if (entityType && entityId) {
        processedRevelations.push({
          entityType,
          entityId,
          entityName,
          text: content,
          revealedAtTurn: gameState.turnCount || 0
        });
      } else {
        // Log unmatched revelations for debugging
        console.log(`[REVELATIONS] Could not match revelation to entity: ${type} - ${content.substring(0, 50)}...`);
      }
    });
    
    res.json({
      revelations: processedRevelations,
      usage: data.usage,
      model: data.model,
      fullPrompt,
      rawResponse: rawContent
    });
  } catch (error: any) {
    console.error('[REVELATIONS] Error:', error.message);
    res.status(500).json({ 
      error: error.message,
      fullPrompt: req.body.systemPrompt || 'Prompt not available',
      rawResponse: JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
    });
  }
}
