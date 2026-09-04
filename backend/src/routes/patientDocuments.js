const express  = require('express');
const multer   = require('multer');
const sharp    = require('sharp');
const { randomUUID } = require('crypto');
const Anthropic = require('@anthropic-ai/sdk');
const { pool } = require('../db');
const storage  = require('../lib/supabaseStorage');

const router = express.Router({ mergeParams: true });

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];
const VALID_DOC_TYPES = ['id_card', 'driving_licence', 'passport'];
const MAX_BYTES    = 10 * 1024 * 1024; // 10 MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: MAX_BYTES },
  fileFilter(_req, file, cb) {
    cb(null, ALLOWED_MIME.includes(file.mimetype));
  },
});

// Compress JPEG/PNG: resize to max 2000px long edge, JPEG quality 80.
// PDFs pass through untouched.
async function maybeCompress(buffer, mimeType, originalName) {
  if (mimeType === 'application/pdf') return { buffer, mimeType, ext: 'pdf' };

  const original = buffer.length;
  const compressed = await sharp(buffer)
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();

  console.log(
    `[PatientDocuments] compress "${originalName}": ${(original / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB`,
  );
  return { buffer: compressed, mimeType: 'image/jpeg', ext: 'jpg' };
}

function resolveTenant(req) {
  return req.user?.tenantId || req.query.tenantId || null;
}

