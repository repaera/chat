import * as React from "react"

const MOBILE_BREAKPOINT = 768

const mql = typeof window !== "undefined"
  ? window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
  : null

function subscribe(callback: () => void) {
  mql?.addEventListener("change", callback)
  return () => mql?.removeEventListener("change", callback)
}

function getSnapshot() {
  return window.innerWidth < MOBILE_BREAKPOINT
}

function getServerSnapshot() {
  return false
}

export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
