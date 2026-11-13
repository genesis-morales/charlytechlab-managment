import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { AxiosResponse } from 'axios'

export interface Customer {
  id: string
  name: string
  phone: string
  email?: string | null
  address?: string | null
  notes?: string | null
  isActive: boolean
  createdAt: string
  _count?: { workOrders: number; quotes: number }
}

export interface CustomerDetail extends Customer {
  workOrders: {
    id: string
    number: string
    createdAt: string
    devices: {
      status: string
      device: { brand?: string | null; model?: string | null; deviceType: string }
    }[]
  }[]
  quotes: { id: string; number: string; status: string; total: number; createdAt: string }[]
  warranties: { id: string; startsAt: string; expiresAt: string; isActive: boolean; product: { title: string } }[]
}

export interface ListMeta { total: number; page: number; limit: number; pages: number }

interface ListParams { q?: string; active?: 'true' | 'false'; page?: number; limit?: number }

export function useCustomers(params: ListParams = {}) {
  return useQuery<{ data: Customer[]; meta: ListMeta }>({
    queryKey: ['customers', params],
    queryFn: async () => (await api.get('/customers', { params })).data,
  })
}

export function useCustomer(id: string) {
  return useQuery<CustomerDetail>({
    queryKey: ['customers', id],
    queryFn: async () => (await api.get(`/customers/${id}`)).data,
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Customer>) => (await api.post('/customers', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useUpdateCustomer(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: Partial<Customer>) => (await api.patch(`/customers/${id}`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export function useDeactivateCustomer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => api.delete(`/customers/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['customers'] }),
  })
}

export interface CreateCustomerResult {
  data: Customer
  duplicates?: Customer[]
}

export function useCheckDuplicate() {
  return useMutation({
    mutationFn: async (params: { phone?: string; email?: string }) =>
      ((await api.get('/customers/check-duplicate', { params })).data as { duplicates: Customer[] }),
  })
}

// Re-export para uso en hooks de mutacion que retornan { data, duplicates }
export type { AxiosResponse }
