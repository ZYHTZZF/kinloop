import React, { useEffect, useRef, useState } from 'react'
import styles from './ChatInput.module.css'
import {
  cancelVoiceRecording,
  startVoiceRecording,
  stopVoiceRecording,
  type VoiceRecordingSession,
} from '../../utils/chatVoice'
import { ensureMicrophoneCapturePermission } from '../../platform/permissions'

interface ChatInputProps {
  onSendMessage: (text: string) => void
  onSendVoice?: (blob: Blob, durationMs: number) => void
  onSendImage?: (file: File) => void
  isFamilyStyle?: boolean
  presetMessages?: string[]
  disabled?: boolean
}

const ChatInput: React.FC<ChatInputProps> = ({
  onSendMessage,
  onSendVoice,
  onSendImage,
  isFamilyStyle = false,
  presetMessages = [],
  disabled = false,
}) => {
  const [message, setMessage] = useState('')
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [voiceDuration, setVoiceDuration] = useState(0)
  const recordingSessionRef = useRef<VoiceRecordingSession | null>(null)
  const recordingStartTimeRef = useRef<number>(0)
  const recordingTimerRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      clearRecordingTimer()
      if (recordingSessionRef.current) {
        cancelVoiceRecording(recordingSessionRef.current)
        recordingSessionRef.current = null
      }
    }
  }, [])

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
  }

  const handleSendMessage = () => {
    if (message.trim()) {
      onSendMessage(message.trim())
      setMessage('')

      if (document.activeElement instanceof HTMLTextAreaElement) {
        const textarea = document.activeElement as HTMLTextAreaElement
        textarea.style.height = 'auto'
      }
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleTextChange(e)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`
  }

  const handleStartVoiceRecording = async () => {
    if (disabled || isVoiceRecording) return

    const allowed = await ensureMicrophoneCapturePermission()
    if (!allowed) {
      console.error('Microphone permission is not available')
      return
    }

    try {
      const session = await startVoiceRecording()
      recordingSessionRef.current = session
      recordingStartTimeRef.current = session.startedAt

      setIsVoiceRecording(true)
      setVoiceDuration(0)
      clearRecordingTimer()
      recordingTimerRef.current = window.setInterval(() => {
        setVoiceDuration(Date.now() - recordingStartTimeRef.current)
      }, 100)
    } catch (error) {
      console.error('Failed to start voice recording:', error)
    }
  }

  const handleStopVoiceRecording = async () => {
    if (!recordingSessionRef.current || !isVoiceRecording) return

    const session = recordingSessionRef.current
    recordingSessionRef.current = null
    clearRecordingTimer()

    try {
      const { blob, durationMs } = await stopVoiceRecording(session)
      setIsVoiceRecording(false)
      setVoiceDuration(0)

      if (onSendVoice) {
        onSendVoice(blob, durationMs)
      }
    } catch (error) {
      console.error('Failed to stop voice recording:', error)
      setIsVoiceRecording(false)
      setVoiceDuration(0)
    }
  }

  const handleCancelVoiceRecording = () => {
    if (!recordingSessionRef.current || !isVoiceRecording) return

    cancelVoiceRecording(recordingSessionRef.current)
    recordingSessionRef.current = null
    clearRecordingTimer()
    setIsVoiceRecording(false)
    setVoiceDuration(0)
  }

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onSendImage) {
      onSendImage(file)
    }
  }

  const handlePresetMessageClick = (msg: string) => {
    onSendMessage(msg)
  }

  const formatRecordingTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
  }

  const clearRecordingTimer = () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = 0
    }
  }

  const bindHoldToRecord = {
    onMouseDown: () => void handleStartVoiceRecording(),
    onMouseUp: () => void handleStopVoiceRecording(),
    onMouseLeave: handleCancelVoiceRecording,
    onTouchStart: () => void handleStartVoiceRecording(),
    onTouchEnd: () => void handleStopVoiceRecording(),
    onTouchCancel: handleCancelVoiceRecording,
  }

  const containerClasses = [
    styles.container,
    isFamilyStyle ? styles.familyStyle : styles.normalStyle,
    disabled ? styles.disabled : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (isFamilyStyle && presetMessages.length > 0) {
    return (
      <div className={containerClasses}>
        {presetMessages.length > 0 && (
          <div className={styles.presetMessages}>
            {presetMessages.map((msg) => (
              <button
                key={msg}
                className={styles.presetButton}
                onClick={() => handlePresetMessageClick(msg)}
                disabled={disabled}
              >
                {msg}
              </button>
            ))}
          </div>
        )}

        <div className={styles.inputRow}>
          <div className={styles.voiceButtonLarge}>
            <button
              className={`${styles.voiceButton} ${isVoiceRecording ? styles.recording : ''}`}
              {...bindHoldToRecord}
              disabled={disabled}
            >
              🔊 {isVoiceRecording ? formatRecordingTime(voiceDuration) : '按住说话'}
            </button>
          </div>

          <textarea
            value={message}
            onChange={handleTextareaChange}
            onKeyPress={handleKeyPress}
            className={styles.textarea}
            placeholder="输入消息..."
            disabled={disabled}
            rows={1}
          />

          <button
            onClick={handleSendMessage}
            className={styles.sendButton}
            disabled={disabled || !message.trim()}
          >
            发送
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={containerClasses}>
      <div className={styles.toolbarRow}>
        <button
          className={styles.toolButton}
          onClick={() => fileInputRef.current?.click()}
          title="发送图片"
          disabled={disabled}
        >
          🖼️
        </button>

        <button
          className={`${styles.toolButton} ${isVoiceRecording ? styles.recording : ''}`}
          title="按住说话"
          {...bindHoldToRecord}
          disabled={disabled}
        >
          🔊
        </button>

        <button className={styles.toolButton} title="更多选项" disabled={disabled}>
          😊
        </button>
      </div>

      <div className={styles.inputRow}>
        <textarea
          value={message}
          onChange={handleTextareaChange}
          onKeyPress={handleKeyPress}
          className={styles.textarea}
          placeholder="输入消息..."
          disabled={disabled || isVoiceRecording}
          rows={1}
        />

        <button
          onClick={handleSendMessage}
          className={styles.sendButton}
          disabled={disabled || !message.trim() || isVoiceRecording}
        >
          {isVoiceRecording ? formatRecordingTime(voiceDuration) : '发送'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageSelect}
        style={{ display: 'none' }}
      />
    </div>
  )
}

export default ChatInput
