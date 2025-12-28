import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/sbox-info')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const bonc = await import('@/server/bonc')
        try {
          const body: { path: string } = await request.json()
          const sboxInfo = await bonc.readSBoxInfo(body.path)
          return Response.json(sboxInfo)
        } catch (err) {
          if (err instanceof bonc.BadRequestError) {
            return Response.json({ error: err.message }, { status: 400 })
          }
          return Response.json(
            { error: 'Failed to get S-Box info.' },
            { status: 500 },
          )
        }
      },
    },
  },
})
