import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export type QuoteStatus =
  | 'DRAFT' | 'SENT' | 'AWAITING_APPROVAL' | 'APPROVED'
  | 'REJECTED' | 'CONVERTED' | 'EXPIRED'

export type PaymentMethod = 'CASH' | 'SINPE' | 'BANK_TRANSFER' | 'OTHER'

export const QUOTE_STATUS_LABELS: Record<QuoteStatus, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  AWAITING_APPROVAL: 'Esperando aprobación',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CONVERTED: 'Pagada',
  EXPIRED: 'Expirada',
}

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  SENT: 'bg-blue-100 text-blue-700',
  AWAITING_APPROVAL: 'bg-orange-100 text-orange-700',
  APPROVED: 'bg-teal-100 text-teal-700',
  REJECTED: 'bg-red-100 text-red-700',
  CONVERTED: 'bg-green-100 text-green-700',
  EXPIRED: 'bg-gray-200 text-gray-500',
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Efectivo',
  SINPE: 'SINPE Móvil',
  BANK_TRANSFER: 'Transferencia',
  OTHER: 'Otro',
}

export interface QuoteItem {
  id: string
  description: string
  itemType: 'part' | 'labor' | 'service' | 'other'
  quantity: number
  unitPrice: number
  subtotal: number
  notes?: string | null
  position: number
}

export interface Payment {
  id: string
  amount: number
  method: PaymentMethod
  reference?: string | null
  notes?: string | null
  paidAt: string
  isVoided: boolean
  voidedAt?: string | null
  voidReason?: string | null
}

export interface Quote {
  id: string
  number: string
  workOrderId?: string | null
  customerId?: string | null
  status: QuoteStatus
  total: number
  validUntil?: string | null
  notes?: string | null
  terms?: string | null
  approvedAt?: string | null
  approvedBy?: string | null
  rejectedAt?: string | null
  rejectedReason?: string | null
  createdAt: string
  updatedAt: string
  customer?: { id: string; name: string; phone: string; email?: string | null } | null
  workOrder?: { id: string; number: string } | null
  items: QuoteItem[]
  payments: Payment[]
  versions?: { id: string; version: number; createdAt: string }[]
}

export interface QuoteSummary {
  id: string
  number: string
  status: QuoteStatus
  total: number
  createdAt: string
  customer?: { id: string; name: string; phone: string } | null
  workOrder?: { id: string; number: string } | null
  _count?: { items: number; payments: number }
}

export interface PaymentSummary {
  total: number
  paid: string
  balance: string
  isPaidInFull: boolean
}

export interface ListMeta { total: number; page: number; limit: number; pages: number }

interface ListParams {
  q?: string; customerId?: string; workOrderId?: string
  status?: string; page?: number; limit?: number
}

// ---- Hooks ----

export function useQuotes(params: ListParams = {}) {
  return useQuery<{ data: QuoteSummary[]; meta: ListMeta }>({
    queryKey: ['quotes', params],
    queryFn: async () => (await api.get('/quotes', { params })).data,
  })
}

export function useQuote(id: string) {
  return useQuery<Quote>({
    queryKey: ['quotes', id],
    queryFn: async () => (await api.get(`/quotes/${id}`)).data,
    enabled: !!id,
  })
}

export function useQuotePayments(id: string) {
  return useQuery<{ data: Payment[]; summary: PaymentSummary }>({
    queryKey: ['quotes', id, 'payments'],
    queryFn: async () => (await api.get(`/quotes/${id}/payments`)).data,
    enabled: !!id,
  })
}

export function useQuotePdfData(id: string, enabled = false) {
  return useQuery({
    queryKey: ['quotes', id, 'pdf-data'],
    queryFn: async () => (await api.get(`/quotes/${id}/pdf-data`)).data,
    enabled,
  })
}

export function useCreateQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      workOrderId?: string; customerId?: string
      notes?: string; terms?: string; validUntil?: string
      items: { description: string; itemType: string; quantity: number; unitPrice: number; notes?: string; position?: number }[]
    }) => (await api.post('/quotes', data)).data as Quote,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  })
}

export function useUpdateQuote(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      notes?: string; terms?: string; validUntil?: string
      items?: { description: string; itemType: string; quantity: number; unitPrice: number; notes?: string; position?: number }[]
    }) => (await api.patch(`/quotes/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quotes'] }),
  })
}

export function useSendQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/quotes/${id}/send`)).data,
    onSuccess: (_d, id) => qc.invalidateQueries({ queryKey: ['quotes', id] }),
  })
}

export function useApproveQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, approvedBy, notes }: { id: string; approvedBy: string; notes?: string }) =>
      (await api.post(`/quotes/${id}/approve`, { approvedBy, notes })).data,
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['quotes', v.id] }),
  })
}

export function useRejectQuote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      (await api.post(`/quotes/${id}/reject`, { reason })).data,
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['quotes', v.id] }),
  })
}

export function useAddPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ quoteId, ...data }: {
      quoteId: string; amount: number; method: PaymentMethod
      reference?: string; notes?: string; paidAt?: string
    }) => (await api.post(`/quotes/${quoteId}/payments`, data)).data,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['quotes', v.quoteId] })
      qc.invalidateQueries({ queryKey: ['quotes', v.quoteId, 'payments'] })
    },
  })
}

export function useVoidPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ quoteId, paymentId, reason }: { quoteId: string; paymentId: string; reason: string }) =>
      (await api.post(`/quotes/${quoteId}/payments/${paymentId}/void`, { reason })).data,
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ['quotes', v.quoteId] })
      qc.invalidateQueries({ queryKey: ['quotes', v.quoteId, 'payments'] })
    },
  })
}
