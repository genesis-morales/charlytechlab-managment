import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export type ProductStatus = 'COMING_SOON' | 'AVAILABLE' | 'RESERVED' | 'SOLD'

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  COMING_SOON: 'Próximamente',
  AVAILABLE: 'Disponible',
  RESERVED: 'Reservado',
  SOLD: 'Vendido',
}

export const PRODUCT_STATUS_COLORS: Record<ProductStatus, string> = {
  COMING_SOON: 'bg-gray-100 text-gray-600',
  AVAILABLE: 'bg-green-100 text-green-700',
  RESERVED: 'bg-orange-100 text-orange-700',
  SOLD: 'bg-blue-100 text-blue-700',
}

export interface Product {
  id: string
  deviceId: string
  title: string
  description?: string | null
  status: ProductStatus
  askingPriceCRC: string
  costCRC?: string | null
  reservedAt?: string | null
  reservedUntil?: string | null
  displaySpecs?: Record<string, unknown> | null
  publishedAt?: string | null
  soldAt?: string | null
  createdAt: string
  updatedAt: string
  device?: {
    id: string; brand?: string | null; model?: string | null; deviceType: string
    processor?: string | null; ram?: string | null; storage?: string | null
  } | null
  photos?: { url: string; position: number }[]
  reservations?: ProductReservation[]
  inquiries?: PublicInquiry[]
  warranty?: Warranty | null
}

export interface ProductReservation {
  id: string
  name: string
  phone: string
  email?: string | null
  notes?: string | null
  expiresAt: string
  isActive: boolean
  createdAt: string
}

export interface PublicInquiry {
  id: string
  name: string
  phone: string
  email?: string | null
  message?: string | null
  isRead: boolean
  createdAt: string
}

export interface Warranty {
  id: string
  startsAt: string
  expiresAt: string
  isActive: boolean
  terms?: string | null
  claims: WarrantyClaim[]
}

export interface WarrantyClaim {
  id: string
  description: string
  status: string
  resolution?: string | null
  claimedAt: string
  resolvedAt?: string | null
}

export interface ListMeta { total: number; page: number; limit: number; pages: number }

interface ListParams { status?: string; q?: string; page?: number; limit?: number }

export function useProducts(params: ListParams = {}) {
  return useQuery<{ data: Product[]; meta: ListMeta }>({
    queryKey: ['products', params],
    queryFn: async () => (await api.get('/products', { params })).data,
  })
}

export function useProduct(id: string) {
  return useQuery<Product>({
    queryKey: ['products', id],
    queryFn: async () => (await api.get(`/products/${id}`)).data,
    enabled: !!id,
  })
}

export function useCreateProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      deviceId: string; title: string; description?: string
      askingPriceCRC: number; displaySpecs?: Record<string, string>
    }) => (await api.post('/products', data)).data as Product,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['products'] }),
  })
}

export function useUpdateProduct(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      title?: string; description?: string; askingPriceCRC?: number
      displaySpecs?: Record<string, string>
    }) => (await api.patch(`/products/${id}`, data)).data,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['products'] })
      qc.invalidateQueries({ queryKey: ['products', id] })
    },
  })
}

export function usePublishProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => (await api.post(`/products/${id}/publish`)).data,
    onSuccess: (_d, id) => qc.invalidateQueries({ queryKey: ['products', id] }),
  })
}

export function useReserveProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string; name: string; phone: string
      email?: string; notes?: string; customerId?: string
    }) => (await api.post(`/products/${id}/reserve`, data)).data,
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['products', v.id] }),
  })
}

export function useCancelReservation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => api.post(`/products/${id}/cancel-reservation`),
    onSuccess: (_d, id) => qc.invalidateQueries({ queryKey: ['products', id] }),
  })
}

export function useSellProduct() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...data }: {
      id: string; customerId?: string; warrantyMonths?: number
    }) => (await api.post(`/products/${id}/sell`, data)).data,
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['products', v.id] }),
  })
}

export function useProductWarranty(id: string) {
  return useQuery<Warranty>({
    queryKey: ['products', id, 'warranty'],
    queryFn: async () => (await api.get(`/products/${id}/warranty`)).data,
    enabled: !!id,
  })
}

export function useCreateWarrantyClaim() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ productId, description }: { productId: string; description: string }) =>
      (await api.post(`/products/${productId}/warranty/claims`, { description })).data,
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ['products', v.productId, 'warranty'] }),
  })
}
