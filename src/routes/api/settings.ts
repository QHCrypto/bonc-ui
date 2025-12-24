import type { Settings } from '@/server/bonc'
import { createFileRoute } from '@tanstack/react-router'
import { json } from '@tanstack/react-start'

export const Route = createFileRoute('/api/settings')({
  server: {
    handlers: {
      GET: async () => {
        const bonc = await import('@/server/bonc')
        const settings = await bonc.getSettings()
        return json(settings)
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
          return json(next)
        } catch (err) {
          if (err instanceof bonc.BadRequestError) {
            return json({ error: err.message }, { status: 400 })
          }
          return json({ error: 'Failed to save settings.' }, { status: 500 })
        }
      },
    },
  },
})
