import type { ExecutionSnapshot, SnapshotSummary, StepSnapshot } from '../types';

// ANSI color helpers
const dim = (s: string) => `\x1B[2m${s}\x1B[22m`;
const bold = (s: string) => `\x1B[1m${s}\x1B[22m`;
const green = (s: string) => `\x1B[32m${s}\x1B[39m`;
const red = (s: string) => `\x1B[31m${s}\x1B[39m`;
const yellow = (s: string) => `\x1B[33m${s}\x1B[39m`;
const cyan = (s: string) => `\x1B[36m${s}\x1B[39m`;
const magenta = (s: string) => `\x1B[35m${s}\x1B[39m`;

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0';
  if (cost < 0.001) return `$${cost.toFixed(6)}`;
  return `$${cost.toFixed(4)}`;
}

function truncate(s: string, maxLen: number): string {
  const single = s.replaceAll('\n', ' ');
  if (single.length <= maxLen) return single;
  return single.slice(0, maxLen - 3) + '...';
}

function padEnd(s: string, len: number): string {
  if (s.length >= len) return s;
  return s + ' '.repeat(len - s.length);
}

export function renderSnapshot(snapshot: ExecutionSnapshot): string {
  const lines: string[] = [];
  const durationMs = (snapshot.completedAt ?? Date.now()) - snapshot.startedAt;
  const shortId = snapshot.traceId.slice(0, 12);

  // Header
  lines.push(
    bold('Agent Operation') +
      `  ${cyan(shortId)}` +
      (snapshot.model ? `  ${magenta(snapshot.model)}` : '') +
      `  ${snapshot.totalSteps} steps` +
      `  ${formatMs(durationMs)}`,
  );

  // Steps
  const lastIdx = snapshot.steps.length - 1;
  for (let i = 0; i <= lastIdx; i++) {
    const step = snapshot.steps[i];
    const isLast = i === lastIdx;
    const prefix = isLast ? '└─' : '├─';
    const childPrefix = isLast ? '   ' : '│  ';

    lines.push(
      `${prefix} Step ${step.stepIndex}  ${dim(`[${step.stepType}]`)}  ${formatMs(step.executionTimeMs)}`,
    );

    if (step.stepType === 'call_llm') {
      renderLlmStep(lines, step, childPrefix);
    } else {
      renderToolStep(lines, step, childPrefix);
    }
  }

  // Footer
  const reasonColor =
    snapshot.completionReason === 'done' ? green : snapshot.error ? red : yellow;
  lines.push(
    `${dim('└─')} ${reasonColor(snapshot.completionReason ?? 'unknown')}` +
      `  tokens=${formatTokens(snapshot.totalTokens)}` +
      `  cost=${formatCost(snapshot.totalCost)}`,
  );

  if (snapshot.error) {
    lines.push(`   ${red('Error:')} ${snapshot.error.type} — ${snapshot.error.message}`);
  }

  return lines.join('\n');
}

function renderLlmStep(lines: string[], step: StepSnapshot, prefix: string): void {
  const tokenInfo: string[] = [];
  if (step.inputTokens) tokenInfo.push(`in:${formatTokens(step.inputTokens)}`);
  if (step.outputTokens) tokenInfo.push(`out:${formatTokens(step.outputTokens)}`);

  if (tokenInfo.length > 0) {
    lines.push(`${prefix}${dim('├─')} LLM     ${tokenInfo.join(' ')} tokens`);
  }

  if (step.toolsCalling && step.toolsCalling.length > 0) {
    const names = step.toolsCalling.map((t) => t.identifier || t.apiName);
    lines.push(
      `${prefix}${dim('├─')} ${yellow('→')} ${step.toolsCalling.length} tool_calls: [${names.join(', ')}]`,
    );
  }

  if (step.content) {
    lines.push(`${prefix}${dim('└─')} Output  ${dim(truncate(step.content, 80))}`);
  }

  if (step.reasoning) {
    lines.push(`${prefix}${dim('└─')} Reason  ${dim(truncate(step.reasoning, 80))}`);
  }
}

function renderToolStep(lines: string[], step: StepSnapshot, prefix: string): void {
  if (step.toolsResult) {
    for (let i = 0; i < step.toolsResult.length; i++) {
      const tool = step.toolsResult[i];
      const isLast = i === step.toolsResult.length - 1;
      const connector = isLast ? '└─' : '├─';
      const status = tool.isSuccess === false ? red('✗') : green('✓');
      const name = tool.identifier || tool.apiName;
      lines.push(`${prefix}${dim(connector)} Tool  ${name}  ${status}`);
    }
  }
}

export function renderSummaryTable(summaries: SnapshotSummary[]): string {
  if (summaries.length === 0) return dim('No snapshots found.');

  const lines: string[] = [];

  lines.push(
    bold(
      padEnd('Trace ID', 14) +
        padEnd('Model', 20) +
        padEnd('Steps', 7) +
        padEnd('Tokens', 10) +
        padEnd('Duration', 10) +
        padEnd('Reason', 12) +
        'Time',
    ),
  );
  lines.push(dim('─'.repeat(90)));

  for (const s of summaries) {
    const reasonColor = s.completionReason === 'done' ? green : s.hasError ? red : yellow;
    const time = new Date(s.createdAt).toLocaleString();

    lines.push(
      cyan(padEnd(s.traceId.slice(0, 12), 14)) +
        padEnd(s.model ?? '-', 20) +
        padEnd(String(s.totalSteps), 7) +
        padEnd(formatTokens(s.totalTokens), 10) +
        padEnd(formatMs(s.durationMs), 10) +
        reasonColor(padEnd(s.completionReason ?? '-', 12)) +
        dim(time),
    );
  }

  return lines.join('\n');
}

export function renderStepDetail(
  step: StepSnapshot,
  options?: { messages?: boolean; tools?: boolean },
): string {
  const lines: string[] = [];

  lines.push(bold(`Step ${step.stepIndex}`) + `  [${step.stepType}]  ${formatMs(step.executionTimeMs)}`);
  lines.push('');

  if (step.inputTokens || step.outputTokens) {
    lines.push(`Tokens: in=${step.inputTokens ?? 0}  out=${step.outputTokens ?? 0}`);
  }

  if (options?.messages || !options?.tools) {
    if (step.content) {
      lines.push('');
      lines.push(bold('Content:'));
      lines.push(step.content);
    }
    if (step.reasoning) {
      lines.push('');
      lines.push(bold('Reasoning:'));
      lines.push(step.reasoning);
    }
  }

  if (options?.tools) {
    if (step.toolsCalling && step.toolsCalling.length > 0) {
      lines.push('');
      lines.push(bold('Tool Calls:'));
      for (const tc of step.toolsCalling) {
        lines.push(`  ${cyan(tc.identifier || tc.apiName)}`);
        if (tc.arguments) {
          lines.push(`    args: ${tc.arguments}`);
        }
      }
    }
    if (step.toolsResult && step.toolsResult.length > 0) {
      lines.push('');
      lines.push(bold('Tool Results:'));
      for (const tr of step.toolsResult) {
        const status = tr.isSuccess === false ? red('✗') : green('✓');
        lines.push(`  ${status} ${cyan(tr.identifier || tr.apiName)}`);
        if (tr.output) {
          const output = tr.output.length > 500 ? tr.output.slice(0, 500) + '...' : tr.output;
          lines.push(`    output: ${output}`);
        }
      }
    }
  }

  return lines.join('\n');
}
