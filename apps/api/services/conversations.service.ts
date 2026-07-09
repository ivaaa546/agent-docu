import { randomUUID } from 'crypto';
import * as repo from '../repositories/conversations.repository';

export const create = (sessionId: string, title?: string) => {
  const id = `conv_${randomUUID()}`;
  const finalTitle = title || 'Nueva Conversación';
  return repo.createConversation(id, sessionId, finalTitle);
};

export const list = (sessionId: string) => {
  return repo.listConversations(sessionId);
};

export const rename = (id: string, sessionId: string, title: string) => {
  return repo.updateConversationTitle(id, sessionId, title);
};

export const remove = (id: string, sessionId: string) => {
  repo.deleteConversation(id, sessionId);
  return { success: true };
};
