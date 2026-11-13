const pending = new Map<string, string>()

export function operationKey(signature: string, supplied?: string): string {
  if (supplied) return supplied
  const previous = pending.get(signature)
  if (previous) return previous
  if (pending.size >= 500) throw new Error('Hay demasiadas operaciones pendientes de confirmación')
  const key = crypto.randomUUID()
  pending.set(signature, key)
  return key
}

export function completeOperation(key?: string) {
  if (!key) return
  for (const [signature, current] of pending) if (current === key) pending.delete(signature)
}

export function clearOperationKeys() { pending.clear() }
