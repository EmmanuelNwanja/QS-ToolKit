const ctrl = require('../../src/controllers/referralController');
const supabase = require('../../src/config/supabase');

// Minimal mock chain helper
const mockQuery = (result) => {
  const chain = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue(result),
    order: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    insert: jest.fn().mockResolvedValue(result),
    update: jest.fn().mockReturnThis(),
  };
  return chain;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('referralController.lookupReferralCode', () => {
  test('returns user_id for valid code', async () => {
    supabase.from = jest.fn(() => mockQuery({ data: { user_id: 'user-123' }, error: null }));
    const result = await ctrl.lookupReferralCode('ABC123');
    expect(result).toBe('user-123');
    expect(supabase.from).toHaveBeenCalledWith('referral_links');
  });

  test('returns null for invalid code', async () => {
    supabase.from = jest.fn(() => mockQuery({ data: null, error: { code: 'PGRST116' } }));
    const result = await ctrl.lookupReferralCode('INVALID');
    expect(result).toBeNull();
  });
});

describe('referralController.getReferralDiscount', () => {
  test('returns discount for active referrer', async () => {
    supabase.from = jest.fn(() => mockQuery({ data: { id: 'disc-1', discount_percent: 15 }, error: null }));
    const result = await ctrl.getReferralDiscount('user-456');
    expect(result).toEqual({ id: 'disc-1', discount_percent: 15 });
  });

  test('returns null when no active discount', async () => {
    supabase.from = jest.fn(() => mockQuery({ data: null, error: { code: 'PGRST116' } }));
    const result = await ctrl.getReferralDiscount('user-no-discount');
    expect(result).toBeNull();
  });
});

describe('referralController.getMyLink', () => {
  test('returns referral link with code', async () => {
    const chain = mockQuery({ data: { code: 'ABC123', created_at: '2026-01-01' }, error: null });
    supabase.from = jest.fn(() => chain);

    const req = { user: { id: 'user-1' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await ctrl.getMyLink(req, res, next);

    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          code: 'ABC123',
          link: expect.stringContaining('ref=ABC123')
        })
      })
    );
  });

  test('returns 404 when no link found', async () => {
    const chain = mockQuery({ data: null, error: { code: 'PGRST116' } });
    supabase.from = jest.fn(() => chain);

    const req = { user: { id: 'user-no-link' } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();

    await ctrl.getMyLink(req, res, next);

    expect(res.status).toHaveBeenCalledWith(404);
  });
});
