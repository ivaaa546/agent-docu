import { db } from '../lib/db';

const test = () => {
  try {
    const cid = 'conv_123';
    db.prepare(`INSERT INTO conversations (id, session_id, title) VALUES (?, ?, ?)`).run(cid, 'session_1', 'Test Conv');
    db.prepare(`INSERT INTO messages (id, conversation_id, role, content) VALUES (?, ?, ?, ?)`).run('msg_1', cid, 'user', 'Hello');
    db.prepare(`INSERT INTO files (id, conversation_id, filename) VALUES (?, ?, ?)`).run('file_1', cid, 'test.md');
    db.prepare(`INSERT INTO file_chunks (id, file_id, chunk_index, content) VALUES (?, ?, ?, ?)`).run('chunk_1', 'file_1', 0, 'Hello World');
    
    // Test vec0 embedding
    const embedding = new Float32Array(768).fill(0.1);
    db.prepare(`INSERT INTO file_chunk_embeddings (chunk_id, embedding) VALUES (?, ?)`).run('chunk_1', embedding);

    // Read back
    const conv = db.prepare(`SELECT * FROM conversations WHERE id = ?`).get(cid);
    console.log('✅ Read conversation:', conv);

    // Delete cascade test
    db.prepare(`DELETE FROM conversations WHERE id = ?`).run(cid);
    const msgs = db.prepare(`SELECT count(*) as count FROM messages WHERE conversation_id = ?`).get(cid) as { count: number };
    if (msgs.count !== 0) throw new Error('Cascade delete failed');
    
    console.log('✅ Smoke test passed!');
  } catch (err) {
    console.error('❌ Smoke test failed:', err);
    process.exit(1);
  }
};

test();
