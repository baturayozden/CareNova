'use strict';

// GECE-4-BRIEFI.md Bölüm C — unit tests for the media pre-processing helpers
// (transcribeIncomingVoiceNote, handleIncomingVisualMedia) exported via
// _internal, same pattern as routes/caseFiles.js's _internal export. No HTTP
// layer, no DB — every dependency is mocked. MUTLAK YASAK #5: nothing here
// makes a real network or AI call.

jest.mock('../../db/index', () => ({ pool: { query: jest.fn() } }));
jest.mock('../../services/whatsapp', () => ({
  downloadMedia: jest.fn(),
  sendText: jest.fn().mockResolvedValue({ messages: [{ id: 'wamid.OUT1' }] }),
}));
jest.mock('../../services/ai', () => ({
  loadCaseForLead: jest.fn(),
  loadBranchTemplate: jest.fn(),
}));
jest.mock('../../services/leadStore', () => ({
  saveMessage: jest.fn().mockResolvedValue({ id: 'msg-1' }),
}));
jest.mock('../../services/caseFileStore', () => ({
  addMedia: jest.fn().mockResolvedValue({ id: 'media-1' }),
  appendCaseEvent: jest.fn().mockResolvedValue({ id: 'evt-1' }),
  listMedia: jest.fn().mockResolvedValue([]),
  updateCaseStatus: jest.fn().mockResolvedValue({ id: 'case-1', status: 'awaiting_doctor' }),
}));
jest.mock('../../services/transcription', () => ({ transcribeAudio: jest.fn() }));
jest.mock('../../services/visionExtraction', () => ({
  extractFromImage: jest.fn(),
  isQualityInsufficient: jest.fn(),
}));
jest.mock('../../lib/supabaseStorage', () => ({ uploadFile: jest.fn().mockResolvedValue(undefined) }));
// These are required transitively by routes/whatsapp.js but unused by the
// functions under test — stubbed so `require` doesn't touch a real DB/SMTP.
jest.mock('../notifications', () => ({ createNotification: jest.fn() }));
jest.mock('../../services/leadScoring', () => ({ scoreLeadAsync: jest.fn() }));
jest.mock('../../utils/email', () => ({ sendEscalationAlert: jest.fn() }));
jest.mock('../../config/tenantDefaults', () => ({ getDefaultAssignee: jest.fn() }));

const whatsapp = require('../../services/whatsapp');
const ai = require('../../services/ai');
const leadStore = require('../../services/leadStore');
const caseFileStore = require('../../services/caseFileStore');
const transcription = require('../../services/transcription');
const visionExtraction = require('../../services/visionExtraction');
const supabaseStorage = require('../../lib/supabaseStorage');

const { _internal } = require('../whatsapp');
const { transcribeIncomingVoiceNote, handleIncomingVisualMedia } = _internal;

const HAIR_BRANCH_TEMPLATE = {
  key: 'hair_transplant',
  requiredMedia: [
    { id: 'on_gorunum', captureInstruction: { tr: 'Doğal ışıkta, önden çekilmiş', en: 'Natural light, taken from the front' } },
    { id: 'tepe', captureInstruction: { tr: 'Baş tepesi net görünecek şekilde', en: 'From above, crown clearly visible' } },
  ],
};

const BASE_INCOMING = {
  from: '905551234567', messageId: 'wamid.MEDIA1', mediaId: 'media-abc', mimeType: 'audio/ogg',
};
const BASE_LEAD = { id: 'lead-1', language: 'tr' };
const WA_CONFIG = { phoneNumberId: '111', accessToken: 'tok' };

afterEach(() => jest.clearAllMocks());

describe('transcribeIncomingVoiceNote — success', () => {
  test('downloads, transcribes, and returns the transcript', async () => {
    whatsapp.downloadMedia.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'audio/ogg' });
    transcription.transcribeAudio.mockResolvedValue({
      transcript: 'Saç ekimi hakkında bilgi istiyorum', detectedLanguage: 'tr', confidence: 0.9, provider: 'mock',
    });
    ai.loadCaseForLead.mockResolvedValue(null);

    const result = await transcribeIncomingVoiceNote(
      { ...BASE_INCOMING, type: 'audio' },
      { tenantId: 'tenant-1', lead: BASE_LEAD, waConfig: WA_CONFIG },
    );

    expect(result).toBe('Saç ekimi hakkında bilgi istiyorum');
    expect(whatsapp.sendText).not.toHaveBeenCalled(); // no failure reply
    expect(caseFileStore.addMedia).not.toHaveBeenCalled(); // no case yet
  });

  test('when a case exists, saves the transcript to case_media as kind=audio', async () => {
    whatsapp.downloadMedia.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'audio/ogg' });
    transcription.transcribeAudio.mockResolvedValue({
      transcript: 'Panoramik röntgenim var', detectedLanguage: 'tr', confidence: 0.95, provider: 'mock',
    });
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'dental' });

    await transcribeIncomingVoiceNote(
      { ...BASE_INCOMING, type: 'audio' },
      { tenantId: 'tenant-1', lead: BASE_LEAD, waConfig: WA_CONFIG },
    );

    expect(caseFileStore.addMedia).toHaveBeenCalledWith(
      'tenant-1', 'case-1',
      expect.objectContaining({
        kind: 'audio',
        whatsappMediaId: 'media-abc',
        aiExtraction: expect.objectContaining({ transcript: 'Panoramik röntgenim var', detectedLanguage: 'tr' }),
      }),
      null,
    );
  });
});

