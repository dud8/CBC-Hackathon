import Anthropic from '@anthropic-ai/sdk'
import { buildSectionChatSystemPrompt, buildSectionChatContext } from './prompts.js'

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
const MAX_HISTORY_MESSAGES = 12

const createRequestId = () => `bp-chat-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

const createLogger = (requestId) => {
  const prefix = `[BluePeak][SectionChat][${requestId}]`
  return {
    debug: (...args) => console.debug(prefix, ...args),
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args)
  }
}

const readJsonBody = (req) =>
  new Promise((resolve, reject) => {
    let data = ''
    req.on('data', (chunk) => {
      data += chunk
      if (data.length > 1e6) {
        reject(new Error('Request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      try {
        resolve(data ? JSON.parse(data) : {})
      } catch (error) {
        reject(error)
      }
    })
    req.on('error', reject)
  })

const sanitizeMessages = (messages = []) =>
  Array.isArray(messages)
    ? messages
        .filter(
          (msg) =>
            msg &&
            typeof msg.content === 'string' &&
            msg.content.trim().length > 0 &&
            (msg.role === 'user' || msg.role === 'assistant')
        )
        .map((msg) => ({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content.trim()
        }))
        .slice(-MAX_HISTORY_MESSAGES)
    : []

export default async function handler(req, res) {
  const requestId = createRequestId()
  const logger = createLogger(requestId)

  if (req.method !== 'POST') {
    logger.warn('Rejected non-POST request')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const body = await readJsonBody(req)
    const sectionContent = typeof body.sectionContent === 'string' ? body.sectionContent.trim() : ''
    const sectionLabel = typeof body.sectionLabel === 'string' && body.sectionLabel.trim().length > 0 ? body.sectionLabel.trim() : 'Strategy Section'
    const messages = sanitizeMessages(body.messages)

    if (!sectionContent) {
      logger.warn('Missing section content for chat request')
      return res.status(400).json({ error: 'Section content is required for chat' })
    }

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicApiKey) {
      logger.error('Missing ANTHROPIC_API_KEY environment variable')
      return res.status(500).json({ error: 'Server misconfigured: missing Anthropic API key' })
    }

    const conversation = [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: buildSectionChatContext({
              sectionLabel,
              sectionContent
            })
          }
        ]
      },
      ...messages.map((msg) => ({
        role: msg.role,
        content: [{ type: 'text', text: msg.content }]
      }))
    ]

    const anthropic = new Anthropic({
      apiKey: anthropicApiKey
    })

    let stream
    try {
      stream = anthropic.messages.stream({
        model: CLAUDE_MODEL,
        max_tokens: 600,
        temperature: 0.2,
        system: buildSectionChatSystemPrompt(sectionLabel),
        messages: conversation
      })
    } catch (error) {
      logger.error('Failed to initialize Anthropic stream', error)
      return res.status(500).json({ error: 'Unable to start chat response stream' })
    }

    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Transfer-Encoding': 'chunked'
    })

    const stopStreaming = (error) => {
      if (error) {
        logger.error('Section chat stream error', error)
        if (!res.headersSent) {
          res.statusCode = 500
        }
      }
      if (!res.writableEnded) {
        res.end()
      }
    }

    stream.on('text', (textChunk) => {
      try {
        res.write(textChunk)
      } catch (error) {
        logger.error('Failed to write chat chunk', error)
        stream.controller.abort()
      }
    })

    stream.on('error', (error) => {
      stopStreaming(error)
    })

    stream.on('end', () => {
      logger.debug('Section chat stream completed')
      stopStreaming()
    })

    req.on('close', () => {
      if (!res.writableEnded) {
        logger.info('Client closed connection, aborting stream')
        stream.controller.abort()
        res.end()
      }
    })

    stream.finalMessage().catch((error) => {
      logger.error('Section chat final message error', error)
    })
  } catch (error) {
    console.error('[BluePeak][SectionChat] Handler error', error)
    return res.status(500).json({
      error: 'Unexpected error while processing chat request'
    })
  }
}
