import type { Observable, Unsubscribe } from "@real-life-stack/data-interface"

type Callback<T> = (value: T) => void

export function createObservable<T>(initial: T): Observable<T> & { set(value: T): void; destroy(): void } {
  let current = initial
  const subscribers = new Set<Callback<T>>()

  return {
    get current() {
      return current
    },
    subscribe(callback: Callback<T>): Unsubscribe {
      subscribers.add(callback)
      return () => subscribers.delete(callback)
    },
    set(value: T) {
      current = value
      subscribers.forEach((cb) => cb(value))
    },
    destroy() {
      subscribers.clear()
    },
  }
}
