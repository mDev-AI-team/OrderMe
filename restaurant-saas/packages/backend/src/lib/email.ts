import { Resend } from 'resend';
import { createLogger } from './logger';

const logger = createLogger();

export interface EmailService {
  sendVerificationEmail(to: string, token: string): Promise<void>;
  sendPasswordResetEmail(to: string, token: string): Promise<void>;
  sendStaffInviteEmail(
    to: string,
    inviterName: string,
    restaurantName: string,
    inviteLink: string
  ): Promise<void>;
}

interface EmailServiceConfig {
  resendApiKey: string | undefined;
  fromAddress?: string;
}

const NOOP: EmailService = {
  async sendVerificationEmail() {},
  async sendPasswordResetEmail() {},
  async sendStaffInviteEmail() {},
};

export function createEmailService(config: EmailServiceConfig): EmailService {
  const { resendApiKey, fromAddress = 'noreply@restaurant-saas.com' } = config;

  if (!resendApiKey) {
    logger.warn('RESEND_API_KEY not set — email sending is disabled');
    return NOOP;
  }

  const resend = new Resend(resendApiKey);

  return {
    async sendVerificationEmail(to, token) {
      await resend.emails.send({
        from: fromAddress,
        to,
        subject: 'Verify your email address',
        html: `<p>Please verify your email address by using this token: <strong>${token}</strong></p>`,
      });
    },

    async sendPasswordResetEmail(to, token) {
      await resend.emails.send({
        from: fromAddress,
        to,
        subject: 'Reset your password',
        html: `<p>Use this token to reset your password: <strong>${token}</strong></p>`,
      });
    },

    async sendStaffInviteEmail(to, inviterName, restaurantName, inviteLink) {
      await resend.emails.send({
        from: fromAddress,
        to,
        subject: `You've been invited to join ${restaurantName}`,
        html: `<p>${inviterName} has invited you to join <strong>${restaurantName}</strong>. <a href="${inviteLink}">Accept invitation</a></p>`,
      });
    },
  };
}
