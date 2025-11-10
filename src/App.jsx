import { useState, useEffect } from 'react'
import TextInput from './components/TextInput'
import FileUpload from './components/FileUpload'
import StrategyDisplay from './components/StrategyDisplay'
import ClarificationDialog from './components/ClarificationDialog'

const normalizeText = (value) => (typeof value === 'string' ? value : '')

// Token limit constant
const MAX_TOKENS = 200000

const CLIENT_DEBUG_PREFIX = '[BluePeak][Client]'
const clientDebug = (...args) => console.debug(CLIENT_DEBUG_PREFIX, ...args)
const clientWarn = (...args) => console.warn(CLIENT_DEBUG_PREFIX, ...args)
const clientError = (...args) => console.error(CLIENT_DEBUG_PREFIX, ...args)
const previewText = (value = '', length = 120) => {
  if (typeof value !== 'string') return '[non-string payload]'
  return value.length > length ? `${value.slice(0, length)}…` : value
}

const describeFiles = (fileList = []) =>
  Array.from(fileList).map((file, index) => ({
    index,
    name: file?.name,
    size: file?.size,
    type: file?.type
  }))

const snapshotFormData = (formData) => {
  const canInspect = typeof FormData !== 'undefined' && formData instanceof FormData
  if (!canInspect) {
    clientWarn('snapshotFormData called without a browser FormData instance')
    return
  }

  const details = []
  for (const [key, value] of formData.entries()) {
    const isFile = typeof File !== 'undefined' && value instanceof File
    if (isFile) {
      details.push({
        key,
        valueType: 'File',
        name: value.name,
        size: value.size,
        mime: value.type
      })
    } else {
      details.push({
        key,
        valueType: typeof value,
        preview: previewText(value, 80),
        length: typeof value === 'string' ? value.length : undefined
      })
    }
  }

  clientDebug('FormData snapshot', details)
}

// Debounce utility
function useDebounce(value, delay) {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])

  return debouncedValue
}

