import type { OrderDetailOrder } from "@/components/order-detail-dialog"

/**
 * Build the OrderDetailOrder shape expected by OrderDetailDialog from a
 * Prisma Order object that was fetched with the proper includes.
 *
 * Required `include` shape on the Prisma query:
 *   include: {
 *     customer: { select: { name, phone, email, address } },
 *     event:    { select: { eventNumber, name, eventDate } },
 *     lineItems: { select: { id, productSku, productName, productSize, qty, unitPrice } },
 *     executionLogs: {
 *       select: {
 *         id, executionNumber, status, executedAt, actualCost,
 *         lines: { select: { materialName, qtyUsed, unit, lineCost, type } }
 *       }
 *     }
 *   }
 *
 * Top-level Order fields (no select) are returned automatically by `include`.
 */
export function serializeOrderForDetail<T extends {
  id: string
  orderNumber: string
  status: string
  customer: { name: string | null; phone: string | null; email: string | null; address: string | null } | null
  event: { eventNumber: string; name: string; eventDate: Date | null } | null
  lineItems: Array<{
    id: string
    productSku: string
    productName: string
    productSize: string | null
    qty: number
    unitPrice: number
  }>
  executionLogs: Array<{
    id: string
    executionNumber: string
    status: string
    executedAt: Date
    actualCost: number | null
    lines: Array<{
      materialName: string
      qtyUsed: number
      unit: string
      lineCost: number
      type: string
    }>
  }>
  deliveryDate: Date | null
  deliveryAddress: string | null
  cardMessage: string | null
  deliveryNotes: string | null
  internalNotes: string | null
  deliveryFee: number
  discount: number
  paymentStatus: string
  paymentMethod: string | null
  paymentAmount: number | null
  paymentReference: string | null
  paymentConfirmedAt: Date | null
  procurementStartedAt: Date | null
  producedAt: Date | null
  deliveredAt: Date | null
  fulfilledAt: Date | null
}>(o: T): OrderDetailOrder {
  return {
    id: o.id,
    orderNumber: o.orderNumber,
    status: o.status,
    customer: o.customer
      ? {
          name: o.customer.name,
          phone: o.customer.phone,
          email: o.customer.email,
          address: o.customer.address,
        }
      : null,
    event: o.event
      ? {
          eventNumber: o.event.eventNumber,
          name: o.event.name,
          eventDate: o.event.eventDate,
        }
      : null,
    deliveryDate: o.deliveryDate,
    deliveryAddress: o.deliveryAddress,
    cardMessage: o.cardMessage,
    deliveryNotes: o.deliveryNotes,
    internalNotes: o.internalNotes,
    deliveryFee: o.deliveryFee,
    discount: o.discount,
    paymentStatus: o.paymentStatus,
    paymentMethod: o.paymentMethod,
    paymentAmount: o.paymentAmount,
    paymentReference: o.paymentReference,
    paymentConfirmedAt: o.paymentConfirmedAt,
    procurementStartedAt: o.procurementStartedAt,
    producedAt: o.producedAt,
    deliveredAt: o.deliveredAt,
    fulfilledAt: o.fulfilledAt,
    lineItems: o.lineItems,
    executionLogs: o.executionLogs,
  }
}
