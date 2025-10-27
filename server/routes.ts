/**
 * Express API Routes for Local Development
 * 
 * These routes mirror the Vercel serverless functions in /api directory
 * to enable local development in Replit while keeping Vercel deployment working.
 */

import { Router, type Request, type Response } from 'express';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const router = Router();

// R2 configuration from environment variables
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Initialize S3 client for Cloudflare R2 (only if credentials are available)
let s3Client: S3Client | null = null;
if (R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_ENDPOINT) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: R2_ENDPOINT,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

// Helper function to get API key from request
function getApiKey(req: Request): string {
  const { apiKey } = req.body;
  return apiKey || process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || '';
}

// 1. GET /api/models - Fetch OpenRouter models
router.post('/models', async (req: Request, res: Response) => {
  try {
    const key = getApiKey(req);
    
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
});

// 2. POST /api/llm/chat - Non-streaming LLM chat completions
router.post('/llm/chat', async (req: Request, res: Response) => {
  const { modelId, messages, systemPrompt, maxTokens = 1000 } = req.body;
  
  try {
    const key = getApiKey(req);
    
    if (!key) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': req.headers.referer || req.headers.origin || 'http://localhost:5000',
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
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    res.json({
      content: data.choices[0].message.content,
      usage: data.usage,
      model: data.model
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 3. POST /api/llm/chat/stream - Streaming LLM chat completions
router.post('/llm/chat/stream', async (req: Request, res: Response) => {
  const { modelId, messages, systemPrompt, maxTokens = 1000 } = req.body;
  
  try {
    const key = getApiKey(req);
    
    if (!key) {
      return res.status(400).json({ error: 'API key required' });
    }
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': req.headers.referer || req.headers.origin || 'http://localhost:5000',
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
        stream: true,
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`);
    }
    
    // Set headers for SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Pipe the stream directly to the client
    if (response.body) {
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value);
          res.write(chunk);
        }
        res.end();
      } catch (error) {
        console.error('Streaming error:', error);
        res.end();
      }
    } else {
      res.end();
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// 4. POST /api/generate-backstory - Generate entity backstories
router.post('/generate-backstory', async (req: Request, res: Response) => {
  try {
    const { systemPrompt, context, entity, entityType, model } = req.body;
    const key = getApiKey(req);
    
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
        'HTTP-Referer': req.headers.referer || req.headers.origin || 'http://localhost:5000',
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
});

// Helper functions for robust JSON parsing (backstory parser)
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

// 5. POST /api/parse-backstories - Parse backstories for entity updates
router.post('/parse-backstories', async (req: Request, res: Response) => {
  try {
    const { systemPrompt, context, gameState, model } = req.body;
    const key = getApiKey(req);
    
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
        'HTTP-Referer': req.headers.referer || req.headers.origin || 'http://localhost:5000',
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
    
    // Parse JSON response using robust extraction and parsing
    let parsedData;
    try {
      parsedData = extractAndParseBackstoryJSON(rawContent);
    } catch (parseError: any) {
      console.error('[BACKSTORY PARSER] Failed to extract valid JSON:', parseError.message);
      console.error('[BACKSTORY PARSER] Raw response:', rawContent);
      return res.status(500).json({
        error: 'LLM returned non-JSON response. The model ignored JSON-only instructions and returned narrative text instead.',
        fullPrompt,
        rawResponse: rawContent
      });
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
});

// 6. POST /api/generate-lore - Generate world lore
router.post('/generate-lore', async (req: Request, res: Response) => {
  try {
    const { systemPrompt, context, model } = req.body;
    const key = getApiKey(req);
    
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
        'HTTP-Referer': req.headers.referer || req.headers.origin || 'http://localhost:5000',
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
});

// Helper function to build revelations context
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
  
  return sections.join('\n');
}

// 6. POST /api/chat/revelations - Track backstory revelations
router.post('/chat/revelations', async (req: Request, res: Response) => {
  try {
    const { systemPrompt, narrative, gameState, model } = req.body;
    const key = getApiKey(req);
    
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
        'HTTP-Referer': req.headers.referer || req.headers.origin || 'http://localhost:5000',
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
    
    // Parse JSON response (same logic as Vercel function)
    let parsedData;
    try {
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
    
    // Process revelations (simplified - full logic would be copied from Vercel function)
    const revelations = parsedData.revelations || [];
    
    res.json({
      revelations,
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
});

// Helper functions for image generation
function sanitizeForFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9-]/g, '_');
}

function generateCharacterFilename(metadata: any): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const parts = [
    sanitizeForFilename(metadata.age || 'NA'),
    sanitizeForFilename(metadata.sex || 'NA'),
    sanitizeForFilename(metadata.race || 'NA'),
    sanitizeForFilename(metadata.job || 'NA'),
    sanitizeForFilename(metadata.mood || 'NA'),
  ];
  return `char_${parts.join('-')}_${metadata.sessionId}_${timestamp}.png`;
}

function generateLocationFilename(metadata: any): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const parts = [
    sanitizeForFilename(metadata.environment || 'NA'),
    sanitizeForFilename(metadata.timeOfDay || 'NA'),
    sanitizeForFilename(metadata.weather || 'NA'),
    sanitizeForFilename(metadata.region || 'NA'),
    sanitizeForFilename(metadata.vibe || 'NA'),
  ];
  return `loc_${parts.join('-')}_${metadata.sessionId}_${timestamp}.png`;
}

function generateBusinessFilename(metadata: any): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const parts = [
    sanitizeForFilename(metadata.name || 'NA'),
    sanitizeForFilename(metadata.type || 'shop'),
  ];
  return `biz_${parts.join('-')}_${metadata.sessionId}_${timestamp}.png`;
}

async function uploadImageToR2(base64Image: string, filename: string): Promise<string> {
  if (!s3Client || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
    throw new Error('R2 configuration missing');
  }
  
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: filename,
    Body: buffer,
    ContentType: 'image/png',
  });

  await s3Client.send(command);
  return `${R2_PUBLIC_URL}/${filename}`;
}

// 7. POST /api/generate-image - Generate images (requires R2 and RunPod/Gemini)
router.post('/generate-image', async (req: Request, res: Response) => {
  try {
    const { entityType, entity, promptTemplate, apiKey, sessionId, provider = 'flux', existingJobId } = req.body;
    const entityData = entity;
    
    const openRouterKey = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || '';
    const runPodKey = process.env.RUNPOD_API_KEY || '';
    
    console.log('[IMAGE GEN] Request:', {
      entityType,
      entityName: entityData?.name,
      provider,
      hasOpenRouterKey: !!openRouterKey,
      hasRunPodKey: !!runPodKey,
      promptTemplateLength: promptTemplate?.length,
      existingJobId: existingJobId || 'none'
    });
    
    // Validate API keys based on provider
    if (provider === 'flux' && !runPodKey) {
      console.error('[IMAGE GEN] Error: No RunPod API key available for Flux provider');
      return res.status(400).json({ 
        error: 'RunPod API key required for Flux image generation',
        filledPrompt: promptTemplate || 'No template provided'
      });
    }
    
    if (provider === 'gemini' && !openRouterKey) {
      console.error('[IMAGE GEN] Error: No OpenRouter API key available for Gemini provider');
      return res.status(400).json({ 
        error: 'OpenRouter API key required for Gemini image generation',
        filledPrompt: promptTemplate || 'No template provided'
      });
    }
    
    if (!promptTemplate) {
      console.error('[IMAGE GEN] Error: No prompt template provided');
      return res.status(400).json({ 
        error: 'Prompt template required',
        filledPrompt: 'No template provided'
      });
    }
    
    // Fill in template placeholders
    let filledPrompt = promptTemplate;
    
    if (entityType === 'character' || entityType === 'companion' || entityType === 'npc') {
      filledPrompt = filledPrompt
        .replace(/\[age\]/g, entityData.age || '')
        .replace(/\[sex\]/g, entityData.sex || '')
        .replace(/\[race\]/g, entityData.race || '')
        .replace(/\[class\]/g, entityData.class || '')
        .replace(/\[role\]/g, entityData.role || '')
        .replace(/\[name\]/g, entityData.name || '')
        .replace(/\[hair_color\]/g, entityData.hairColor || '')
        .replace(/\[outfit\]/g, entityData.outfit || '')
        .replace(/\[body_type\]/g, entityData.bodyType || '')
        .replace(/\[appearance\]/g, entityData.appearance || entityData.personality || '')
        .replace(/\[description\]/g, entityData.description || '')
        .replace(/\[brief description of expression\/specific gear\/personality trait\]/g, entityData.appearance || entityData.description || entityData.personality || '');
    } else if (entityType === 'location' || entityType === 'business') {
      filledPrompt = filledPrompt
        .replace(/\[location_name\]/g, entityData.name || 'unknown location')
        .replace(/\[location_description\]/g, entityData.description || 'a mysterious place')
        .replace(/\[notable landmarks or characteristics\]/g, entityData.landmarks || 'unique features');
    }
    
    console.log('[IMAGE GEN] Filled prompt:', filledPrompt.substring(0, 200) + '...');
    
    let imageUrl: string | null = null;
    let usage: any = null;
    let model = '';
    
    if (provider === 'flux') {
      // Call RunPod Flux API
      console.log('[IMAGE GEN] Using Flux 1.1 Schnell via RunPod');
      
      let jobId = existingJobId;
      
      // If we have an existing job ID, check its status first instead of creating a new job
      if (existingJobId) {
        console.log('[IMAGE GEN] Checking status of existing job:', existingJobId);
      } else {
        // Create a new job only if we don't have an existing one
        const runPodResponse = await fetch('https://api.runpod.ai/v2/black-forest-labs-flux-1-schnell/run', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${runPodKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            input: {
              prompt: filledPrompt,
              seed: -1,
              num_inference_steps: 4,
              guidance: 7,
              negative_prompt: "",
              image_format: "png",
              width: 512,
              height: 512
            }
          })
        });
        
        if (!runPodResponse.ok) {
          const errorData = await runPodResponse.json();
          console.error('[IMAGE GEN] RunPod API error:', errorData);
          return res.status(runPodResponse.status).json({
            error: `RunPod API error: ${errorData.error || 'Unknown error'}`,
            filledPrompt,
            rawResponse: JSON.stringify(errorData, null, 2)
          });
        }
        
        const runPodData = await runPodResponse.json();
        console.log('[IMAGE GEN] RunPod response:', {
          status: runPodData.status,
          id: runPodData.id
        });
        
        jobId = runPodData.id;
      }
      
      // Poll for job completion
      let jobComplete = false;
      let attempts = 0;
      const maxAttempts = 30;
      
      while (!jobComplete && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        attempts++;
        
        const statusResponse = await fetch(`https://api.runpod.ai/v2/black-forest-labs-flux-1-schnell/status/${jobId}`, {
          headers: {
            'Authorization': `Bearer ${runPodKey}`
          }
        });
        
        const statusData = await statusResponse.json();
        console.log(`[IMAGE GEN] RunPod job status (attempt ${attempts}):`, statusData.status);
        
        if (statusData.status === 'COMPLETED') {
          jobComplete = true;
          
          if (statusData.output?.image_url) {
            const runPodImageUrl = statusData.output.image_url;
            console.log('[IMAGE GEN] RunPod image URL:', runPodImageUrl);
            
            try {
              const imageResponse = await fetch(runPodImageUrl);
              if (!imageResponse.ok) {
                throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
              }
              const imageBuffer = await imageResponse.arrayBuffer();
              const base64Image = Buffer.from(imageBuffer).toString('base64');
              imageUrl = `data:image/png;base64,${base64Image}`;
              console.log('[IMAGE GEN] Successfully fetched and converted image to base64');
            } catch (fetchError: any) {
              console.error('[IMAGE GEN] Failed to fetch RunPod image:', fetchError.message);
            }
          } else {
            console.error('[IMAGE GEN] No image_url in RunPod output');
          }
          model = 'flux-1.1-schnell';
          usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
        } else if (statusData.status === 'FAILED') {
          console.error('[IMAGE GEN] RunPod job failed:', statusData.error);
          return res.status(500).json({
            error: `RunPod job failed: ${statusData.error || 'Unknown error'}`,
            filledPrompt,
            rawResponse: JSON.stringify(statusData, null, 2)
          });
        } else if (statusData.status === 'IN_QUEUE' || statusData.status === 'IN_PROGRESS') {
          // Job is still queued or processing, continue polling
          console.log(`[IMAGE GEN] Job ${jobId} is ${statusData.status}, continuing to poll...`);
        }
      }
      
      if (!jobComplete) {
        console.error('[IMAGE GEN] RunPod job still not complete after', attempts, 'attempts');
        // Return queued status with job ID so frontend can retry
        return res.status(202).json({
          status: 'IN_QUEUE',
          jobId: jobId,
          message: 'Image generation is still in progress. Please try again in a few moments.',
          filledPrompt
        });
      }
    } else {
      // Gemini image generation not yet implemented in server
      return res.status(501).json({
        error: 'Gemini image generation not yet implemented in local development server. Use Vercel deployment or switch to Flux provider.'
      });
    }
    
    // Upload to R2
    let r2ImageUrl: string | null = null;
    if (imageUrl) {
      try {
        let filename: string;
        
        if (entityType === 'location') {
          const locationMetadata = {
            environment: entityData.environment || entityData.type || 'unknown',
            timeOfDay: entityData.timeOfDay || 'day',
            weather: entityData.weather,
            region: entityData.region || entityData.name,
            vibe: entityData.vibe || entityData.atmosphere || 'neutral',
            sessionId: sessionId || 'default',
          };
          filename = generateLocationFilename(locationMetadata);
        } else if (entityType === 'business') {
          const businessMetadata = {
            name: entityData.name || 'business',
            type: entityData.type || 'shop',
            sessionId: sessionId || 'default',
          };
          filename = generateBusinessFilename(businessMetadata);
        } else {
          const characterMetadata = {
            age: entityData.age?.toString() || 'NA',
            sex: entityData.sex || entityData.gender || 'NA',
            race: entityData.race || 'NA',
            job: entityData.class || entityData.job || entityData.role || 'NA',
            mood: entityData.mood || entityData.expression,
            sessionId: sessionId || 'default',
          };
          filename = generateCharacterFilename(characterMetadata);
        }
        
        console.log('[R2 UPLOAD] Uploading image with filename:', filename);
        r2ImageUrl = await uploadImageToR2(imageUrl, filename);
        console.log('[R2 UPLOAD] Successfully uploaded to R2:', r2ImageUrl);
      } catch (uploadError: any) {
        console.error('[R2 UPLOAD] Failed to upload to R2:', uploadError.message);
        r2ImageUrl = null;
      }
    }
    
    res.json({
      imageUrl: r2ImageUrl,
      usage: usage,
      model: model,
      filledPrompt
    });
  } catch (error: any) {
    console.error('[IMAGE GEN] Error:', error.message);
    res.status(500).json({ 
      error: error.message,
      filledPrompt: req.body.promptTemplate || 'Template not available',
      rawResponse: JSON.stringify({ error: error.message, stack: error.stack }, null, 2)
    });
  }
});

// 8. GET /api/prompts/defaults - Load default prompts from filesystem
router.get('/prompts/defaults', async (req: Request, res: Response) => {
  try {
    // Prompts are stored in client/public/prompts/ for static serving and API access
    const promptsDir = join(process.cwd(), 'client', 'public', 'prompts');
    
    // Load all prompts from markdown files
    const [primary, parser, imageCharacter, imageLocation, backstory, backstoryparser, revelations, lore] = await Promise.all([
      readFile(join(promptsDir, 'primary.md'), 'utf-8'),
      readFile(join(promptsDir, 'parser.md'), 'utf-8'),
      readFile(join(promptsDir, 'image-character.md'), 'utf-8'),
      readFile(join(promptsDir, 'image-location.md'), 'utf-8'),
      readFile(join(promptsDir, 'backstory.md'), 'utf-8'),
      readFile(join(promptsDir, 'backstoryparser.md'), 'utf-8'),
      readFile(join(promptsDir, 'revelations.md'), 'utf-8'),
      readFile(join(promptsDir, 'lore.md'), 'utf-8'),
    ]);
    
    res.json({
      primary,
      parser,
      imageCharacter,
      imageLocation,
      backstory,
      backstoryparser,
      revelations,
      lore,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to load default prompts: ${error.message}` });
  }
});

export default router;
