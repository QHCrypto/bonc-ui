import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/stream')({
  server: {
    handlers: {
      GET: async () => {
        const bonc = await import('@/server/bonc')
        const encoder = new TextEncoder()
        let removeClient: (() => void) | null = null
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            const send = (payload: string) => {
              controller.enqueue(encoder.encode(payload))
            }
            removeClient = bonc.addStreamClient(send)
            send(
              'event: notice\ndata: {"level":"info","message":"Stream connected."}\n\n',
            )
          },
          cancel() {
            if (removeClient) {
              removeClient()
              removeClient = null
            }
          },
        })
        return new Response(stream, {
          headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
          },
        })
      },
    },
  },
})
