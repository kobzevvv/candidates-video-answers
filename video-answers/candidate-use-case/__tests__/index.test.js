const handler = require('..');
const httpMocks = require('node-mocks-http');

describe('videoInterviewInvite', () => {
  test('redirects to typeform when email invalid', async () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      query: { email: 'bad', firstName: 'John', positionId: 'pos1' }
    });
    const res = httpMocks.createResponse({ eventEmitter: require('events').EventEmitter });
    await handler.videoInterviewInvite(req, res);
    expect(res._getStatusCode()).toBe(302);
    expect(res._getRedirectUrl()).toMatch(/form\.typeform\.com/);
  });

  test('redirects to typeform when firstName is underscores', async () => {
    const req = httpMocks.createRequest({
      method: 'GET',
      query: { email: 'jane@example.com', firstName: '___', positionId: 'pos1' }
    });
    const res = httpMocks.createResponse({ eventEmitter: require('events').EventEmitter });
    await handler.videoInterviewInvite(req, res);
    expect(res._getStatusCode()).toBe(302);
    expect(res._getRedirectUrl()).toMatch(/form\.typeform\.com/);
  });
});
