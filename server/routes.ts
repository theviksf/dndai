import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameStateSchema } from "@shared/schema";
import { uploadImageToR2, generateCharacterFilename, generateLocationFilename, type CharacterImageMetadata, type LocationImageMetadata } from "./r2-storage";
import { readFile, writeFile, copyFile } from "fs/promises";
import { join } from "path";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || "";

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Get default prompts from files
  app.get('/api/prompts/defaults', async (req, res) => {
    try {
      const promptsDir = join(process.cwd(), 'prompts');
      
      const [primary, parser, imageCharacter, imageLocation] = await Promise.all([
        readFile(join(promptsDir, 'primary.md'), 'utf-8'),
        readFile(join(promptsDir, 'parser.md'), 'utf-8'),
        readFile(join(promptsDir, 'image-character.md'), 'utf-8'),
        readFile(join(promptsDir, 'image-location.md'), 'utf-8'),
      ]);
      
      res.json({
        primary,
        parser,
        imageCharacter,
        imageLocation,
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
      };

      const filename = fileMap[promptType];
      if (!filename) {
        return res.status(400).json({ error: 'Invalid promptType. Must be one of: primary, parser, imageCharacter, imageLocation' });
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
          .replace(/\[brief description of expression\/specific gear\/personality trait\]/g, entityData.description || entityData.appearance || entityData.personality || 'determined expression');
      } else if (entityType === 'location') {
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
        console.error('[IMAGE GEN] Failed to extract image URL from response:', JSON.stringify(message, null, 2));
        res.json({
          imageUrl: null,
          usage: data.usage,
          model: data.model,
          filledPrompt,
          rawResponse: JSON.stringify(data, null, 2)
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
        // Fall back to original base64 URL if R2 upload fails
        r2ImageUrl = imageUrl;
      }
      
      res.json({
        imageUrl: r2ImageUrl,
        usage: data.usage,
        model: data.model,
        filledPrompt,
        rawResponse: JSON.stringify(data, null, 2)
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
