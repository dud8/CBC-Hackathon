import { useState, useEffect } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const clarificationRemarkPlugins = [remarkGfm]
const questionMarkdownWrapperClass = 'prose prose-sm max-w-none text-slate-200'

const normalizeQuestion = (value) => {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) {
    return value
      .map((part) => (typeof part === 'string' ? part : JSON.stringify(part, null, 2)))
      .join('\n\n')
  }
  if (value && typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    } catch (error) {
      console.warn('[BluePeak][Client][Clarification] Failed to stringify question object', error)
      return ''
    }
  }
  if (value === null || typeof value === 'undefined') {
    return ''
  }
  return String(value)
}

function ClarificationDialog({ questions, onSubmit, onReset, loading }) {
  const [answer, setAnswer] = useState('')
  const safeQuestions = Array.isArray(questions) ? questions : []
  const hasQuestions = safeQuestions.length > 0
  const clarificationDebugPrefix = '[BluePeak][Client][Clarification]'
  const clarificationDebug = (...args) => console.debug(clarificationDebugPrefix, ...args)

  useEffect(() => {
    clarificationDebug('Clarification dialog mounted', {
      questionCount: safeQuestions.length,
      hasQuestions
    })

    if (!hasQuestions) {
      clarificationDebug('AI requested clarification but no questions were provided.')
    }
  }, [questions, hasQuestions])

  useEffect(() => {
    clarificationDebug('Loading state updated', { loading })
  }, [loading])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (answer.trim()) {
      clarificationDebug('Submitting clarification answer', {
        length: answer.length,
        preview: answer.length > 120 ? `${answer.slice(0, 120)}…` : answer
      })
      onSubmit(answer)
      setAnswer('')
    } else {
      clarificationDebug('Submission blocked because answer is empty or whitespace')
    }
  }

  const handleReset = () => {
    clarificationDebug('Reset requested via clarification dialog UI')
    onReset()
  }

  const handleAnswerChange = (value) => {
    clarificationDebug('Clarification answer updated', { length: value.length })
    setAnswer(value)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bp-card p-8">
        <h2 className="text-2xl font-semibold text-slate-100 mb-4">
          Additional Information Needed
        </h2>
        <p className="text-slate-300 mb-6">
          BluePeak-AI needs more details to create an accurate strategy for your client.
        </p>

        {/* Display Questions */}
        <div className="bp-alert-warn mb-6">
          <h3 className="font-semibold text-slate-100 mb-3">Questions:</h3>
          <div className="space-y-4">
            {hasQuestions ? (
              safeQuestions.map((question, index) => {
                const normalizedQuestion = normalizeQuestion(question)
                const fallback = '_No question text provided._'
                return (
                  <div key={index} className={questionMarkdownWrapperClass}>
                    <ReactMarkdown remarkPlugins={clarificationRemarkPlugins}>
                      {normalizedQuestion?.trim() ? normalizedQuestion : fallback}
                    </ReactMarkdown>
                  </div>
                )
              })
            ) : (
              <p className="text-slate-200">
                BluePeak-AI requested clarification but did not return specific questions. Check the server
                logs for more details or provide additional client context.
              </p>
            )}
          </div>
        </div>

        {/* Answer Form */}
        <form onSubmit={handleSubmit}>
          <label htmlFor="clarification-answer" className="bp-label">
            Your Answer
          </label>
          <textarea
            id="clarification-answer"
            value={answer}
            onChange={(e) => handleAnswerChange(e.target.value)}
            disabled={loading}
            placeholder="Provide the requested information..."
            className="bp-textarea h-48"
          />

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="bp-btn-gray"
            >
              Start Over
            </button>
            <button
              type="submit"
              disabled={loading || answer.trim() === ''}
              className="bp-btn-primary"
            >
              {loading ? 'Processing...' : 'Submit Answer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ClarificationDialog
