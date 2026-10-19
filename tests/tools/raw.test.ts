/**
 * Tests for the generic passthrough tool (teamleader_api_call)
 */

import { describe, it, expect, vi } from 'vitest';
import { callRaw, isReadOnlyMethod, rawWritesAllowed, RawCallSchema } from '../../src/tools/raw.js';
import { TeamleaderClient, TeamleaderApiError } from '../../src/client/teamleader.js';

function makeClient(status: number, body: unknown) {
  const fetch = vi.fn(async (_url: string, _init: RequestInit) => ({
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(),
    text: async () => (body === undefined ? '' : JSON.stringify(body)),
    json: async () => body,
  }));
  const client = new TeamleaderClient({ accessToken: 'tok', fetch: fetch as any });
  return { client, fetch };
}

describe('RawCallSchema', () => {
  it('accepts valid method names', () => {
    for (const m of ['deals.list', 'dealPhases.list', 'users.me', 'projects-v2.projects.list', 'timeTracking.add']) {
      expect(() => RawCallSchema.parse({ method: m })).not.toThrow();
    }
  });

  it('rejects path traversal and junk', () => {
    for (const m of ['../oauth2/access_token', 'deals', 'deals.list?x=1', 'https://evil.com/x.list', 'deals/list', '']) {
      expect(() => RawCallSchema.parse({ method: m })).toThrow();
    }
  });
});

describe('isReadOnlyMethod', () => {
  it('classifies methods', () => {
    expect(isReadOnlyMethod('deals.list')).toBe(true);
    expect(isReadOnlyMethod('invoices.info')).toBe(true);
    expect(isReadOnlyMethod('users.me')).toBe(true);
    expect(isReadOnlyMethod('contacts.update')).toBe(false);
    expect(isReadOnlyMethod('invoices.delete')).toBe(false);
  });
});

describe('rawWritesAllowed', () => {
  it('defaults to allowing writes', () => {
    expect(rawWritesAllowed({})).toBe(true);
  });
  it('respects TEAMLEADER_RAW_READONLY', () => {
    expect(rawWritesAllowed({ TEAMLEADER_RAW_READONLY: 'true' })).toBe(false);
    expect(rawWritesAllowed({ TEAMLEADER_RAW_READONLY: '1' })).toBe(false);
    expect(rawWritesAllowed({ TEAMLEADER_RAW_READONLY: 'false' })).toBe(true);
  });
});

describe('callRaw', () => {
  it('POSTs params to the method endpoint with auth', async () => {
    const { client, fetch } = makeClient(200, { data: [{ id: 'p1', name: 'New' }] });
    const res = await callRaw(client, { method: 'dealPhases.list', params: { page: { size: 10 } } });

    expect(res).toEqual({ data: [{ id: 'p1', name: 'New' }] });
    const [url, init] = fetch.mock.calls[0];
    expect(url).toBe('https://api.focus.teamleader.eu/dealPhases.list');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok');
    expect(JSON.parse(init.body as string)).toEqual({ page: { size: 10 } });
  });

  it('sends {} when params omitted', async () => {
    const { client, fetch } = makeClient(200, { data: { id: 'u1' } });
    await callRaw(client, { method: 'users.me' });
    expect(JSON.parse(fetch.mock.calls[0][1].body as string)).toEqual({});
  });

  it('returns {ok:true} on 204 No Content', async () => {
    const { client } = makeClient(204, undefined);
    const res = await callRaw(client, { method: 'contacts.update', params: { id: 'c1', first_name: 'X' } });
    expect(res).toEqual({ ok: true });
  });

  it('propagates API errors (so 401 retry in server still works)', async () => {
    const { client } = makeClient(401, { errors: [{ title: 'Unauthorized', status: 401 }] });
    await expect(callRaw(client, { method: 'deals.list' })).rejects.toBeInstanceOf(TeamleaderApiError);
  });

  it('blocks writes in read-only mode without calling the API', async () => {
    const { client, fetch } = makeClient(204, undefined);
    await expect(callRaw(client, { method: 'invoices.delete', params: { id: 'i1' } }, false)).rejects.toThrow(/read-only/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('allows reads in read-only mode', async () => {
    const { client } = makeClient(200, { data: [] });
    await expect(callRaw(client, { method: 'tickets.list' }, false)).resolves.toEqual({ data: [] });
  });
});
