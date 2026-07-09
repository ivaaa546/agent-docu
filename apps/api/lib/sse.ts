import { PassThrough } from 'stream';
import { FastifyReply } from 'fastify';

export class SSEStream {
  private stream: PassThrough;

  constructor(reply: FastifyReply) {
    this.stream = new PassThrough();
    
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    this.stream.pipe(reply.raw);

    // Evitar fugas de memoria ante desconexiones
    reply.raw.on('close', () => {
      this.stream.unpipe(reply.raw);
      this.stream.destroy();
    });
  }

  send(data: any, event?: string) {
    if (event) {
      this.stream.write(`event: ${event}\n`);
    }
    this.stream.write(`data: ${JSON.stringify(data)}\n\n`);
  }

  close() {
    this.stream.end();
  }

  writeRaw(chunk: string) {
    this.stream.write(chunk);
  }
}
