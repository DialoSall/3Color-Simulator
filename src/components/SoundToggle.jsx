function SoundToggle({ soundEnabled, onSoundEnabledChange, onPreviewSound }) {
  function handleClick() {
    const nextSoundEnabled = !soundEnabled;

    onSoundEnabledChange(nextSoundEnabled);

    if (nextSoundEnabled) {
      onPreviewSound?.();
    }
  }

  return (
    <button
      type="button"
      className={`soundToggle ${soundEnabled ? "enabled" : "muted"}`}
      onClick={handleClick}
      aria-pressed={soundEnabled}
      aria-label={soundEnabled ? "Mute sound" : "Turn on sound"}
      title={soundEnabled ? "Sound on" : "Sound muted"}
    >
      <span className="soundToggleIcon" aria-hidden="true">
        {soundEnabled ? "♪" : "×"}
      </span>

      <span className="soundToggleText">
        {soundEnabled ? "Sound" : "Muted"}
      </span>
    </button>
  );
}

export default SoundToggle;