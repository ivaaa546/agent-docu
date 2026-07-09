import { FastifyInstance } from 'fastify';
import * as convService from '../services/conversations.service';
import { z } from 'zod';

const createSchema = z.object({
  title: z.string().optional(),
});

const renameSchema = z.object({
  title: z.string().min(1),
});

export const conversationsRoutes = async (fastify: FastifyInstance) => {
  fastify.post('/', async (request, reply) => {
    const body = createSchema.parse(request.body || {});
    const conv = convService.create(request.sessionId, body.title);
    return reply.code(201).send(conv);
  });

  fastify.get('/', async (request, reply) => {
    const convs = convService.list(request.sessionId);
    return reply.send(convs);
  });

  fastify.patch('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = renameSchema.parse(request.body);
    const conv = convService.rename(id, request.sessionId, body.title);
    if (!conv) return reply.code(404).send({ error: 'Conversation not found' });
    return reply.send(conv);
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const result = convService.remove(id, request.sessionId);
    return reply.send(result);
  });
};
