import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { sessionPlugin } from './plugins/session';
import { conversationsRoutes } from './routes/conversations.routes';
import { filesRoutes } from './routes/files.routes';
import { chatRoutes } from './routes/chat.routes';

const server = Fastify({
  logger: {
    level: 'warn'
  }
});

server.register(multipart, {
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});
server.register(sessionPlugin);
server.register(conversationsRoutes, { prefix: '/conversations' });
server.register(filesRoutes);
server.register(chatRoutes);

server.get('/health', async (request, reply) => {
  return { status: 'ok' };
});

// Manejo global de errores consistente (Fase 9 - T046)
server.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  if (error.validation) {
    return reply.code(400).send({ error: 'Datos de entrada inválidos', details: error.validation });
  }
  const statusCode = error.statusCode || 500;
  return reply.code(statusCode).send({
    error: error.message || 'Error interno del servidor',
  });
});

const start = async () => {
  try {
    const port = process.env.PORT ? parseInt(process.env.PORT) : 3001;
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on port ${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
