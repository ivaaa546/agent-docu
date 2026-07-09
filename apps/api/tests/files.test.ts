import { describe, it } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import { sessionPlugin } from '../plugins/session';
import { conversationsRoutes } from '../routes/conversations.routes';
import { filesRoutes } from '../routes/files.routes';

describe('Files API', async () => {
  const server = Fastify({ logger: true });
  await server.register(multipart);
  await server.register(sessionPlugin);
  await server.register(conversationsRoutes, { prefix: '/conversations' });
  await server.register(filesRoutes);

  let cookie = '';
  let convId = '';
  let fileId = '';

  it('should set up a conversation first', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/conversations',
      payload: { title: 'File Test Conv' }
    });
    assert.strictEqual(res.statusCode, 201);
    const json = res.json();
    convId = json.id;

    let setCookie = res.headers['set-cookie'];
    if (typeof setCookie === 'string') setCookie = [setCookie];
    assert.ok(setCookie && setCookie.length > 0);
    cookie = setCookie[0].split(';')[0];
  });

  it('should upload a markdown file to conversation', async () => {
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const payload = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="test.md"',
      'Content-Type: text/markdown',
      '',
      '# Documento de Prueba\nContenido de prueba.',
      `--${boundary}--`,
      ''
    ].join('\r\n');

    const res = await server.inject({
      method: 'POST',
      url: `/conversations/${convId}/files`,
      headers: {
        cookie,
        'content-type': `multipart/form-data; boundary=${boundary}`
      },
      payload
    });

    assert.strictEqual(res.statusCode, 201);
    const json = res.json();
    assert.strictEqual(json.length, 1);
    assert.strictEqual(json[0].filename, 'test.md');
    assert.strictEqual(json[0].raw_content, '# Documento de Prueba\nContenido de prueba.');
    fileId = json[0].id;
  });

  it('should list files of the conversation', async () => {
    const res = await server.inject({
      method: 'GET',
      url: `/conversations/${convId}/files`,
      headers: { cookie }
    });

    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    assert.strictEqual(json.length, 1);
    assert.strictEqual(json[0].id, fileId);
  });

  it('should delete file', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/files/${fileId}`,
      headers: { cookie }
    });

    assert.strictEqual(res.statusCode, 200);

    const resList = await server.inject({
      method: 'GET',
      url: `/conversations/${convId}/files`,
      headers: { cookie }
    });
    assert.strictEqual(resList.json().length, 0);
  });
});
