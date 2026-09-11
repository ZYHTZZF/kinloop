type GlobalVoiceButtonProps = {
  label: string
}

export function GlobalVoiceButton({ label }: GlobalVoiceButtonProps) {
  return (
    <button className="global-voice-button" type="button" aria-label={label}>
      <span className="global-voice-button__mic">🎤</span>
      <span>{label}</span>
    </button>
  )
}
