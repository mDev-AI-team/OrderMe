import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantContext } from '@restaurant-saas/shared';

interface RequestContext {
  readonly tenant: TenantContext | null;
  readonly requestId: string;
}

export const asyncContext = new AsyncLocalStorage<RequestContext>();

export function getTenantContext(): TenantContext {
  const store = asyncContext.getStore();
  if (!store?.tenant) {
    throw new Error('Tenant context not set — are you inside a tenant-scoped request?');
  }
  return store.tenant;
}

export function getRequestId(): string {
  const store = asyncContext.getStore();
  return store?.requestId ?? 'no-request-id';
}
