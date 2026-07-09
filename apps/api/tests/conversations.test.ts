import { describe, it } from 'node:test';
import assert from 'node:assert';
import Fastify from 'fastify';
import { sessionPlugin } from '../plugins/session';
import { conversationsRoutes } from '../routes/conversations.routes';

describe('Conversations API', async () => {
  const server = Fastify();
  await server.register(sessionPlugin);
  await server.register(conversationsRoutes, { prefix: '/conversations' });

  let cookie = '';
  let convId = '';

  it('should create a new conversation and return cookie', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/conversations',
      payload: { title: 'Test API Conv' }
    });
    
    assert.strictEqual(res.statusCode, 201);
    const json = res.json();
    assert.strictEqual(json.title, 'Test API Conv');
    assert.ok(json.id);
    convId = json.id;

    // Fastify-cookie sets the 'set-cookie' header
    let setCookie = res.headers['set-cookie'];
    if (typeof setCookie === 'string') setCookie = [setCookie];
    assert.ok(setCookie && setCookie.length > 0);
    cookie = setCookie[0].split(';')[0]; // simple parsing for the next requests
    console.log('Got cookie:', cookie);
  });

  it('should list conversations for the session', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/conversations',
      headers: { cookie }
    });

    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    assert.strictEqual(json.length, 1);
    assert.strictEqual(json[0].id, convId);
  });

  it('should rename a conversation', async () => {
    const res = await server.inject({
      method: 'PATCH',
      url: `/conversations/${convId}`,
      headers: { cookie },
      payload: { title: 'Renamed Conv' }
    });

    assert.strictEqual(res.statusCode, 200);
    const json = res.json();
    assert.strictEqual(json.title, 'Renamed Conv');
  });

  it('should delete a conversation', async () => {
    const res = await server.inject({
      method: 'DELETE',
      url: `/conversations/${convId}`,
      headers: { cookie }
    });

    assert.strictEqual(res.statusCode, 200);
    
    // Verify it is deleted
    const resList = await server.inject({
      method: 'GET',
      url: '/conversations',
      headers: { cookie }
    });
    assert.strictEqual(resList.json().length, 0);
  });
});
