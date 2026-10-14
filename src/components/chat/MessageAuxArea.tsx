import React from 'react';
import { Message } from '../../services/api/types';
import { useMemoryTrigger } from '../../utils/hooks/useMemoryTrigger';
import { MemoryTriggerCard } from './MemoryTriggerCard';
import styles from './MessageAuxArea.module.css';

interface MessageAuxAreaProps {
  message: Message;
  isMine: boolean;
}

export const MessageAuxArea: React.FC<MessageAuxAreaProps> = ({ message, isMine }) => {
  // 仅演示文本触发，如果是语音的话会按实际需求解析后触发
  const { memoryData, loading } = useMemoryTrigger(message);

  // 如果没有匹配的回忆数据，暂不渲染任何内容
  if (!memoryData && !loading) {
    return null;
  }

  return (
    <div className={`${styles.auxContainer} ${isMine ? styles.isMine : styles.isOther}`}>
      {memoryData && <MemoryTriggerCard memoryData={memoryData} />}
      {/* 未来长消息摘要、解释等可以在这里按需注入 */}
      {loading && <div className={styles.loadingTip}>正在检索相关回忆...</div>}
    </div>
  );
};
