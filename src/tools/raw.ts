/**
 * Generic passthrough tool for Teamleader Focus
 *
 * The Teamleader Focus API is RPC-style: every endpoint is
 * POST https://api.focus.teamleader.eu/{resource}.{action} with a JSON body.
 * This tool lets the assistant call any endpoint that has no dedicated tool,
 * reusing the existing client (auth headers, 204 handling, error mapping).
 *
 * Reference: https://developer.focus.teamleader.eu/
 */

import { z } from 'zod';
import type { TeamleaderClient, ApiResponse } from '../client/teamleader.js';

// e.g. "deals.list", "timeTracking.add", "dealPhases.list", "projects-v2.projects.list"
const METHOD_PATTERN = /^[a-zA-Z][a-zA-Z0-9-]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/;

// Actions that only read data. Anything else is treated as a write.
const READ_ONLY_ACTIONS = new Set(['list', 'info', 'download', 'me', 'search']);

export const RawCallSchema = z.object({
  method: z
    .string()
    .regex(METHOD_PATTERN, 'method must look like "resource.action", e.g. "deals.list"'),
  params: z.record(z.unknown()).optional().default({}),
}).strict();

export type RawCallInput = z.input<typeof RawCallSchema>;

export function isReadOnlyMethod(method: string): boolean {
  const action = method.split('.').pop() ?? '';
  return READ_ONLY_ACTIONS.has(action);
}

/**
 * Whether write calls through the raw tool are allowed.
 * Set TEAMLEADER_RAW_READONLY=true to restrict the raw tool to read-only methods.
 */
export function rawWritesAllowed(env: NodeJS.ProcessEnv = process.env): boolean {
  const v = (env.TEAMLEADER_RAW_READONLY || '').toLowerCase();
  return !(v === 'true' || v === '1' || v === 'yes');
}

export async function callRaw(
  client: TeamleaderClient,
  input: RawCallInput,
  allowWrites: boolean = rawWritesAllowed()
): Promise<ApiResponse<unknown> | { ok: true }> {
  const { method, params } = RawCallSchema.parse(input);

  if (!allowWrites && !isReadOnlyMethod(method)) {
    throw new Error(
      `Method "${method}" is not read-only and TEAMLEADER_RAW_READONLY is enabled. ` +
      `Only ${[...READ_ONLY_ACTIONS].map((a) => `*.${a}`).join(', ')} are allowed.`
    );
  }

  const result = await client.request<unknown>(method, params);

  // Write endpoints (update, delete, move, ...) return 204 No Content → {}
  if (result && typeof result === 'object' && Object.keys(result).length === 0) {
    return { ok: true };
  }
  return result;
}
