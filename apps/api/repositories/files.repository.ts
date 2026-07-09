import { db } from '../lib/db';

export interface FileRecord {
  id: string;
  conversation_id: string;
  filename: string;
  raw_content: string | null;
  is_chunked: number;
  created_at: string;
}

export const createFile = (
  id: string,
  conversationId: string,
  filename: string,
  rawContent: string | null,
  isChunked = 0
): FileRecord => {
  const stmt = db.prepare(
    'INSERT INTO files (id, conversation_id, filename, raw_content, is_chunked) VALUES (?, ?, ?, ?, ?)'
  );
  stmt.run(id, conversationId, filename, rawContent, isChunked);
  return getFile(id)!;
};

export const getFile = (id: string): FileRecord | undefined => {
  const stmt = db.prepare('SELECT * FROM files WHERE id = ?');
  return stmt.get(id) as FileRecord | undefined;
};

export const listFilesByConversation = (conversationId: string): FileRecord[] => {
  const stmt = db.prepare('SELECT * FROM files WHERE conversation_id = ? ORDER BY created_at DESC');
  return stmt.all(conversationId) as FileRecord[];
};

export const deleteFile = (id: string) => {
  const stmt = db.prepare('DELETE FROM files WHERE id = ?');
  stmt.run(id);
};
