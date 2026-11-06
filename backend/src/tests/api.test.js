// backend/src/tests/api.test.js
// Integration test for HTTP endpoints: health, auth, and protected route security.

import assert from 'assert';
import app from '../app.js';

console.log('\n🌐 Running API Integration Test Suite...\n');

const server = app.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const BASE_URL = `http://127.0.0.1:${port}/api`;
  let passed = 0;
  let failed = 0;

  async function testRoute(name, fn) {
    try {
      await fn();
      console.log(`  ✅  ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌  ${name}`);
      console.error(`      ${err.message}`, err.cause || '');
      failed++;
    }
  }

  try {
    // 1. Health check
    await testRoute('GET /api/health returns health status', async () => {
      const res = await fetch(`${BASE_URL}/health`);
      const body = await res.json();
      assert(body.status, 'Response must contain status');
      assert(body.services, 'Response must contain services object');
    });

    // 2. Auth: Google login URL generator
    await testRoute('GET /api/auth/google?json=true generates auth URL & state', async () => {
      const res = await fetch(`${BASE_URL}/auth/google?json=true`);
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
      assert(body.url.includes('accounts.google.com'), 'Auth URL must point to Google');
      assert(body.url.includes('gmail.readonly'), 'Auth URL must request gmail.readonly scope');
      assert(body.url.includes('access_type=offline'), 'Auth URL must request offline access');
      assert(body.state, 'Response must contain state token');
    });

    // 3. Security: Protected route rejects unauthenticated request
    await testRoute('GET /api/auth/me returns 401 without Bearer token', async () => {
      const res = await fetch(`${BASE_URL}/auth/me`);
      const body = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'UNAUTHORIZED');
    });

    // 4. Security: Protected Gmail route rejects unauthenticated request
    await testRoute('GET /api/gmail/status returns 401 without Bearer token', async () => {
      const res = await fetch(`${BASE_URL}/gmail/status`);
      const body = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'UNAUTHORIZED');
    });

    // 5. Auth: Logout endpoint
    await testRoute('POST /api/auth/logout succeeds', async () => {
      const res = await fetch(`${BASE_URL}/auth/logout`, { method: 'POST' });
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.strictEqual(body.success, true);
    });

    // 6. Webhooks: Gmail Pub/Sub push notification endpoint
    await testRoute('POST /api/webhooks/gmail handles Pub/Sub message safely', async () => {
      const mockPush = {
        message: {
          data: Buffer.from(
            JSON.stringify({ emailAddress: 'webhooktest@gmail.com', historyId: '998877' }),
          ).toString('base64'),
          messageId: 'pubsub_mock_12345',
          publishTime: new Date().toISOString(),
        },
        subscription: 'projects/test/subscriptions/gmail-sub',
      };

      const res = await fetch(`${BASE_URL}/webhooks/gmail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mockPush),
      });

      assert.strictEqual(res.status, 200, 'Must ACK with 200');
      const body = await res.json();
      assert(body.status === 'acknowledged' || body.status === 'ignored');
    });

    // 7. Security: Protected Gmail Watch routes reject unauthenticated requests
    await testRoute('POST /api/gmail/watch/start returns 401 without Bearer token', async () => {
      const res = await fetch(`${BASE_URL}/gmail/watch/start`, { method: 'POST' });
      const body = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(body.error.code, 'UNAUTHORIZED');
    });

    await testRoute('GET /api/gmail/sync/status returns 401 without Bearer token', async () => {
      const res = await fetch(`${BASE_URL}/gmail/sync/status`);
      const body = await res.json();
      assert.strictEqual(res.status, 401);
      assert.strictEqual(body.error.code, 'UNAUTHORIZED');
    });

    console.log(`\n========================================`);
    console.log(`  API Tests Passed: ${passed}`);
    console.log(`  API Tests Failed: ${failed}`);
    console.log(`========================================\n`);
  } finally {
    server.close(() => {
      process.exit(failed > 0 ? 1 : 0);
    });
  }
});

