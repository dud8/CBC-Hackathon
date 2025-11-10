function TextInput({ value, onChange, disabled }) {
  return (
    <div className="mb-6">
      <label htmlFor="text-input" className="bp-label">
        Text Input
      </label>
      <textarea
        id="text-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste client notes, email chains, discovery call transcripts, or type directly here... Supports Markdown formatting."
        className="bp-textarea h-64 font-mono text-sm"
      />
    </div>
  )
}

export default TextInput
