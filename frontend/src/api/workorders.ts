import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

// ---- Types ----

export type WorkOrderDeviceStatus =
  | 'RECEIVED' | 'DIAGNOSING' | 'QUOTED' | 'AWAITING_APPROVAL' | 'APPROVED'
  | 'WAITING_PARTS' | 'REPAIRING' | 'QUALITY_CHECK' | 'READY_FOR_DELIVERY'
  | 'DELIVERED' | 'REJECTED_BY_CUSTOMER' | 'CANCELLED' | 'WARRANTY_CLAIM' | 'CLOSED'

export type PartRequestStatus =
  | 'TO_BUY' | 'PURCHASED' | 'RECEIVED_IN_MAILBOX' | 'IN_TRANSIT'
  | 'IN_CUSTOMS' | 'RECEIVED_IN_CR' | 'INSPECTED'

export const STATUS_LABELS: Record<WorkOrderDeviceStatus, string> = {
  RECEIVED: 'Recibido',
  DIAGNOSING: 'En diagnóstico',
  QUOTED: 'Cotizado',
  AWAITING_APPROVAL: 'Esperando aprobación',
  APPROVED: 'Aprobado',
  WAITING_PARTS: 'Esperando repuestos',
  REPAIRING: 'En reparación',
  QUALITY_CHECK: 'Control de calidad',
  READY_FOR_DELIVERY: 'Listo para entrega',
  DELIVERED: 'Entregado',
  REJECTED_BY_CUSTOMER: 'Rechazado por cliente',
  CANCELLED: 'Cancelado',
  WARRANTY_CLAIM: 'Garantía',
  CLOSED: 'Cerrado',
}

export const PART_STATUS_LABELS: Record<PartRequestStatus, string> = {
  TO_BUY: 'Por comprar',
  PURCHASED: 'Comprado',
  RECEIVED_IN_MAILBOX: 'En casillero',
  IN_TRANSIT: 'En tránsito',
  IN_CUSTOMS: 'En aduana',
  RECEIVED_IN_CR: 'Recibido en CR',
  INSPECTED: 'Inspeccionado',
}

export const STATUS_COLORS: Record<WorkOrderDeviceStatus, string> = {
  RECEIVED: 'bg-gray-100 text-gray-700',
  DIAGNOSING: 'bg-blue-100 text-blue-700',
  QUOTED: 'bg-yellow-100 text-yellow-700',
  AWAITING_APPROVAL: 'bg-orange-100 text-orange-700',
  APPROVED: 'bg-teal-100 text-teal-700',
  WAITING_PARTS: 'bg-purple-100 text-purple-700',
  REPAIRING: 'bg-indigo-100 text-indigo-700',
  QUALITY_CHECK: 'bg-cyan-100 text-cyan-700',
  READY_FOR_DELIVERY: 'bg-green-100 text-green-700',
  DELIVERED: 'bg-green-200 text-green-800',
  REJECTED_BY_CUSTOMER: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-red-200 text-red-800',
  WARRANTY_CLAIM: 'bg-pink-100 text-pink-700',
  CLOSED: 'bg-gray-200 text-gray-600',
}

export interface Device {
  id: string
  ownerType: 'OWN' | 'CUSTOMER'
  customerId?: string | null
  deviceType: string
  brand?: string | null
  model?: string | null
  serialNumber?: string | null
  processor?: string | null
  ram?: string | null
  storage?: string | null
  physicalCondition?: string | null
  accessories?: string | null
  notes?: string | null
}

export interface PartRequest {
  id: string
  description: string
  status: PartRequestStatus
  priceCRC?: number | null
  purchaseLink?: string | null
  estimatedArrival?: string | null
  notes?: string | null
  supplier?: { id: string; name: string } | null
  statusHistory: { id: string; fromStatus: string | null; toStatus: string; notes: string | null; createdAt: string }[]
}

