import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function StrategyDisplay({ proposal, contentStrategy, sampleAds, onReset }) {
  const [activeTab, setActiveTab] = useState('proposal')

  const tabs = [
    { id: 'proposal', label: 'Client Proposal', content: proposal },
    { id: 'content', label: 'Content Strategy', content: contentStrategy },
    { id: 'ads', label: 'Sample Ads', content: sampleAds }
  ]

  return (
    <div className="max-w-6xl mx-auto">
      {/* Success Header */}
      <div className="bg-green-50 border border-green-200 text-green-800 px-6 py-4 rounded-lg mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1">Strategy Generated Successfully</h2>
            <p className="text-sm">Your complete marketing strategy is ready for review.</p>
          </div>
          <button
            onClick={onReset}
            className="bg-white text-bluepeak-blue border border-bluepeak-blue px-4 py-2 rounded-lg font-semibold hover:bg-bluepeak-light transition-colors"
          >
            New Strategy
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-4 px-6 text-center font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-b-2 border-bluepeak-blue text-bluepeak-blue bg-bluepeak-light'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-8">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={activeTab === tab.id ? 'block' : 'hidden'}
            >
              <div className="prose prose-lg max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {tab.content}
                </ReactMarkdown>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Download/Export Buttons */}
      <div className="mt-6 flex justify-end space-x-4">
        <button
          onClick={() => {
            const fullContent = `# BluePeak Strategy\n\n## Client Proposal\n\n${proposal}\n\n## Content Strategy\n\n${contentStrategy}\n\n## Sample Ads\n\n${sampleAds}`
            const blob = new Blob([fullContent], { type: 'text/markdown' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'bluepeak-strategy.md'
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="bg-gray-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-gray-700 transition-colors"
        >
          Download as Markdown
        </button>
      </div>
    </div>
  )
}

export default StrategyDisplay
