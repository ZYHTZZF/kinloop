import React, { useState, useRef } from 'react'
import styles from './ChatInput.module.css'

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
  disabled = false
}) => {
  const [message, setMessage] = useState('')
  const [isVoiceRecording, setIsVoiceRecording] = useState(false)
  const [voiceDuration, setVoiceDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const recordingStartTimeRef = useRef<number>(0)
  const recordingTimerRef = useRef<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 处理文本输入
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value)
  }

  // 处理发送消息
  const handleSendMessage = () => {
    if (message.trim()) {
      onSendMessage(message.trim())
      setMessage('')

      // 重置高度
      if (document.activeElement instanceof HTMLTextAreaElement) {
        const textarea = document.activeElement as HTMLTextAreaElement
        textarea.style.height = 'auto'
      }
    }
  }

  // 处理按 Enter 键发送
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // 自动调整 textarea 高度
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    handleTextChange(e)
    e.target.style.height = 'auto'
    e.target.style.height = `${Math.min(e.target.scrollHeight, 100)}px`
  }

  // 开始语音录制
  const handleStartVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream)

      mediaRecorder.ondataavailable = (e) => {
        audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
      }

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []
      recordingStartTimeRef.current = Date.now()

      mediaRecorder.start()
      setIsVoiceRecording(true)

      // 更新录制时长
      recordingTimerRef.current = window.setInterval(() => {
        const duration = Date.now() - recordingStartTimeRef.current
        setVoiceDuration(duration)
      }, 100)
    } catch (error) {
      console.error('Failed to start voice recording:', error)
    }
  }

  // 停止语音录制
  const handleStopVoiceRecording = () => {
    if (mediaRecorderRef.current && isVoiceRecording) {
      mediaRecorderRef.current.stop()
      clearInterval(recordingTimerRef.current)

      const blob = new Blob(audioChunksRef.current, { type: 'audio/mp3' })
      const duration = Date.now() - recordingStartTimeRef.current

      setIsVoiceRecording(false)
      setVoiceDuration(0)

      if (onSendVoice) {
        onSendVoice(blob, duration)
      }
    }
  }

  // 取消语音录制
  const handleCancelVoiceRecording = () => {
    if (mediaRecorderRef.current && isVoiceRecording) {
      mediaRecorderRef.current.stop()
      clearInterval(recordingTimerRef.current)
      setIsVoiceRecording(false)
      setVoiceDuration(0)
    }
  }

  // 处理图片选择
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && onSendImage) {
      onSendImage(file)
    }
  }

  // 处理预设消息点击
  const handlePresetMessageClick = (msg: string) => {
    onSendMessage(msg)
  }

  const formatRecordingTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000)
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(
      seconds % 60
    ).padStart(2, '0')}`
  }

  const containerClasses = [
    styles.container,
    isFamilyStyle ? styles.familyStyle : styles.normalStyle,
    disabled ? styles.disabled : ''
  ]
    .filter(Boolean)
    .join(' ')

  // 老人端：显示语音按钮和预设消息
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
              className={`${styles.voiceButton} ${
                isVoiceRecording ? styles.recording : ''
              }`}
              onMouseDown={handleStartVoiceRecording}
              onMouseUp={handleStopVoiceRecording}
              onMouseLeave={handleCancelVoiceRecording}
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

  // 子女端：标准输入框
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
          onMouseDown={handleStartVoiceRecording}
          onMouseUp={handleStopVoiceRecording}
          onMouseLeave={handleCancelVoiceRecording}
          title="按住说话"
          disabled={disabled}
        >
          🔊
        </button>

        <button
          className={styles.toolButton}
          title="更多选项"
          disabled={disabled}
        >
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
