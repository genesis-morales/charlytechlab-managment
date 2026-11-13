import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

// ---- Types ----

export type TransactionType =
  | 'INCOME' | 'EXPENSE' | 'TRANSFER' | 'OWNER_LOAN' | 'OWNER_LOAN_REPAYMENT'
  | 'OWNER_INVESTMENT' | 'OWNER_WITHDRAWAL' | 'INVENTORY_PURCHASE'
  | 'COST_ADJUSTMENT' | 'WRITE_OFF' | 'RESERVE' | 'RELEASE_RESERVE'
  | 'SALE' | 'REFUND' | 'OTHER'

export const TX_TYPE_LABELS: Record<TransactionType, string> = {
  INCOME: 'Ingreso',
  EXPENSE: 'Gasto',
  TRANSFER: 'Transferencia',
  OWNER_LOAN: 'Préstamo propietaria',
  OWNER_LOAN_REPAYMENT: 'Devolución préstamo',
  OWNER_INVESTMENT: 'Inversión propietaria',
  OWNER_WITHDRAWAL: 'Retiro propietaria',
  INVENTORY_PURCHASE: 'Compra inventario',
  COST_ADJUSTMENT: 'Ajuste de costo',
  WRITE_OFF: 'Baja',
  RESERVE: 'Reserva de fondo',
  RELEASE_RESERVE: 'Liberación de reserva',
  SALE: 'Venta',
  REFUND: 'Devolución/Reembolso',
  OTHER: 'Otro',
}

export const TX_TYPE_COLORS: Record<TransactionType, string> = {
  INCOME: 'text-green-700',
  EXPENSE: 'text-red-600',
  TRANSFER: 'text-blue-600',
  OWNER_LOAN: 'text-purple-600',
  OWNER_LOAN_REPAYMENT: 'text-orange-600',
  OWNER_INVESTMENT: 'text-teal-600',
  OWNER_WITHDRAWAL: 'text-orange-700',
  INVENTORY_PURCHASE: 'text-red-600',
  COST_ADJUSTMENT: 'text-gray-600',
  WRITE_OFF: 'text-gray-500',
  RESERVE: 'text-yellow-700',
  RELEASE_RESERVE: 'text-yellow-600',
  SALE: 'text-green-700',
  REFUND: 'text-green-600',
  OTHER: 'text-gray-500',
}

// Tipos que representan entradas de dinero (para mostrar en verde)
export const CREDIT_TYPES = new Set<TransactionType>([
  'INCOME', 'SALE', 'OWNER_INVESTMENT', 'OWNER_LOAN', 'REFUND', 'RELEASE_RESERVE',
])

export interface FinancialAccount {
  id: string; name: string; description?: string | null
  isActive: boolean; balance: string; createdAt: string
}

export interface Fund {
  id: string; name: string; description?: string | null
  isActive: boolean; balance: string; createdAt: string
}

export interface AccountingCategory {
  id: string; name: string; type: 'income' | 'expense'; description?: string | null
}

export interface FinancialTransaction {
  id: string; type: TransactionType; amount: string; description: string
  accountId?: string | null; fundId?: string | null; categoryId?: string | null
  isConfirmed: boolean; isVoided: boolean
  transferId?: string | null; transferDirection?: 'IN' | 'OUT' | null
  reference?: string | null; notes?: string | null
  transactedAt: string; createdAt: string
  account?: { id: string; name: string } | null
  fund?: { id: string; name: string } | null
  category?: { id: string; name: string; type: string } | null
}

export interface OwnerLoan {
  id: string; amount: string; description?: string | null
  loanedAt: string; isRepaid: boolean; repaidAt?: string | null
  repaid: string; pending: string
  repayments: { id: string; amount: string; paidAt: string; notes?: string | null }[]
}

export interface FinancialSummary {
  totalBalance: string; totalFunds: string
  totalOwnerDebt: string; monthlyMovements: string
  accounts: { id: string; name: string; balance: string }[]
  funds: { id: string; name: string; balance: string }[]
}

export interface ListMeta { total: number; page: number; limit: number; pages: number }

// ---- Hooks ----

export function useAccounts() {
  return useQuery<{ data: FinancialAccount[] }>({
    queryKey: ['financial', 'accounts'],
    queryFn: async () => (await api.get('/financial/accounts')).data,
  })
}

export function useFunds() {
  return useQuery<{ data: Fund[] }>({
    queryKey: ['financial', 'funds'],
    queryFn: async () => (await api.get('/financial/funds')).data,
  })
}

export function useCategories() {
  return useQuery<{ data: AccountingCategory[] }>({
    queryKey: ['financial', 'categories'],
    queryFn: async () => (await api.get('/financial/categories')).data,
  })
}

export function useFinancialSummary() {
  return useQuery<FinancialSummary>({
    queryKey: ['financial', 'summary'],
    queryFn: async () => (await api.get('/financial/summary')).data,
  })
}

interface TxParams {
  accountId?: string; fundId?: string; categoryId?: string; type?: string
  confirmed?: string; page?: number; limit?: number; from?: string; to?: string
}

export function useTransactions(params: TxParams = {}) {
  return useQuery<{ data: FinancialTransaction[]; meta: ListMeta }>({
    queryKey: ['financial', 'transactions', params],
    queryFn: async () => (await api.get('/financial/transactions', { params })).data,
  })
}

export function useOwnerLoans() {
  return useQuery<{ data: OwnerLoan[]; totalPending: string }>({
    queryKey: ['financial', 'owner-loans'],
    queryFn: async () => (await api.get('/financial/owner-loans')).data,
  })
}

export function useLedger(params: { from?: string; to?: string }) {
  return useQuery<{ data: Record<string, string>[] }>({
    queryKey: ['financial', 'ledger', params],
    queryFn: async () => (await api.get('/financial/ledger', { params })).data,
    enabled: !!(params.from || params.to),
  })
}

// ---- Mutations ----

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) =>
      (await api.post('/financial/accounts', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
  })
}

export function useCreateFund() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; description?: string }) =>
      (await api.post('/financial/funds', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
  })
}

export function useCreateCategory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: { name: string; type: 'income' | 'expense'; description?: string }) =>
      (await api.post('/financial/categories', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
  })
}

export function useCreateTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      type: TransactionType; amount: number; description: string
      accountId?: string; fundId?: string; categoryId?: string
      reference?: string; notes?: string; transactedAt?: string
    }) => (await api.post('/financial/transactions', data)).data as FinancialTransaction,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
  })
}

export function useConfirmTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) =>
      (await api.post(`/financial/transactions/${id}/confirm`, { confirm: true })).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
  })
}

export function useVoidTransaction() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) =>
      api.post(`/financial/transactions/${id}/void`, { reason }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
  })
}

export function useTransfer() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      fromAccountId: string; toAccountId: string; amount: number
      description: string; notes?: string; transactedAt?: string
    }) => (await api.post('/financial/transfer', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
  })
}

export function useCreateOwnerLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (data: {
      amount: number; description?: string
      loanedAt: string; accountId?: string
    }) => (await api.post('/financial/owner-loans', data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
  })
}

export function useRepayOwnerLoan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ loanId, ...data }: {
      loanId: string; amount: number; paidAt: string; notes?: string; accountId?: string
    }) => (await api.post(`/financial/owner-loans/${loanId}/repayments`, data)).data,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['financial'] }),
  })
}
