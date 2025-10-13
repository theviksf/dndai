import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameStateSchema } from "@shared/schema";
import { uploadImageToR2, generateCharacterFilename, generateLocationFilename, generateBusinessFilename, type CharacterImageMetadata, type LocationImageMetadata, type BusinessImageMetadata } from "./r2-storage";
import { readFile, writeFile, copyFile } from "fs/promises";
import { join } from "path";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || "";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get default prompts from files
  app.get('/api/prompts/defaults', async (req, res) => {
    try {
      const promptsDir = join(process.cwd(), 'prompts');
      
      // Load prompts with fallback for revelations and lore (newer prompts that might not exist)
      const [primary, parser, imageCharacter, imageLocation, backstory] = await Promise.all([
        readFile(join(promptsDir, 'primary.md'), 'utf-8'),
        readFile(join(promptsDir, 'parser.md'), 'utf-8'),
        readFile(join(promptsDir, 'image-character.md'), 'utf-8'),
        readFile(join(promptsDir, 'image-location.md'), 'utf-8'),
        readFile(join(promptsDir, 'backstory.md'), 'utf-8'),
      ]);
      
      // Try to load revelations, fallback to default if missing
      let revelations: string;
      try {
        revelations = await readFile(join(promptsDir, 'revelations.md'), 'utf-8');
      } catch {
        // Fallback to default revelations prompt if file doesn't exist
        revelations = `You are a revelations tracker for a D&D adventure game. Your role is to identify when elements of an entity's backstory are revealed to the player character during the narrative.

# Mission
Analyze the DM's narrative response and extract revelations - specific backstory elements that became known to the player.

**CRITICAL RULE**: You can ONLY extract a revelation if:
1. The entity has an existing backstory in the game context
2. The revealed information connects to that backstory
3. The information hasn't already been recorded in existing revelations

# Output Format

=== CRITICAL: YOU MUST RETURN ONLY RAW JSON - NO OTHER TEXT ===

EXACT JSON FORMAT TO RETURN:
{
  "revelations": [
    {
      "entityType": "character" | "companion" | "npc" | "location",
      "entityId": "entity_id_or_character",
      "entityName": "Entity Name",
      "text": "Specific revelation text extracted from the narrative",
      "revealedAtTurn": 5
    }
  ]
}`;
      }
      
      // Try to load lore, fallback to default if missing
      let lore: string;
      try {
        lore = await readFile(join(promptsDir, 'lore.md'), 'utf-8');
      } catch {
        // Fallback to default lore prompt if file doesn't exist
        lore = `You are a World Lore Generator for a D&D adventure game. Your mission is to create comprehensive world lore based on the current game context.

# Output Format

=== CRITICAL: YOU MUST RETURN ONLY RAW JSON - NO OTHER TEXT ===

EXACT JSON FORMAT TO RETURN:
{
  "worldLore": "Your comprehensive world lore here (600-1000 words). Structure it with clear sections for World Genesis, Lore & History, Factions & Power, and Relational Geography."
}`;
      }
      
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

  // Update prompt with automatic backup
  app.post('/api/prompts/update', async (req, res) => {
    try {
      const { promptType, content } = req.body;
      
      if (!promptType || !content) {
        return res.status(400).json({ error: 'promptType and content are required' });
      }

      const fileMap: Record<string, string> = {
        primary: 'primary.md',
        parser: 'parser.md',
        imageCharacter: 'image-character.md',
        imageLocation: 'image-location.md',
        backstory: 'backstory.md',
        revelations: 'revelations.md',
        lore: 'lore.md',
      };

      const filename = fileMap[promptType];
      if (!filename) {
        return res.status(400).json({ error: 'Invalid promptType. Must be one of: primary, parser, imageCharacter, imageLocation, backstory, revelations, lore' });
      }

      const promptsDir = join(process.cwd(), 'prompts');
      const filepath = join(promptsDir, filename);
      
      // Create backup with timestamp before updating
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5); // Format: 2025-10-07T06-30-45
      const backupFilename = filename.replace('.md', `-${timestamp}.md`);
      const backupPath = join(promptsDir, backupFilename);
      
      let backupCreated = false;
      try {
        // Copy existing file to backup
        await copyFile(filepath, backupPath);
        backupCreated = true;
        console.log(`[PROMPT UPDATE] Created backup: ${backupFilename}`);
      } catch (copyError: any) {
        // If file doesn't exist yet, that's okay (new file)
        if (copyError.code === 'ENOENT') {
          console.log(`[PROMPT UPDATE] No existing file to backup (creating new file: ${filename})`);
        } else {
          // Any other error means backup failed - abort the update
          console.error('[PROMPT UPDATE] Failed to create backup:', copyError.message);
          return res.status(500).json({ 
            error: `Failed to create backup: ${copyError.message}. Update aborted to prevent data loss.`,
            backupCreated: false
          });
        }
      }
      
      // Write new content only if backup succeeded or file is new
      await writeFile(filepath, content, 'utf-8');
      console.log(`[PROMPT UPDATE] Updated ${filename}`);
      
      res.json({ 
        success: true, 
        backupCreated: backupCreated ? backupFilename : null,
        message: backupCreated 
          ? `Updated ${filename} and created backup ${backupFilename}`
          : `Created new file ${filename} (no backup needed)`
      });
    } catch (error: any) {
      console.error('[PROMPT UPDATE] Error:', error.message);
      res.status(500).json({ error: `Failed to update prompt: ${error.message}` });
    }
  });

  // OpenRouter models endpoint
  app.post('/api/models', async (req, res) => {
    try {
      const { apiKey } = req.body;
      const key = apiKey || OPENROUTER_API_KEY;
      
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

  // OpenRouter chat completion proxy (non-streaming)
  app.post('/api/llm/chat', async (req, res) => {
    const { modelId, messages, systemPrompt, maxTokens = 1000, apiKey } = req.body;
    
    try {
      const key = apiKey || OPENROUTER_API_KEY;
      
      if (!key) {
        return res.status(400).json({ error: 'API key required' });
      }
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': req.headers.referer || 'http://localhost:5000',
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

  // OpenRouter chat completion proxy (streaming)
  app.post('/api/llm/chat/stream', async (req, res) => {
    const { modelId, messages, systemPrompt, maxTokens = 1000, apiKey } = req.body;
    
    try {
      const key = apiKey || OPENROUTER_API_KEY;
      
      if (!key) {
        return res.status(400).json({ error: 'API key required' });
      }
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': req.headers.referer || 'http://localhost:5000',
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

  // Image generation endpoint
  // Backstory generation endpoint
  app.post('/api/generate-backstory', async (req, res) => {
    try {
      const { systemPrompt, context, entity, entityType, model, apiKey } = req.body;
      const key = apiKey || OPENROUTER_API_KEY;
      
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
          'HTTP-Referer': req.headers.referer || 'http://localhost:5000',
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
      
      res.json({
        backstory: parsedData.backstory || null,
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

  // World Lore generation endpoint
  app.post('/api/generate-lore', async (req, res) => {
    try {
      const { systemPrompt, context, gameState, model, apiKey } = req.body;
      const key = apiKey || OPENROUTER_API_KEY;
      
      if (!key) {
        return res.status(400).json({ error: 'API key required' });
      }
      
      // Build the full prompt with game context
      const fullPrompt = `${systemPrompt}\n\n# Current Game Context\n\n${context}\n\nGenerate comprehensive world lore based on the current game context. Remember to return ONLY raw JSON with a "worldLore" field.`;
      
      console.log('[LORE GEN] Generating world lore using model', model);
      
      // Call OpenRouter
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': req.headers.referer || 'http://localhost:5000',
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
      
      // Parse JSON response with multiple fallback strategies
      let parsedData;
      try {
        // Try to extract JSON from code fences if present
        const jsonMatch = rawContent.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || 
                          rawContent.match(/(\{[\s\S]*\})/);
        const jsonStr = jsonMatch ? jsonMatch[1] : rawContent;
        parsedData = JSON.parse(jsonStr);
      } catch (parseError) {
        console.error('[LORE GEN] Failed to parse JSON:', parseError);
        return res.status(500).json({
          error: 'Failed to parse lore JSON from LLM response',
          fullPrompt,
          rawResponse: rawContent
        });
      }
      
      res.json({
        worldLore: parsedData.worldLore || null,
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

  // Revelations tracking endpoint
  app.post('/api/chat/revelations', async (req, res) => {
    try {
      const { systemPrompt, narrative, gameState, model, apiKey } = req.body;
      const key = apiKey || OPENROUTER_API_KEY;
      
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
          'HTTP-Referer': req.headers.referer || 'http://localhost:5000',
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
      
      res.json({
        revelations: parsedData.revelations || [],
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

  // Helper function to sanitize image responses by removing base64 data
  function sanitizeImageResponse(data: any): any {
    const sanitized = JSON.parse(JSON.stringify(data)); // Deep clone
    
    if (sanitized.choices && Array.isArray(sanitized.choices)) {
      sanitized.choices = sanitized.choices.map((choice: any) => {
        if (!choice.message) return choice;
        
        const msg = choice.message;
        
        // Sanitize content if it's a string with base64
        if (typeof msg.content === 'string' && msg.content.startsWith('data:image')) {
          msg.content = '[Base64 image data removed - stored in R2]';
        }
        
        // Sanitize content if it's an array with base64
        if (Array.isArray(msg.content)) {
          msg.content = msg.content.map((item: any) => {
            if (item.image_base64) {
              return { ...item, image_base64: '[Base64 removed]' };
            }
            if (item.url && item.url.startsWith('data:image')) {
              return { ...item, url: '[Base64 removed]' };
            }
            if (item.image_url?.url && item.image_url.url.startsWith('data:image')) {
              return { ...item, image_url: { ...item.image_url, url: '[Base64 removed]' } };
            }
            return item;
          });
        }
        
        // Sanitize images array if present
        if (msg.images && Array.isArray(msg.images)) {
          msg.images = msg.images.map((img: any) => {
            if (img.image_base64) {
              return { ...img, image_base64: '[Base64 removed]' };
            }
            if (img.url && img.url.startsWith('data:image')) {
              return { ...img, url: '[Base64 removed]' };
            }
            if (img.image_url?.url && img.image_url.url.startsWith('data:image')) {
              return { ...img, image_url: { ...img.image_url, url: '[Base64 removed]' } };
            }
            return img;
          });
        }
        
        return { ...choice, message: msg };
      });
    }
    
    return sanitized;
  }

  app.post('/api/generate-image', async (req, res) => {
    try {
      const { entityType, entity, promptTemplate, apiKey, sessionId } = req.body;
      const entityData = entity;
      
      const key = apiKey || OPENROUTER_API_KEY;
      
      console.log('[IMAGE GEN] Request:', {
        entityType,
        entityName: entityData?.name,
        hasApiKey: !!key,
        promptTemplateLength: promptTemplate?.length
      });
      
      if (!key) {
        console.error('[IMAGE GEN] Error: No API key provided');
        return res.status(400).json({ 
          error: 'API key required',
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
          .replace(/\[age\]/g, entityData.age || 'unknown')
          .replace(/\[sex\]/g, entityData.sex || 'unknown')
          .replace(/\[race\]/g, entityData.race || 'unknown')
          .replace(/\[class\]/g, entityData.class || 'adventurer')
          .replace(/\[name\]/g, entityData.name || 'unnamed')
          .replace(/\[hair_color\]/g, entityData.hairColor || 'dark')
          .replace(/\[body_type\]/g, entityData.bodyType || 'average')
          .replace(/\[brief description of expression\/specific gear\/personality trait\]/g, entityData.appearance || entityData.description || entityData.personality || 'determined expression');
      } else if (entityType === 'location' || entityType === 'business') {
        filledPrompt = filledPrompt
          .replace(/\[location_name\]/g, entityData.name || 'unknown location')
          .replace(/\[location_description\]/g, entityData.description || 'a mysterious place')
          .replace(/\[notable landmarks or characteristics\]/g, entityData.landmarks || 'unique features');
      }
      
      console.log('[IMAGE GEN] Filled prompt:', filledPrompt.substring(0, 200) + '...');
      
      // Call OpenRouter with Gemini image model
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'HTTP-Referer': req.headers.referer || 'http://localhost:5000',
          'X-Title': 'D&D Adventure Game',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [
            {
              role: 'user',
              content: filledPrompt
            }
          ],
          max_tokens: 1000,
          temperature: 0.9,
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('[IMAGE GEN] OpenRouter API error:', errorData);
        return res.status(response.status).json({
          error: `OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`,
          filledPrompt,
          rawResponse: JSON.stringify(errorData, null, 2)
        });
      }
      
      const data = await response.json();
      console.log('[IMAGE GEN] OpenRouter response:', {
        model: data.model,
        hasChoices: !!data.choices,
        choicesLength: data.choices?.length,
        messageContentType: typeof data.choices?.[0]?.message?.content,
        isContentArray: Array.isArray(data.choices?.[0]?.message?.content),
        usage: data.usage
      });
      
      // Extract image URL from response
      // Gemini image models can return images in multiple formats
      let imageUrl = null;
      const message = data.choices[0].message;
      
      // First check if there's a separate images array (Gemini 2.5 flash preview format)
      if (message.images && Array.isArray(message.images) && message.images.length > 0) {
        const firstImage = message.images[0];
        if (firstImage.image_url?.url) {
          imageUrl = firstImage.image_url.url;
        } else if (firstImage.url) {
          imageUrl = firstImage.url;
        }
      }
      
      // If no image found in images array, check content (older format)
      if (!imageUrl) {
        const content = message.content;
        
        // Check if content is an array (for image models)
        if (Array.isArray(content)) {
          // Look for Gemini's output_image type or standard image_url type
          const imageContent = content.find((item: any) => 
            item.type === 'output_image' || item.type === 'image_url'
          );
          if (imageContent) {
            // Handle multiple formats:
            // 1. URL in image_url.url (OpenRouter standard)
            // 2. Direct url property
            // 3. Base64 in image_base64 (Gemini preview model)
            if (imageContent.image_url?.url) {
              imageUrl = imageContent.image_url.url;
            } else if (imageContent.url) {
              imageUrl = imageContent.url;
            } else if (imageContent.image_base64) {
              // Convert base64 to data URL
              imageUrl = `data:image/png;base64,${imageContent.image_base64}`;
            }
          }
        } else if (typeof content === 'string') {
          // Some models may return a URL directly in text or base64
          const urlMatch = content.match(/https?:\/\/[^\s]+/);
          if (urlMatch) {
            imageUrl = urlMatch[0];
          } else if (content.startsWith('data:image')) {
            // Handle base64 image data
            imageUrl = content;
          }
        }
      }
      
      // Log if no image URL was found for debugging
      if (!imageUrl) {
        console.error('[IMAGE GEN] Failed to extract image URL from response');
        
        // Sanitize response even on failure to prevent base64 bloat
        const sanitizedData = sanitizeImageResponse(data);
        
        res.json({
          imageUrl: null,
          usage: data.usage,
          model: data.model,
          filledPrompt,
          rawResponse: JSON.stringify(sanitizedData, null, 2)
        });
        return;
      }
      
      console.log('[IMAGE GEN] Successfully extracted image URL:', imageUrl.substring(0, 100) + '...');
      
      // Upload image to Cloudflare R2
      let r2ImageUrl = null;
      try {
        // Generate filename based on entity type
        let filename: string;
        
        if (entityType === 'location') {
          const locationMetadata: LocationImageMetadata = {
            environment: entityData.environment || entityData.type || 'unknown',
            timeOfDay: entityData.timeOfDay || 'day',
            weather: entityData.weather,
            region: entityData.region || entityData.name,
            vibe: entityData.vibe || entityData.atmosphere || 'neutral',
            sessionId: sessionId || 'default',
          };
          filename = generateLocationFilename(locationMetadata);
        } else if (entityType === 'business') {
          const businessMetadata: BusinessImageMetadata = {
            name: entityData.name || 'business',
            type: entityData.type || 'shop',
            sessionId: sessionId || 'default',
          };
          filename = generateBusinessFilename(businessMetadata);
        } else {
          // Character, companion, or NPC
          const characterMetadata: CharacterImageMetadata = {
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
        // NEVER return base64 URLs to prevent IndexedDB bloat - return null instead
        r2ImageUrl = null;
      }
      
      // Sanitize response to remove ALL base64 image data
      const sanitizedData = sanitizeImageResponse(data);
      
      res.json({
        imageUrl: r2ImageUrl,
        usage: data.usage,
        model: data.model,
        filledPrompt,
        rawResponse: JSON.stringify(sanitizedData, null, 2)
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

  // Game state endpoints
  app.get('/api/game/:id', async (req, res) => {
    try {
      const gameState = await storage.getGameState(req.params.id);
      if (!gameState) {
        return res.status(404).json({ error: 'Game state not found' });
      }
      res.json(gameState);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/game', async (req, res) => {
    try {
      const validated = insertGameStateSchema.parse(req.body);
      const gameState = await storage.createGameState(validated);
      res.json(gameState);
    } catch (error: any) {
      res.status(400).json({ error: error.message });
    }
  });

  app.patch('/api/game/:id', async (req, res) => {
    try {
      const gameState = await storage.updateGameState(req.params.id, req.body);
      res.json(gameState);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete('/api/game/:id', async (req, res) => {
    try {
      await storage.deleteGameState(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
