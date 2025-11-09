import { useRef } from 'react'

function FileUpload({ files, onChange, disabled }) {
  const fileInputRef = useRef(null)

  const handleFileChange = (e) => {
    const newFiles = Array.from(e.target.files)
    onChange([...files, ...newFiles])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    if (disabled) return

    const droppedFiles = Array.from(e.dataTransfer.files)
    onChange([...files, ...droppedFiles])
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const removeFile = (index) => {
    const newFiles = files.filter((_, i) => i !== index)
    onChange(newFiles)
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
      <label className="block text-sm font-medium text-gray-700 mb-2">
        File Uploads
      </label>

      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => !disabled && fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          disabled
            ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
            : 'border-bluepeak-blue bg-bluepeak-light hover:bg-blue-50'
        }`}
      >
        <div className="text-4xl mb-2">📁</div>
        <p className="text-gray-700 font-medium mb-1">
          Drop files here or click to browse
        </p>
        <p className="text-sm text-gray-500">
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
          <h3 className="text-sm font-medium text-gray-700">Uploaded Files ({files.length})</h3>
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
            >
              <div className="flex items-center space-x-3 flex-1 min-w-0">
                <span className="text-2xl">{getFileIcon(file.name)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
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
                className="ml-4 text-red-600 hover:text-red-800 font-medium text-sm disabled:text-gray-400"
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
