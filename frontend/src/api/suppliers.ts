import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface Supplier {
  id: string
  name: string
  isLocal: boolean
  country?: string | null
  contact?: string | null
  website?: string | null
  notes?: string | null
  createdAt: string
  _count?: { purchases: number; partRequests: number }
}

export interface SupplierDetail extends Supplier {
  purchases: {
    id: string; totalCRC: string; purchasedAt: string
    _count: { items: number }
  }[]
  partRequests: { id: string; description: string; status: string; createdAt: string }[]
}

export interface PurchaseItem {
  id: string
  description: string
  quantity: number
  unitCostCRC: string
  subtotal: string
  inventoryItem?: { id: string; name: string } | null
  importShipmentItem?: { id: string; description: string } | null
}

export interface Purchase {
  id: string
  supplierId?: string | null
  totalCRC: string
  purchasedAt: string
  notes?: string | null
  createdAt: string
  supplier?: { id: string; name: string; country?: string | null } | null
  items?: PurchaseItem[]
  _count?: { items: number }
}

export interface ListMeta { total: number; page: number; limit: number; pages: number }

interface ListParams { q?: string; isLocal?: string; page?: number; limit?: number }
interface PurchaseListParams { supplierId?: string; page?: number; limit?: number }

export function useSuppliers(params: ListParams = {}) {
  return useQuery<{ data: Supplier[]; meta: ListMeta }>({
    queryKey: ['suppliers', params],
    queryFn: async () => (await api.get('/suppliers', { params })).data,
  })
}

export function useSupplier(id: string) {
  return useQuery<SupplierDetail>({
    queryKey: ['suppliers', id],
    queryFn: async () => (await api.get(`/suppliers/${id}`)).data,
    enabled: !!id,
  })
}

export function useCreateSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      name: string; isLocal: boolean; country?: string
      contact?: string; website?: string; notes?: string
    }) => (await api.post('/suppliers', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

export function useUpdateSupplier(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<{ name: string; isLocal: boolean; country: string; contact: string; website: string; notes: string }>) =>
      (await api.patch(`/suppliers/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

export function useDeleteSupplier() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/suppliers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['suppliers'] }),
  })
}

export function usePurchases(params: PurchaseListParams = {}) {
  return useQuery<{ data: Purchase[]; meta: ListMeta }>({
    queryKey: ['purchases', params],
    queryFn: async () => (await api.get('/suppliers/purchases', { params })).data,
  })
}

export function usePurchase(id: string) {
  return useQuery<Purchase>({
    queryKey: ['purchases', id],
    queryFn: async () => (await api.get(`/suppliers/purchases/${id}`)).data,
    enabled: !!id,
  })
}

export function useCreatePurchase() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      supplierId?: string; purchasedAt: string; notes?: string
      items: {
        description: string; quantity: number; unitCostCRC: number
        inventoryItemId?: string; importShipmentItemId?: string
      }[]
    }) => (await api.post('/suppliers/purchases', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['purchases'] }),
  })
}
