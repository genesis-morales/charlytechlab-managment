import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { api } from '../lib/api'

export type CertificateKind = 'sale' | 'repair'
export type CertificateState = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | 'INACTIVE' | 'NOT_STARTED'
export const CERTIFICATE_STATES: Record<CertificateState, string> = {
  ACTIVE: 'Vigente', EXPIRED: 'Vencida', REVOKED: 'Emisión anulada', INACTIVE: 'Garantía inactiva', NOT_STARTED: 'Aún no inicia',
}
export interface CertificateSnapshot {
  schemaVersion: 1
  issuer: { name: string; location: string; phone: string; instagram: string }
  number: string
  version: number
  issuedAt: string
  kind: CertificateKind
  customer: { id: string; name: string }
  operation: { reference: string; date: string }
  device: { title: string; type: string; serialNumber: string | null; serialNotApplicable: boolean; description: string }
  startsAt: string
  expiresAt: string
  coverage: string
  conditions: string
  paymentReference: string
  paymentId: string | null
}
export interface CertificateSummary { id: string; number: string; version: number; issuedAt: string; revokedAt: string | null }
export interface WarrantyCertificate extends CertificateSummary {
  warrantyId: string
  snapshot: CertificateSnapshot
  verificationPath: string
  state: CertificateState
  revocationReason: string | null
}
export interface CertificateSource {
  kind: CertificateKind
  id: string
  eligible: boolean
  unavailableReason: string | null
  issuer: CertificateSnapshot['issuer']
  customer: CertificateSnapshot['customer'] | null
  device: { title: string; type: string; serialNumber: string | null }
  operation: { reference: string; date: string | null }
  startsAt: string | null
  expiresAt: string | null
  description: string
  conditions: string
  warrantyActive: boolean
  certificates: CertificateSummary[]
  payments: { id: string; reference: string | null; amount: string; paidAt: string }[]
}
export interface IssueCertificate {
  customerId?: string
  description: string
  serialNotApplicable: boolean
  coverage: string
  conditions: string
  paymentReference?: string
  paymentId?: string
  confirmed: true
}

export const certificateDate = (value: string) => new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium', timeZone: 'America/Costa_Rica' }).format(new Date(value))

export function useCertificateSource(kind: CertificateKind, id: string, enabled = true) {
  return useQuery<CertificateSource>({ queryKey: ['warranty-sources', kind, id], queryFn: async () => (await api.get(`/warranties/sources/${kind}/${id}`)).data, enabled })
}
export function useCertificate(id: string) {
  return useQuery<WarrantyCertificate>({ queryKey: ['warranty-certificates', id], queryFn: async () => (await api.get(`/warranties/certificates/${id}`)).data, enabled: !!id, staleTime: 0 })
}
function useRefreshCertificates(kind: CertificateKind, id: string) {
  const qc = useQueryClient()
  return () => Promise.all(['warranty-sources', 'products', 'workorders', 'customers', 'dashboard', 'warranty-certificates'].map(key => qc.invalidateQueries({ queryKey: key === 'warranty-sources' ? [key, kind, id] : [key] })))
}
export function useIssueCertificate(kind: CertificateKind, id: string) {
  const qc = useQueryClient(), refresh = useRefreshCertificates(kind, id)
  return useMutation({
    mutationFn: async (data: IssueCertificate) => (await api.post<WarrantyCertificate>(`/warranties/sources/${kind}/${id}/certificates`, data)).data,
    onSuccess: data => { qc.setQueryData(['warranty-certificates', data.id], data) },
    onSettled: refresh,
  })
}
export function useRevokeCertificate(kind: CertificateKind, id: string) {
  const refresh = useRefreshCertificates(kind, id)
  return useMutation({ mutationFn: async ({ certificateId, reason }: { certificateId: string; reason: string }) => api.post(`/warranties/certificates/${certificateId}/revoke`, { reason }), onSettled: refresh })
}

const verificationApi = axios.create({ baseURL: import.meta.env.VITE_API_URL ?? '/api', timeout: 10000 })
export interface PublicCertificate {
  number: string; kind: CertificateKind; equipment: string; issuedAt: string; startsAt: string; expiresAt: string; state: CertificateState
}
export function useVerifyCertificate(token: string) {
  return useQuery<PublicCertificate>({
    queryKey: ['warranty-verification', token],
    queryFn: async ({ signal }) => (await verificationApi.post('/public/certificates/verify', { token }, { signal })).data,
    enabled: /^[A-Za-z0-9_-]{43}$/.test(token), retry: false, staleTime: 0, refetchInterval: 60000,
  })
}