async function assertLeadOwnership(leadId, tenantId) {
  const { rows } = await pool.query(
    `SELECT id FROM leads WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
    [leadId, tenantId],
  );
  return rows.length > 0;
}

// AI pre-screening: sends compressed image buffer to Claude vision API.
// Non-blocking — caller continues even if this fails.
async function runAiAnalysis(docId, imageBuffer, mimeType, docType) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.warn(`[PatientDocuments] runAiAnalysis(${docId}): ANTHROPIC_API_KEY not set — skipping`);
    await pool.query(
      `UPDATE patient_documents SET ai_analysis = $1 WHERE id = $2`,
      ['AI analysis skipped: ANTHROPIC_API_KEY not configured on server.', docId],
    ).catch(e => console.error(`[PatientDocuments] DB write failed after missing key:`, e.message));
    return;
  }

  console.log(`[PatientDocuments] runAiAnalysis starting: docId=${docId} mimeType=${mimeType} docType=${docType} bufferBytes=${imageBuffer.length}`);

  try {
    const client = new Anthropic({ apiKey });

    const base64Image = imageBuffer.toString('base64');
    const mediaType   = mimeType === 'image/png' ? 'image/png' : 'image/jpeg';
    const docTypeLabel = { id_card: 'ID card', driving_licence: 'driving licence', passport: 'passport' }[docType] ?? docType;

    console.log(`[PatientDocuments] calling Anthropic API: model=claude-haiku-4-5-20251001 mediaType=${mediaType} base64Len=${base64Image.length}`);

    const response = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `You are an ID document PRE-SCREENING assistant. This is a ${docTypeLabel} image.
Respond ONLY in English. All flags, issues, and summary MUST be written in English.
CRITICAL: Any mismatch between the MRZ (Machine Readable Zone) and the visual data fields (name, surname, passport number, date of birth) is a STRONG fraud indicator and MUST be marked severity "high", never "medium" or "low". MRZ inconsistencies are the most reliable sign of document tampering.
Flag SUSPICIOUS signals: editing or Photoshop traces, font or alignment inconsistencies, format irregularities, readability issues, absence of expected security features (hologram, microprint, etc.).
NEVER make a definitive "genuine/fake" judgment — only state that these points should be checked by a human.
If nothing suspicious, summary should be: "No obvious issues detected, but human verification is still required."
Return ONLY a raw JSON object — no markdown, no code fences, no prose before or after:
{"flags":[{"severity":"high","issue":"..."}],"summary":"...","appears_suspicious":true}`,
      messages: [{
        role: 'user',
        content: [{
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64Image },
        }, {
          type: 'text',
          text: `Analyse this ${docTypeLabel} image and return JSON only.`,
        }],
      }],
    });

    const raw = response.content[0]?.text?.trim() ?? '';
    console.log(`[PatientDocuments] AI raw response (${docId}):`, raw.slice(0, 300));

    // Extract JSON: strip fences first, then find the first {...} block (handles prose wrapping)
    const stripped = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const jsonMatch = stripped.match(/\{[\s\S]*\}/);
    const jsonStr   = jsonMatch ? jsonMatch[0] : stripped;
    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (parseErr) {
      console.error(`[PatientDocuments] JSON parse failed (${docId}):`, parseErr.message, '| extracted:', jsonStr.slice(0, 300));
      await pool.query(
        `UPDATE patient_documents SET ai_analysis = $1 WHERE id = $2`,
        [`AI returned unreadable response. Raw: ${raw.slice(0, 400)}`, docId],
      ).catch(e => console.error(`[PatientDocuments] DB write failed after parse error:`, e.message));
      return;
    }

    const flags             = Array.isArray(parsed.flags) ? parsed.flags : [];
    const summary           = typeof parsed.summary === 'string' ? parsed.summary : '';
    const appearsSuspicious = !!parsed.appears_suspicious;
    const newStatus         = appearsSuspicious ? 'flagged' : 'unreviewed';

    await pool.query(
      `UPDATE patient_documents
          SET ai_flags = $1, ai_analysis = $2, verification_status = $3
        WHERE id = $4`,
      [JSON.stringify(flags), summary, newStatus, docId],
    );

    console.log(`[PatientDocuments] AI analysis complete: docId=${docId} status=${newStatus} flags=${flags.length}`);
  } catch (err) {
    console.error(`[PatientDocuments] runAiAnalysis FAILED (${docId}): ${err.message}`, err.status ?? '', err.error ?? '');
    await pool.query(
      `UPDATE patient_documents SET ai_analysis = $1 WHERE id = $2`,
      [`AI analysis failed: ${err.message}`, docId],
    ).catch(e => console.error(`[PatientDocuments] DB write failed after analysis error:`, e.message));
  }
}

// POST /api/patients/:leadId/documents
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    try {
      storage.checkConfig();
    } catch (cfgErr) {
      console.error('[PatientDocuments] Storage not configured:', cfgErr.message);
      return res.status(503).json({ error: 'Document storage is not configured on this server.' });
    }

    const { leadId } = req.params;
    const docType = req.body.doc_type;

    if (!req.file) return res.status(400).json({ error: 'No file uploaded or file type not allowed (jpeg/png/pdf only).' });
    if (!VALID_DOC_TYPES.includes(docType)) {
      return res.status(400).json({ error: 'doc_type must be one of: id_card, driving_licence, passport.' });
    }

    const owned = await assertLeadOwnership(leadId, tenantId);
    if (!owned) return res.status(404).json({ error: 'Patient not found.' });

    const { buffer, mimeType, ext } = await maybeCompress(
      req.file.buffer, req.file.mimetype, req.file.originalname,
    );

    const fileId   = randomUUID();
    const filePath = `${tenantId}/${leadId}/${fileId}.${ext}`;

    await storage.uploadFile(filePath, buffer, mimeType);

    const { rows } = await pool.query(
      `INSERT INTO patient_documents (tenant_id, lead_id, doc_type, file_path, original_name, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [tenantId, leadId, docType, filePath, req.file.originalname, mimeType, req.user.sub],
    );

    const doc = rows[0];
    const signedUrl = await storage.getSignedUrl(doc.file_path, 300);

    // Respond immediately — AI analysis runs in the background (non-blocking)
    res.status(201).json({ document: { ...doc, url: signedUrl } });

    // Only analyse images (PDFs not supported by vision API without conversion)
    if (mimeType !== 'application/pdf') {
      runAiAnalysis(doc.id, buffer, mimeType, docType);
    } else {
      pool.query(
        `UPDATE patient_documents SET ai_analysis = $1 WHERE id = $2`,
        ['PDF documents are not automatically analysed — please review manually.', doc.id],
      ).catch(() => {});
    }
  } catch (err) {
    console.error('[PatientDocuments] POST error:', err.message);
    res.status(500).json({ error: 'Failed to upload document.' });
  }
});

