/**
 * Wave 0 gap-closure: automated coverage for /healthz status and SPA fallback
 * in NODE_ENV=production.
 *
 * Test harness mirrors gameHandlers.test.ts: real buildServer() factory, port 0,
 * beforeEach/afterEach lifecycle. Three assertions:
 *   1. GET /healthz → 200 'ok'
 *   2. GET /some/unknown/route → 200, body contains CA_SPA_FIXTURE marker
 *   3. GET /healthz → body does NOT contain the CA_SPA_FIXTURE marker
 *      (proves /healthz is registered before express.static and app.get('*'))
 *
 * This test is intentionally RED before Task 2 adds the static serving block.
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../createServer.js';

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// clientDist resolves the same way the production static block does from src/:
// src/__tests__/staticServing.test.ts  → src/  → ../../client/dist
const clientDist = path.resolve(__dirname, '../../../client/dist');
const fixtureIndexHtml = path.join(clientDist, 'index.html');
const FIXTURE_MARKER = '<!-- CA_SPA_FIXTURE -->';

// ---------------------------------------------------------------------------
// Server lifecycle
// ---------------------------------------------------------------------------

let httpServer: ReturnType<typeof buildServer>['httpServer'];
let port: number;

// NODE_ENV save/restore
let savedNodeEnv: string | undefined;
// Whether index.html existed before this test suite ran
let indexHtmlPreExisted = false;

beforeAll(() => {
  // Save and override NODE_ENV so buildServer() sees 'production'
  savedNodeEnv = process.env['NODE_ENV'];
  process.env['NODE_ENV'] = 'production';

  // Create fixture index.html (guard against overwriting a real build)
  indexHtmlPreExisted = fs.existsSync(fixtureIndexHtml);
  if (!indexHtmlPreExisted) {
    fs.mkdirSync(clientDist, { recursive: true });
    fs.writeFileSync(
      fixtureIndexHtml,
      `<!DOCTYPE html><html><body>${FIXTURE_MARKER}</body></html>`,
    );
  }
});

afterAll(() => {
  // Restore NODE_ENV
  if (savedNodeEnv === undefined) {
    delete process.env['NODE_ENV'];
  } else {
    process.env['NODE_ENV'] = savedNodeEnv;
  }

  // Only remove the fixture if we created it (don't delete a real build output)
  if (!indexHtmlPreExisted && fs.existsSync(fixtureIndexHtml)) {
    fs.rmSync(fixtureIndexHtml);
    // Clean up the dist dir only if it's now empty
    try {
      const entries = fs.readdirSync(clientDist);
      if (entries.length === 0) {
        fs.rmdirSync(clientDist);
      }
    } catch {
      // Ignore — dir may have been created by another process
    }
  }
});

beforeEach(async () => {
  const server = buildServer();
  httpServer = server.httpServer;
  await new Promise<void>((resolve) => {
    httpServer.listen(0, () => {
      resolve();
    });
  });
  port = (httpServer.address() as { port: number }).port;
});

afterEach(async () => {
  await new Promise<void>((resolve) => {
    httpServer.close(() => {
      resolve();
    });
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('production static serving', () => {
  it('GET /healthz returns 200 with body "ok"', async () => {
    const res = await fetch(`http://localhost:${port}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe('ok');
  });

  it('GET to an unmatched path returns 200 and the SPA index.html (fixture marker present)', async () => {
    const res = await fetch(`http://localhost:${port}/some/unknown/route`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain(FIXTURE_MARKER);
  });

  it('GET /healthz body is "ok" and NOT the index.html marker (healthz not shadowed by SPA fallback)', async () => {
    const res = await fetch(`http://localhost:${port}/healthz`);
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toBe('ok');
    expect(body).not.toContain(FIXTURE_MARKER);
  });
});
