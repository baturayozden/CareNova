'use strict';

// GECE-4-BRIEFI.md Bölüm C.1/C.2 — parseIncomingMessage's audio/image/document
// extraction, and the two-step Meta Media API fetch (getMediaUrl → download).
// axios is mocked throughout — MUTLAK YASAK #5, no real network call.

jest.mock('axios');
const axios = require('axios');
const { parseIncomingMessage, parseStatusUpdate, getMediaUrl, downloadMedia } = require('../whatsapp');

function webhookBody(message, contact = { profile: { name: 'Ahmed Ali' } }) {
  return {
    entry: [{
      changes: [{
        value: {
          metadata: { phone_number_id: '1234567890' },
          contacts: [contact],
          messages: [message],
        },
      }],
    }],
  };
}

describe('parseIncomingMessage — text (unchanged baseline)', () => {
  test('parses a plain text message', () => {
    const body = webhookBody({
      from: '905551234567', id: 'wamid.TEXT1', timestamp: '1700000000',
      type: 'text', text: { body: 'Merhaba' },
    });
    const result = parseIncomingMessage(body);
    expect(result.type).toBe('text');
    expect(result.text).toBe('Merhaba');
    expect(result.mediaId).toBeNull();
    expect(result.isVoiceNote).toBe(false);
  });
});

describe('parseIncomingMessage — audio / voice notes', () => {
  test('voice note sets mediaId, mimeType, isVoiceNote=true, text=null', () => {
    const body = webhookBody({
      from: '905551234567', id: 'wamid.AUDIO1', timestamp: '1700000000',
      type: 'audio', audio: { id: 'media-abc', mime_type: 'audio/ogg; codecs=opus', voice: true },
    });
    const result = parseIncomingMessage(body);
    expect(result.type).toBe('audio');
    expect(result.text).toBeNull();
    expect(result.mediaId).toBe('media-abc');
    expect(result.mimeType).toBe('audio/ogg; codecs=opus');
    expect(result.isVoiceNote).toBe(true);
  });

  test('a shared audio file (not a voice note) has isVoiceNote=false', () => {
    const body = webhookBody({
      from: '905551234567', id: 'wamid.AUDIO2', timestamp: '1700000000',
      type: 'audio', audio: { id: 'media-def', mime_type: 'audio/mpeg' },
    });
    const result = parseIncomingMessage(body);
    expect(result.isVoiceNote).toBe(false);
  });
});

describe('parseIncomingMessage — image', () => {
  test('sets mediaId/mimeType and preserves an optional caption', () => {
    const body = webhookBody({
      from: '905551234567', id: 'wamid.IMG1', timestamp: '1700000000',
      type: 'image', image: { id: 'media-img', mime_type: 'image/jpeg', caption: 'ön görünüm' },
    });
    const result = parseIncomingMessage(body);
    expect(result.type).toBe('image');
    expect(result.mediaId).toBe('media-img');
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.caption).toBe('ön görünüm');
    expect(result.filename).toBeNull();
  });

  test('caption is null when absent', () => {
    const body = webhookBody({
      from: '905551234567', id: 'wamid.IMG2', timestamp: '1700000000',
      type: 'image', image: { id: 'media-img2', mime_type: 'image/jpeg' },
    });
    expect(parseIncomingMessage(body).caption).toBeNull();
  });
});

describe('parseIncomingMessage — document', () => {
  test('sets mediaId/mimeType/filename', () => {
    const body = webhookBody({
      from: '905551234567', id: 'wamid.DOC1', timestamp: '1700000000',
      type: 'document', document: { id: 'media-doc', mime_type: 'application/pdf', filename: 'panoramik.pdf' },
    });
    const result = parseIncomingMessage(body);
    expect(result.type).toBe('document');
    expect(result.mediaId).toBe('media-doc');
    expect(result.filename).toBe('panoramik.pdf');
  });
});

describe('parseIncomingMessage — unsupported type still parses without throwing', () => {
  test('sticker/location/etc. return a normalised object with null media fields', () => {
    const body = webhookBody({
      from: '905551234567', id: 'wamid.LOC1', timestamp: '1700000000',
      type: 'location', location: { latitude: 41.0, longitude: 28.9 },
    });
    const result = parseIncomingMessage(body);
    expect(result.type).toBe('location');
    expect(result.mediaId).toBeNull();
    expect(result.text).toBeNull();
  });
});

describe('getMediaUrl / downloadMedia — Meta two-step fetch, fully mocked', () => {
  afterEach(() => jest.clearAllMocks());

  test('getMediaUrl calls GET /{media-id} (not under the phone-number path) with a Bearer token', async () => {
    axios.get.mockResolvedValueOnce({
      data: { url: 'https://lookaside.fbsbx.com/whatsapp_business/attachments/signed', mime_type: 'audio/ogg', sha256: 'abc', file_size: 1234, id: 'media-abc' },
    });

    const result = await getMediaUrl('media-abc', { accessToken: 'test-token' });

    expect(axios.get).toHaveBeenCalledTimes(1);
    const [url, config] = axios.get.mock.calls[0];
    expect(url).toContain('/media-abc');
    expect(url).not.toContain('/media-abc/messages');
    expect(config.headers.Authorization).toBe('Bearer test-token');
    expect(result.url).toBe('https://lookaside.fbsbx.com/whatsapp_business/attachments/signed');
  });

  test('downloadMedia fetches metadata then the signed url, returning a Buffer', async () => {
    axios.get
      .mockResolvedValueOnce({ data: { url: 'https://signed.example/blob', mime_type: 'image/jpeg', file_size: 999 } })
      .mockResolvedValueOnce({ data: Buffer.from('fake-jpeg-bytes') });

    const result = await downloadMedia('media-img', { accessToken: 'test-token' });

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(axios.get.mock.calls[1][0]).toBe('https://signed.example/blob');
    expect(axios.get.mock.calls[1][1].responseType).toBe('arraybuffer');
    expect(Buffer.isBuffer(result.buffer)).toBe(true);
    expect(result.mimeType).toBe('image/jpeg');
    expect(result.fileSize).toBe(999);
  });

  test('downloadMedia propagates a failure from the metadata fetch (webhook catches this upstream)', async () => {
    axios.get.mockRejectedValueOnce(new Error('Meta API 404'));
    await expect(downloadMedia('missing-media', { accessToken: 'test-token' })).rejects.toThrow('Meta API 404');
  });
});

describe('parseStatusUpdate — unaffected by the media changes (regression check)', () => {
  test('still parses a delivery status update', () => {
    const body = {
      entry: [{ changes: [{ value: { statuses: [{ id: 'wamid.S1', status: 'delivered', timestamp: '1700000000', recipient_id: '905551234567' }] } }] }],
    };
    const result = parseStatusUpdate(body);
    expect(result.status).toBe('delivered');
  });
});
