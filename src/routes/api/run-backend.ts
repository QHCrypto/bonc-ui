import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

type BackendPayload = {
  backend?: string
  jsonPath?: string
  options?: Record<string, unknown>
}

export const Route = createFileRoute('/api/run-backend')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const bonc = await import('@/server/bonc')
        let body: BackendPayload = {}
        try {
          body = (await request.json()) as BackendPayload
        } catch {
          body = {}
        }

        const backend = typeof body.backend === 'string' ? body.backend : ''
        const jsonPath = typeof body.jsonPath === 'string' ? body.jsonPath : ''
        const options =
          typeof body.options === 'object' && body.options
            ? body.options
            : {}

        if (!backend) {
          return json({ error: 'Backend is required.' }, { status: 400 })
        }
        if (!jsonPath) {
          return json({ error: 'JSON path is required.' }, { status: 400 })
        }

        let release: (() => void) | undefined
        try {
          release = bonc.acquireRunLock()
          await bonc.runBackend(backend as 'nm' | 'sat' | 'dp', jsonPath, options)
          return json({ ok: true })
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Backend run failed.'
          if (err instanceof bonc.RunInProgressError) {
            return json({ error: message }, { status: 409 })
          }
          if (err instanceof bonc.BadRequestError) {
            return json({ error: message }, { status: 400 })
          }
          bonc.sendNotice('error', message)
          return json({ error: message }, { status: 500 })
        } finally {
          if (release) {
            release()
          }
        }
      },
    },
  },
})
