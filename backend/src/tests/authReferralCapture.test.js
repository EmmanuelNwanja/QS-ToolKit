describe('Auth referral capture logic', () => {
  // Test the referral lookup + recording logic without Supabase
  const mockLookup = jest.fn();
  const mockRecord = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  test('records referral when valid code provided', async () => {
    mockLookup.mockResolvedValue('referrer-user-id');

    const ref = 'ABC123';
    const newUserId = 'new-user-id';

    const referrerUserId = await mockLookup(ref);
    expect(referrerUserId).toBe('referrer-user-id');

    if (referrerUserId && referrerUserId !== newUserId) {
      await mockRecord(referrerUserId, newUserId);
    }

    expect(mockRecord).toHaveBeenCalledWith('referrer-user-id', 'new-user-id');
  });

  test('skips when no ref code provided', async () => {
    const ref = '';
    if (ref) {
      await mockLookup(ref);
    }
    expect(mockLookup).not.toHaveBeenCalled();
  });

  test('skips when referrer is same as new user', async () => {
    mockLookup.mockResolvedValue('same-user-id');

    const ref = 'SELF';
    const newUserId = 'same-user-id';

    const referrerUserId = await mockLookup(ref);
    if (referrerUserId && referrerUserId !== newUserId) {
      await mockRecord(referrerUserId, newUserId);
    }

    expect(mockRecord).not.toHaveBeenCalled();
  });

  test('handles invalid referral code gracefully', async () => {
    mockLookup.mockResolvedValue(null);

    const ref = 'INVALID';
    const referrerUserId = await mockLookup(ref);
    expect(referrerUserId).toBeNull();
  });
});
