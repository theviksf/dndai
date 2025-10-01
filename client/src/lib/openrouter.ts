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
  apiKey?: string
): Promise<{
  content: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model: string;
}> {
  const response = await apiRequest('POST', '/api/llm/chat', {
    modelId,
    messages,
    systemPrompt,
    maxTokens,
    apiKey,
  });
  
  return await response.json();
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
