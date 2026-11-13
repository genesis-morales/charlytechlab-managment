import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export type ImportShipmentStatus =
  | 'PENDING' | 'PURCHASED' | 'RECEIVED_IN_MAILBOX' | 'IN_TRANSIT'
  | 'IN_CUSTOMS' | 'RECEIVED_IN_CR' | 'DELIVERED'

export const SHIPMENT_STATUS_LABELS: Record<ImportShipmentStatus, string> = {
  PENDING: 'Pendiente',
  PURCHASED: 'Comprado',
  RECEIVED_IN_MAILBOX: 'En casillero (US)',
  IN_TRANSIT: 'En tránsito',
  IN_CUSTOMS: 'En aduana',
  RECEIVED_IN_CR: 'Recibido en CR',
  DELIVERED: 'Entregado',
}

export const SHIPMENT_STATUS_COLORS: Record<ImportShipmentStatus, string> = {
  PENDING: 'bg-gray-100 text-gray-700',
  PURCHASED: 'bg-blue-100 text-blue-700',
  RECEIVED_IN_MAILBOX: 'bg-teal-100 text-teal-700',
  IN_TRANSIT: 'bg-orange-100 text-orange-700',
  IN_CUSTOMS: 'bg-purple-100 text-purple-700',
  RECEIVED_IN_CR: 'bg-green-100 text-green-700',
  DELIVERED: 'bg-gray-200 text-gray-600',
}

export const SHIPMENT_TRANSITIONS: Record<ImportShipmentStatus, ImportShipmentStatus[]> = {
  PENDING: ['PURCHASED'],
  PURCHASED: ['RECEIVED_IN_MAILBOX', 'IN_TRANSIT'],
  RECEIVED_IN_MAILBOX: ['IN_TRANSIT'],
  IN_TRANSIT: ['IN_CUSTOMS', 'RECEIVED_IN_CR'],
  IN_CUSTOMS: ['RECEIVED_IN_CR'],
  RECEIVED_IN_CR: ['DELIVERED'],
  DELIVERED: [],
}

export interface ImportShipmentItem {
  id: string
  shipmentId: string
  description: string
  quantity: number
  pricePaidCRC: string
  allocatedCostCRC?: string | null
  purchaseItems?: {
    id: string
    purchase: { id: string; purchasedAt: string }
    inventoryItem: { id: string; name: string } | null
  }[]
}

export interface ImportShipment {
  id: string
  trackingNumber?: string | null
  origin?: string | null
  status: ImportShipmentStatus
  weightLbs?: string | null
  shippingCRC?: string | null
  customsCRC?: string | null
  handlingCRC?: string | null
  totalCostCRC?: string | null
  purchasedAt?: string | null
  estimatedArrival?: string | null
  arrivedAt?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
  items: ImportShipmentItem[]
  statusHistory: {
    id: string
    fromStatus: ImportShipmentStatus | null
    toStatus: ImportShipmentStatus
    notes?: string | null
    createdAt: string
  }[]
  _count?: { items: number }
}

export interface ImportSummary {
  activeShipments: (ImportShipment & { _count: { items: number } })[]
  totalInTransit: number
  totalItemsPending: number
  pendingCosts: { shipping: string; customs: string; handling: string }
}

export interface ListMeta { total: number; page: number; limit: number; pages: number }

interface ListParams { status?: string; q?: string; page?: number; limit?: number }

export function useShipments(params: ListParams = {}) {
  return useQuery<{ data: ImportShipment[]; meta: ListMeta }>({
    queryKey: ['imports', params],
    queryFn: async () => (await api.get('/imports', { params })).data,
  })
}

export function useShipment(id: string) {
  return useQuery<ImportShipment>({
    queryKey: ['imports', id],
    queryFn: async () => (await api.get(`/imports/${id}`)).data,
    enabled: !!id,
  })
}

export function useImportSummary() {
  return useQuery<ImportSummary>({
    queryKey: ['imports', 'summary'],
    queryFn: async () => (await api.get('/imports/summary')).data,
  })
}

export function useCreateShipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      trackingNumber?: string; origin?: string; notes?: string
      purchasedAt?: string; estimatedArrival?: string
    }) => (await api.post('/imports', data)).data as ImportShipment,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['imports'] }),
  })
}

export function useUpdateShipment(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      trackingNumber?: string; origin?: string; notes?: string
      weightLbs?: number; shippingCRC?: number; customsCRC?: number
      handlingCRC?: number; estimatedArrival?: string
    }) => (await api.patch(`/imports/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['imports'] })
      qc.invalidateQueries({ queryKey: ['imports', id] })
    },
  })
}

export function useTransitionShipment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, toStatus, notes }: {
      id: string; toStatus: ImportShipmentStatus; notes?: string
    }) => (await api.post(`/imports/${id}/transition`, { toStatus, notes })).data,
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['imports', v.id] }),
  })
}

export function useAddShipmentItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ shipmentId, ...data }: {
      shipmentId: string; description: string; quantity: number; pricePaidCRC: number
    }) => (await api.post(`/imports/${shipmentId}/items`, data)).data,
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['imports', v.shipmentId] }),
  })
}

export function useUpdateShipmentItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ shipmentId, itemId, ...data }: {
      shipmentId: string; itemId: string
      description?: string; quantity?: number; pricePaidCRC?: number
    }) => (await api.patch(`/imports/${shipmentId}/items/${itemId}`, data)).data,
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['imports', v.shipmentId] }),
  })
}

export function useDeleteShipmentItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ shipmentId, itemId }: { shipmentId: string; itemId: string }) =>
      api.delete(`/imports/${shipmentId}/items/${itemId}`),
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['imports', v.shipmentId] }),
  })
}

export function useRecalculateCosts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/imports/${id}/recalculate`)).data,
    onSuccess: (_d, id) => qc.invalidateQueries({ queryKey: ['imports', id] }),
  })
}
