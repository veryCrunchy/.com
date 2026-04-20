/**
 * Payload plugin: reducer/reviver for native Date objects.
 *
 * Without this, Date instances serialised into useAsyncData / useState payloads
 * arrive on the client as plain ISO strings. With this plugin they are
 * transparently re-hydrated back into real Date instances.
 *
 * Runs before payload revival — no router or other Nuxt properties available here.
 */
export default definePayloadPlugin(() => {
  definePayloadReducer(
    'Date',
    (value: unknown) => value instanceof Date && value.toISOString(),
  )
  definePayloadReviver(
    'Date',
    (value: string) => new Date(value),
  )
})
