#!/usr/bin/env bun

const command = process.argv[2];
const args = process.argv.slice(3);

async function main() {
  switch (command) {
    case 'trace': {
      const { FileSnapshotStore } = await import('../store/file-store');
      const { renderSnapshot } = await import('../viewer');
      const store = new FileSnapshotStore();
      const traceId = args[0];
      const snapshot = traceId ? await store.get(traceId) : await store.getLatest();
      if (!snapshot) {
        console.error(
          traceId
            ? `Snapshot not found: ${traceId}`
            : 'No snapshots found. Run an agent operation first.',
        );
        process.exit(1);
      }
      console.log(renderSnapshot(snapshot));
      break;
    }

    case 'list': {
      const { FileSnapshotStore } = await import('../store/file-store');
      const { renderSummaryTable } = await import('../viewer');
      const store = new FileSnapshotStore();
      let limit = 10;
      const limitIdx = args.indexOf('--limit');
      if (limitIdx !== -1 && args[limitIdx + 1]) {
        limit = Number.parseInt(args[limitIdx + 1], 10);
        if (Number.isNaN(limit) || limit < 1) limit = 10;
      }
      console.log(renderSummaryTable(await store.list({ limit })));
      break;
    }

    case 'inspect': {
      const { FileSnapshotStore } = await import('../store/file-store');
      const { renderSnapshot, renderStepDetail } = await import('../viewer');
      const store = new FileSnapshotStore();

      if (args.length === 0) {
        console.error('Usage: agent-tracing inspect <traceId> [--step N] [--messages] [--tools] [--json]');
        process.exit(1);
      }

      const traceId = args[0];
      const jsonMode = args.includes('--json');
      const showMessages = args.includes('--messages');
      const showTools = args.includes('--tools');

      let stepIndex: number | undefined;
      const stepIdx = args.indexOf('--step');
      if (stepIdx !== -1 && args[stepIdx + 1]) {
        stepIndex = Number.parseInt(args[stepIdx + 1], 10);
      }

      const snapshot = await store.get(traceId);
      if (!snapshot) {
        console.error(`Snapshot not found: ${traceId}`);
        process.exit(1);
      }

      if (jsonMode) {
        if (stepIndex !== undefined) {
          const step = snapshot.steps.find((s) => s.stepIndex === stepIndex);
          console.log(JSON.stringify(step ?? null, null, 2));
        } else {
          console.log(JSON.stringify(snapshot, null, 2));
        }
      } else if (stepIndex !== undefined) {
        const step = snapshot.steps.find((s) => s.stepIndex === stepIndex);
        if (!step) {
          console.error(
            `Step ${stepIndex} not found. Available: ${snapshot.steps.map((s) => s.stepIndex).join(', ')}`,
          );
          process.exit(1);
        }
        console.log(renderStepDetail(step, { messages: showMessages, tools: showTools }));
      } else {
        console.log(renderSnapshot(snapshot));
      }
      break;
    }

    default: {
      console.log(`agent-tracing — Local agent execution snapshot viewer

Usage:
  agent-tracing trace [traceId]                         View latest or specific trace
  agent-tracing list [--limit N]                        List recent snapshots
  agent-tracing inspect <traceId> [options]             Inspect trace details

Inspect options:
  --step N        View specific step
  --messages      Show LLM content
  --tools         Show tool call details
  --json          Output as JSON`);
      if (command) {
        console.error(`\nUnknown command: ${command}`);
        process.exit(1);
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
