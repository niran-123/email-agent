// backend/src/tests/phase2.test.js
// Verification tests for Phase 2: Crypto, MIME parsing, JWT, and Gmail services.

import assert from 'assert';
import { encrypt, decrypt, generateSecureToken } from '../utils/crypto.js';
import {
  decodeBase64Url,
  parseContact,
  parseContactList,
  parseGmailMessage,
} from '../services/mimeParser.service.js';
import { signJwtToken, verifyJwtToken } from '../utils/token.js';
import { validateOAuthState } from '../services/googleAuth.service.js';

console.log('\n🧪 Running Phase 2 Test Suite...\n');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅  ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌  ${name}`);
    console.error(`      ${err.message}`);
    failed++;
  }
}

async function runAsyncTests() {
  // ── 1. AES-256-GCM Encryption Tests ──────────────────────────────────────────
  test('Crypto: Encrypt and decrypt standard string', () => {
    const secret = 'ya29.a0ARrdaM-sensitive-google-refresh-token-123456';
    const encrypted = encrypt(secret);

    assert(encrypted.includes(':'), 'Encrypted payload must contain IV and tag delimiters');
    assert.strictEqual(encrypted.split(':').length, 3, 'Must have iv:authTag:ciphertext');

    const decrypted = decrypt(encrypted);
    assert.strictEqual(decrypted, secret, 'Decrypted text must match original');
  });

  test('Crypto: Tampered ciphertext is detected by GCM auth tag', () => {
    const secret = 'my-token';
    const encrypted = encrypt(secret);
    const [iv, tag, ciphertext] = encrypted.split(':');

    // Tamper with one byte of ciphertext
    const tamperedCiphertext =
      ciphertext.slice(0, -2) + (ciphertext.slice(-2) === 'aa' ? 'bb' : 'aa');
    const tamperedPayload = `${iv}:${tag}:${tamperedCiphertext}`;

    assert.throws(
      () => decrypt(tamperedPayload),
      /Unsupported state or unable to authenticate data|bad auth tag/,
      'Tampered payload must fail authentication',
    );
  });

  test('Crypto: Generate secure random state token', () => {
    const token1 = generateSecureToken(32);
    const token2 = generateSecureToken(32);
    assert.strictEqual(token1.length, 64, '32 bytes in hex is 64 characters');
    assert.notStrictEqual(token1, token2, 'Two tokens must not collide');
  });

  // ── 2. JWT Session Token Tests ────────────────────────────────────────────────
  test('Token: Sign and verify user JWT', () => {
    const fakeUser = {
      _id: '507f1f77bcf86cd799439011',
      email: 'alex@example.com',
    };
    const token = signJwtToken(fakeUser);
    assert(token && typeof token === 'string', 'Token must be a valid JWT string');

    const decoded = verifyJwtToken(token);
    assert.strictEqual(decoded.userId, fakeUser._id);
    assert.strictEqual(decoded.email, fakeUser.email);
  });

  // ── 3. MIME & Email Parser Tests ─────────────────────────────────────────────
  test('MIME: Base64URL decoding handles web-safe chars and padding', () => {
    // "Hello World! Special: +/=" encoded in web-safe Base64URL
    const encoded = Buffer.from('Hello World! Special: +/=').toString('base64url');
    const decoded = decodeBase64Url(encoded);
    assert.strictEqual(decoded, 'Hello World! Special: +/=');
  });

  test('MIME: Parse contact headers correctly', () => {
    const c1 = parseContact('Sarah Connor <sarah@cyberdyne.com>');
    assert.strictEqual(c1.name, 'Sarah Connor');
    assert.strictEqual(c1.email, 'sarah@cyberdyne.com');

    const c2 = parseContact('simple@example.com');
    assert.strictEqual(c2.name, '');
    assert.strictEqual(c2.email, 'simple@example.com');
  });

  test('MIME: Parse multiple contact addresses', () => {
    const list = parseContactList(
      'Alice <alice@test.com>, "Bob, The Builder" <bob@test.com>, charlie@test.com',
    );
    assert.strictEqual(list.length, 3);
    assert.strictEqual(list[0].email, 'alice@test.com');
    assert.strictEqual(list[1].name, 'Bob, The Builder');
    assert.strictEqual(list[1].email, 'bob@test.com');
    assert.strictEqual(list[2].email, 'charlie@test.com');
  });

  test('MIME: Parse full Gmail API message structure', () => {
    const mockGmailMessage = {
      id: 'msg_12345',
      threadId: 'th_67890',
      historyId: '998877',
      internalDate: '1700000000000',
      labelIds: ['INBOX', 'UNREAD'],
      snippet: 'Hey! Are we still meeting for lunch?',
      payload: {
        headers: [
          { name: 'Subject', value: 'Lunch Tomorrow' },
          { name: 'From', value: 'John Smith <john@smith.org>' },
          { name: 'To', value: 'Me <me@mailmind.ai>' },
        ],
        parts: [
          {
            mimeType: 'text/plain',
            body: {
              data: Buffer.from('Hey! Are we still meeting for lunch?').toString('base64url'),
            },
          },
          {
            mimeType: 'text/html',
            body: {
              data: Buffer.from('<p>Hey! Are we still meeting for lunch?</p>').toString('base64url'),
            },
          },
          {
            filename: 'menu.pdf',
            mimeType: 'application/pdf',
            body: {
              size: 42000,
              attachmentId: 'att_abc123',
            },
          },
        ],
      },
    };

    const parsed = parseGmailMessage(mockGmailMessage);
    assert.strictEqual(parsed.gmailMessageId, 'msg_12345');
    assert.strictEqual(parsed.threadId, 'th_67890');
    assert.strictEqual(parsed.subject, 'Lunch Tomorrow');
    assert.strictEqual(parsed.from.email, 'john@smith.org');
    assert.strictEqual(parsed.to[0].email, 'me@mailmind.ai');
    assert.strictEqual(parsed.bodyText, 'Hey! Are we still meeting for lunch?');
    assert.strictEqual(parsed.bodyHtml, '<p>Hey! Are we still meeting for lunch?</p>');
    assert.strictEqual(parsed.hasAttachments, true);
    assert.strictEqual(parsed.attachments.length, 1);
    assert.strictEqual(parsed.attachments[0].filename, 'menu.pdf');
    assert.strictEqual(parsed.attachments[0].size, 42000);
  });

  // ── 4. OAuth State Validation ────────────────────────────────────────────────
  const validState = await validateOAuthState(generateSecureToken(32));
  test('OAuth: State validation returns true for valid random state token', () => {
    assert.strictEqual(validState, true);
  });

  const emptyState = await validateOAuthState('');
  test('OAuth: State validation rejects empty state string', () => {
    assert.strictEqual(emptyState, false);
  });

  console.log(`\n========================================`);
  console.log(`  Tests Passed: ${passed}`);
  console.log(`  Tests Failed: ${failed}`);
  console.log(`========================================\n`);

  if (failed > 0) process.exit(1);
}

runAsyncTests();