describe('transcribeIncomingVoiceNote — failure (Bölüm C.1 item 5: never go silent)', () => {
  test('media download failure → sends a written-retry request in the lead\'s language, returns null', async () => {
    whatsapp.downloadMedia.mockRejectedValue(new Error('Meta media fetch failed'));
    ai.loadCaseForLead.mockResolvedValue(null);

    const result = await transcribeIncomingVoiceNote(
      { ...BASE_INCOMING, type: 'audio' },
      { tenantId: 'tenant-1', lead: { ...BASE_LEAD, language: 'tr' }, waConfig: WA_CONFIG },
    );

    expect(result).toBeNull();
    expect(whatsapp.sendText).toHaveBeenCalledTimes(1);
    const [to, text] = whatsapp.sendText.mock.calls[0];
    expect(to).toBe('+905551234567');
    expect(text).toMatch(/yaz(arak|ı)/i); // Turkish retry text asks to write it instead
  });

  test('transcription provider failure → same graceful behaviour, logs a case_event if a case exists', async () => {
    whatsapp.downloadMedia.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'audio/ogg' });
    transcription.transcribeAudio.mockRejectedValue(new Error('provider unavailable'));
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'hair_transplant' });

    const result = await transcribeIncomingVoiceNote(
      { ...BASE_INCOMING, type: 'audio' },
      { tenantId: 'tenant-1', lead: { ...BASE_LEAD, language: 'en' }, waConfig: WA_CONFIG },
    );

    expect(result).toBeNull();
    expect(whatsapp.sendText).toHaveBeenCalledTimes(1);
    expect(caseFileStore.appendCaseEvent).toHaveBeenCalledWith(
      'tenant-1', 'case-1', 'media_error', null, expect.objectContaining({ type: 'audio' }),
    );
  });

  test('never throws — webhook resilience (Bölüm C.3)', async () => {
    whatsapp.downloadMedia.mockRejectedValue(new Error('boom'));
    ai.loadCaseForLead.mockResolvedValue(null);
    await expect(
      transcribeIncomingVoiceNote({ ...BASE_INCOMING, type: 'audio' }, { tenantId: 'tenant-1', lead: BASE_LEAD, waConfig: WA_CONFIG }),
    ).resolves.toBeNull();
  });
});

describe('handleIncomingVisualMedia — no case yet', () => {
  test('acknowledges receipt, saves the inbound message, never calls vision extraction', async () => {
    whatsapp.downloadMedia.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'image/jpeg' });
    ai.loadCaseForLead.mockResolvedValue(null);

    await handleIncomingVisualMedia(
      { ...BASE_INCOMING, type: 'image', mediaId: 'media-img', mimeType: 'image/jpeg', caption: null },
      { tenantId: 'tenant-1', lead: BASE_LEAD, waConfig: WA_CONFIG },
    );

    expect(visionExtraction.extractFromImage).not.toHaveBeenCalled();
    expect(caseFileStore.addMedia).not.toHaveBeenCalled();
    expect(leadStore.saveMessage).toHaveBeenCalledWith(expect.objectContaining({ messageType: 'image' }));
    expect(whatsapp.sendText).toHaveBeenCalledTimes(1);
  });
});

