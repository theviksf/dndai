import type { VercelRequest, VercelResponse } from '@vercel/node';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// R2 configuration from environment variables
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

// Initialize S3 client for Cloudflare R2
const s3Client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
  },
});

interface CharacterImageMetadata {
  age: string;
  sex: string;
  race: string;
  job: string;
  mood?: string;
  sessionId: string;
}

interface LocationImageMetadata {
  environment: string;
  timeOfDay: string;
  weather?: string;
  region?: string;
  vibe: string;
  sessionId: string;
}

interface BusinessImageMetadata {
  name: string;
  type?: string;
  sessionId: string;
}

function sanitizeForFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9-]/g, '_');
}

function generateCharacterFilename(metadata: CharacterImageMetadata): string {
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

function generateLocationFilename(metadata: LocationImageMetadata): string {
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

function generateBusinessFilename(metadata: BusinessImageMetadata): string {
  const timestamp = new Date().toISOString().replace(/[-:]/g, '').split('.')[0];
  const parts = [
    sanitizeForFilename(metadata.name || 'NA'),
    sanitizeForFilename(metadata.type || 'shop'),
  ];
  return `biz_${parts.join('-')}_${metadata.sessionId}_${timestamp}.png`;
}

async function uploadImageToR2(base64Image: string, filename: string): Promise<string> {
  const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  const command = new PutObjectCommand({
    Bucket: R2_BUCKET_NAME,
    Key: filename,
    Body: buffer,
    ContentType: 'image/png',
  });

  await s3Client.send(command);

  if (!R2_PUBLIC_URL) {
    throw new Error('R2_PUBLIC_URL environment variable is not set');
  }
  
  return `${R2_PUBLIC_URL}/${filename}`;
}

function sanitizeImageResponse(data: any): any {
  const sanitized = JSON.parse(JSON.stringify(data));
  
  if (sanitized.choices && Array.isArray(sanitized.choices)) {
    sanitized.choices = sanitized.choices.map((choice: any) => {
      if (!choice.message) return choice;
      
      const msg = choice.message;
      
      if (typeof msg.content === 'string' && msg.content.startsWith('data:image')) {
        msg.content = '[Base64 image data removed - stored in R2]';
      }
      
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

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { entityType, entity, promptTemplate, apiKey, sessionId, provider = 'flux' } = req.body;
    const entityData = entity;
    
    const openRouterKey = apiKey || process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_DEVKEY || '';
    const runPodKey = process.env.RUNPOD_API_KEY || '';
    
    console.log('[IMAGE GEN] Request:', {
      entityType,
      entityName: entityData?.name,
      provider,
      hasOpenRouterKey: !!openRouterKey,
      hasRunPodKey: !!runPodKey,
      promptTemplateLength: promptTemplate?.length
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
      
      // Poll for job completion
      const jobId = runPodData.id;
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
        }
      }
      
      if (!jobComplete) {
        console.error('[IMAGE GEN] RunPod job timeout after', attempts, 'attempts');
        return res.status(504).json({
          error: 'RunPod job timeout - image generation took too long',
          filledPrompt
        });
      }
    } else {
      // Call OpenRouter with Gemini
      console.log('[IMAGE GEN] Using Gemini 2.5 Flash via OpenRouter');
      
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': req.headers.referer || req.headers.origin || 'https://dnd-game.vercel.app',
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
      model = data.model || 'google/gemini-2.5-flash-image-preview';
      usage = data.usage;
      
      // Extract image URL from response
      const message = data.choices[0].message;
      
      if (message.images && Array.isArray(message.images) && message.images.length > 0) {
        const firstImage = message.images[0];
        if (firstImage.image_url?.url) {
          imageUrl = firstImage.image_url.url;
        } else if (firstImage.url) {
          imageUrl = firstImage.url;
        }
      }
      
      if (!imageUrl) {
        const content = message.content;
        
        if (Array.isArray(content)) {
          const imageContent = content.find((item: any) => 
            item.type === 'output_image' || item.type === 'image_url'
          );
          if (imageContent) {
            if (imageContent.image_url?.url) {
              imageUrl = imageContent.image_url.url;
            } else if (imageContent.url) {
              imageUrl = imageContent.url;
            } else if (imageContent.image_base64) {
              imageUrl = `data:image/png;base64,${imageContent.image_base64}`;
            }
          }
        } else if (typeof content === 'string') {
          const urlMatch = content.match(/https?:\/\/[^\s]+/);
          if (urlMatch) {
            imageUrl = urlMatch[0];
          } else if (content.startsWith('data:image')) {
            imageUrl = content;
          }
        }
      }
      
      if (!imageUrl) {
        console.error('[IMAGE GEN] Failed to extract image URL from response');
        const sanitizedData = sanitizeImageResponse(data);
        return res.json({
          imageUrl: null,
          usage: data.usage,
          model: data.model,
          filledPrompt,
          rawResponse: JSON.stringify(sanitizedData, null, 2)
        });
      }
    }
    
    // Upload to R2
    let r2ImageUrl: string | null = null;
    try {
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
      r2ImageUrl = await uploadImageToR2(imageUrl!, filename);
      console.log('[R2 UPLOAD] Successfully uploaded to R2:', r2ImageUrl);
    } catch (uploadError: any) {
      console.error('[R2 UPLOAD] Failed to upload to R2:', uploadError.message);
      r2ImageUrl = null;
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
}
