import type { MutableRefObject } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type SparrowDeskApi,
  DEFAULT_READY_TIMEOUT_MS,
  DEFAULT_SCRIPT_SRC,
  acquireWidgetScript,
  isBrowser,
  normalizeRequired,
  removeOtherWidgetScripts,
  setWidgetGlobals,
  waitForSparrowDeskApi,
} from './sparrowDeskWidget'
import { useLatest } from './useLatest'

/** Bound pending calls while the widget API is loading (avoids unbounded memory if init never completes). */
const MAX_PENDING_API_CALLS = 50

export interface UseSparrowDeskWidgetOptions {
  domain: string
  token: string

  tags?: string[] | undefined
  contactFields?: Record<string, unknown> | undefined
  conversationFields?: Record<string, unknown> | undefined

  onReady?: ((api: SparrowDeskApi) => void) | undefined
  onOpen?: (() => void) | undefined
  onClose?: (() => void) | undefined

  openOnInit?: boolean
  hideOnInit?: boolean

  shouldInitialize?: boolean
  connectOnPageLoad?: boolean
  initializeOnInteraction?: boolean
  cleanupOnUnmount?: boolean
  readyTimeoutMs?: number
}

export interface UseSparrowDeskWidgetResult {
  /** True once `window.sparrowDesk` has been resolved. */
  isReady: boolean
  /** Live ref to the resolved widget API (null until ready). */
  apiRef: MutableRefObject<SparrowDeskApi | null>
  /** Whether both domain and token are present after normalization. */
  hasCredentials: boolean
  /** Ensures the widget script is injected (if enabled) and begins waiting for the API. */
  initialize: () => void
  /** Runs `fn` immediately if the API is ready, otherwise initializes and queues it. */
  callWhenReady: (fn: (api: SparrowDeskApi) => void) => void
}

/**
 * Owns the full widget lifecycle shared by `<Chat />` and `<SparrowDeskProvider />`:
 * setting globals, injecting/reference-counting the script, waiting for the API,
 * registering open/close callbacks once, applying init-time tags/fields, and honoring
 * `openOnInit` / `hideOnInit`. Callbacks and field props are read via refs so the latest
 * value is always used without re-running the wait.
 */
