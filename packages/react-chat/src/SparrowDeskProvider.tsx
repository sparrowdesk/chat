import * as React from 'react'
import { useMemo } from 'react'
import { type SparrowDeskApi, DEFAULT_READY_TIMEOUT_MS } from './internal/sparrowDeskWidget'
import { useSparrowDeskWidget } from './internal/useSparrowDeskWidget'

export type SparrowDeskProviderProps = {
  /** SparrowDesk domain, e.g. "your-workspace.sparrowdesk.com" */
  domain: string
  /** SparrowDesk widget token */
  token: string

  children: React.ReactNode

  /**
   * Controls whether this provider should set globals and inject the widget script.
   * Set to `false` if SparrowDesk is loaded elsewhere (e.g. via Segment) and you only
   * want the hook-based API.
   */
  shouldInitialize?: boolean

  /**
   * If `false`, defers injecting the widget script + waiting for the API until
   * you call `initialize()` (or invoke `openWidget`/`closeWidget`/`hideWidget`/etc),
   * or until the first user interaction when `initializeOnInteraction` is enabled.
   *
   * This is a performance optimization implemented at the wrapper level by delaying
   * script injection until you explicitly initialize.
   */
  connectOnPageLoad?: boolean

  /**
   * When `connectOnPageLoad={false}`, if `true`, initialize on the first
   * user interaction (pointer or keyboard). Defaults to `true`.
   */
  initializeOnInteraction?: boolean

  tags?: string[]
  contactFields?: Record<string, unknown>
  conversationFields?: Record<string, unknown>

  onReady?: (api: SparrowDeskApi) => void
  onOpen?: () => void
  onClose?: () => void

  openOnInit?: boolean
  hideOnInit?: boolean

  cleanupOnUnmount?: boolean
  readyTimeoutMs?: number
}

export type SparrowDeskContextValue = {
  isReady: boolean
  api: SparrowDeskApi | null
  /** Ensures the widget script is injected (if enabled) and begins waiting for the API. */
  initialize: () => void
  openWidget: () => void
  closeWidget: () => void
  hideWidget: () => void
  setTags: (tags: string[]) => void
  setContactFields: (fields: Record<string, unknown>) => void
  setConversationFields: (fields: Record<string, unknown>) => void
}

const SparrowDeskContext = React.createContext<SparrowDeskContextValue | null>(null)

export function useSparrowDesk(): SparrowDeskContextValue {
  const value = React.useContext(SparrowDeskContext)
  if (!value) {
    throw new Error('useSparrowDesk must be used within <SparrowDeskProvider />')
  }
  return value
}

export function SparrowDeskProvider({
  domain,
  token,
  children,
  shouldInitialize = true,
  connectOnPageLoad = true,
  initializeOnInteraction = true,
  tags,
  contactFields,
  conversationFields,
  onReady,
  onOpen,
  onClose,
  openOnInit = false,
  hideOnInit = false,
  cleanupOnUnmount = false,
  readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
}: SparrowDeskProviderProps) {
  const { isReady, apiRef, initialize, callWhenReady } = useSparrowDeskWidget({
    domain,
    token,
    tags,
    contactFields,
    conversationFields,
    onReady,
    onOpen,
    onClose,
    openOnInit,
    hideOnInit,
    shouldInitialize,
    connectOnPageLoad,
    initializeOnInteraction,
    cleanupOnUnmount,
    readyTimeoutMs,
  })

  const methods = useMemo<Omit<SparrowDeskContextValue, 'isReady' | 'api'>>(() => {
    return {
      initialize,
      openWidget: () => callWhenReady((api) => api.openWidget?.()),
      closeWidget: () => callWhenReady((api) => api.closeWidget?.()),
      hideWidget: () => callWhenReady((api) => api.hideWidget?.()),
      setTags: (t) => callWhenReady((api) => api.setTags?.(t)),
      setContactFields: (f) => callWhenReady((api) => api.setContactFields?.(f)),
      setConversationFields: (f) => callWhenReady((api) => api.setConversationFields?.(f)),
    }
  }, [initialize, callWhenReady])

  const value = useMemo<SparrowDeskContextValue>(() => {
    return {
      ...methods,
      isReady,
      api: apiRef.current,
    }
  }, [methods, isReady, apiRef])

  return <SparrowDeskContext.Provider value={value}>{children}</SparrowDeskContext.Provider>
}
