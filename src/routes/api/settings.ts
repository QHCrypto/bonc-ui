import { createFileRoute } from '@tanstack/react-router'
import type { Settings } from '@/server/bonc'

export const Route = createFileRoute('/api/settings')({
  server: {
    handlers: {
      GET: async () => {
        const bonc = await import('@/server/bonc')
        const settings = await bonc.getSettings()
        return Response.json(settings)
      },
      POST: async ({ request }) => {
        const bonc = await import('@/server/bonc')
        let body: unknown = {}
        try {
          body = await request.json()
        } catch {
          body = {}
        }
        try {
          const next = await bonc.saveSettings(body as Settings)
          return Response.json(next)
        } catch (err) {
          if (err instanceof bonc.BadRequestError) {
            return Response.json({ error: err.message }, { status: 400 })
          }
          return Response.json({ error: 'Failed to save settings.' }, { status: 500 })
        }
      },
    },
  },
})
