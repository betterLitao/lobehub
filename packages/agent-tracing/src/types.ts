export interface ExecutionSnapshot {
  traceId: string;
  operationId: string;
  model?: string;
  provider?: string;
  startedAt: number;
  completedAt?: number;
  completionReason?: 'done' | 'error' | 'interrupted' | 'max_steps' | 'cost_limit' | 'waiting_for_human';
  totalSteps: number;
  totalTokens: number;
  totalCost: number;
  error?: { type: string; message: string };
  steps: StepSnapshot[];
}

export interface StepSnapshot {
  stepIndex: number;
  stepType: 'call_llm' | 'call_tool';
  startedAt: number;
  completedAt: number;
  executionTimeMs: number;

  // LLM data
  content?: string;
  reasoning?: string;
  inputTokens?: number;
  outputTokens?: number;

  // Tool data
  toolsCalling?: Array<{
    apiName: string;
    identifier: string;
    arguments?: string;
  }>;
  toolsResult?: Array<{
    apiName: string;
    identifier: string;
    isSuccess?: boolean;
    output?: string;
  }>;

  // Cumulative
  totalTokens: number;
  totalCost: number;
}

export interface SnapshotSummary {
  traceId: string;
  operationId: string;
  model?: string;
  completionReason?: string;
  totalSteps: number;
  totalTokens: number;
  durationMs: number;
  createdAt: number;
  hasError: boolean;
}
