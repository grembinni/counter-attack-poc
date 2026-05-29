import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const eventsSource = readFileSync(join(__dirname, 'events.ts'), 'utf8');

describe('SocketData interface', () => {
  it('declares sessionToken as an optional string field', () => {
    expect(eventsSource).toMatch(/sessionToken\?:\s*string/);
  });

  it('declares playerSlot as optional', () => {
    expect(eventsSource).toMatch(/playerSlot\?:\s*1\s*\|\s*2/);
  });

  it('declares roomCode as optional', () => {
    expect(eventsSource).toMatch(/roomCode\?:\s*string/);
  });

  it('does not change ClientEvents, ServerEvents, or event map interfaces', () => {
    expect(eventsSource).toContain("ROOM_CREATE: 'room:create'");
    expect(eventsSource).toContain("ROOM_JOIN: 'room:join'");
    expect(eventsSource).toContain("ROOM_JOINED: 'room:joined'");
    expect(eventsSource).toContain("ROOM_ERROR: 'room:error'");
    expect(eventsSource).toContain('ClientToServerEvents');
    expect(eventsSource).toContain('ServerToClientEvents');
    expect(eventsSource).toContain('InterServerEvents');
  });
});
