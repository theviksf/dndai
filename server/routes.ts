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

// 5. POST /api/generate-lore - Generate world lore
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

// 7. POST /api/generate-image - Generate images (requires R2 and RunPod/Gemini)
router.post('/generate-image', async (req: Request, res: Response) => {
  try {
    const { prompt, metadata, imageType } = req.body;
    
    // For now, return an error if R2 is not configured
    if (!s3Client || !R2_BUCKET_NAME || !R2_PUBLIC_URL) {
      return res.status(501).json({ 
        error: 'Image generation requires R2 storage configuration (R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET_NAME, R2_PUBLIC_URL)'
      });
    }
    
    // Image generation logic would go here
    // For now, return placeholder
    res.status(501).json({ 
      error: 'Image generation not yet implemented in local development server' 
    });
  } catch (error: any) {
    console.error('[IMAGE GEN] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// 8. GET /api/prompts/defaults - Load default prompts from filesystem
router.get('/prompts/defaults', async (req: Request, res: Response) => {
  try {
    const promptsDir = join(process.cwd(), 'prompts');
    
    // Load all prompts from markdown files
    const [primary, parser, imageCharacter, imageLocation, backstory, revelations, lore] = await Promise.all([
      readFile(join(promptsDir, 'primary.md'), 'utf-8'),
      readFile(join(promptsDir, 'parser.md'), 'utf-8'),
      readFile(join(promptsDir, 'image-character.md'), 'utf-8'),
      readFile(join(promptsDir, 'image-location.md'), 'utf-8'),
      readFile(join(promptsDir, 'backstory.md'), 'utf-8'),
      readFile(join(promptsDir, 'revelations.md'), 'utf-8'),
      readFile(join(promptsDir, 'lore.md'), 'utf-8'),
    ]);
    
    res.json({
      primary,
      parser,
      imageCharacter,
      imageLocation,
      backstory,
      revelations,
      lore,
    });
  } catch (error: any) {
    res.status(500).json({ error: `Failed to load default prompts: ${error.message}` });
  }
});

export default router;
