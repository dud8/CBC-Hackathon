import { useState } from 'react'

function ClarificationDialog({ questions, onSubmit, onReset, loading }) {
  const [answer, setAnswer] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (answer.trim()) {
      onSubmit(answer)
      setAnswer('')
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Additional Information Needed
        </h2>
        <p className="text-gray-600 mb-6">
          BluePeak-AI needs more details to create an accurate strategy for your client.
        </p>

        {/* Display Questions */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-gray-800 mb-3">Questions:</h3>
          <div className="space-y-2">
            {questions.map((question, index) => (
              <p key={index} className="text-gray-700">
                {question}
              </p>
            ))}
          </div>
        </div>

        {/* Answer Form */}
        <form onSubmit={handleSubmit}>
          <label htmlFor="clarification-answer" className="block text-sm font-medium text-gray-700 mb-2">
            Your Answer
          </label>
          <textarea
            id="clarification-answer"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            disabled={loading}
            placeholder="Provide the requested information..."
            className="w-full h-48 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-bluepeak-blue focus:border-transparent resize-y disabled:bg-gray-100 disabled:cursor-not-allowed"
          />

          <div className="mt-6 flex justify-between">
            <button
              type="button"
              onClick={onReset}
              disabled={loading}
              className="bg-gray-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-gray-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Start Over
            </button>
            <button
              type="submit"
              disabled={loading || answer.trim() === ''}
              className="bg-bluepeak-blue text-white px-8 py-3 rounded-lg font-semibold hover:bg-bluepeak-dark disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
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