describe('handleIncomingVisualMedia — 🔴 MUTLAK KURAL: extraction never reaches the patient', () => {
  test('sends only a deterministic ack — the structured extraction never appears in an outbound message', async () => {
    whatsapp.downloadMedia.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'image/jpeg' });
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'hair_transplant', patient_language: 'en', status: 'new' });
    ai.loadBranchTemplate.mockResolvedValue(HAIR_BRANCH_TEMPLATE);
    visionExtraction.extractFromImage.mockResolvedValue({
      norwoodEstimate: 'Norwood 4 (estimate — doctor review required)',
      donorDensityNote: 'adequate', imageQuality: 'good', matchedSlot: 'on_gorunum',
    });
    visionExtraction.isQualityInsufficient.mockReturnValue(false);
    caseFileStore.listMedia.mockResolvedValue([{ template_slot_id: 'on_gorunum', quality_ok: true }]);

    await handleIncomingVisualMedia(
      { ...BASE_INCOMING, type: 'image', mediaId: 'media-img', mimeType: 'image/jpeg', caption: null },
      { tenantId: 'tenant-1', lead: BASE_LEAD, waConfig: WA_CONFIG },
    );

    const sentTexts = whatsapp.sendText.mock.calls.map(call => call[1]);
    for (const text of sentTexts) {
      expect(text).not.toMatch(/norwood/i);
      expect(text).not.toMatch(/adequate/i);
    }
  });
});

describe('handleIncomingVisualMedia — quality insufficient → retake request', () => {
  test('uses the matched slot\'s captureInstruction in the patient\'s language', async () => {
    whatsapp.downloadMedia.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'image/jpeg' });
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'hair_transplant', patient_language: 'en', status: 'new' });
    ai.loadBranchTemplate.mockResolvedValue(HAIR_BRANCH_TEMPLATE);
    visionExtraction.extractFromImage.mockResolvedValue({ imageQuality: 'blurry', matchedSlot: 'tepe' });
    visionExtraction.isQualityInsufficient.mockReturnValue(true);

    await handleIncomingVisualMedia(
      { ...BASE_INCOMING, type: 'image', mediaId: 'media-img', mimeType: 'image/jpeg', caption: null },
      { tenantId: 'tenant-1', lead: BASE_LEAD, waConfig: WA_CONFIG },
    );

    expect(caseFileStore.addMedia).toHaveBeenCalledWith(
      'tenant-1', 'case-1', expect.objectContaining({ qualityOk: false }), null,
    );
    expect(caseFileStore.updateCaseStatus).not.toHaveBeenCalled();
    const [, text] = whatsapp.sendText.mock.calls[0];
    expect(text).toMatch(/crown clearly visible/i); // the 'tepe' slot's English captureInstruction
  });
});

