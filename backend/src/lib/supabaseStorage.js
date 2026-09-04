const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL          = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET                = 'patient-documents';

let _client = null;

function getClient() {
  if (_client) return _client;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for document storage.');
  }
  _client = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false },
  });
  return _client;
}

async function uploadFile(path, buffer, mimeType) {
  const { error } = await getClient()
    .storage
    .from(BUCKET)
    .upload(path, buffer, { contentType: mimeType, upsert: false });
  if (error) throw error;
}

async function getSignedUrl(path, expiresInSeconds = 300) {
  const { data, error } = await getClient()
    .storage
    .from(BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
}

async function deleteFile(path) {
  const { error } = await getClient()
    .storage
    .from(BUCKET)
    .remove([path]);
  if (error) throw error;
}

function checkConfig() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    throw new Error('Storage not configured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  }
}

async function downloadFile(path) {
  const { data, error } = await getClient()
    .storage
    .from(BUCKET)
    .download(path);
  if (error) throw error;
  // Supabase returns a Blob in Node.js; convert to Buffer
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

module.exports = { uploadFile, getSignedUrl, deleteFile, downloadFile, checkConfig };
