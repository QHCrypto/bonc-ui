import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/compile')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const bonc = await import('@/server/bonc')
        let body: { code?: string } = {}
        try {
          body = (await request.json()) as { code?: string }
        } catch {
          body = {}
        }

        const code = typeof body.code === 'string' ? body.code : ''
        let release: (() => void) | undefined
        try {
          release = bonc.acquireRunLock()
          const result = await bonc.compile(code)
          return json(result)
        } catch (err) {
          const message =
            err instanceof Error ? err.message : 'Compile failed.'
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
