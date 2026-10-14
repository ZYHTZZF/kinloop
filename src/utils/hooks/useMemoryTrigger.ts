import { useState, useEffect, useRef } from 'react';
import { Message } from '../../services/api/types';

export interface MemoryData {
  id: string;
  title: string;
  summary: string;
  date: string;
  keyword?: string;
}

export function useMemoryTrigger(message: Message) {
  const [memoryData, setMemoryData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(false);
  const checked = useRef(false);

  useEffect(() => {
    // 只有文本消息才去触发回忆分析
    if (message.messageType !== 'Text' || !message.textContent || checked.current) {
      return;
    }

    checked.current = true; // 每条消息只检查一次

    const checkMemory = async () => {
      setLoading(true);
      try {
        const res = await fetch('/api/memories/trigger', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messageId: message.id,
            text: message.textContent,
            userId: message.senderMemberId,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          if (data.triggered && data.memory) {
            setMemoryData(data.memory);
          }
        }
      } catch (err) {
        console.error('Failed to trigger memory:', err);
      } finally {
        setLoading(false);
      }
    };

    checkMemory();
  }, [message.id, message.messageType, message.textContent, message.senderMemberId]);

  return { memoryData, loading };
}