export interface WorkOrderDevice {
  id: string
  workOrderId: string
  status: WorkOrderDeviceStatus
  problem: string
  hoursWorked?: number | null
  device: Device
  history: { id: string; fromStatus: string | null; toStatus: string; notes: string | null; createdAt: string }[]
  diagnoses: {
    id: string; diagnosis: string; findings?: string | null
    hasCost: boolean; diagnosticCost?: number | null; createdAt: string
  }[]
  partRequests: PartRequest[]
}

export interface WorkOrder {
  id: string
  number: string
  customerId: string
  notes?: string | null
  createdAt: string
  customer: { id: string; name: string; phone: string; email?: string | null }
  devices: WorkOrderDevice[]
  quotes: { id: string; number: string; status: string; total: number; createdAt: string }[]
}

export interface WorkOrderSummary {
  id: string
  number: string
  createdAt: string
  customer: { id: string; name: string; phone: string }
  devices: { id: string; status: WorkOrderDeviceStatus; device: { id: string; brand?: string | null; model?: string | null; deviceType: string } }[]
}

export interface ListMeta { total: number; page: number; limit: number; pages: number }

// ---- Hooks ----

interface ListParams { q?: string; customerId?: string; status?: string; page?: number; limit?: number }

export function useWorkOrders(params: ListParams = {}) {
  return useQuery<{ data: WorkOrderSummary[]; meta: ListMeta }>({
    queryKey: ['workorders', params],
    queryFn: async () => (await api.get('/workorders', { params })).data,
  })
}

export function useWorkOrder(id: string) {
  return useQuery<WorkOrder>({
    queryKey: ['workorders', id],
    queryFn: async () => (await api.get(`/workorders/${id}`)).data,
    enabled: !!id,
  })
}

export function useCreateWorkOrder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      customerId: string
      notes?: string
      devices: {
        deviceType: string; brand?: string; model?: string; serialNumber?: string
        processor?: string; ram?: string; storage?: string
        physicalCondition?: string; accessories?: string; notes?: string; problem: string
      }[]
    }) => (await api.post('/workorders', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workorders'] }),
  })
}

export function useTransitionDevice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, wodId, toStatus, notes }: {
      orderId: string; wodId: string; toStatus: WorkOrderDeviceStatus; notes?: string
    }) => (await api.post(`/workorders/${orderId}/devices/${wodId}/transition`, { toStatus, notes })).data,
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['workorders', vars.orderId] }),
  })
}

export function useAddDiagnosis() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, wodId, ...data }: {
      orderId: string; wodId: string; diagnosis: string; findings?: string
      testsPerformed?: string; hasCost?: boolean; diagnosticCost?: number; notes?: string
    }) => (await api.post(`/workorders/${orderId}/devices/${wodId}/diagnoses`, data)).data,
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['workorders', vars.orderId] }),
  })
}

export function useAddPartRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, wodId, ...data }: {
      orderId: string; wodId: string; description: string
      supplierId?: string; purchaseLink?: string; priceCRC?: number
      estimatedArrival?: string; notes?: string
    }) => (await api.post(`/workorders/${orderId}/devices/${wodId}/parts`, data)).data,
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['workorders', vars.orderId] }),
  })
}

export function useTransitionPart() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, wodId, partId, toStatus, notes }: {
      orderId: string; wodId: string; partId: string; toStatus: PartRequestStatus; notes?: string
    }) => (await api.post(`/workorders/${orderId}/devices/${wodId}/parts/${partId}/transition`, { toStatus, notes })).data,
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['workorders', vars.orderId] }),
  })
}

export function useUpdateHours() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ orderId, wodId, hoursWorked }: {
      orderId: string; wodId: string; hoursWorked: number
    }) => (await api.patch(`/workorders/${orderId}/devices/${wodId}/hours`, { hoursWorked })).data,
    onSuccess: (_data, vars) => qc.invalidateQueries({ queryKey: ['workorders', vars.orderId] }),
  })
}
