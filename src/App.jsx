import { useState } from 'react'
import TextInput from './components/TextInput'
import FileUpload from './components/FileUpload'
import StrategyDisplay from './components/StrategyDisplay'
import ClarificationDialog from './components/ClarificationDialog'

const normalizeText = (value) => (typeof value === 'string' ? value : '')

function App() {
  const [textInput, setTextInput] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)
  const [wordCount, setWordCount] = useState(0)

  const countWords = (text) => {
    const normalized = normalizeText(text).trim()
    if (!normalized) return 0
    return normalized.split(/\s+/).filter(word => word.length > 0).length
  }

  const handleTextChange = (text) => {
    const normalizedText = normalizeText(text)
    setTextInput(normalizedText)
    setWordCount(countWords(normalizedText))
  }

  const handleFilesChange = (newFiles) => {
    setFiles(newFiles)
  }

  const handleSubmit = async (clarificationAnswer = null) => {
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()

      // Add text input
      const textPayload = clarificationAnswer
        ? normalizeText(clarificationAnswer)
        : normalizeText(textInput)

      formData.append('text', textPayload)

      // Add files
      files.forEach((file, index) => {
        formData.append(`file_${index}`, file)
      })

      const res = await fetch('/api/strategy', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        let errorMessage = `API request failed: ${res.status} ${res.statusText}`
        try {
          const errorPayload = await res.json()
          if (errorPayload?.message) {
            errorMessage = errorPayload.message
          }
        } catch (parseError) {
          // Ignore JSON parse errors and fall back to the generic message
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()
      setResponse(data)
    } catch (err) {
      console.error('Error:', err)
      setError(err.message || 'An error occurred while processing your request')
    } finally {
      setLoading(false)
    }
  }

  const handleClarificationSubmit = (answer) => {
    handleSubmit(answer)
  }

  const handleReset = () => {
    setTextInput('')
    setFiles([])
    setResponse(null)
    setError(null)
    setWordCount(0)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-bluepeak-blue text-white py-6 shadow-md">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">BluePeak Strategy Generator</h1>
          <p className="text-bluepeak-light mt-2">Transform raw client data into professional marketing strategies</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {!response ? (
          <div className="max-w-5xl mx-auto">
            {/* Input Section */}
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Client Information</h2>
              <p className="text-gray-600 mb-6">
                Provide client data in any format: paste notes, upload documents, whiteboard photos, or spreadsheets.
              </p>

              <TextInput
                value={normalizeText(textInput)}
                onChange={handleTextChange}
                disabled={loading}
              />

              <FileUpload
                files={files}
                onChange={handleFilesChange}
                disabled={loading}
              />

              {/* Word Count */}
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-600">
                  Words: {wordCount.toLocaleString()} / 170,000
                  {wordCount > 170000 && (
                    <span className="text-red-600 ml-2 font-semibold">
                      Warning: Input will be truncated
                    </span>
                  )}
                </span>
                <button
                  onClick={() => handleSubmit()}
                  disabled={loading || (normalizeText(textInput).trim() === '' && files.length === 0)}
                  className="bg-bluepeak-blue text-white px-8 py-3 rounded-lg font-semibold hover:bg-bluepeak-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Analyzing...' : 'Generate Strategy'}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 px-6 py-4 rounded-lg">
                <h3 className="font-semibold mb-2">Error</h3>
                <p>{error}</p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="bg-blue-50 border border-blue-200 px-6 py-4 rounded-lg">
                <div className="flex items-center">
                  <svg className="animate-spin h-5 w-5 text-bluepeak-blue mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-bluepeak-dark font-medium">BluePeak-AI is analyzing your client data...</span>
                </div>
              </div>
            )}
          </div>
        ) : response.type === 'clarification_needed' ? (
          <ClarificationDialog
            questions={response.questions}
            onSubmit={handleClarificationSubmit}
            onReset={handleReset}
            loading={loading}
          />
        ) : response.type === 'full_plan' ? (
          <StrategyDisplay
            proposal={response.proposal}
            contentStrategy={response.contentStrategy}
            sampleAds={response.sampleAds}
            onReset={handleReset}
          />
        ) : response.type === 'cannot_proceed' ? (
          <div className="max-w-3xl mx-auto">
            <div className="bg-yellow-50 border border-yellow-200 text-yellow-900 px-6 py-4 rounded-lg">
              <h3 className="font-semibold text-lg mb-2">Cannot Proceed</h3>
              <p className="whitespace-pre-wrap">{response.message}</p>
              <button
                onClick={handleReset}
                className="mt-4 bg-bluepeak-blue text-white px-6 py-2 rounded-lg font-semibold hover:bg-bluepeak-dark transition-colors"
              >
                Start Over
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="bg-gray-800 text-gray-300 py-6 mt-12">
        <div className="container mx-auto px-4 text-center">
          <p>BluePeak Marketing - Strategy Generator Prototype</p>
        </div>
      </footer>
    </div>
  )
}

export default App
