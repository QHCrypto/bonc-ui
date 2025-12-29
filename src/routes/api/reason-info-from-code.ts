import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/reason-info-from-code')({
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
        if (!code.trim()) {
          return json({ error: 'Code is required.' }, { status: 400 })
        }

        try {
          const result = await bonc.reasonInfoFromCode(code)
          return json(result)
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : 'Failed to extract information from code.'
          return json({ error: message }, { status: 500 })
        }
      }
    }
  }
})
