'use strict';

const fs     = require('fs');
const path   = require('path');
const AdmZip = require('adm-zip');

const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

function xmlEscape(str) {
  return String(str)
    .replace(/&/g,  '&amp;')
    .replace(/</g,  '&lt;')
    .replace(/>/g,  '&gt;')
    .replace(/"/g,  '&quot;')
    .replace(/'/g,  '&apos;');
}

/** Convert a pg DATE value (string "YYYY-MM-DD" or Date object) to DD/MM/YYYY. */
function toUKDate(val) {
  if (!val) return '';
  const s = val instanceof Date ? val.toISOString().slice(0, 10) : String(val).slice(0, 10);
  const [year, month, day] = s.split('-');
  if (!year || !month || !day) return '';
  return `${day}/${month}/${year}`;
}

/**
 * Fill a .docx template (in TEMPLATES_DIR) with data and return a base64 string.
 * Replaces every [[key]] with data[key] (XML-escaped). Missing keys → ''.
 * SignWell text-tags ({{...}}) are untouched — they live in a different format.
 */
async function fillTemplate(templateFileName, data) {
  const templatePath = path.join(TEMPLATES_DIR, templateFileName);
  if (!fs.existsSync(templatePath)) {
    throw new Error(`SignWell template not found at ${templatePath}`);
  }
  const zip      = new AdmZip(templatePath);
  const docEntry = zip.getEntry('word/document.xml');
  if (!docEntry) throw new Error(`word/document.xml not found in ${templateFileName}`);

  let xml = zip.readAsText(docEntry, 'utf8');

  xml = xml.replace(/\[\[([^\]]+)\]\]/g, (_m, key) => {
    const val = data[key];
    return xmlEscape(val != null ? String(val) : '');
  });

  zip.updateFile('word/document.xml', Buffer.from(xml, 'utf8'));
  return zip.toBuffer().toString('base64');
}

/**
 * Create a SignWell signature document.
 * Returns { documentId, recipients: [{id, email, signing_url}] }
 */
async function createSignatureDocument({
  apiKey, fileBase64, fileName, recipients, metadata,
  requesterName, requesterEmail, subject, message,
}) {
  const body = {
    files:                 [{ name: fileName, file_base64: fileBase64 }],
    recipients,
    text_tags:             true,
    metadata,
    custom_requester_name:  requesterName,
    custom_requester_email: requesterEmail,
    name:                   fileName,
    subject,
    message,
    draft:         false,
    reminders:     true,
    allow_decline: true,
    expires_in:    7,
    language:      'en',
  };

  const resp = await fetch('https://www.signwell.com/api/v1/documents', {
    method:  'POST',
    headers: { 'X-Api-Key': apiKey, 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    console.error('[SignWell] createDocument error:', resp.status, text);
    throw new Error(`SignWell API error ${resp.status}: ${text}`);
  }

  const json = await resp.json();
  return {
    documentId: json.id,
    recipients: (json.recipients || []).map(r => ({
      id:          r.id,
      email:       r.email,
      signing_url: r.signing_url,
    })),
  };
}

/**
 * Fetch the signed PDF download URL for a completed SignWell document.
 * Uses the dedicated completed_pdf endpoint with url_only=true to get a direct link.
 * Ref: GET /api/v1/documents/{id}/completed_pdf?url_only=true → { file_url: "..." }
 */
async function getDocumentDownloadUrl(apiKey, documentId) {
  const resp = await fetch(
    `https://www.signwell.com/api/v1/documents/${documentId}/completed_pdf?url_only=true`,
    { headers: { 'X-Api-Key': apiKey } },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`SignWell completed_pdf error ${resp.status}: ${text}`);
  }
  const json = await resp.json();
  const url  = json.file_url || null;
  if (!url) throw new Error(`SignWell completed_pdf returned no file_url: ${JSON.stringify(json)}`);
  return url;
}

module.exports = { fillTemplate, createSignatureDocument, getDocumentDownloadUrl, toUKDate };
