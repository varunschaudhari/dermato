// Module-level pub/sub so non-component code (axios interceptors) can raise
// toasts without needing access to React context.
const listeners = new Set()

export function emitToast(toast) {
  listeners.forEach((fn) => fn(toast))
}

export function subscribeToast(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
