import { useRef, useState } from 'react'

function FileUpload({ files, onChange, disabled, currentTokenCount, maxTokens, onCheckTokens }) {
  const fileInputRef = useRef(null)
  const [tokenWarning, setTokenWarning] = useState(null)
  const [checking, setChecking] = useState(false)

  const handleFileChange = async (e) => {
    const newFiles = Array.from(e.target.files)
    await checkAndAddFiles(newFiles)
    e.target.value = '' // reset value so identical re-uploads trigger change
  }

  const handleDrop = async (e) => {
    e.preventDefault()
    if (disabled) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    await checkAndAddFiles(droppedFiles)
  }

  const checkAndAddFiles = async (newFiles) => {
    setTokenWarning(null)

    if (onCheckTokens) {
      setChecking(true)
      const allFiles = [...files, ...newFiles]
      const estimatedTokens = await onCheckTokens(allFiles)
      setChecking(false)

      if (estimatedTokens > maxTokens) {
        setTokenWarning(`Cannot add ${newFiles.length} file(s). This would result in ${estimatedTokens.toLocaleString()} tokens, exceeding the limit of ${maxTokens.toLocaleString()}.`)
        return
      }
    }

    onChange([...files, ...newFiles])
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index)
    onChange(newFiles)
    setTokenWarning(null) // Clear warning when removing files
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase()
    const icons = {
      'pdf': '📄',
      'docx': '📝',
      'doc': '📝',
      'txt': '📄',
      'md': '📄',
      'xlsx': '📊',
      'xls': '📊',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'png': '🖼️',
      'gif': '🖼️'
    }
    return icons[ext] || '📎'
  }

  return (
    <div className="mb-6">
      <label className="bp-label">
        File Uploads
      </label>

      {/* Token Warning */}
      {tokenWarning && (
        <div className="mb-3 bp-alert-warn">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-500" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">{tokenWarning}</p>
            </div>
          </div>
        </div>
      )}

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !disabled && !checking && fileInputRef.current?.click()}
        className={`bp-dropzone ${disabled || checking ? 'bp-dropzone-disabled' : 'bp-dropzone-active'}`}
      >
        <div className="text-4xl mb-2">{checking ? '⏳' : '📁'}</div>
        <p className="text-slate-100 font-medium mb-1">
          {checking ? 'Checking token count...' : 'Drop files here or click to browse'}
        </p>
        <p className="text-sm text-slate-400">
          Supports: Images (JPG, PNG), Documents (PDF, DOCX, TXT, MD), Spreadsheets (XLSX)
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        onChange={handleFileChange}
        disabled={disabled}
        accept=".jpg,.jpeg,.png,.pdf,.docx,.txt,.md,.xlsx"
        className="hidden"
      />

      {/* File List */}
      {files.length > 0 && (
        <div className="mt-4 space-y-2">
          <h3 className="text-sm font-medium text-slate-200">Uploaded Files ({files.length})</h3>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bp-card p-4"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-2xl">{getFileIcon(file.name)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-100 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-slate-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  removeFile(index)
                }}
                disabled={disabled}
                type="button"
                className="ml-4 text-sm font-medium text-red-300 hover:text-red-200 disabled:text-slate-500"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default FileUpload
