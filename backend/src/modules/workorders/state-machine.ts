import { WorkOrderDeviceStatus } from '@prisma/client'

// ============================================================
// Maquina de estados de un dispositivo dentro de una orden.
// Define que transiciones son validas desde cada estado.
// Decision A1: el estado vive en cada WorkOrderDevice, no en la orden.
// ============================================================

export const STATUS_LABELS: Record<WorkOrderDeviceStatus, string> = {
  RECEIVED: 'Recibido',
  DIAGNOSING: 'En diagnóstico',
  QUOTED: 'Cotizado',
  AWAITING_APPROVAL: 'Esperando aprobación',
  APPROVED: 'Aprobado',
  WAITING_PARTS: 'Esperando repuestos',
  REPAIRING: 'En reparación',
  QUALITY_CHECK: 'Control de calidad',
  READY_FOR_DELIVERY: 'Listo para entrega',
  DELIVERED: 'Entregado',
  REJECTED_BY_CUSTOMER: 'Rechazado por cliente',
  CANCELLED: 'Cancelado',
  WARRANTY_CLAIM: 'Garantía',
  CLOSED: 'Cerrado',
}

// Transiciones validas: desde cada estado, a que estados se puede pasar.
const TRANSITIONS: Record<WorkOrderDeviceStatus, WorkOrderDeviceStatus[]> = {
  RECEIVED: ['DIAGNOSING', 'CANCELLED'],
  DIAGNOSING: ['QUOTED', 'CANCELLED'],
  QUOTED: ['AWAITING_APPROVAL', 'CANCELLED'],
  AWAITING_APPROVAL: ['APPROVED', 'REJECTED_BY_CUSTOMER', 'CANCELLED'],
  APPROVED: ['WAITING_PARTS', 'REPAIRING', 'CANCELLED'],
  WAITING_PARTS: ['REPAIRING', 'CANCELLED'],
  REPAIRING: ['QUALITY_CHECK', 'WAITING_PARTS', 'CANCELLED'],
  QUALITY_CHECK: ['READY_FOR_DELIVERY', 'REPAIRING'],
  READY_FOR_DELIVERY: ['DELIVERED', 'WARRANTY_CLAIM', 'CANCELLED'],
  DELIVERED: ['CLOSED', 'WARRANTY_CLAIM'],
  WARRANTY_CLAIM: ['REPAIRING', 'CLOSED'],
  REJECTED_BY_CUSTOMER: ['CLOSED'],
  CANCELLED: ['CLOSED'],
  CLOSED: [],
}

export function isValidTransition(
  from: WorkOrderDeviceStatus,
  to: WorkOrderDeviceStatus,
): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false
}

export function canTransitionTo(from: WorkOrderDeviceStatus): WorkOrderDeviceStatus[] {
  return TRANSITIONS[from] ?? []
}

// Estados que indican que la orden todavia esta activa (no finalizada)
export const ACTIVE_STATUSES: WorkOrderDeviceStatus[] = [
  'RECEIVED',
  'DIAGNOSING',
  'QUOTED',
  'AWAITING_APPROVAL',
  'APPROVED',
  'WAITING_PARTS',
  'REPAIRING',
  'QUALITY_CHECK',
  'READY_FOR_DELIVERY',
  'WARRANTY_CLAIM',
]

export const FINAL_STATUSES: WorkOrderDeviceStatus[] = [
  'DELIVERED',
  'REJECTED_BY_CUSTOMER',
  'CANCELLED',
  'CLOSED',
]

export function isFinal(status: WorkOrderDeviceStatus): boolean {
  return FINAL_STATUSES.includes(status)
}
