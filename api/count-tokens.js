import Anthropic from '@anthropic-ai/sdk'
import formidable from 'formidable'
import fs from 'fs'
import { BLUEPEAK_SYSTEM_PROMPT, buildUserPrompt } from './prompts.js'
import { buildContextBlob, normalizeTextInput, parseUploadedFiles } from './file-processing.js'

const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5'

const createRequestId = () => `bp-tokens-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

const createLogger = (requestId) => {
  const prefix = `[BluePeak][TokenCountAPI][${requestId}]`
  return {
    debug: (...args) => console.debug(prefix, ...args),
    info: (...args) => console.log(prefix, ...args),
    warn: (...args) => console.warn(prefix, ...args),
    error: (...args) => console.error(prefix, ...args)
  }
}

const previewForLog = (value = '', length = 120) => {
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

// Cache the baseline token count to avoid recalculating
let cachedBaselineTokens = null

export const config = {
  api: {
    bodyParser: false
  }
}

export default async function handler(req, res) {
  const requestId = createRequestId()
  const logger = createLogger(requestId)

  logger.info('Incoming /api/count-tokens request', { method: req.method })

  if (req.method !== 'POST') {
    logger.warn('Rejected non-POST token count request')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const anthropicApiKey = process.env.ANTHROPIC_API_KEY
    if (!anthropicApiKey) {
      logger.error('Missing ANTHROPIC_API_KEY for token counter')
      return res.status(500).json({
        error: 'Server misconfigured: ANTHROPIC_API_KEY is not set.'
      })
    }

    // Parse form data
    logger.debug('Parsing multipart form data for token count')
    const form = formidable({
      multiples: true,
      maxFileSize: 50 * 1024 * 1024 // 50MB max
    })

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) {
          logger.error('Form parsing error (token count)', err)
          reject(err)
        } else {
          resolve([fields, files])
        }
      })
    })

    const textInput = normalizeTextInput(fields.text)
    logger.debug('Token count text input normalized', {
      length: textInput.length,
      preview: previewForLog(textInput)
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
    logger.debug('Token count uploaded files', {
      total: fileArray.length,
      files: summarizeUploads(fileArray)
    })

    // Initialize Anthropic client
    const anthropic = new Anthropic({
      apiKey: anthropicApiKey
    })

    // If there are no files and no text, return 0
    if (!textInput.trim() && fileArray.length === 0) {
      logger.info('Token count request empty, returning 0')
      return res.status(200).json({ tokens: 0 })
    }

    // Parse all uploaded files
    const parsedFiles = await parseUploadedFiles(fileArray, logger)
    const parsedSummary = parsedFiles.reduce(
      (acc, item) => {
        acc[item.type] = (acc[item.type] || 0) + 1
        return acc
      },
      {}
    )
    logger.debug('Token count parsed file summary', parsedSummary)

    // Build context blob
    const { blob, images, pdfs } = buildContextBlob(textInput, parsedFiles)
    logger.debug('Token count context blob generated', {
      blobLength: blob.length,
      imageCount: images.length,
      pdfCount: pdfs.length
    })
    const textCharacterCount = textInput.length + parsedFiles.reduce(
      (total, file) => (file.type === 'text' && typeof file.content === 'string' ? total + file.content.length : total),
      0
    )

    // Prepare user prompt
    const userPrompt = buildUserPrompt({ contextBlob: blob })
    logger.debug('Token count user prompt prepared', {
      length: userPrompt.length
    })

    // Calculate baseline token count (system prompt + empty message with delimiters) - cached
    if (cachedBaselineTokens === null) {
      logger.debug('Computing baseline token count for cache miss')
      const emptyPrompt = buildUserPrompt({ contextBlob: '' })
      const baselineCount = await anthropic.messages.countTokens({
        model: CLAUDE_MODEL,
        system: BLUEPEAK_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [{ type: 'text', text: emptyPrompt }]
        }]
      })
      cachedBaselineTokens = baselineCount.input_tokens
      logger.debug('Baseline token count cached', { baselineTokens: cachedBaselineTokens })
    }

    // Prepare content array for token counting
    const content = []

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

    // Add text prompt
    content.push({
      type: 'text',
      text: userPrompt
    })
    logger.debug('Token count content array prepared', {
      blockCount: content.length,
      pdfCount: pdfs.length,
      imageCount: images.length
    })

    // Count tokens for full request
    const fullTokenCount = await anthropic.messages.countTokens({
      model: CLAUDE_MODEL,
      system: BLUEPEAK_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: content
      }]
    })
    logger.info('Token count API responded', {
      totalInputTokens: fullTokenCount.input_tokens,
      cachedBaselineTokens
    })

    // Calculate actual user content tokens (subtract baseline)
    let userContentTokens = fullTokenCount.input_tokens - cachedBaselineTokens
    if (userContentTokens <= 0) {
      const fallbackEstimate = Math.max(1, Math.ceil(textCharacterCount / 4))
      logger.warn('Baseline subtraction yielded non-positive token count. Using fallback estimate.', {
        fallbackEstimate,
        textCharacterCount,
        fullTokens: fullTokenCount.input_tokens,
        baselineTokens: cachedBaselineTokens
      })
      userContentTokens = fallbackEstimate
    }

    // Clean up temp files
    let cleanedFiles = 0
    for (const file of fileArray) {
      try {
        if (file.filepath && fs.existsSync(file.filepath)) {
          fs.unlinkSync(file.filepath)
          cleanedFiles += 1
        }
      } catch (err) {
        logger.error('Error cleaning up file after token count', { filename: file?.originalFilename, error: err })
      }
    }
    logger.debug('Token count cleanup complete', { cleanedFiles })

    logger.info('User content tokens computed', {
      tokens: userContentTokens,
      hasFiles: fileArray.length > 0
    })

    return res.status(200).json({
      tokens: userContentTokens,
      hasFiles: fileArray.length > 0,
      fileCount: fileArray.length
    })
  } catch (error) {
    logger.error('Token counting error', error)
    // Return fallback estimate - use 0 if we can't estimate
    return res.status(200).json({
      tokens: 0,
      error: 'Token counting failed'
    })
  }
}
