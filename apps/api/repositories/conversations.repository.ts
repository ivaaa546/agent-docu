import { db } from '../lib/db';

export interface Conversation {
  id: string;
  session_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export const createConversation = (id: string, session_id: string, title: string) => {
  const stmt = db.prepare('INSERT INTO conversations (id, session_id, title) VALUES (?, ?, ?)');
  stmt.run(id, session_id, title);
  return getConversation(id, session_id);
};

export const getConversation = (id: string, session_id: string): Conversation | undefined => {
  const stmt = db.prepare('SELECT * FROM conversations WHERE id = ? AND session_id = ?');
  return stmt.get(id, session_id) as Conversation | undefined;
};

export const listConversations = (session_id: string): Conversation[] => {
  const stmt = db.prepare('SELECT * FROM conversations WHERE session_id = ? ORDER BY updated_at DESC');
  return stmt.all(session_id) as Conversation[];
};

export const updateConversationTitle = (id: string, session_id: string, title: string) => {
  const stmt = db.prepare('UPDATE conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND session_id = ?');
  stmt.run(title, id, session_id);
  return getConversation(id, session_id);
};

export const deleteConversation = (id: string, session_id: string) => {
  const stmt = db.prepare('DELETE FROM conversations WHERE id = ? AND session_id = ?');
  stmt.run(id, session_id);
};