export function useSparrowDeskWidget(
  options: UseSparrowDeskWidgetOptions,
): UseSparrowDeskWidgetResult {
  const {
    domain,
    token,
    tags,
    contactFields,
    conversationFields,
    onReady,
    onOpen,
    onClose,
    openOnInit = false,
    hideOnInit = false,
    shouldInitialize = true,
    connectOnPageLoad = true,
    initializeOnInteraction = true,
    cleanupOnUnmount = false,
    readyTimeoutMs = DEFAULT_READY_TIMEOUT_MS,
  } = options

  const normalized = useMemo(() => {
    return {
      domain: normalizeRequired(domain),
      token: normalizeRequired(token),
    }
  }, [domain, token])

  const onReadyRef = useLatest(onReady)
  const onOpenRef = useLatest(onOpen)
  const onCloseRef = useLatest(onClose)
  const tagsRef = useLatest(tags)
  const contactFieldsRef = useLatest(contactFields)
  const conversationFieldsRef = useLatest(conversationFields)
  const openOnInitRef = useLatest(openOnInit)
  const hideOnInitRef = useLatest(hideOnInit)

  const apiRef = useRef<SparrowDeskApi | null>(null)
  const registeredCallbacksRef = useRef(false)
  const didOpenOnceRef = useRef(false)
  const didHideOnceRef = useRef(false)
  const scriptHandleRef = useRef<ReturnType<typeof acquireWidgetScript> | null>(null)
  const initStartedRef = useRef(false)
  const initCancelRef = useRef<(() => void) | null>(null)
  const pendingCallsRef = useRef<Array<(api: SparrowDeskApi) => void>>([])

  const [isReady, setIsReady] = useState(false)
  const [shouldStart, setShouldStart] = useState(connectOnPageLoad)

  useEffect(() => {
    setShouldStart(connectOnPageLoad)
  }, [connectOnPageLoad])

  // Reset all one-shot state when the target widget (domain/token) changes.
  useEffect(() => {
    didOpenOnceRef.current = false
    didHideOnceRef.current = false
    apiRef.current = null
    registeredCallbacksRef.current = false
    initStartedRef.current = false
    initCancelRef.current?.()
    initCancelRef.current = null
    pendingCallsRef.current = []
    scriptHandleRef.current?.release()
    scriptHandleRef.current = null
    setIsReady(false)
    setShouldStart(connectOnPageLoad)
  }, [normalized.domain, normalized.token, connectOnPageLoad])

  const initialize = useCallback(() => {
    if (!isBrowser()) return
    if (!normalized.domain || !normalized.token) return

    // Always set globals; the embed snippet expects these.
    setWidgetGlobals(normalized.domain, normalized.token)

    // Inject the script if this wrapper is responsible for initialization.
    if (shouldInitialize && !scriptHandleRef.current) {
      removeOtherWidgetScripts(DEFAULT_SCRIPT_SRC)
      scriptHandleRef.current = acquireWidgetScript(DEFAULT_SCRIPT_SRC, cleanupOnUnmount)
    }

    // Begin waiting for the API once per (domain, token) pair.
    if (initStartedRef.current) return
    initStartedRef.current = true

    let cancelled = false
    initCancelRef.current = () => {
      cancelled = true
    }

    void (async () => {
      const api = await waitForSparrowDeskApi(readyTimeoutMs)
      if (cancelled || !api) return

      apiRef.current = api
      setIsReady(true)

      // Register open/close callbacks once, but call the latest prop via refs.
      if (!registeredCallbacksRef.current) {
        api.onOpen?.(() => onOpenRef.current?.())
        api.onClose?.(() => onCloseRef.current?.())
        registeredCallbacksRef.current = true
      }

      onReadyRef.current?.(api)

      // Apply init-time defaults once the API is available (use refs for latest values).
      const latestTags = tagsRef.current
      const latestContactFields = contactFieldsRef.current
      const latestConversationFields = conversationFieldsRef.current
      if (Array.isArray(latestTags) && latestTags.length) api.setTags?.(latestTags)
      if (latestContactFields && Object.keys(latestContactFields).length)
        api.setContactFields?.(latestContactFields)
      if (latestConversationFields && Object.keys(latestConversationFields).length)
        api.setConversationFields?.(latestConversationFields)

      if (hideOnInitRef.current && !didHideOnceRef.current) {
        api.hideWidget?.()
        didHideOnceRef.current = true
      }
      if (openOnInitRef.current && !didOpenOnceRef.current) {
        api.openWidget?.()
        didOpenOnceRef.current = true
      }

      const pending = pendingCallsRef.current
      pendingCallsRef.current = []
      pending.forEach((fn) => fn(api))
    })()
  }, [
    cleanupOnUnmount,
    normalized.domain,
    normalized.token,
    readyTimeoutMs,
    shouldInitialize,
  ])

  // Auto-start once allowed; always set globals so an externally-loaded widget can read them.
  useEffect(() => {
    if (!isBrowser()) return
    if (!normalized.domain || !normalized.token) return
    setWidgetGlobals(normalized.domain, normalized.token)
    if (!shouldStart) return
    initialize()
    return () => {
      initCancelRef.current?.()
      initCancelRef.current = null
      // If we cancelled before becoming ready, allow a new initialize() call to restart polling.
      if (!apiRef.current) initStartedRef.current = false
      scriptHandleRef.current?.release()
      scriptHandleRef.current = null
    }
  }, [initialize, normalized.domain, normalized.token, shouldStart])

  // When deferred, kick off initialization on the first user interaction.
  useEffect(() => {
    if (!isBrowser()) return
    if (connectOnPageLoad) return
    if (!initializeOnInteraction) return
    if (shouldStart) return
    if (!normalized.domain || !normalized.token) return

    const onFirstInteraction = () => {
      setShouldStart(true)
      cleanup()
    }

    const cleanup = () => {
      document.removeEventListener('pointerdown', onFirstInteraction, true)
      document.removeEventListener('keydown', onFirstInteraction, true)
    }

    document.addEventListener('pointerdown', onFirstInteraction, true)
    document.addEventListener('keydown', onFirstInteraction, true)

    return cleanup
  }, [
    connectOnPageLoad,
    initializeOnInteraction,
    normalized.domain,
    normalized.token,
    shouldStart,
  ])

  // If tags/fields change after init, apply them without re-waiting for the API.
  useEffect(() => {
    const api = apiRef.current
    if (!api) return

    if (Array.isArray(tags) && tags.length) api.setTags?.(tags)
    if (contactFields && Object.keys(contactFields).length) api.setContactFields?.(contactFields)
    if (conversationFields && Object.keys(conversationFields).length)
      api.setConversationFields?.(conversationFields)
  }, [tags, contactFields, conversationFields])

  const callWhenReady = useCallback(
    (fn: (api: SparrowDeskApi) => void) => {
      const api = apiRef.current
      if (api) {
        fn(api)
        return
      }
      // Queue whenever the API is not ready yet (including connectOnPageLoad=true + slow load).
      initialize()
      if (pendingCallsRef.current.length < MAX_PENDING_API_CALLS) {
        pendingCallsRef.current.push(fn)
      }
    },
    [initialize],
  )

  return {
    isReady,
    apiRef,
    hasCredentials: Boolean(normalized.domain && normalized.token),
    initialize,
    callWhenReady,
  }
}
