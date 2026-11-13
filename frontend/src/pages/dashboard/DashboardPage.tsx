import { useNavigate } from 'react-router-dom'
import { useDashboard } from '../../api/dashboard'

function fmtMoney(n: string | number | null | undefined) {
  if (n == null) return '₡0'
  return new Intl.NumberFormat('es-CR', {
    style: 'currency', currency: 'CRC', maximumFractionDigits: 0,
  }).format(Number(n))
}

function fmtDate(d: string) {
  return new Intl.DateTimeFormat('es-CR', { dateStyle: 'medium' }).format(new Date(d))
}

const STATUS_LABELS: Record<string, string> = {
  RECEIVED: 'Recibido',
  DIAGNOSING: 'En diagnóstico',
  QUOTED: 'Cotizado',
  AWAITING_APPROVAL: 'Esperando aprobación',
  APPROVED: 'Aprobado',
  WAITING_PARTS: 'Esperando repuestos',
  REPAIRING: 'En reparación',
  QUALITY_CHECK: 'Control de calidad',
  READY_FOR_DELIVERY: 'Listo para entrega',
  WARRANTY_CLAIM: 'Garantía',
}

// ---- Tarjeta genérica ----
function Card({
  label, value, sub, color = 'gray', onClick,
}: {
  label: string
  value: string | number
  sub?: string
  color?: 'gray' | 'green' | 'red' | 'blue' | 'orange' | 'amber' | 'purple' | 'teal'
  onClick?: () => void
}) {
  const colorMap = {
    gray: 'border-gray-200',
    green: 'border-green-200 bg-green-50',
    red: 'border-red-200 bg-red-50',
    blue: 'border-blue-200 bg-blue-50',
    orange: 'border-orange-200 bg-orange-50',
    amber: 'border-amber-200 bg-amber-50',
    purple: 'border-purple-200 bg-purple-50',
    teal: 'border-teal-200 bg-teal-50',
  }
  const valColor = {
    gray: 'text-gray-800',
    green: 'text-green-700',
    red: 'text-red-700',
    blue: 'text-blue-700',
    orange: 'text-orange-700',
    amber: 'text-amber-700',
    purple: 'text-purple-700',
    teal: 'text-teal-700',
  }
  return (
    <div
      className={`border rounded-lg p-4 ${colorMap[color]} ${onClick ? 'cursor-pointer hover:shadow-sm transition-shadow' : ''}`}
      onClick={onClick}
    >
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold tabular-nums ${valColor[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  )
}

// ---- Sección con título ----
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h2>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Panel de control</h1>
        </div>
        <p className="text-sm text-gray-500">Cargando indicadores…</p>
      </div>
    )
  }

  if (isError || !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">Panel de control</h1>
        <p className="text-sm text-red-500">Error al cargar el panel. Asegúrese de que el servidor esté corriendo.</p>
        <button onClick={() => refetch()} className="mt-2 text-sm text-blue-600 hover:underline">Reintentar</button>
      </div>
    )
  }

  const gananciaLiquidaPositiva = Number(data.gananciaLiquida) >= 0

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Panel de control</h1>
        <button onClick={() => refetch()} className="text-xs text-gray-400 hover:text-gray-600">
          ↻ Actualizar
        </button>
      </div>

      {/* ---- ALERTAS ---- */}
      {(data.ordenesAtrasadas > 0 || data.stockBajo.length > 0 || data.garantiasPorVencer.length > 0) && (
        <div className="space-y-2">
          {data.ordenesAtrasadas > 0 && (
            <div
              className="flex items-center gap-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-800 cursor-pointer hover:bg-red-100"
              onClick={() => navigate('/ordenes')}
            >
              <span className="text-lg">⚠</span>
              <span><strong>{data.ordenesAtrasadas}</strong> orden{data.ordenesAtrasadas > 1 ? 'es' : ''} sin actividad hace más de 14 días</span>
            </div>
          )}
          {data.stockBajo.length > 0 && (
            <div
              className="flex items-start gap-3 rounded-lg bg-orange-50 border border-orange-200 px-4 py-3 text-sm text-orange-800 cursor-pointer hover:bg-orange-100"
              onClick={() => navigate('/inventario')}
            >
              <span className="text-lg mt-0.5">📦</span>
              <div>
                <span className="font-medium">Stock bajo en {data.stockBajo.length} artículo{data.stockBajo.length > 1 ? 's' : ''}: </span>
                {data.stockBajo.slice(0, 3).map((i, idx) => (
                  <span key={i.id}>{idx > 0 ? ', ' : ''}{i.name} ({i.quantity}/{i.minQuantity})</span>
                ))}
                {data.stockBajo.length > 3 && <span> y {data.stockBajo.length - 3} más…</span>}
              </div>
            </div>
          )}
          {data.garantiasPorVencer.length > 0 && (
            <div
              className="flex items-start gap-3 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800 cursor-pointer hover:bg-yellow-100"
              onClick={() => navigate('/productos')}
            >
              <span className="text-lg mt-0.5">🔔</span>
              <div>
                <span className="font-medium">Garantías por vencer (30 días): </span>
                {data.garantiasPorVencer.slice(0, 2).map((g, idx) => (
                  <span key={g.id}>{idx > 0 ? ', ' : ''}{g.product} ({fmtDate(g.expiresAt)})</span>
                ))}
                {data.garantiasPorVencer.length > 2 && <span> y {data.garantiasPorVencer.length - 2} más</span>}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ---- CAPITAL Y SALDOS ---- */}
      <Section title="Capital y saldos">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card label="Saldo total en cuentas" value={fmtMoney(data.totalBalance)} color="blue" onClick={() => navigate('/financiero')} />
          <Card label="Fondos reservados" value={fmtMoney(data.totalFunds)} color="teal" />
          <Card label="Capital en inventario" value={fmtMoney(data.capitalInventario)} color="gray" onClick={() => navigate('/inventario')} />
          <Card label="Capital en laptops" value={fmtMoney(data.capitalLaptops)} color="purple" onClick={() => navigate('/productos')} />
        </div>
        {/* Cuentas individuales */}
        {data.accounts.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {data.accounts.map((a) => (
              <div key={a.id} className="border rounded-md px-3 py-1.5 text-sm bg-white">
                <span className="text-gray-500">{a.name}:</span>{' '}
                <span className={`font-medium tabular-nums ${Number(a.balance) < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                  {fmtMoney(a.balance)}
                </span>
              </div>
            ))}
          </div>
        )}
        {Number(data.totalOwnerDebt) > 0 && (
          <div className="mt-2 text-sm text-orange-700 bg-orange-50 rounded-md px-3 py-2 border border-orange-100">
            Deuda pendiente con propietaria: <strong className="tabular-nums">{fmtMoney(data.totalOwnerDebt)}</strong>
          </div>
        )}
      </Section>

      {/* ---- RENTABILIDAD LAPTOPS ---- */}
      <Section title="Laptops">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card
            label="Capital en laptops activas"
            value={fmtMoney(data.capitalLaptops)}
            sub="Equipos en proceso / listados"
            color="purple"
          />
          <Card
            label="Ingresos totales por ventas"
            value={fmtMoney(data.ingresosVentasLaptops)}
            sub={`${data.productosVendidos} laptop${data.productosVendidos !== 1 ? 's' : ''} vendida${data.productosVendidos !== 1 ? 's' : ''}`}
            color="green"
          />
          <Card
            label="Ganancia neta laptops"
            value={fmtMoney(data.gananciaNetaLaptops)}
            sub="Precio venta − costo total"
            color={Number(data.gananciaNetaLaptops) >= 0 ? 'green' : 'red'}
          />
        </div>
      </Section>

      {/* ---- INGRESOS POR LINEA ---- */}
      <Section title="Ingresos por línea de negocio">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card
            label="Ingresos por venta de repuestos"
            value={fmtMoney(data.ingresosRepuestos)}
            sub="De cotizaciones pagadas"
            color="blue"
          />
          <Card
            label="Ingresos por servicios cobrados"
            value={fmtMoney(data.ingresosServicios)}
            sub="Mano de obra y servicios"
            color="teal"
          />
        </div>
      </Section>

      {/* ---- GASTOS ---- */}
      <Section title="Gastos">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Card
            label="Gastos herramientas / taller"
            value={fmtMoney(data.gastosHerramientas)}
            sub="Equipamiento técnico"
            color="orange"
          />
          <Card
            label="Gastos infraestructura / local"
            value={fmtMoney(data.gastosInfraestructura)}
            sub="Construcción y adecuación"
            color="amber"
          />
        </div>
      </Section>

      {/* ---- GANANCIA LIQUIDA ---- */}
      <div className={`rounded-xl border-2 p-5 ${gananciaLiquidaPositiva ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1">
          Ganancia líquida acumulada
        </p>
        <p className={`text-4xl font-bold tabular-nums ${gananciaLiquidaPositiva ? 'text-green-700' : 'text-red-700'}`}>
          {fmtMoney(data.gananciaLiquida)}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          (Laptops + Repuestos + Servicios) − Gastos totales confirmados
        </p>
      </div>

      {/* ---- OPERACIONES ---- */}
      <Section title="Operaciones activas">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card
            label="Órdenes de trabajo"
            value={data.ordenesActivas}
            sub={data.ordenesAtrasadas > 0 ? `⚠ ${data.ordenesAtrasadas} atrasadas` : 'Al día'}
            color={data.ordenesAtrasadas > 0 ? 'orange' : 'gray'}
            onClick={() => navigate('/ordenes')}
          />
          <Card
            label="Cotizaciones pendientes"
            value={data.cotizacionesPendientes}
            sub="Enviadas o en aprobación"
            color={data.cotizacionesPendientes > 0 ? 'blue' : 'gray'}
            onClick={() => navigate('/cotizaciones')}
          />
          <Card
            label="Por cobrar"
            value={fmtMoney(data.saldoPorCobrar)}
            sub="Cotizaciones con saldo abierto"
            color={Number(data.saldoPorCobrar) > 0 ? 'orange' : 'gray'}
          />
          <Card
            label="Productos disponibles"
            value={data.productosDisponibles}
            sub={`${data.productosReservados} reservados · ${data.productosProximamente} próximamente`}
            color="green"
            onClick={() => navigate('/productos')}
          />
        </div>

        {/* Desglose de órdenes por estado */}
        {Object.keys(data.ordenesPorEstado).length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {Object.entries(data.ordenesPorEstado).map(([status, count]) => (
              <div key={status} className="border rounded-full px-3 py-1 text-xs bg-white text-gray-600">
                {STATUS_LABELS[status] ?? status}: <strong>{count}</strong>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ---- FONDOS ---- */}
      {data.funds.length > 0 && (
        <Section title="Fondos">
          <div className="flex flex-wrap gap-2">
            {data.funds.map((f) => (
              <div key={f.id} className="border rounded-lg px-4 py-3 bg-white text-sm">
                <p className="text-xs text-gray-500">{f.name}</p>
                <p className="font-bold tabular-nums">{fmtMoney(f.balance)}</p>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  )
}