// GET /api/patients/:leadId/documents
router.get('/', async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    try {
      storage.checkConfig();
    } catch (cfgErr) {
      console.error('[PatientDocuments] Storage not configured:', cfgErr.message);
      return res.status(503).json({ error: 'Document storage is not configured on this server.' });
    }

    const { leadId } = req.params;
    const owned = await assertLeadOwnership(leadId, tenantId);
    if (!owned) return res.status(404).json({ error: 'Patient not found.' });

    const { rows } = await pool.query(
      `SELECT pd.*,
              CASE WHEN u.id IS NOT NULL
                   THEN trim(u.first_name || ' ' || u.last_name)
                   ELSE NULL
              END AS uploaded_by_name,
              CASE WHEN rv.id IS NOT NULL
                   THEN trim(rv.first_name || ' ' || rv.last_name)
                   ELSE NULL
              END AS reviewed_by_name
       FROM patient_documents pd
       LEFT JOIN users u  ON u.id  = pd.uploaded_by
       LEFT JOIN users rv ON rv.id = pd.reviewed_by
       WHERE pd.lead_id = $1 AND pd.tenant_id = $2 AND pd.deleted_at IS NULL
       ORDER BY pd.uploaded_at DESC`,
      [leadId, tenantId],
    );

    const documents = await Promise.all(
      rows.map(async doc => {
        try {
          const url = await storage.getSignedUrl(doc.file_path, 300);
          return { ...doc, url };
        } catch (urlErr) {
          console.warn(`[PatientDocuments] signed URL failed for ${doc.id}:`, urlErr.message);
          return { ...doc, url: null };
        }
      }),
    );

    res.json({ documents });
  } catch (err) {
    console.error('[PatientDocuments] GET error:', err.message);
    res.status(500).json({ error: 'Failed to fetch documents.' });
  }
});

// PATCH /api/patients/:leadId/documents/:docId/review
// Human decision: approved or rejected.
router.patch('/:docId/review', async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const { leadId, docId } = req.params;
    const { decision } = req.body;

    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: 'decision must be "approved" or "rejected".' });
    }

    const { rows } = await pool.query(
      `SELECT * FROM patient_documents WHERE id = $1 AND lead_id = $2 AND tenant_id = $3`,
      [docId, leadId, tenantId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Document not found.' });

    const newStatus = decision === 'approved' ? 'human_approved' : 'rejected';

    const { rows: updated } = await pool.query(
      `UPDATE patient_documents
          SET verification_status = $1,
              reviewed_by         = $2,
              reviewed_at         = NOW()
        WHERE id = $3
        RETURNING *`,
      [newStatus, req.user.sub, docId],
    );

    // Fetch reviewer name for response
    const { rows: reviewerRows } = await pool.query(
      `SELECT trim(first_name || ' ' || last_name) AS reviewed_by_name FROM users WHERE id = $1`,
      [req.user.sub],
    );

    res.json({ document: { ...updated[0], reviewed_by_name: reviewerRows[0]?.reviewed_by_name ?? null } });
  } catch (err) {
    console.error('[PatientDocuments] PATCH review error:', err.message);
    res.status(500).json({ error: 'Failed to update review decision.' });
  }
});

// POST /api/patients/:leadId/documents/:docId/analyze
// Re-trigger AI analysis for an existing document (e.g. migration backfill).
router.post('/:docId/analyze', async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const { leadId, docId } = req.params;

    const { rows } = await pool.query(
      `SELECT * FROM patient_documents WHERE id = $1 AND lead_id = $2 AND tenant_id = $3`,
      [docId, leadId, tenantId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Document not found.' });

    const doc = rows[0];

    if (doc.mime_type === 'application/pdf') {
      return res.status(422).json({ error: 'PDF documents cannot be analysed by AI vision.' });
    }

    try {
      storage.checkConfig();
    } catch (cfgErr) {
      return res.status(503).json({ error: 'Document storage is not configured on this server.' });
    }

    // Download file from storage for analysis
    const imageBuffer = await storage.downloadFile(doc.file_path);

    res.json({ ok: true, message: 'AI analysis started.' });

    runAiAnalysis(doc.id, imageBuffer, doc.mime_type, doc.doc_type);
  } catch (err) {
    console.error('[PatientDocuments] POST analyze error:', err.message);
    res.status(500).json({ error: 'Failed to start AI analysis.' });
  }
});

// DELETE /api/patients/:leadId/documents/:docId
router.delete('/:docId', async (req, res) => {
  try {
    const tenantId = resolveTenant(req);
    if (!tenantId) return res.status(400).json({ error: 'tenantId is required.' });

    const { leadId, docId } = req.params;

    const { rows } = await pool.query(
      `SELECT * FROM patient_documents WHERE id = $1 AND lead_id = $2 AND tenant_id = $3`,
      [docId, leadId, tenantId],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Document not found.' });

    const doc = rows[0];

    try {
      await storage.deleteFile(doc.file_path);
    } catch (storageErr) {
      console.warn('[PatientDocuments] Storage delete failed (non-fatal):', storageErr.message);
    }

    await pool.query(`DELETE FROM patient_documents WHERE id = $1`, [doc.id]);

    res.json({ ok: true });
  } catch (err) {
    console.error('[PatientDocuments] DELETE error:', err.message);
    res.status(500).json({ error: 'Failed to delete document.' });
  }
});

module.exports = router;
