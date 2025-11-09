function TextInput({ value, onChange, disabled }) {
  return (
    <div className="mb-6">
      <label htmlFor="text-input" className="block text-sm font-medium text-gray-700 mb-2">
        Text Input
      </label>
      <textarea
        id="text-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="Paste client notes, email chains, discovery call transcripts, or type directly here... Supports Markdown formatting."
        className="w-full h-64 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bluepeak-blue focus:border-transparent resize-y disabled:bg-gray-100 disabled:cursor-not-allowed font-mono text-sm"
      />
    </div>
  )
}

export default TextInput
