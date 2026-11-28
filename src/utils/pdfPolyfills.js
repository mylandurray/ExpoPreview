// APIs pdf.js's legacy build still assumes but does not polyfill itself.
// Adding these takes PDF import back to roughly Safari/iOS 15.4 and Chrome 98.
// Loaded on the main thread and in the legacy pdf.js worker; no-ops where the
// browser already has them.

if (typeof Promise.withResolvers !== 'function') {
  Promise.withResolvers = function withResolvers() {
    let resolve, reject
    const promise = new this((res, rej) => { resolve = res; reject = rej })
    return { promise, resolve, reject }
  }
}

if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any !== 'function') {
  AbortSignal.any = function any(signals) {
    const controller = new AbortController()
    for (const signal of signals) {
      if (signal.aborted) {
        controller.abort(signal.reason)
        break
      }
      signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true, signal: controller.signal })
    }
    return controller.signal
  }
}
