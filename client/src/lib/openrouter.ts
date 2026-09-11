import { apiRequest } from './queryClient';
import type { OpenRouterModel } from '@shared/schema';

export async function fetchOpenRouterModels(apiKey?: string): Promise<OpenRouterModel[]> {
  const response = await apiRequest('POST', '/api/models', { apiKey });
  const data = await response.json();
  return data.data || [];
}

export async function callLLM(
  modelId: string,
  messages: { role: string; content: string }[],
  systemPrompt: string,
  maxTokens: number = 1000,
  apiKey?: string,
  options?: { timeoutMs?: number; signal?: AbortSignal; responseFormat?: 'json_object' }
): Promise<{
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}> {
  const timeoutMs = options?.timeoutMs ?? 90000;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  if (options?.signal) {
    if (options.signal.aborted) {
      clearTimeout(timeoutId);
      throw new Error('Request cancelled by user');
    }
    options.signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await apiRequest('POST', '/api/llm/chat', {
      modelId,
      messages,
      systemPrompt,
      maxTokens,
      apiKey,
      responseFormat: options?.responseFormat,
    }, controller.signal);

    return await response.json();
  } catch (err: any) {
    if (err.name === 'AbortError') {
      if (options?.signal?.aborted) {
        throw new Error('Request cancelled by user');
      }
      throw new Error(`LLM request timed out after ${Math.round(timeoutMs / 1000)}s — the model may be overloaded. Try again or switch to a faster model.`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function callLLMStream(
  modelId: string,
  messages: { role: string; content: string }[],
  systemPrompt: string,
  maxTokens: number = 1000,
  apiKey: string | undefined,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal,
  onReasoning?: (chunk: string) => void
): Promise<{
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}> {
  const response = await fetch('/api/llm/chat/stream', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      modelId,
      messages,
      systemPrompt,
      maxTokens,
      apiKey,
    }),
    signal,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let fullContent = '';
  let usage = { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  let model = modelId;
  let buffer = ''; // Buffer for incomplete lines

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // Add new chunk to buffer
      buffer += decoder.decode(value, { stream: true });
      
      // Process complete lines (ending with \n)
      const lines = buffer.split('\n');
      
      // Keep the last potentially incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            continue;
          }

          try {
            const parsed = JSON.parse(data);

            if (parsed.error) {
              throw new Error(parsed.error.message || 'OpenRouter streaming error');
            }
            
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              const content = parsed.choices[0].delta.content;
              fullContent += content;
              onChunk(content);
            }

            const delta = parsed.choices?.[0]?.delta;
            const reasoningText =
              (typeof delta?.reasoning === 'string' ? delta.reasoning : '') ||
              (Array.isArray(delta?.reasoning_details)
                ? delta.reasoning_details
                    .map((detail: any) => detail?.text || detail?.summary || '')
                    .filter(Boolean)
                    .join('')
                : '');
            if (reasoningText) {
              onReasoning?.(reasoningText);
            }

            if (parsed.usage) {
              usage = parsed.usage;
            }

            if (parsed.model) {
              model = parsed.model;
            }
          } catch (e: any) {
            if (e instanceof SyntaxError) {
              // Ignore incomplete/non-JSON SSE lines, but never hide API errors.
              continue;
            }
            throw e;
          }
        }
      }
    }

    if (!fullContent.trim()) {
      throw new Error('The model completed without a final response. Retry or choose a different model.');
    }
    
    // Process any remaining buffered content
    if (buffer.trim()) {
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6).trim();
        if (data && data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices && parsed.choices[0]?.delta?.content) {
              const content = parsed.choices[0].delta.content;
              fullContent += content;
              onChunk(content);
            }
            if (parsed.usage) usage = parsed.usage;
            if (parsed.model) model = parsed.model;
          } catch (e) {
            console.warn('Failed to parse final SSE line:', data, e);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return {
    content: fullContent,
    usage,
    model,
  };
}

export const RECOMMENDED_CONFIGS = {
  premium: {
    primary: 'anthropic/claude-3-opus',
    parser: 'anthropic/claude-3-haiku',
    description: 'Best quality, ~$0.03-0.05/turn'
  },
  balanced: {
    primary: 'anthropic/claude-3-sonnet',
    parser: 'anthropic/claude-3-haiku',
    description: 'Great quality, ~$0.01-0.02/turn'
  },
  budget: {
    primary: 'openai/gpt-3.5-turbo',
    parser: 'google/gemini-flash-1.5',
    description: 'Good quality, ~$0.001-0.003/turn'
  },
  experimental: {
    primary: 'meta-llama/llama-3.1-70b-instruct',
    parser: 'meta-llama/llama-3.1-8b-instruct',
    description: 'Open source, ~$0.001-0.002/turn'
  }
};

export function estimateTurnCost(
  primaryPricing: { prompt: string; completion: string },
  parserPricing: { prompt: string; completion: string }
): number {
  const primaryPromptCost = parseFloat(primaryPricing.prompt) * 1500;
  const primaryCompletionCost = parseFloat(primaryPricing.completion) * 600;
  const parserPromptCost = parseFloat(parserPricing.prompt) * 500;
  const parserCompletionCost = parseFloat(parserPricing.completion) * 200;
  
  return primaryPromptCost + primaryCompletionCost + parserPromptCost + parserCompletionCost;
}
