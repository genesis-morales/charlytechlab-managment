import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export type InventoryCategory =
  | 'LAPTOP' | 'DESKTOP' | 'COMPONENT_RAM' | 'COMPONENT_SSD'
  | 'COMPONENT_OTHER' | 'TOOL' | 'CONSUMABLE' | 'SPARE_PART' | 'OTHER'

export type InventoryMovementType =
  | 'ENTRY' | 'CONSUMPTION' | 'SALE' | 'ADJUSTMENT' | 'WRITE_OFF'

export const CATEGORY_LABELS: Record<InventoryCategory, string> = {
  LAPTOP: 'Laptop',
  DESKTOP: 'Desktop',
  COMPONENT_RAM: 'RAM',
  COMPONENT_SSD: 'SSD',
  COMPONENT_OTHER: 'Componente (otro)',
  TOOL: 'Herramienta',
  CONSUMABLE: 'Insumo',
  SPARE_PART: 'Repuesto',
  OTHER: 'Otro',
}

export const MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  ENTRY: 'Entrada',
  CONSUMPTION: 'Consumo (reparación)',
  SALE: 'Venta',
  ADJUSTMENT: 'Ajuste',
  WRITE_OFF: 'Baja',
}

export const MOVEMENT_TYPE_COLORS: Record<InventoryMovementType, string> = {
  ENTRY: 'text-green-700',
  CONSUMPTION: 'text-orange-600',
  SALE: 'text-blue-600',
  ADJUSTMENT: 'text-gray-600',
  WRITE_OFF: 'text-red-600',
}

export interface InventoryItem {
  id: string
  name: string
  category: InventoryCategory
  description?: string | null
  specs?: Record<string, unknown> | null
  sku?: string | null
  quantity: number
  minQuantity: number
  costPrice?: string | null
  salePrice?: string | null
  supplierId?: string | null
  supplier?: { id: string; name: string } | null
  createdAt: string
  updatedAt: string
  _count?: { movements: number }
  movements?: InventoryMovement[]
}

export interface InventoryMovement {
  id: string
  inventoryItemId: string
  type: InventoryMovementType
  quantity: number
  unitCost?: string | null
  notes?: string | null
  purchaseItemId?: string | null
  workOrderDeviceId?: string | null
  createdAt: string
}

export interface InventorySummary {
  totalItems: number
  totalCost: string
  totalSale: string
  potentialProfit: string
  byCategory: Record<string, { count: number; costValue: number; saleValue: number }>
}

export interface ListMeta { total: number; page: number; limit: number; pages: number }

// ---- Hooks ----

interface ListParams { q?: string; category?: string; lowStock?: string; page?: number; limit?: number }

export function useInventoryItems(params: ListParams = {}) {
  return useQuery<{ data: InventoryItem[]; meta: ListMeta }>({
    queryKey: ['inventory', params],
    queryFn: async () => (await api.get('/inventory', { params })).data,
  })
}

export function useInventoryItem(id: string) {
  return useQuery<InventoryItem>({
    queryKey: ['inventory', id],
    queryFn: async () => (await api.get(`/inventory/${id}`)).data,
    enabled: !!id,
  })
}

export function useInventorySummary() {
  return useQuery<InventorySummary>({
    queryKey: ['inventory', 'summary'],
    queryFn: async () => (await api.get('/inventory/summary')).data,
  })
}

export function useLowStockItems() {
  return useQuery<{ data: Pick<InventoryItem, 'id' | 'name' | 'category' | 'quantity' | 'minQuantity' | 'salePrice'>[] }>({
    queryKey: ['inventory', 'low-stock'],
    queryFn: async () => (await api.get('/inventory/low-stock')).data,
  })
}

export function useCreateInventoryItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      name: string; category: InventoryCategory; description?: string
      specs?: Record<string, string>; sku?: string; minQuantity?: number
      costPrice?: number; salePrice?: number; supplierId?: string; quantity?: number
    }) => (await api.post('/inventory', data)).data as InventoryItem,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}

export function useUpdateInventoryItem(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      name?: string; description?: string; specs?: Record<string, string>
      sku?: string; minQuantity?: number; costPrice?: number; salePrice?: number
      supplierId?: string
    }) => (await api.patch(`/inventory/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['inventory', id] })
    },
  })
}

export function useAddMovement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, ...data }: {
      itemId: string; type: InventoryMovementType; quantity: number
      unitCost?: number; notes?: string
      purchaseItemId?: string; workOrderDeviceId?: string
    }) => (await api.post(`/inventory/${itemId}/movements`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}

export function useAdjustStock() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ itemId, newQuantity, reason }: {
      itemId: string; newQuantity: number; reason: string
    }) => (await api.post(`/inventory/${itemId}/adjust`, { newQuantity, reason })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inventory'] }),
  })
}
