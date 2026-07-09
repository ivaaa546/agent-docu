import { useState, useCallback } from 'react';

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
}

export const useChatStream = (conversationId: string, onMessageComplete?: () => void) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/conversations/${id}/messages`);
      if (res.ok) {
        const history = await res.json();
        setMessages(history);
      }
    } catch (err) {
      console.error('Error fetching messages:', err);
    }
  }, []);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isStreaming) return;

    setIsStreaming(true);
    setError(null);

    // Optimistically add user message
    const tempUserMsg: Message = {
      id: `temp_user_${Date.now()}`,
      conversation_id: conversationId,
      role: 'user',
      content,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempUserMsg]);

    try {
      const response = await fetch(`/api/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });

      if (!response.ok) {
        throw new Error('Error al enviar el mensaje');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) throw new Error('No se pudo establecer el stream de respuesta');

      let assistantMessageId = '';
      let assistantContent = '';

      // Prepare empty assistant message bubble
      const tempAssistantMsg: Message = {
        id: 'temp_assistant',
        conversation_id: conversationId,
        role: 'assistant',
        content: '',
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev.filter(m => m.id !== tempUserMsg.id), tempUserMsg, tempAssistantMsg]);

      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Mantener la última línea incompleta en el buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.assistantMsgId) {
                assistantMessageId = data.assistantMsgId;
              }
              if (data.chunk) {
                assistantContent += data.chunk;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === 'temp_assistant'
                      ? { ...m, id: assistantMessageId || m.id, content: assistantContent }
                      : m
                  )
                );
              }
              if (data.error) {
                setError(data.error);
              }
            } catch (e) {
              // Ignorar errores menores de parseo JSON parcial
            }
          }
        }
      }

      // Re-fetch final history from database to ensure sync and exact timestamps
      await fetchHistory(conversationId);
      if (onMessageComplete) onMessageComplete();

    } catch (err: any) {
      console.error('Error during message streaming:', err);
      setError(err.message || 'Error de conexión.');
      
      // Intenta recargar el historial para ver lo que se llegó a guardar (Fase 5 - T030)
      await fetchHistory(conversationId);
    } finally {
      setIsStreaming(false);
    }
  };

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    fetchHistory,
    setMessages
  };
};
