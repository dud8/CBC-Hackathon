import Anthropic from '@anthropic-ai/sdk'
import formidable from 'formidable'
import fs from 'fs'
import { BLUEPEAK_SYSTEM_PROMPT, buildUserPrompt } from './prompts.js'
import { buildContextBlob, normalizeTextInput, parseUploadedFiles } from './file-processing.js'

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'
const CLAUDE_MAX_TOKENS = Number(process.env.BLUEPEAK_MAX_TOKENS || 12000)
const EXTENDED_THINKING_BUDGET = Number(process.env.BLUEPEAK_THINKING_BUDGET || 6000)
const ENABLE_EXTENDED_THINKING = process.env.BLUEPEAK_ENABLE_THINKING === 'true'
const THINKING_CONFIG = ENABLE_EXTENDED_THINKING
  ? {
      type: 'enabled',
      budget_tokens: EXTENDED_THINKING_BUDGET
    }
  : null

const createRequestId = () => `bp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const createLogger = (requestId) => {
  const prefix = `[BluePeak][StrategyAPI][${requestId}]`
  return {
    debug: (...args) => console.debug(prefix, ...args),
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args)
  }
}

const previewForLog = (value = '', length = 200) => {
  if (typeof value !== 'string') return '[non-string payload]'
  return value.length > length ? `${value.slice(0, length)}…` : value
}

const summarizeUploads = (files = []) =>
  files.map((file, idx) => ({
    index: idx,
    fieldName: file?.fieldName || file?.newFilename || null,
    filename: file?.originalFilename || file?.name,
    size: file?.size,
    mimetype: file?.mimetype
  }))

// Token counter utility using Anthropic's API
async function countTokens(anthropic, model, textContent, images = [], pdfs = [], logger = null) {
  try {
    const content = []
    logger?.debug('Starting token count request', {
      hasText: Boolean(textContent),
      imageCount: images.length,
      pdfCount: pdfs.length
    })

    // Add PDFs first
    for (const pdf of pdfs) {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: pdf.data
        }
      })
    }

    // Add images
    for (const img of images) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mimeType,
          data: img.data
        }
      })
    }

    // Add text
    if (textContent) {
      content.push({
        type: 'text',
        text: textContent
      })
    }

    const tokenCount = await anthropic.messages.countTokens({
      model: model,
      system: BLUEPEAK_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: content
      }]
    })

    logger?.debug('Token count API completed', {
      inputTokens: tokenCount.input_tokens
    })

    return tokenCount.input_tokens
  } catch (error) {
    logger?.error('Error counting tokens:', error)
    // Fallback: rough estimate (4 chars per token)
    const safeLength = typeof textContent === 'string' ? textContent.length : 0
    return Math.ceil(safeLength / 4)
  }
}

const SECTION_SEQUENCE = ['proposal', 'content_strategy', 'sample_ads']
const MAX_FALLBACK_QUESTIONS = 10

const extractTagContent = (text = '', tagName = '', logger = null) => {
  if (!text || !tagName) return ''
  const normalizedTag = tagName.toLowerCase()
  const tagRegex = new RegExp(`<${normalizedTag}(\\s[^>]*)?>([\\s\\S]*?)</${normalizedTag}>`, 'i')
  const match = tagRegex.exec(text)
  if (!match) {
    logger?.debug?.(`extractTagContent: <${tagName}> tag not found`)
    return ''
  }
  return match[2]?.trim() || ''
}

const sanitizeQuestionLine = (line = '') =>
  line
    .replace(/^[-*•>\s]*\d{0,2}[).:-]?\s*/u, '')
    .replace(/^question\s*[:.-]\s*/i, '')
    .replace(/^[A-Z]\)\s*/, '')
    .replace(/\*\*/g, '')
    .trim()

const normalizeQuestionText = (text = '') => {
  if (!text) return ''
  const withoutTags = text.replace(/<[^>]+>/g, ' ')
  const sanitized = sanitizeQuestionLine(withoutTags.replace(/\s+/g, ' '))
  if (!sanitized) return ''
  const trimmed = sanitized.replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  if (trimmed.endsWith('?')) return trimmed
  const lastQuestionIdx = trimmed.lastIndexOf('?')
  if (lastQuestionIdx !== -1) {
    return trimmed.slice(0, lastQuestionIdx + 1).trim()
  }
  return `${trimmed}?`
}

const deriveQuestionsFromText = (rawText = '', logger = null) => {
  if (!rawText.trim()) return []
  const withoutTags = rawText.replace(/<[^>]+>/g, '\n')
  const lines = withoutTags.split('\n')
  const questions = []
  const seen = new Set()

  for (const line of lines) {
    const normalized = normalizeQuestionText(line)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (!seen.has(key)) {
      seen.add(key)
      questions.push(normalized)
    }
    if (questions.length >= MAX_FALLBACK_QUESTIONS) break
  }

  if (!questions.length) {
    logger?.debug?.('deriveQuestionsFromText: no fallback questions derived')
  }

  return questions
}

const extractErrorMessage = (error) =>
  typeof error?.error?.message === 'string'
    ? error.error.message
    : typeof error?.message === 'string'
      ? error.message
      : ''

const shouldRetryWithoutThinking = (error) => {
  if (!THINKING_CONFIG) return false
  const message = extractErrorMessage(error).toLowerCase()
  if (!message) return false
  return (
    message.includes('thinking') ||
    message.includes('budget_tokens') ||
    message.includes('unknown key: thinking') ||
    message.includes('extended thinking') ||
    message.includes('parameter thinking')
  )
}

const extractSectionContent = (text, tagName, logger = null) => {
  const normalizedTag = tagName.toLowerCase()
  const openingRegex = new RegExp(`<${normalizedTag}(\\s[^>]*)?>`, 'i')
  const openingMatch = openingRegex.exec(text)

  if (!openingMatch) {
    logger?.debug(`Section <${tagName}> not found in response`)
    return ''
  }

  const contentStart = openingMatch.index + openingMatch[0].length
  const lowerText = text.toLowerCase()
  const closingTag = `</${normalizedTag}>`
  const closingIndex = lowerText.indexOf(closingTag, contentStart)

  if (closingIndex !== -1) {
    return text.slice(contentStart, closingIndex).trim()
  }

  // Fall back to slicing until the next known section or end of response
  const nextTags = []
  const currentIdx = SECTION_SEQUENCE.indexOf(normalizedTag)
  if (currentIdx !== -1) {
    for (let i = currentIdx + 1; i < SECTION_SEQUENCE.length; i += 1) {
      nextTags.push(`<${SECTION_SEQUENCE[i]}`)
    }
  }
  nextTags.push(`</full_plan`)

  let fallbackEnd = lowerText.length
  for (const tag of nextTags) {
    const idx = lowerText.indexOf(tag, contentStart)
    if (idx !== -1 && idx < fallbackEnd) {
      fallbackEnd = idx
    }
  }

  const fallbackContent = text.slice(contentStart, fallbackEnd).trim()
  if (fallbackContent) {
    logger?.warn(`Missing closing </${tagName}> tag. Using fallback extraction.`)
  } else {
    logger?.warn(`Missing closing </${tagName}> tag and fallback extraction returned empty content.`)
  }
  return fallbackContent
}

const hasTag = (text, tagName) => {
  const normalizedTag = tagName.toLowerCase()
  const tagRegex = new RegExp(`<${normalizedTag}(\\s|>)`, 'i')
  return tagRegex.test(text)
}

// Parse XML response from Claude
function parseXMLResponse(text, logger = null) {
  if (!text || !text.trim()) {
    logger?.warn('Claude returned an empty response block')
    return {
      type: 'error',
      message: 'Claude returned an empty response. Please check the server logs for details.'
    }
  }

  logger?.debug('Parsing XML response text', { length: text.length })

  // Extract thinking
  const thinkingMatch = text.match(/<thinking>([\s\S]*?)<\/thinking>/)
  const thinking = thinkingMatch ? thinkingMatch[1].trim() : null
  if (thinking) {
    logger?.debug('Thinking section extracted', { length: thinking.length })
  }

  // Check for clarification_needed
  if (hasTag(text, 'clarification_needed')) {
    const questionRegex = /<question[^>]*>([\s\S]*?)<\/question>/gi
    const questions = []
    const seenQuestions = new Set()
    const addQuestion = (rawText) => {
      const normalized = normalizeQuestionText(rawText)
      if (!normalized) return false
      const fingerprint = normalized.toLowerCase()
      if (seenQuestions.has(fingerprint)) return false
      seenQuestions.add(fingerprint)
      questions.push(normalized)
      return true
    }
    let questionMatch

    while ((questionMatch = questionRegex.exec(text)) !== null) {
      addQuestion(questionMatch[1])
    }
    const initialQuestionCount = questions.length

    const fallbackSource =
      extractTagContent(text, 'questions', logger) || extractTagContent(text, 'clarification_needed', logger) || text
    const fallbackQuestions = deriveQuestionsFromText(fallbackSource, logger)
    let fallbackAdded = 0
    if (fallbackQuestions.length) {
      for (const fallbackQuestion of fallbackQuestions) {
        if (addQuestion(fallbackQuestion)) {
          fallbackAdded += 1
        }
      }
      if (fallbackAdded > 0) {
        if (initialQuestionCount === 0) {
          logger?.warn('Clarification response missing <question> tags. Using fallback extraction.', {
            fallbackAdded
          })
        } else {
          logger?.info('Clarification response contained additional untagged questions. Added fallback-derived entries.', {
            fallbackAdded
          })
        }
      }
    }

    if (questions.length === 0) {
      logger?.warn('Clarification response missing question data. Returning default guidance.')
      questions.push(
        'BluePeak-AI requested clarification but did not return specific questions. Please refine your client brief and resubmit.'
      )
    }

    logger?.info('Parsed clarification_needed response', { questionCount: questions.length })
    return {
      type: 'clarification_needed',
      thinking,
      questions
    }
  }

  // Check for full_plan
  if (hasTag(text, 'full_plan')) {
    const proposalContent = extractSectionContent(text, 'proposal', logger)
    const contentStrategyContent = extractSectionContent(text, 'content_strategy', logger)
    const sampleAdsContent = extractSectionContent(text, 'sample_ads', logger)

    logger?.info('Parsed full_plan response', {
      proposalLength: proposalContent.length,
      contentStrategyLength: contentStrategyContent.length,
      sampleAdsLength: sampleAdsContent.length
    })

    return {
      type: 'full_plan',
      thinking,
      proposal: proposalContent,
      contentStrategy: contentStrategyContent,
      sampleAds: sampleAdsContent
    }
  }

  // Check for cannot_proceed
  if (hasTag(text, 'cannot_proceed')) {
    const messageMatch = text.match(/<message>([\s\S]*?)<\/message>/)
    logger?.info('Parsed cannot_proceed response', {
      hasMessage: Boolean(messageMatch)
    })
    return {
      type: 'cannot_proceed',
      thinking,
      message: messageMatch ? messageMatch[1].trim() : 'Cannot proceed without additional information.'
    }
  }

  // Fallback - couldn't parse
  logger?.warn('Unable to parse Claude response into known XML schema')
  return {
    type: 'error',
    message: 'Could not parse AI response. Please try again.'
  }
}

export const config = {
  api: {
    bodyParser: false
  }
}

export default async function handler(req, res) {
  const requestId = createRequestId()
  const logger = createLogger(requestId)

  logger.info('Incoming /api/strategy request', {
    method: req.method,
    contentLength: req.headers['content-length']
  })

  if (req.method !== 'POST') {
    logger.warn('Rejected non-POST request')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    // Parse form data
    logger.debug('Parsing multipart form data')
    const form = formidable({
      multiples: true,
      maxFileSize: 50 * 1024 * 1024 // 50MB max
    })

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          logger.error('Form parsing error', err)
          reject(err)
        } else {
          resolve([fields, files])
        }
      })
    })
    logger.debug('Form data parsed', {
      fieldKeys: Object.keys(fields || {}),
      fileKeys: Object.keys(files || {})
    })

    const textInput = normalizeTextInput(fields.text)
    logger.debug('Text input normalized', {
      length: textInput.length,
      preview: previewForLog(textInput, 160)
    })

    // Convert files object to array
    const fileArray = []
    for (const key in files) {
      const file = files[key]
      if (Array.isArray(file)) {
        fileArray.push(...file)
      } else if (file) {
        fileArray.push(file)
      }
    }
    logger.debug('Uploaded files summarized', {
      total: fileArray.length,
      files: summarizeUploads(fileArray)
    })

    // Parse all uploaded files
    const parsedFiles = await parseUploadedFiles(fileArray, logger)
    const parsedSummary = parsedFiles.reduce(
      (acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1
        return acc
      },
      {}
    )
    logger.debug('Parsed file payload summary', parsedSummary)

    // Build context blob
    const { blob, images, pdfs } = buildContextBlob(textInput, parsedFiles)
    logger.debug('Context blob generated', {
      blobLength: blob.length,
      imageCount: images.length,
      pdfCount: pdfs.length
    })

    // Prepare user prompt
    const userPrompt = buildUserPrompt({ contextBlob: blob })
    logger.debug('User prompt prepared', {
      length: userPrompt.length,
      preview: previewForLog(userPrompt, 200)
    })

    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicApiKey) {
      logger.error('Missing ANTHROPIC_API_KEY environment variable')
      return res.status(500).json({
        type: 'error',
        message: 'Server misconfigured: ANTHROPIC_API_KEY is not set. Add it to your .env (local) or Vercel project and restart.'
      })
    }

    // Initialize Anthropic client
    logger.debug('Initializing Anthropic client')
    const anthropic = new Anthropic({
      apiKey: anthropicApiKey
    })

    // Count tokens for the entire request
    const tokenCount = await countTokens(anthropic, CLAUDE_MODEL, userPrompt, images, pdfs, logger)
    logger.info('Token count computed', { tokenCount })

    // Prepare message content with PDFs, images, and text
    const content = []

    // Add PDFs first (if any)
    for (const pdf of pdfs) {
      content.push({
        type: 'document',
        source: {
          type: 'base64',
          media_type: 'application/pdf',
          data: pdf.data
        }
      })
    }

    // Add images (if any)
    for (const img of images) {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: img.mimeType,
          data: img.data
        }
      })
    }

    // Add text prompt
    content.push({
      type: 'text',
      text: userPrompt
    })
    logger.debug('Prepared message content blocks', {
      totalBlocks: content.length,
      pdfCount: pdfs.length,
      imageCount: images.length
    })

    const baseClaudeRequest = {
      model: CLAUDE_MODEL,
      max_tokens: CLAUDE_MAX_TOKENS,
      system: BLUEPEAK_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content
        }
      ]
    }

    const requestWithThinking = THINKING_CONFIG
      ? {
          ...baseClaudeRequest,
          thinking: THINKING_CONFIG
        }
      : baseClaudeRequest

    let message
    try {
      message = await anthropic.messages.create(requestWithThinking)
    } catch (error) {
      if (shouldRetryWithoutThinking(error)) {
        logger.warn('Extended thinking request rejected. Retrying without thinking block.', {
          errorMessage: extractErrorMessage(error)
        })
        message = await anthropic.messages.create(baseClaudeRequest)
      } else {
        throw error
      }
    }
    logger.info('Anthropic response received', {
      messageId: message?.id,
      stopReason: message?.stop_reason,
      usage: message?.usage
    })

    // Extract response text
    const responseText = message.content.find(block => block.type === 'text')?.text || ''
    logger.debug('Extracted response text', {
      length: responseText.length,
      preview: previewForLog(responseText, 200)
    })

    // Parse XML response
    let parsedResponse = parseXMLResponse(responseText, logger)

    if (parsedResponse.type === 'clarification_needed') {
      const questionCount = Array.isArray(parsedResponse.questions) ? parsedResponse.questions.length : 0
      logger.info('Claude requested clarification', { questionCount })

      if (questionCount === 0) {
        logger.warn('Clarification response missing specific questions. Logging raw text for review.')
        logger.warn(responseText)
        parsedResponse = {
          ...parsedResponse,
          questions: [
            'BluePeak-AI requested clarification but did not return specific questions. Please refine your input or try again.'
          ]
        }
      }
    }

    // Add token count to response
    parsedResponse.tokenCount = tokenCount

    // Clean up temp files
    let cleanedFiles = 0
    for (const file of fileArray) {
      try {
        if (file?.filepath && fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath)
          cleanedFiles += 1
        }
      } catch (err) {
        logger.error('Error cleaning up file', { filename: file?.originalFilename, error: err })
      }
    }
    logger.debug('Temporary upload cleanup complete', { cleanedFiles })

    return res.status(200).json(parsedResponse)
  } catch (error) {
    logger.error('API Error while generating strategy', error)
    return res.status(500).json({
      type: 'error',
      message: error.message || 'An error occurred while processing your request',
      detail: extractErrorMessage(error)
    })
  }
}
