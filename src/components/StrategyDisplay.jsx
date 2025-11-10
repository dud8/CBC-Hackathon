import { useState, useEffect, useRef } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

function StrategyDisplay({ proposal, contentStrategy, sampleAds, onReset }) {
  const [activeTab, setActiveTab] = useState('proposal')
  const [copied, setCopied] = useState(false)
  const createChatSession = (open = false) => ({
    open,
    messages: [],
    input: '',
    isLoading: false,
    error: null
  })
  const buildInitialChatSessions = () => ({
    proposal: createChatSession(),
    content: createChatSession(),
    ads: createChatSession()
  })
  const [chatSessions, setChatSessions] = useState(buildInitialChatSessions)
  const chatControllersRef = useRef({})
  const chatScrollRefs = useRef({})
  const displayDebugPrefix = '[BluePeak][Client][StrategyDisplay]'
  const displayDebug = (...args) => console.debug(displayDebugPrefix, ...args)
  const displayWarn = (...args) => console.warn(displayDebugPrefix, ...args)

  useEffect(() => {
    displayDebug('Strategy payload updated', {
      proposalLength: proposal?.length ?? 0,
      contentStrategyLength: contentStrategy?.length ?? 0,
      sampleAdsLength: sampleAds?.length ?? 0
    })

    if (!proposal && !contentStrategy && !sampleAds) {
      displayWarn('All strategy sections are empty. Check API parsing/output.')
    }
  }, [proposal, contentStrategy, sampleAds])

  useEffect(() => {
    displayDebug('Active tab updated', activeTab)
  }, [activeTab])

  useEffect(() => {
    Object.entries(chatSessions).forEach(([tabId, session]) => {
      if (!session?.open) return
      const container = chatScrollRefs.current[tabId]
      if (container) {
        container.scrollTop = container.scrollHeight
      }
    })
  }, [chatSessions])

  const tabs = [
    { id: 'proposal', label: 'Client Proposal', content: proposal },
    { id: 'content', label: 'Content Strategy', content: contentStrategy },
    { id: 'ads', label: 'Sample Ads', content: sampleAds }
  ]
  const tabLookup = tabs.reduce((acc, tab) => {
    acc[tab.id] = tab
    return acc
  }, {})

  useEffect(() => {
    displayDebug('Resetting chat sessions due to new strategy payload')
    Object.values(chatControllersRef.current).forEach((controller) => {
      if (controller) controller.abort()
    })
    chatControllersRef.current = {}
    chatScrollRefs.current = {}
    setChatSessions(buildInitialChatSessions())
  }, [proposal, contentStrategy, sampleAds])

  const safeContent = (value) => (typeof value === 'string' && value.trim().length > 0 ? value : '')

  const updateChatSession = (tabId, updater) => {
    setChatSessions((prev) => {
      const nextState = typeof updater === 'function' ? updater(prev[tabId] ?? createChatSession()) : updater
      return {
        ...prev,
        [tabId]: nextState
      }
    })
  }

  const toggleChatPanel = (tabId, shouldOpen) => {
    displayDebug('Toggling chat panel', { tabId, shouldOpen })
    if (!shouldOpen && chatControllersRef.current[tabId]) {
      chatControllersRef.current[tabId].abort()
      delete chatControllersRef.current[tabId]
    }
    updateChatSession(tabId, (session) => ({
      ...session,
      open: shouldOpen
    }))
  }

  const resetChatSession = (tabId) => {
    displayDebug('Resetting chat session', tabId)
    if (chatControllersRef.current[tabId]) {
      chatControllersRef.current[tabId].abort()
      delete chatControllersRef.current[tabId]
    }
    updateChatSession(tabId, () => ({
      ...createChatSession(true)
    }))
  }

  const removeMessageById = (tabId, messageId) => {
    updateChatSession(tabId, (session) => ({
      ...session,
      messages: session.messages.filter((msg) => msg.id !== messageId)
    }))
  }

  const updateAssistantMessage = (tabId, messageId, content) => {
    updateChatSession(tabId, (session) => ({
      ...session,
      messages: session.messages.map((msg) =>
        msg.id === messageId
          ? {
              ...msg,
              content
            }
          : msg
      )
    }))
  }

  const createMessageId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return `msg_${Math.random().toString(36).slice(2, 10)}`
  }

  const handleChatInputChange = (tabId, value) => {
    updateChatSession(tabId, (session) => ({
      ...session,
      input: value
    }))
  }

  const handleChatSubmit = async (tabId) => {
    const session = chatSessions[tabId]
    const sectionDetails = tabLookup[tabId]
    if (!sectionDetails || !safeContent(sectionDetails.content)) {
      displayWarn('Cannot start chat without section content', tabId)
      return
    }
    if (!session || session.isLoading) return
    const trimmedInput = session.input.trim()
    if (!trimmedInput) return

    const userMessage = {
      id: createMessageId(),
      role: 'user',
      content: trimmedInput
    }
    const historyToSend = [...session.messages, { role: 'user', content: trimmedInput }]
    updateChatSession(tabId, (prevSession) => ({
      ...prevSession,
      messages: [...prevSession.messages, userMessage],
      input: '',
      isLoading: true,
      error: null
    }))

    if (chatControllersRef.current[tabId]) {
      chatControllersRef.current[tabId].abort()
    }
    const controller = new AbortController()
    chatControllersRef.current[tabId] = controller

    let assistantMessageId = null
    try {
      const response = await fetch('/api/section-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: tabId,
          sectionLabel: sectionDetails.label,
          sectionContent: sectionDetails.content,
          messages: historyToSend
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const errorBody = await response.text()
        throw new Error(errorBody || 'Chat request failed')
      }

      if (!response.body) {
        throw new Error('Chat response stream unavailable')
      }

      assistantMessageId = createMessageId()
      updateChatSession(tabId, (prevSession) => ({
        ...prevSession,
        messages: [
          ...prevSession.messages,
          {
            id: assistantMessageId,
            role: 'assistant',
            content: ''
          }
        ]
      }))

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let done = false

      while (!done) {
        const { value, done: readerDone } = await reader.read()
        done = readerDone
        if (value) {
          const chunk = decoder.decode(value, { stream: !done })
          accumulated += chunk
          updateAssistantMessage(tabId, assistantMessageId, accumulated)
        }
      }

      if (!accumulated.trim()) {
        updateAssistantMessage(tabId, assistantMessageId, 'I do not have enough information in this section to answer that.')
      }
    } catch (error) {
      if (error?.name === 'AbortError') {
        displayWarn('Chat request aborted', tabId)
      } else {
        displayWarn('Chat request failed', error)
        if (assistantMessageId) {
          removeMessageById(tabId, assistantMessageId)
        }
        updateChatSession(tabId, (prevSession) => ({
          ...prevSession,
          error: error?.message || 'Unable to complete chat request'
        }))
      }
    } finally {
      if (chatControllersRef.current[tabId] === controller) {
        delete chatControllersRef.current[tabId]
      }
      updateChatSession(tabId, (prevSession) => ({
        ...prevSession,
        isLoading: false
      }))
    }
  }

  const handleTabChange = (tabId) => {
    displayDebug('Tab clicked', tabId)
    setActiveTab(tabId)
  }

  const handleDownload = () => {
    const fullContent = `# BluePeak Strategy\n\n## Client Proposal\n\n${proposal}\n\n## Content Strategy\n\n${contentStrategy}\n\n## Sample Ads\n\n${sampleAds}`
    displayDebug('Preparing markdown download', {
      totalLength: fullContent.length,
      proposalLength: proposal?.length ?? 0,
      contentStrategyLength: contentStrategy?.length ?? 0,
      sampleAdsLength: sampleAds?.length ?? 0
    })
    const blob = new Blob([fullContent], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bluepeak-strategy.md'
    a.click()
    URL.revokeObjectURL(url)
    displayDebug('Markdown download triggered successfully')
  }

  const handleCopy = async () => {
    try {
      const fullContent = `# BluePeak Strategy\n\n## Client Proposal\n\n${proposal}\n\n## Content Strategy\n\n${contentStrategy}\n\n## Sample Ads\n\n${sampleAds}`
      await navigator.clipboard.writeText(fullContent)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      displayDebug('Markdown copied to clipboard')
    } catch (err) {
      displayWarn('Clipboard copy failed', err)
    }
  }

  const renderChatInterface = (tab) => {
    const session = chatSessions[tab.id] ?? createChatSession()
    const hasContent = Boolean(safeContent(tab.content))

    if (!hasContent) {
      return (
        <div className="mt-6 text-sm text-slate-400">
          Chat is unavailable because this section is empty.
        </div>
      )
    }

    if (!session.open) {
      return (
        <div className="mt-6">
          <button
            className="bp-btn-secondary flex items-center gap-2"
            onClick={() => toggleChatPanel(tab.id, true)}
          >
            <span aria-hidden="true">💬</span>
            Chat about this section
          </button>
        </div>
      )
    }

    return (
      <div className="mt-6 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-950/85 via-slate-900/70 to-slate-900/40 p-5 shadow-2xl shadow-black/30 ring-1 ring-white/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bluepeak-blue/20 text-bluepeak-blue">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17 8h2a3 3 0 013 3v7a3 3 0 01-3 3h-8l-4 3v-3H5a3 3 0 01-3-3v-7a3 3 0 013-3h2" opacity=".4" />
                <path d="M12 14a5 5 0 100-10 5 5 0 000 10z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Chat about {tab.label}</h3>
              <p className="text-sm text-slate-400">Ask concise follow-ups. Replies cite only this section.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => resetChatSession(tab.id)}
              className="bp-btn-secondary"
            >
              Reset
            </button>
            <button
              onClick={() => toggleChatPanel(tab.id, false)}
              className="bp-btn-gray"
            >
              Close
            </button>
          </div>
        </div>
        <div
          ref={(el) => {
            chatScrollRefs.current[tab.id] = el
          }}
          className="mt-4 h-72 overflow-y-auto space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4 backdrop-blur"
        >
          {session.messages.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/10 bg-slate-900/30 p-6 text-center text-sm text-slate-400">
              No conversation yet. Ask a targeted question to explore this section.
            </div>
          )}
          {session.messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-full rounded-2xl px-4 py-3 text-sm leading-relaxed sm:max-w-2xl ${
                  msg.role === 'user'
                    ? 'bg-bluepeak-blue/35 text-blue-50 shadow-inner shadow-bluepeak-blue/40'
                    : 'bg-slate-800/80 text-slate-100 shadow-inner shadow-black/40'
                }`}
              >
                {msg.content || <span className="text-slate-400">…</span>}
              </div>
            </div>
          ))}
        </div>
        {session.error && (
          <div className="bp-alert-error mt-4">
            <p>{session.error}</p>
          </div>
        )}
        <form
          className="mt-4 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            handleChatSubmit(tab.id)
          }}
        >
          <textarea
            value={session.input}
            onChange={(event) => handleChatInputChange(tab.id, event.target.value)}
            placeholder={`Ask a question about ${tab.label.toLowerCase()}…`}
            disabled={session.isLoading}
            className="min-h-[90px] w-full rounded-2xl border border-white/10 bg-slate-950/80 p-4 text-sm text-slate-100 placeholder:text-slate-500 shadow-inner shadow-black/40 focus:border-bluepeak-blue/70 focus:outline-none focus:ring-2 focus:ring-bluepeak-blue/60 disabled:opacity-60"
          />
          <div className="flex items-center justify-end gap-3">
            {session.isLoading && (
              <span className="text-sm text-slate-400">Streaming answer…</span>
            )}
            <button
              type="submit"
              className="bp-btn-primary"
              disabled={session.isLoading || !session.input.trim()}
            >
              Send
            </button>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Success Header */}
      <div className="bp-alert-success mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold mb-1">Strategy Generated Successfully</h2>
            <p className="text-sm">Your complete marketing strategy is ready for review.</p>
          </div>
          <button
            onClick={() => {
              displayDebug('New Strategy button clicked')
              onReset()
            }}
            className="bp-btn-secondary"
          >
            New Strategy
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bp-card p-0 overflow-hidden">
        <div className="border-b border-white/10">
          <nav className="bp-tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`bp-tab ${activeTab === tab.id ? 'bp-tab-active' : ''}`}
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
                {safeContent(tab.content) ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {safeContent(tab.content)}
                  </ReactMarkdown>
                ) : (
                  <p className="text-sm text-slate-400 italic">No content generated for this section.</p>
                )}
              </div>
              {renderChatInterface(tab)}
            </div>
          ))}
        </div>
      </div>

      {/* Download/Export Buttons */}
      <div className="mt-6 flex justify-end space-x-3">
        <button
          onClick={handleCopy}
          className="bp-btn-secondary"
          title="Copy markdown to clipboard"
        >
          {copied ? 'Copied!' : 'Copy Markdown'}
        </button>
        <button
          onClick={handleDownload}
          className="bp-btn-gray"
        >
          Download as Markdown
        </button>
      </div>
    </div>
  )
}

export default StrategyDisplay
