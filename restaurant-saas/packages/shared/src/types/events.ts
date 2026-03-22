export const EventName = {
  ORDER_PLACED: 'order.placed',
  ORDER_STATUS_CHANGED: 'order.status.changed',
  ORDER_ITEM_STATUS_CHANGED: 'order.item.status.changed',
  ORDER_CANCELLED: 'order.cancelled',
  PAYMENT_COMPLETED: 'payment.completed',
  PAYMENT_FAILED: 'payment.failed',
  PAYMENT_REFUNDED: 'payment.refunded',
  TENANT_CREATED: 'tenant.created',
  TENANT_SUSPENDED: 'tenant.suspended',
  TABLE_SESSION_OPENED: 'table.session.opened',
  TABLE_SESSION_CLOSED: 'table.session.closed',
  MENU_ITEM_AVAILABILITY_CHANGED: 'menu.item.availability.changed',
  SUBSCRIPTION_CHANGED: 'subscription.changed',
  STAFF_INVITED: 'staff.invited',
  STAFF_REMOVED: 'staff.removed',
} as const;

export type EventNameValue = typeof EventName[keyof typeof EventName];

export interface BaseEventPayload {
  readonly tenant_id: string;
  readonly version: number;
  readonly causation_id: string;
  readonly timestamp: string;
}

export interface OrderPlacedPayload extends BaseEventPayload {
  readonly order_id: string;
  readonly session_id: string;
  readonly customer_token: string;
  readonly item_count: number;
}

export interface PaymentCompletedPayload extends BaseEventPayload {
  readonly payment_id: string;
  readonly session_id: string;
  readonly amount: string;
  readonly method: 'card' | 'cash';
}
