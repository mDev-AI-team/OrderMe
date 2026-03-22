export const QUEUES = {
  EVENTS: 'events',
  TENANT_PROVISIONING: 'tenant-provisioning',
  EMAIL: 'email',
  QR_GENERATION: 'qr-generation',
  IMAGE_PROCESSING: 'image-processing',
  ANALYTICS: 'analytics',
  PAYMENT_WEBHOOKS: 'payment-webhooks',
  BILLING: 'billing',
} as const;

export const MAX_CAUSATION_DEPTH = 5;
