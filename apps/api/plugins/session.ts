import fp from 'fastify-plugin';
import cookie from '@fastify/cookie';
import { randomUUID } from 'crypto';
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    sessionId: string;
  }
}

export const sessionPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.register(cookie, {
    secret: process.env.SESSION_SECRET || 'supersecret-minimum-32-characters-for-cookie-signature',
  });

  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    let sessionId = request.cookies.session_id;
    if (!sessionId) {
      sessionId = `sess_${randomUUID()}`;
      reply.setCookie('session_id', sessionId, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    }
    console.log('Session ID:', sessionId, 'Cookie header:', request.headers.cookie);
    request.sessionId = sessionId;
  });
});
