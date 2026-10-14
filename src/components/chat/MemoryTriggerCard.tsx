import React, { useState } from 'react';
import { MemoryData } from '../../utils/hooks/useMemoryTrigger';
import styles from './MessageAuxArea.module.css';

interface Props {
  memoryData: MemoryData;
}

export const MemoryTriggerCard: React.FC<Props> = ({ memoryData }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={styles.memoryCard} onClick={() => setExpanded(!expanded)}>
      <div className={styles.memoryHeader}>
        <span className={styles.icon}>💡</span>
        <span className={styles.title}>
          关于{memoryData.keyword ? `「${memoryData.keyword}」` : ''}的回忆：{memoryData.title}
          {expanded ? '' : '（点击查看）'}
        </span>
      </div>
      {expanded && (
        <div className={styles.memoryBody}>
          <div className={styles.detailTitle}>{memoryData.title}</div>
          <div className={styles.detailSummary}>{memoryData.summary}</div>
        </div>
      )}
    </div>
  );
};
