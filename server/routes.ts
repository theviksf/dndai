import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertGameStateSchema } from "@shared/schema";

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "";

export async function registerRoutes(app: Express): Promise<Server> {
  
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
      const { entityType, entity, promptTemplate, apiKey } = req.body;
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
          .replace(/\[brief description of expression\/specific gear\/personality trait\]/g, entityData.appearance || entityData.personality || 'determined expression');
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
      // Gemini image models return content with type 'output_image'
      let imageUrl = null;
      const content = data.choices[0].message.content;
      
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
      
      // Log if no image URL was found for debugging
      if (!imageUrl) {
        console.error('[IMAGE GEN] Failed to extract image URL from response:', JSON.stringify(content, null, 2));
      } else {
        console.log('[IMAGE GEN] Successfully extracted image URL:', imageUrl.substring(0, 100) + '...');
      }
      
      res.json({
        imageUrl,
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
