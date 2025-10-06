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
  app.post('/api/llm/generate-image', async (req, res) => {
    const { prompt, apiKey } = req.body;
    
    try {
      const key = apiKey || OPENROUTER_API_KEY;
      
      if (!key) {
        return res.status(400).json({ error: 'API key required' });
      }
      
      if (!prompt) {
        return res.status(400).json({ error: 'Prompt required' });
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
          model: 'google/gemini-2.5-flash-image-preview',
          messages: [
            { role: 'user', content: prompt }
          ],
          max_tokens: 1000,
          temperature: 0.7,
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`OpenRouter API error: ${errorData.error?.message || 'Unknown error'}`);
      }
      
      const data = await response.json();
      
      // Extract image URL from response
      // Gemini image models return the image URL in the content
      const content = data.choices[0].message.content;
      
      // The response might contain markdown with image URL or direct URL
      let imageUrl = '';
      
      // Try to extract image URL from markdown format ![alt](url)
      const markdownMatch = content.match(/!\[.*?\]\((.*?)\)/);
      if (markdownMatch) {
        imageUrl = markdownMatch[1];
      } else if (content.startsWith('http')) {
        // Direct URL
        imageUrl = content.trim();
      } else {
        // Try to find any URL in the content
        const urlMatch = content.match(/(https?:\/\/[^\s]+)/);
        if (urlMatch) {
          imageUrl = urlMatch[1];
        }
      }
      
      res.json({
        imageUrl,
        usage: data.usage,
        model: data.model,
        rawContent: content
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
