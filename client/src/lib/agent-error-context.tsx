import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

export interface AgentError {
  id: string;
  agentName: string;
  errorMessage: string;
  timestamp: number;
  entityName?: string;
}

interface AgentErrorContextValue {
  errors: AgentError[];
  addError: (error: Omit<AgentError, 'id' | 'timestamp'>) => void;
  dismissError: (id: string) => void;
  dismissAllErrors: () => void;
  hasErrors: boolean;
}

const AgentErrorContext = createContext<AgentErrorContextValue | null>(null);

let errorIdCounter = 0;

export function AgentErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<AgentError[]>([]);

  const addError = useCallback((error: Omit<AgentError, 'id' | 'timestamp'>) => {
    const newError: AgentError = {
      ...error,
      id: `agent-error-${++errorIdCounter}`,
      timestamp: Date.now(),
    };
    console.log(`[AGENT ERROR] ${error.agentName}: ${error.errorMessage}`);
    setErrors(prev => [...prev, newError]);
  }, []);

  const dismissError = useCallback((id: string) => {
    setErrors(prev => prev.filter(e => e.id !== id));
  }, []);

  const dismissAllErrors = useCallback(() => {
    setErrors([]);
  }, []);

  return (
    <AgentErrorContext.Provider
      value={{
        errors,
        addError,
        dismissError,
        dismissAllErrors,
        hasErrors: errors.length > 0,
      }}
    >
      {children}
    </AgentErrorContext.Provider>
  );
}

export function useAgentErrors(): AgentErrorContextValue {
  const context = useContext(AgentErrorContext);
  if (!context) {
    throw new Error('useAgentErrors must be used within an AgentErrorProvider');
  }
  return context;
}

let globalAddError: ((error: Omit<AgentError, 'id' | 'timestamp'>) => void) | null = null;

export function setGlobalErrorHandler(handler: (error: Omit<AgentError, 'id' | 'timestamp'>) => void) {
  globalAddError = handler;
}

export function reportAgentError(agentName: string, errorMessage: string, entityName?: string) {
  if (globalAddError) {
    globalAddError({ agentName, errorMessage, entityName });
  } else {
    console.error(`[AGENT ERROR - no handler] ${agentName}: ${errorMessage}`);
  }
}
