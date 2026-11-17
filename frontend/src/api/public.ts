import axios from 'axios'
import { useQuery } from '@tanstack/react-query'

export type PublicProductStatus = 'AVAILABLE' | 'COMING_SOON'

export interface PublicProduct {
  id: string
  title: string
  description?: string | null
  askingPriceCRC: number | string
  status: PublicProductStatus
  displaySpecs?: Record<string, string> | null
  photos: { url: string }[]
}

interface PublicCatalog {
  data: PublicProduct[]
  meta: { total: number; page: number; limit: number; pages: number }
}

// Public browsing does not attach the CRM token or alter its session on errors.
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 10000,
})

export function usePublicProducts({ page = 1, limit = 12, status }: {
  page?: number
  limit?: number
  status?: PublicProductStatus
} = {}) {
  return useQuery<PublicCatalog>({
    queryKey: ['public-products', { page, limit, status }],
    queryFn: async ({ signal }) => (await publicApi.get<PublicCatalog>('/public/products', {
      params: { page, limit, status }, signal,
    })).data,
  })
}