describe('handleIncomingVisualMedia — required media completion (Bölüm C.2 item 5)', () => {
  test('not all required slots filled → partial ack, no case transition', async () => {
    whatsapp.downloadMedia.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'image/jpeg' });
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'hair_transplant', patient_language: 'en', status: 'new' });
    ai.loadBranchTemplate.mockResolvedValue(HAIR_BRANCH_TEMPLATE);
    visionExtraction.extractFromImage.mockResolvedValue({ imageQuality: 'good', matchedSlot: 'on_gorunum' });
    visionExtraction.isQualityInsufficient.mockReturnValue(false);
    caseFileStore.listMedia.mockResolvedValue([{ template_slot_id: 'on_gorunum', quality_ok: true }]); // 'tepe' still missing

    await handleIncomingVisualMedia(
      { ...BASE_INCOMING, type: 'image', mediaId: 'media-img', mimeType: 'image/jpeg', caption: null },
      { tenantId: 'tenant-1', lead: BASE_LEAD, waConfig: WA_CONFIG },
    );

    expect(caseFileStore.updateCaseStatus).not.toHaveBeenCalled();
  });

  test('all required slots filled → auto-transitions the case to awaiting_doctor', async () => {
    whatsapp.downloadMedia.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'image/jpeg' });
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'hair_transplant', patient_language: 'en', status: 'new' });
    ai.loadBranchTemplate.mockResolvedValue(HAIR_BRANCH_TEMPLATE);
    visionExtraction.extractFromImage.mockResolvedValue({ imageQuality: 'good', matchedSlot: 'tepe' });
    visionExtraction.isQualityInsufficient.mockReturnValue(false);
    caseFileStore.listMedia.mockResolvedValue([
      { template_slot_id: 'on_gorunum', quality_ok: true },
      { template_slot_id: 'tepe', quality_ok: true },
    ]);

    await handleIncomingVisualMedia(
      { ...BASE_INCOMING, type: 'image', mediaId: 'media-img', mimeType: 'image/jpeg', caption: null },
      { tenantId: 'tenant-1', lead: BASE_LEAD, waConfig: WA_CONFIG },
    );

    expect(caseFileStore.updateCaseStatus).toHaveBeenCalledWith('tenant-1', 'case-1', 'awaiting_doctor', null);
  });

  test('already awaiting_doctor → does not call updateCaseStatus again', async () => {
    whatsapp.downloadMedia.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'image/jpeg' });
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'hair_transplant', patient_language: 'en', status: 'awaiting_doctor' });
    ai.loadBranchTemplate.mockResolvedValue(HAIR_BRANCH_TEMPLATE);
    visionExtraction.extractFromImage.mockResolvedValue({ imageQuality: 'good', matchedSlot: 'tepe' });
    visionExtraction.isQualityInsufficient.mockReturnValue(false);
    caseFileStore.listMedia.mockResolvedValue([
      { template_slot_id: 'on_gorunum', quality_ok: true },
      { template_slot_id: 'tepe', quality_ok: true },
    ]);

    await handleIncomingVisualMedia(
      { ...BASE_INCOMING, type: 'image', mediaId: 'media-img', mimeType: 'image/jpeg', caption: null },
      { tenantId: 'tenant-1', lead: BASE_LEAD, waConfig: WA_CONFIG },
    );

    expect(caseFileStore.updateCaseStatus).not.toHaveBeenCalled();
  });

  test('branch template with no requiredMedia (e.g. IVF) treats completion as immediate', async () => {
    whatsapp.downloadMedia.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'application/pdf' });
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-2', branch_key: 'ivf', patient_language: 'en', status: 'new' });
    ai.loadBranchTemplate.mockResolvedValue({ key: 'ivf', requiredMedia: [] });
    visionExtraction.extractFromImage.mockResolvedValue({ documentType: 'passport', extractedText: '', relevance: 'ok' });
    visionExtraction.isQualityInsufficient.mockReturnValue(false);

    await handleIncomingVisualMedia(
      { ...BASE_INCOMING, type: 'document', mediaId: 'media-doc', mimeType: 'application/pdf', filename: 'passport.pdf', caption: null },
      { tenantId: 'tenant-1', lead: BASE_LEAD, waConfig: WA_CONFIG },
    );

    expect(caseFileStore.listMedia).not.toHaveBeenCalled(); // nothing to check — 0 required slots
    expect(caseFileStore.updateCaseStatus).toHaveBeenCalledWith('tenant-1', 'case-2', 'awaiting_doctor', null);
  });
});

describe('handleIncomingVisualMedia — resilience (Bölüm C.3)', () => {
  test('media download failure never throws, logs a case_event when a case exists', async () => {
    whatsapp.downloadMedia.mockRejectedValue(new Error('Meta media fetch failed'));
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'dental' });

    await expect(
      handleIncomingVisualMedia(
        { ...BASE_INCOMING, type: 'image', mediaId: 'media-img', mimeType: 'image/jpeg', caption: null },
        { tenantId: 'tenant-1', lead: BASE_LEAD, waConfig: WA_CONFIG },
      ),
    ).resolves.toBeUndefined();

    expect(caseFileStore.appendCaseEvent).toHaveBeenCalledWith(
      'tenant-1', 'case-1', 'media_error', null, expect.objectContaining({ type: 'image' }),
    );
  });

  test('a failed Supabase Storage upload does not block extraction or the reply (best-effort)', async () => {
    whatsapp.downloadMedia.mockResolvedValue({ buffer: Buffer.from('x'), mimeType: 'image/jpeg' });
    supabaseStorage.uploadFile.mockRejectedValueOnce(new Error('bucket not configured'));
    ai.loadCaseForLead.mockResolvedValue({ id: 'case-1', branch_key: 'hair_transplant', patient_language: 'en', status: 'new' });
    ai.loadBranchTemplate.mockResolvedValue(HAIR_BRANCH_TEMPLATE);
    visionExtraction.extractFromImage.mockResolvedValue({ imageQuality: 'good', matchedSlot: 'on_gorunum' });
    visionExtraction.isQualityInsufficient.mockReturnValue(false);
    caseFileStore.listMedia.mockResolvedValue([{ template_slot_id: 'on_gorunum', quality_ok: true }]);

    await handleIncomingVisualMedia(
      { ...BASE_INCOMING, type: 'image', mediaId: 'media-img', mimeType: 'image/jpeg', caption: null },
      { tenantId: 'tenant-1', lead: BASE_LEAD, waConfig: WA_CONFIG },
    );

    expect(caseFileStore.addMedia).toHaveBeenCalledWith(
      'tenant-1', 'case-1', expect.objectContaining({ storagePath: null }), null,
    );
    expect(whatsapp.sendText).toHaveBeenCalledTimes(1); // still acknowledged
  });
});
