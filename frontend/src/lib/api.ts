import axios from 'axios'
import { useAuthStore } from '../store/auth.store'
import { operationKey, completeOperation } from './operation-key'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
})

// Adjunta el token JWT a cada petición
api.interceptors.request.use((req) => {
  const token = useAuthStore.getState().token
  if (token) req.headers.Authorization = `Bearer ${token}`
  if (['post', 'patch', 'put', 'delete'].includes(req.method?.toLowerCase() ?? '') && !req.url?.startsWith('/auth/')) {
    const signature = JSON.stringify({ user: useAuthStore.getState().user?.id, method: req.method, url: req.url, body: req.data ?? null })
    // Identical pending requests and retries after an uncertain response share a key.
    req.headers['Idempotency-Key'] = operationKey(signature, req.headers['Idempotency-Key'] as string | undefined)
  }
  return req
})

// Si el token expira o es inválido, cierra sesión
api.interceptors.response.use(
  (res) => {
    completeOperation(res.config.headers['Idempotency-Key'] as string | undefined)
    return res
  },
  (err) => {
    // Keep the key after timeouts, lost connections and 5xx responses: the write may have committed.
    if (err.response && err.response.status < 500 && err.response.status !== 408) {
      completeOperation(err.config?.headers?.['Idempotency-Key'])
    }
    if (err.response?.status === 401) {
      useAuthStore.getState().logout()
    }
    return Promise.reject(err)
  },
)
