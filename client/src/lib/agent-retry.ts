export interface AgentRetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  agentName: string;
  onRetry?: (attempt: number, error: string) => void;
}

export interface AgentResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
}

const DEFAULT_MAX_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryableError(status: number, errorMessage?: string): boolean {
  if (status === 500) {
    const msg = errorMessage?.toLowerCase() || '';
    return msg.includes('parse') || msg.includes('json') || msg.includes('timeout');
  }
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;
  return false;
}

export async function runWithRetry<T>(
  operation: () => Promise<Response>,
  parseResponse: (response: Response) => Promise<T>,
  options: AgentRetryOptions
): Promise<AgentResult<T>> {
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const baseDelay = options.baseDelayMs ?? DEFAULT_BASE_DELAY_MS;
  const { agentName, onRetry } = options;

  let lastError = '';
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[${agentName}] Attempt ${attempt}/${maxRetries}`);
      
      const response = await operation();
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        lastError = errorData.error || `HTTP ${response.status}`;
        
        if (isRetryableError(response.status, lastError) && attempt < maxRetries) {
          const delay = baseDelay * attempt;
          console.log(`[${agentName}] Retryable error (${response.status}), waiting ${delay}ms...`);
          onRetry?.(attempt, lastError);
          await sleep(delay);
          continue;
        }
        
        console.error(`[${agentName}] Failed after ${attempt} attempts:`, lastError);
        return { success: false, error: lastError, attempts: attempt };
      }
      
      const data = await parseResponse(response);
      
      if (attempt > 1) {
        console.log(`[${agentName}] Succeeded on attempt ${attempt}`);
      }
      
      return { success: true, data, attempts: attempt };
      
    } catch (error: any) {
      lastError = error.message || 'Unknown error';
      console.error(`[${agentName}] Attempt ${attempt} caught error:`, lastError);
      
      if (attempt < maxRetries) {
        const delay = baseDelay * attempt;
        console.log(`[${agentName}] Retrying after error, waiting ${delay}ms...`);
        onRetry?.(attempt, lastError);
        await sleep(delay);
        continue;
      }
    }
  }
  
  console.error(`[${agentName}] All ${maxRetries} attempts failed`);
  return { success: false, error: lastError, attempts: maxRetries };
}

export async function fetchWithRetry(
  url: string,
  fetchOptions: RequestInit,
  retryOptions: AgentRetryOptions
): Promise<AgentResult<any>> {
  return runWithRetry(
    () => fetch(url, fetchOptions),
    async (response) => response.json(),
    retryOptions
  );
}
