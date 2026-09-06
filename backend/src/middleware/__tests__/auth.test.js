'use strict';

// GECE-3-BRIEFI.md Bölüm F (BLOKAJLAR B5): impersonation is a support
// tool, not an intervention tool — writes must be blocked while an
// admin is impersonating a clinic. No DB/Express server needed to test
// this: blockWritesDuringImpersonation is a plain (req, res, next)
// middleware, exercised here with minimal mock objects.

const { blockWritesDuringImpersonation } = require('../auth');

function mockReqRes(method, headers = {}) {
  const req = { method, headers };
  const res = {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
  return { req, res };
}

describe('blockWritesDuringImpersonation', () => {
  test('blocks POST while impersonating', () => {
    const { req, res } = mockReqRes('POST', { 'x-impersonation-session': '1' });
    const next = jest.fn();
    blockWritesDuringImpersonation(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  test.each(['PUT', 'PATCH', 'DELETE', 'POST'])('blocks %s while impersonating', (method) => {
    const { req, res } = mockReqRes(method, { 'x-impersonation-session': '1' });
    const next = jest.fn();
    blockWritesDuringImpersonation(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  test('allows GET while impersonating', () => {
    const { req, res } = mockReqRes('GET', { 'x-impersonation-session': '1' });
    const next = jest.fn();
    blockWritesDuringImpersonation(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
  });

  test('allows POST when NOT impersonating (no header at all)', () => {
    const { req, res } = mockReqRes('POST', {});
    const next = jest.fn();
    blockWritesDuringImpersonation(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBeNull();
  });

  test('a falsy header value does not count as impersonating', () => {
    const { req, res } = mockReqRes('DELETE', { 'x-impersonation-session': '' });
    const next = jest.fn();
    blockWritesDuringImpersonation(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
