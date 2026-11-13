import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'

export interface DashboardData {
  // Saldos y capital
  totalBalance: string
  totalFunds: string
  totalOwnerDebt: string
  capitalInventario: string
  capitalLaptops: string

  // Laptops
  ingresosVentasLaptops: string
  gananciaNetaLaptops: string

  // Lineas de ingreso
  ingresosRepuestos: string
  ingresosServicios: string

  // Gastos
  gastosHerramientas: string
  gastosInfraestructura: string
  gastosTotales: string

  // Ganancia
  gananciaLiquida: string

  // Operaciones
  ordenesActivas: number
  ordenesAtrasadas: number
  ordenesPorEstado: Record<string, number>
  cotizacionesPendientes: number
  saldoPorCobrar: string

  // Inventario
  stockBajo: { id: string; name: string; quantity: number; minQuantity: number }[]
  valorInventarioCosto: string

  // Productos
  productosDisponibles: number
  productosReservados: number
  productosProximamente: number
  productosVendidos: number
  reservasActivas: number

  // Garantías
  garantiasVigentes: number
  garantiasPorVencer: { id: string; product: string; expiresAt: string }[]

  // Detalle cuentas y fondos
  accounts: { id: string; name: string; balance: string }[]
  funds: { id: string; name: string; balance: string }[]
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => (await api.get('/dashboard')).data,
    // Revalidar cada 2 minutos
    staleTime: 1000 * 120,
  })
}
