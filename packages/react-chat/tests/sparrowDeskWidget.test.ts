import { afterEach, beforeEach, expect, test } from 'vitest'
import {
  WIDGET_SCRIPT_SELECTOR,
  acquireWidgetScript,
  removeOtherWidgetScripts,
} from '../src/internal/sparrowDeskWidget'

// Unique src per scenario keeps the module-level refcount map from leaking between tests.
const SRC_A = 'https://example.test/widget-a.js'
const SRC_B = 'https://example.test/widget-b.js'

function widgetScripts() {
  return Array.from(document.querySelectorAll<HTMLScriptElement>(WIDGET_SCRIPT_SELECTOR))
}

beforeEach(() => {
  widgetScripts().forEach((el) => el.remove())
})

afterEach(() => {
  widgetScripts().forEach((el) => el.remove())
})

test('acquireWidgetScript injects a single async, tagged script', () => {
  const handle = acquireWidgetScript(SRC_A, true)

  const scripts = widgetScripts()
  expect(scripts).toHaveLength(1)
  const script = scripts[0]!
  expect(script.src).toBe(SRC_A)
  expect(script.async).toBe(true)
  expect(script.dataset['sdChatWidget']).toBe('true')

  handle.release()
})

test('concurrent acquirers share one script via reference counting', () => {
  const first = acquireWidgetScript(SRC_A, false)
  const second = acquireWidgetScript(SRC_A, false)

  // Only one element exists despite two acquirers.
  expect(widgetScripts()).toHaveLength(1)

  // First release decrements but must not remove while a holder remains.
  first.release()
  expect(widgetScripts()).toHaveLength(1)

  // Last release with cleanupOnUnmount=false leaves the script on the page...
  second.release()
  expect(widgetScripts()).toHaveLength(1)

  // ...but the map entry is gone, so the next acquire reuses the existing tag.
  const third = acquireWidgetScript(SRC_A, true)
  expect(widgetScripts()).toHaveLength(1)
  // cleanupOnUnmount=true now means the final release removes it.
  third.release()
  expect(widgetScripts()).toHaveLength(0)
})

test('cleanupOnUnmount preference belongs to the last releaser, not a global ratchet', () => {
  const keeper = acquireWidgetScript(SRC_A, false)
  const remover = acquireWidgetScript(SRC_A, true)

  // The acquirer that wants cleanup releases first; a holder remains, so nothing is removed.
  remover.release()
  expect(widgetScripts()).toHaveLength(1)

  // The last releaser opted out of cleanup, so the script stays.
  keeper.release()
  expect(widgetScripts()).toHaveLength(1)
})

test('removeOtherWidgetScripts drops stale wrapper scripts with a different src', () => {
  const stale = acquireWidgetScript(SRC_B, false)
  expect(widgetScripts()).toHaveLength(1)

  removeOtherWidgetScripts(SRC_A)

  // The mismatched script is gone; acquiring the kept src adds exactly one.
  expect(widgetScripts()).toHaveLength(0)
  const keep = acquireWidgetScript(SRC_A, true)
  removeOtherWidgetScripts(SRC_A)
  expect(widgetScripts()).toHaveLength(1)

  keep.release()
  stale.release()
})
