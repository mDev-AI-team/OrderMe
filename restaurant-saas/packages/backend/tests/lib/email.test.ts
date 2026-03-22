const mockSend = jest.fn().mockResolvedValue({ id: 'email-id-123' });
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}));

import { createEmailService } from '../../src/lib/email';

describe('createEmailService — RESEND_API_KEY not configured', () => {
  beforeEach(() => mockSend.mockClear());

  it('sendVerificationEmail resolves without calling Resend', async () => {
    const svc = createEmailService({ resendApiKey: undefined });
    await expect(svc.sendVerificationEmail('u@test.com', 'tok-1')).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sendPasswordResetEmail resolves without calling Resend', async () => {
    const svc = createEmailService({ resendApiKey: undefined });
    await expect(svc.sendPasswordResetEmail('u@test.com', 'tok-2')).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it('sendStaffInviteEmail resolves without calling Resend', async () => {
    const svc = createEmailService({ resendApiKey: undefined });
    await expect(
      svc.sendStaffInviteEmail('staff@test.com', 'Alice', 'The Bistro', 'https://app.test/invite/xyz')
    ).resolves.toBeUndefined();
    expect(mockSend).not.toHaveBeenCalled();
  });
});

describe('createEmailService — RESEND_API_KEY configured', () => {
  const API_KEY = 're_test_abc123';

  beforeEach(() => mockSend.mockClear());

  it('sendVerificationEmail sends to the correct recipient and includes the token', async () => {
    const svc = createEmailService({ resendApiKey: API_KEY });
    await svc.sendVerificationEmail('user@example.com', 'verify-token-abc');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const payload = mockSend.mock.calls[0][0];
    expect(payload.to).toBe('user@example.com');
    expect(payload.subject).toMatch(/verif/i);
    expect(payload.html).toContain('verify-token-abc');
  });

  it('sendPasswordResetEmail sends to the correct recipient and includes the token', async () => {
    const svc = createEmailService({ resendApiKey: API_KEY });
    await svc.sendPasswordResetEmail('user@example.com', 'reset-token-xyz');

    expect(mockSend).toHaveBeenCalledTimes(1);
    const payload = mockSend.mock.calls[0][0];
    expect(payload.to).toBe('user@example.com');
    expect(payload.subject).toMatch(/password/i);
    expect(payload.html).toContain('reset-token-xyz');
  });

  it('sendStaffInviteEmail sends to the correct recipient with restaurant name and invite link', async () => {
    const svc = createEmailService({ resendApiKey: API_KEY });
    await svc.sendStaffInviteEmail(
      'staff@example.com',
      'Alice',
      'The Bistro',
      'https://app.example.com/invite/abc'
    );

    expect(mockSend).toHaveBeenCalledTimes(1);
    const payload = mockSend.mock.calls[0][0];
    expect(payload.to).toBe('staff@example.com');
    expect(payload.subject).toMatch(/invite/i);
    expect(payload.html).toContain('The Bistro');
    expect(payload.html).toContain('https://app.example.com/invite/abc');
  });

  it('sendVerificationEmail propagates Resend errors', async () => {
    mockSend.mockRejectedValueOnce(new Error('Resend API error'));
    const svc = createEmailService({ resendApiKey: API_KEY });
    await expect(svc.sendVerificationEmail('u@test.com', 'tok')).rejects.toThrow('Resend API error');
  });
});
