import type { FC } from 'react'
import { type SparrowDeskApi, DEFAULT_READY_TIMEOUT_MS } from './internal/sparrowDeskWidget'
import { useSparrowDeskWidget } from './internal/useSparrowDeskWidget'

export interface ChatProps {
  /** SparrowDesk domain, e.g. "your-workspace.sparrowdesk.com" */
  domain: string
  /** SparrowDesk widget token */
  token: string

  /** Optional tags (e.g. user identifiers) for the current session. */
  tags?: string[]

  /**
   * Contact fields to set during init (expects internal_name keys).
   * Invalid internal_names / invalid values are skipped by the widget itself.
   */
  contactFields?: Record<string, unknown>

  /**
   * Conversation fields to set during init (expects internal_name keys).
   * Invalid internal_names / invalid values are skipped by the widget itself.
   */
  conversationFields?: Record<string, unknown>

  /** Called once the widget API is available on `window.sparrowDesk`. */
  onReady?: (api: SparrowDeskApi) => void
  /** Called when the widget opens (registered via `window.sparrowDesk.onOpen`). */
  onOpen?: () => void
  /** Called when the widget closes (registered via `window.sparrowDesk.onClose`). */
  onClose?: () => void

  /** If true, calls `window.sparrowDesk.openWidget()` once when ready. */
  openOnInit?: boolean
  /** If true, calls `window.sparrowDesk.hideWidget()` once when ready. */
  hideOnInit?: boolean

  /**
   * Controls whether this component should set globals and inject the widget script.
   * Set to `false` if SparrowDesk is loaded elsewhere and you only want to apply
   * fields/tags + register callbacks.
   */
  shouldInitialize?: boolean

  /**
   * If `false`, defers injecting the widget script + waiting for the API until
   * the visitor interacts (when `initializeOnInteraction` is enabled).
   *
   * This is a performance optimization implemented at the wrapper level by delaying
   * script injection.
   */
  connectOnPageLoad?: boolean

  /**
   * When `connectOnPageLoad={false}`, if `true`, initialize the widget on the first
   * user interaction (pointer or keyboard), then remove those listeners.
   */
  initializeOnInteraction?: boolean

  /** If true, removes the injected script tag on unmount. */
  cleanupOnUnmount?: boolean

  /**
   * How long to wait (ms) for `window.sparrowDesk` to become available after init.
   * Defaults to 10s.
   */
  readyTimeoutMs?: number
}

export const Chat: FC<ChatProps> = ({
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
}) => {
  const { hasCredentials } = useSparrowDeskWidget({
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

  // This component renders nothing itself; the widget UI is injected by the loaded script.
  if (!hasCredentials) return null
  return <div data-sd-chat-widget-container="" />
}