function App() {
  const [textInput, setTextInput] = useState('')
  const [files, setFiles] = useState([])
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)
  const [tokenCount, setTokenCount] = useState(0)
  const [countingTokens, setCountingTokens] = useState(false)

  // Debounce text input for token counting
  const debouncedTextInput = useDebounce(textInput, 500)

  // Count tokens when text or files change
  useEffect(() => {
    clientDebug('Token count effect triggered', {
      loading,
      hasResponse: Boolean(response),
      debouncedTextLength: debouncedTextInput.length,
      fileCount: files.length
    })

    const countTokens = async () => {
      // Don't count if we're currently processing a strategy
      if (loading || response) {
        clientDebug('Skipping token count because loading or response already present')
        return
      }

      // Don't count empty input
      if (!debouncedTextInput.trim() && files.length === 0) {
        clientDebug('Skipping token count because there is no input text or files')
        setTokenCount(0)
        return
      }

      setCountingTokens(true)
      try {
        const formData = new FormData()
        formData.append('text', debouncedTextInput)
        clientDebug('Counting tokens with text payload', {
          length: debouncedTextInput.length,
          preview: previewText(debouncedTextInput)
        })

        files.forEach((file, index) => {
          formData.append(`file_${index}`, file)
        })
        clientDebug('Counting tokens with files', describeFiles(files))
        snapshotFormData(formData)

        const res = await fetch('/api/count-tokens', {
          method: 'POST',
          body: formData
        })

        if (res.ok) {
          const data = await res.json()
          clientDebug('Token count response payload', data)
          setTokenCount(data.tokens || 0)
        } else {
          clientWarn('Token count request failed', res.status, res.statusText)
        }
      } catch (err) {
        clientError('Error counting tokens:', err)
        // Fallback to character-based estimate
        setTokenCount(Math.ceil(debouncedTextInput.length / 4))
      } finally {
        setCountingTokens(false)
      }
    }

    countTokens()
  }, [debouncedTextInput, files, loading, response])

  const handleTextChange = (text) => {
    const normalizedText = normalizeText(text)
    clientDebug('Text input updated', {
      previousLength: textInput.length,
      nextLength: normalizedText.length,
      preview: previewText(normalizedText)
    })
    setTextInput(normalizedText)
  }

  const handleFilesChange = async (newFiles) => {
    clientDebug('Files updated', describeFiles(newFiles))
    setFiles(newFiles)
  }

  const handleSubmit = async (clarificationAnswer = null) => {
    clientDebug('handleSubmit invoked', {
      clarificationAnswerProvided: clarificationAnswer !== null,
      textLength: textInput.length,
      fileCount: files.length
    })
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()

      // Add text input
      const textPayload = clarificationAnswer
        ? normalizeText(clarificationAnswer)
        : normalizeText(textInput)

      clientDebug('Appending text payload for submission', {
        source: clarificationAnswer ? 'clarification' : 'initial',
        length: textPayload.length,
        preview: previewText(textPayload)
      })
      formData.append('text', textPayload)

      // Add files
      files.forEach((file, index) => {
        formData.append(`file_${index}`, file)
      })
      clientDebug('Appending files for submission', describeFiles(files))
      snapshotFormData(formData)

      const res = await fetch('/api/strategy', {
        method: 'POST',
        body: formData
      })

      clientDebug('Strategy API response received', {
        status: res.status,
        statusText: res.statusText
      })

      if (!res.ok) {
        let errorMessage = `API request failed: ${res.status} ${res.statusText}`
        try {
          const errorBody = await res.text()
          if (errorBody) {
            try {
              const errorPayload = JSON.parse(errorBody)
              clientWarn('Strategy API returned error payload', errorPayload)
              if (errorPayload?.message) {
                errorMessage = errorPayload.message
              }
              if (errorPayload?.detail && errorPayload.detail !== errorPayload.message) {
                errorMessage = `${errorMessage} (${errorPayload.detail})`
              }
            } catch (jsonError) {
              clientWarn('Strategy API error response was not valid JSON', { errorBody })
              errorMessage = `${errorMessage}. ${errorBody}`
            }
          }
        } catch (parseError) {
          clientWarn('Unable to read Strategy API error body', parseError)
        }
        throw new Error(errorMessage)
      }

      const data = await res.json()
      clientDebug('Strategy API JSON payload parsed', {
        type: data?.type,
        proposalLength: data?.proposal?.length ?? 0,
        contentStrategyLength: data?.contentStrategy?.length ?? 0,
        sampleAdsLength: data?.sampleAds?.length ?? 0,
        questionsCount: Array.isArray(data?.questions) ? data.questions.length : 0
      })
      setResponse(data)
    } catch (err) {
      clientError('handleSubmit error:', err)
      setError(err.message || 'An error occurred while processing your request')
    } finally {
      setLoading(false)
    }
  }

  const handleClarificationSubmit = (answer) => {
    clientDebug('Submitting clarification answer', {
      answerLength: answer.length,
      preview: previewText(answer)
    })
    handleSubmit(answer)
  }

  const handleReset = () => {
    clientDebug('Resetting application state')
    setTextInput('')
    setFiles([])
    setResponse(null)
    setError(null)
    setTokenCount(0)
  }

  useEffect(() => {
    if (response) {
      clientDebug('Response state updated', {
        type: response.type,
        tokenCount: response.tokenCount,
        proposalLength: response?.proposal?.length ?? 0,
        contentStrategyLength: response?.contentStrategy?.length ?? 0,
        sampleAdsLength: response?.sampleAds?.length ?? 0
      })
    }
  }, [response])

  useEffect(() => {
    if (error) {
      clientWarn('Error state updated', error)
    }
  }, [error])

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bp-hero isolate py-4 sm:py-6">
        <div className="bp-container">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">BluePeak Workflow Engine</h1>
            <p className="text-bluepeak-light/90 text-sm sm:text-base mt-1">Transform raw client data into professional marketing strategies</p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="bp-container py-8">
        {!response ? (
          <div className="max-w-5xl mx-auto">
            {/* Input Section */}
            <div className="bp-card p-6 mb-6">
              <h2 className="text-2xl font-semibold text-slate-100 mb-2">Client Information</h2>
              <p className="text-slate-300 mb-6">
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
                currentTokenCount={tokenCount}
                maxTokens={MAX_TOKENS}
                onCheckTokens={async (newFiles) => {
                  // Make a quick API call to estimate tokens for the new files
                  try {
                    const formData = new FormData()
                    formData.append('text', textInput)

                    newFiles.forEach((file, index) => {
                      formData.append(`file_${index}`, file)
                    })

                    const res = await fetch('/api/count-tokens', {
                      method: 'POST',
                      body: formData
                    })

                    if (res.ok) {
                      const data = await res.json()
                      return data.tokens || 0
                    }
                  } catch (err) {
                    clientError('Error checking tokens via FileUpload estimate:', err)
                  }
                  return 0
                }}
              />

              {/* Token Limit Warning */}
              {tokenCount > MAX_TOKENS && (
                <div className="mt-4 bp-alert-error">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm">
                        <span className="font-semibold">Token limit exceeded!</span> You have {tokenCount.toLocaleString()} tokens but the maximum is {MAX_TOKENS.toLocaleString()}. Please remove some text or files to continue.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Token Count */}
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-slate-300 flex items-center gap-2" role="status" aria-live="polite">
                  {countingTokens ? (
                    <span className="text-slate-500">Counting tokens...</span>
                  ) : (
                    <>
                      <span>Tokens:</span>
                      <span className={`bp-badge ${tokenCount > MAX_TOKENS ? 'bp-badge-danger' : 'bp-badge-neutral'}`}>
                        {tokenCount.toLocaleString()} / {MAX_TOKENS.toLocaleString()}
                      </span>
                      {response && response.tokenCount && (
                        <span className="ml-2 text-slate-400">
                          (Last request: {response.tokenCount.toLocaleString()})
                        </span>
                      )}
                    </>
                  )}
                </span>
                <button
                  onClick={() => handleSubmit()}
                  disabled={loading || tokenCount > MAX_TOKENS || (normalizeText(textInput).trim() === '' && files.length === 0)}
                  className="bp-btn-primary"
                >
                  {loading ? 'Analyzing...' : 'Generate Strategy'}
                </button>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bp-alert-error">
                <h3 className="font-semibold mb-2">Error</h3>
                <p>{error}</p>
              </div>
            )}

            {/* Loading State */}
            {loading && (
              <div className="bp-alert-info">
                <div className="flex items-center">
                  <svg className="animate-spin h-5 w-5 text-bluepeak-blue mr-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="text-blue-100 font-medium">BluePeak-AI is analyzing your client data...</span>
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
            <div className="bp-alert-warn">
              <h3 className="font-semibold text-lg mb-2">Cannot Proceed</h3>
              <p className="whitespace-pre-wrap">{response.message}</p>
              <button
                onClick={handleReset}
                className="mt-4 bp-btn-primary"
              >
                Start Over
              </button>
            </div>
          </div>
        ) : null}
      </main>

      {/* Footer */}
      <footer className="mt-12 border-t border-white/10 bg-slate-900/60 backdrop-blur">
        <div className="bp-container py-6 text-center text-slate-400">
          <p>BluePeak Marketing - Workflow Engine</p>
        </div>
      </footer>
    </div>
  )
}

export default App
