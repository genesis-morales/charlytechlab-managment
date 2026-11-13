import { useState } from 'react'
import { useCreateCustomer, useUpdateCustomer, useCheckDuplicate, type Customer, type CreateCustomerResult } from '../../api/customers'

interface Props {
  customer?: Customer
  onSuccess: () => void
  onCancel: () => void
}

export default function CustomerForm({ customer, onSuccess, onCancel }: Props) {
  const isEdit = !!customer
  const [form, setForm] = useState({
    name: customer?.name ?? '',
    phone: customer?.phone ?? '',
    email: customer?.email ?? '',
    address: customer?.address ?? '',
    notes: customer?.notes ?? '',
  })
  const [duplicates, setDuplicates] = useState<Customer[]>([])
  const [error, setError] = useState('')

  const create = useCreateCustomer()
  const update = useUpdateCustomer(customer?.id ?? '')
  const checkDup = useCheckDuplicate()

  // create y update tienen tipos de retorno distintos — unificamos como CreateCustomerResult
  const loading = isEdit ? update.isPending : create.isPending

  // Verificar duplicados al salir del campo teléfono
  async function handlePhoneBlur() {
    if (!form.phone || form.phone.length < 7) return
    const result = await checkDup.mutateAsync({
      phone: form.phone,
      email: form.email || undefined,
    })
    setDuplicates(result.duplicates.filter((d) => d.id !== customer?.id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const payload = { ...form, email: form.email || undefined }
      let res: CreateCustomerResult
      if (isEdit) {
        res = await update.mutateAsync(payload)
      } else {
        res = await create.mutateAsync(payload)
      }
      if (res?.duplicates?.length) {
        setDuplicates(res.duplicates)
      }
      onSuccess()
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: unknown } } }
      const raw = e?.response?.data?.error
      const msg = (raw as { formErrors?: string[] })?.formErrors?.[0]
        ?? (typeof raw === 'string' ? raw : undefined)
        ?? 'Error al guardar cliente'
      setError(msg)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Teléfono / WhatsApp <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            onBlur={handlePhoneBlur}
            required
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Correo electrónico</label>
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Dirección</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
            className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Notas internas</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          rows={3}
          className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {duplicates.length > 0 && (
        <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
          <p className="font-medium mb-1">⚠ Posibles clientes duplicados:</p>
          <ul className="list-disc list-inside space-y-1">
            {duplicates.map((d) => (
              <li key={d.id}>
                {d.name} — {d.phone}{d.email ? ` / ${d.email}` : ''}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs">Podés continuar de todas formas si son personas distintas.</p>
        </div>
      )}

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm border rounded-md hover:bg-gray-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear cliente'}
        </button>
      </div>
    </form>
  )
}
