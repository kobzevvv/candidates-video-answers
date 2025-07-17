const handler = require('..');
const httpMocks = require('node-mocks-http');

beforeEach(() => {
  jest.resetAllMocks();
});

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

  test('uses manual values when provided and valid', async () => {
    process.env.HIREFLIX_API_KEY = 'test-key';

    global.fetch = jest.fn().mockResolvedValue({
      json: () => Promise.resolve({ data: { inviteCandidateToInterview: { __typename: 'InterviewType', url: { public: 'https://example.com' } } } })
    });

    const req = httpMocks.createRequest({
      method: 'GET',
      query: {
        email: 'bad',
        firstName: 'Xxxxx',
        email_manual: 'good@example.com',
        first_name_manual: 'Vova',
        positionId: 'pos1'
      }
    });
    const res = httpMocks.createResponse({ eventEmitter: require('events').EventEmitter });

    await handler.videoInterviewInvite(req, res);

    expect(fetch).toHaveBeenCalledTimes(1);
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.query).toMatch(/email: "good@example.com"/);
    expect(body.query).toMatch(/firstName: "Vova"/);
    expect(res._getStatusCode()).toBe(200);
    expect(res._getData()).toContain('Start video interview here');
  });
});
