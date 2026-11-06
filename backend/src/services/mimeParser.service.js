// backend/src/services/mimeParser.service.js
// MIME parsing service supporting both RFC 2822 raw messages and Gmail payload tree structures.

import { simpleParser } from 'mailparser';

/**
 * Decode Base64URL encoded string to standard utf-8 string.
 * Gmail API uses web-safe base64 (- and _ instead of + and /).
 *
 * @param {string} base64UrlString
 * @returns {string}
 */
export function decodeBase64Url(base64UrlString) {
  if (!base64UrlString) return '';
  // Convert web-safe base64 to standard base64
  let base64 = base64UrlString.replace(/-/g, '+').replace(/_/g, '/');
  // Pad if missing
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf-8');
}

/**
 * Parse headers array from Gmail API into an object.
 * @param {Array<{ name: string, value: string }>} headers
 * @returns {Record<string, string>}
 */
export function parseHeaders(headers = []) {
  const result = {};
  for (const h of headers) {
    if (h.name && h.value) {
      result[h.name.toLowerCase()] = h.value;
    }
  }
  return result;
}

/**
 * Parse a contact header like "John Doe <john@example.com>" or "john@example.com".
 * @param {string} str
 * @returns {{ name: string, email: string }}
 */
export function parseContact(str = '') {
  if (!str) return { name: '', email: '' };

  const match = str.match(/^(?:"?([^"]*)"?\s)?(?:<?(.+@[^>]+)>?)$/);
  if (match) {
    return {
      name: (match[1] || '').trim(),
      email: (match[2] || '').trim().toLowerCase(),
    };
  }

  return { name: '', email: str.trim().toLowerCase() };
}

/**
 * Parse a comma-separated list of contact headers.
 * @param {string} str
 * @returns {Array<{ name: string, email: string }>}
 */
export function parseContactList(str = '') {
  if (!str) return [];
  // Split on commas not enclosed in quotes
  const contacts = str.split(/,(?=(?:[^\"]*\"[^\"]*\")*[^\"]*$)/);
  return contacts.map((c) => parseContact(c.trim())).filter((c) => Boolean(c.email));
}

/**
 * Recursively extract text, html, and attachments metadata from Gmail message parts.
 *
 * @param {object} part - Gmail payload or part
 * @returns {{ text: string, html: string, attachments: Array<object> }}
 */
export function extractParts(part) {
  let text = '';
  let html = '';
  const attachments = [];

  if (!part) return { text, html, attachments };

  const mimeType = (part.mimeType || '').toLowerCase();

  // If this part is an attachment
  if (part.filename && part.body) {
    attachments.push({
      filename: part.filename,
      mimeType: part.mimeType || 'application/octet-stream',
      size: part.body.size || 0,
      attachmentId: part.body.attachmentId || null,
    });
  }

  // Extract body content if present
  if (part.body && part.body.data) {
    const decoded = decodeBase64Url(part.body.data);
    if (mimeType === 'text/plain') {
      text += decoded;
    } else if (mimeType === 'text/html') {
      html += decoded;
    }
  }

  // Recursively process nested multipart children
  if (Array.isArray(part.parts)) {
    for (const subPart of part.parts) {
      const nested = extractParts(subPart);
      if (nested.text) text += (text ? '\n\n' : '') + nested.text;
      if (nested.html) html += (html ? '\n' : '') + nested.html;
      if (nested.attachments.length) attachments.push(...nested.attachments);
    }
  }

  return { text, html, attachments };
}

/**
 * Parse a complete Gmail API message object into structured, safe fields.
 *
 * @param {object} gmailMessage - Raw object from Gmail API messages.get (format: full)
 * @returns {object} Clean parsed email object
 */
export function parseGmailMessage(gmailMessage) {
  const { id, threadId, historyId, internalDate, labelIds = [], snippet = '', payload } = gmailMessage;

  const headerMap = parseHeaders(payload?.headers || []);
  const fromContact = parseContact(headerMap['from'] || '');
  const toContacts = parseContactList(headerMap['to'] || '');
  const ccContacts = parseContactList(headerMap['cc'] || '');
  const bccContacts = parseContactList(headerMap['bcc'] || '');
  const subject = headerMap['subject'] || '(No Subject)';

  // Extract content and attachments metadata
  const { text, html, attachments } = extractParts(payload);

  // Parse received timestamp (internalDate is ms epoch string)
  let receivedAt;
  if (internalDate) {
    receivedAt = new Date(parseInt(internalDate, 10));
  } else if (headerMap['date']) {
    receivedAt = new Date(headerMap['date']);
  } else {
    receivedAt = new Date();
  }

  return {
    gmailMessageId: id,
    threadId,
    historyId: historyId || null,
    subject,
    sender: fromContact.email || '',
    senderName: fromContact.name || '',
    recipient: toContacts.map((c) => c.email),
    cc: ccContacts.map((c) => c.email),
    bcc: bccContacts.map((c) => c.email),
    from: fromContact,
    to: toContacts,
    snippet,
    bodyText: text || snippet || '',
    bodyHtml: html || null,
    labels: labelIds,
    receivedAt,
    hasAttachments: attachments.length > 0,
    attachments,
    processingStatus: 'pending',
    syncStatus: 'synced',
  };
}

/**
 * Parse raw RFC 2822 email buffer/string using mailparser.
 *
 * @param {Buffer|string} rawContent
 * @returns {Promise<object>}
 */
export async function parseRawEmail(rawContent) {
  const parsed = await simpleParser(rawContent);

  const attachments = (parsed.attachments || []).map((att) => ({
    filename: att.filename || 'attachment',
    mimeType: att.contentType || 'application/octet-stream',
    size: att.size || 0,
    attachmentId: null, // Raw emails don't have Gmail attachment IDs
  }));

  const from = parsed.from?.value?.[0]
    ? { name: parsed.from.value[0].name || '', email: parsed.from.value[0].address || '' }
    : { name: '', email: '' };

  const to = (parsed.to?.value || []).map((t) => ({
    name: t.name || '',
    email: t.address || '',
  }));

  return {
    subject: parsed.subject || '(No Subject)',
    from,
    to,
    receivedAt: parsed.date || new Date(),
    bodyText: parsed.text || '',
    bodyHtml: parsed.html || '',
    attachments,
  };
}

