import type { VercelRequest, VercelResponse } from '@vercel/node';

function buildMemoriesContext(gameState: any, newCompanionIds: string[] = [], newNPCIds: string[] = []): string {
  const sections: string[] = [];
  sections.push(`Turn: ${gameState.turnCount || 0}`);
  sections.push('');
  
  // Existing companions
  if (gameState.companions && gameState.companions.length > 0) {
    sections.push('# Existing Companions');
    gameState.companions.forEach((comp: any) => {
      sections.push(`- ID: ${comp.id}, Name: ${comp.name}`);
    });
    sections.push('');
  }
  
  // New companions (need first meeting memories)
  const newCompanions = gameState.companions?.filter((c: any) => newCompanionIds.includes(c.id)) || [];
  if (newCompanions.length > 0) {
    sections.push('# NEW Companions (need first meeting memories)');
    newCompanions.forEach((comp: any) => {
      sections.push(`- ID: ${comp.id}, Name: ${comp.name}`);
    });
    sections.push('');
  }
  
  // Existing NPCs
  if (gameState.encounteredCharacters && gameState.encounteredCharacters.length > 0) {
    sections.push('# Existing NPCs');
    gameState.encounteredCharacters.forEach((npc: any) => {
      sections.push(`- ID: ${npc.id}, Name: ${npc.name}`);
    });
    sections.push('');
  }
  
  // New NPCs (need first meeting memories)
  const newNPCs = gameState.encounteredCharacters?.filter((c: any) => newNPCIds.includes(c.id)) || [];
  if (newNPCs.length > 0) {
    sections.push('# NEW NPCs (need first meeting memories)');
    newNPCs.forEach((npc: any) => {
      sections.push(`- ID: ${npc.id}, Name: ${npc.name}`);
    });
    sections.push('');
  }
  
  return sections.join('\n');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { systemPrompt, narrative, gameState, model, apiKey, newCompanionIds = [], newNPCIds = [] } = req.body;
    const key = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || '';
    
    if (!key) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    // Build context with all characters
    const context = buildMemoriesContext(gameState, newCompanionIds, newNPCIds);
    
    // Build the full prompt
    const fullPrompt = `${systemPrompt}\n\n# Narrative Response\n\n${narrative}\n\n# Game Context\n\n${context}\n\nAnalyze the narrative and extract character memories. Remember to return ONLY raw JSON with a "memories" array.`;
    
    console.log('[MEMORIES] Tracking memories using model', model);
    
    // Call OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': req.headers.referer as string || req.headers.origin as string || 'https://dnd-game.vercel.app',
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
        max_tokens: 1000,
        temperature: 0.4,
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      console.error('[MEMORIES] OpenRouter API error:', errorData);
      return res.status(response.status).json({
        error: `OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`,
        fullPrompt,
        rawResponse: JSON.stringify(errorData, null, 2)
      });
    }
    
    const data = await response.json();
    const rawContent = data.choices[0].message.content;
    
    console.log('[MEMORIES] Raw response:', rawContent.substring(0, 200));
    
    // Parse JSON response
    let parsedData;
    try {
      const jsonMatch = rawContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                        rawContent.match(/(\{[\s\S]*\})/);
      const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
      parsedData = JSON.parse(jsonStr);
    } catch (parseError) {
      console.error('[MEMORIES] Failed to parse JSON:', parseError);
      return res.status(500).json({
        error: 'Failed to parse memories JSON from LLM response',
        fullPrompt,
        rawResponse: rawContent
      });
    }
    
    const memories = parsedData.memories || [];
    
    res.json({
      memories,
      usage: data.usage,
      model: data.model,
      fullPrompt,
      rawResponse: rawContent
    });
  } catch (error: any) {
    console.error('[MEMORIES] Error:', error.message);
    res.status(500).json({ 
      error: error.message,
      fullPrompt: req.body.systemPrompt || 'Prompt not available',
      rawResponse: JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
    });
  }
}
