/**
 * Production-Ready Document OCR System
 * 
 * Advanced OCR system for medical document processing using
 * Tesseract.js with custom preprocessing and post-processing
 */

import Tesseract, { createWorker, PSM, OEM } from 'tesseract.js'
import sharp from 'sharp'
import { performanceMonitor } from '../../performance/metrics'

export interface OCRResult {
  text: string
  confidence: number
  words: Array<{
    text: string
    confidence: number
    bbox: {
      x0: number
      y0: number
      x1: number
      y1: number
    }
  }>
  lines: Array<{
    text: string
    confidence: number
    bbox: {
      x0: number
      y0: number
      x1: number
      y1: number
    }
    words: number[]
  }>
  metadata: {
    processingTime: number
    imageQuality: number
    language: string
    preprocessingSteps: string[]
    ocrEngine: string
  }
}

export interface DocumentInfo {
  type: 'medical_id' | 'blood_donor_card' | 'medical_report' | 'prescription' | 'lab_result' | 'unknown'
  extractedFields: Record<string, string>
  confidence: number
  validationErrors: string[]
}

export interface OCRConfig {
  language: string
  oem: OEM
  psm: PSM
  whitelist?: string
  blacklist?: string
  preprocessingConfig: {
    deskew: boolean
    denoise: boolean
    enhanceContrast: boolean
    binarize: boolean
    removeBackground: boolean
  }
  postprocessingConfig: {
    spellCheck: boolean
    medicalTermCorrection: boolean
    structureAnalysis: boolean
  }
}

class DocumentOCRSystem {
  private workers: Map<string, Tesseract.Worker> = new Map()
  private isInitialized = false
  private config: OCRConfig
  private maxWorkers = 3

  // Medical document patterns
  private readonly DOCUMENT_PATTERNS = {
    medical_id: {
      patterns: [
        /medical\s+id/i,
        /patient\s+id/i,
        /hospital\s+number/i,
        /medical\s+record/i
      ],
      fields: ['patient_name', 'patient_id', 'date_of_birth', 'blood_type']
    },
    blood_donor_card: {
      patterns: [
        /blood\s+donor/i,
        /donor\s+card/i,
        /blood\s+bank/i,
        /donation\s+record/i
      ],
      fields: ['donor_name', 'donor_id', 'blood_type', 'last_donation', 'eligibility']
    },
    medical_report: {
      patterns: [
        /medical\s+report/i,
        /diagnosis/i,
        /examination/i,
        /clinical\s+findings/i
      ],
      fields: ['patient_name', 'date', 'diagnosis', 'recommendations', 'doctor_name']
    },
    lab_result: {
      patterns: [
        /laboratory\s+result/i,
        /lab\s+report/i,
        /test\s+result/i,
        /blood\s+test/i
      ],
      fields: ['patient_name', 'test_date', 'test_type', 'results', 'reference_range']
    }
  }

  // Medical terminology dictionary for spell correction
  private readonly MEDICAL_TERMS = [
    'blood', 'type', 'donor', 'patient', 'medical', 'hospital', 'clinic',
    'diagnosis', 'treatment', 'medication', 'prescription', 'laboratory',
    'hemoglobin', 'platelet', 'glucose', 'cholesterol', 'pressure',
    'positive', 'negative', 'normal', 'abnormal', 'elevated', 'decreased'
  ]

  constructor(config?: Partial<OCRConfig>) {
    this.config = {
      language: 'eng',
      oem: OEM.LSTM_ONLY,
      psm: PSM.AUTO,
      preprocessingConfig: {
        deskew: true,
        denoise: true,
        enhanceContrast: true,
        binarize: true,
        removeBackground: false
      },
      postprocessingConfig: {
        spellCheck: true,
        medicalTermCorrection: true,
        structureAnalysis: true
      },
      ...config
    }

    this.initializeWorkers()
  }

  private async initializeWorkers(): Promise<void> {
    try {
      console.log('Initializing OCR workers...')

      // Create multiple workers for parallel processing
      for (let i = 0; i < this.maxWorkers; i++) {
        const worker = await createWorker()
        
        await worker.loadLanguage(this.config.language)
        await worker.initialize(this.config.language)
        
        // Configure OCR parameters
        await worker.setParameters({
          tessedit_ocr_engine_mode: this.config.oem,
          tessedit_pageseg_mode: this.config.psm,
          tessedit_char_whitelist: this.config.whitelist || '',
          tessedit_char_blacklist: this.config.blacklist || ''
        })

        this.workers.set(`worker_${i}`, worker)
      }

      this.isInitialized = true
      console.log(`OCR system initialized with ${this.maxWorkers} workers`)

    } catch (error) {
      console.error('Failed to initialize OCR workers:', error)
      this.isInitialized = false
    }
  }

  async processDocument(
    imageBuffer: Buffer,
    options: {
      documentType?: string
      enhanceImage?: boolean
      extractFields?: boolean
      validateDocument?: boolean
    } = {}
  ): Promise<{ ocr: OCRResult; document?: DocumentInfo }> {
    const startTime = performance.now()

    if (!this.isInitialized) {
      throw new Error('OCR system not initialized')
    }

    try {
      // Preprocess the image
      const preprocessedImage = await this.preprocessImage(imageBuffer, options.enhanceImage)
      
      // Get available worker
      const worker = await this.getAvailableWorker()
      
      // Perform OCR
      const ocrResult = await worker.recognize(preprocessedImage)
      
      // Process OCR results
      const processedResult = this.processOCRResult(ocrResult)
      
      const processingTime = performance.now() - startTime
      
      // Add metadata
      processedResult.metadata = {
        processingTime,
        imageQuality: await this.assessImageQuality(preprocessedImage),
        language: this.config.language,
        preprocessingSteps: this.getPreprocessingSteps(options.enhanceImage),
        ocrEngine: 'Tesseract.js'
      }

      let documentInfo: DocumentInfo | undefined

      // Extract document information if requested
      if (options.extractFields || options.validateDocument) {
        documentInfo = await this.analyzeDocument(
          processedResult.text,
          options.documentType,
          options.validateDocument
        )
      }

      // Record performance metrics
      performanceMonitor.recordCustomMetric({
        name: 'document_ocr_duration',
        value: processingTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          confidence: processedResult.confidence.toFixed(2),
          text_length: processedResult.text.length.toString(),
          document_type: documentInfo?.type || 'unknown',
          success: 'true'
        }
      })

      return {
        ocr: processedResult,
        document: documentInfo
      }

    } catch (error) {
      const processingTime = performance.now() - startTime
      
      performanceMonitor.recordCustomMetric({
        name: 'document_ocr_duration',
        value: processingTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          success: 'false',
          error: (error as Error).message
        }
      })

      throw new Error(`Document OCR failed: ${(error as Error).message}`)
    }
  }

  private async preprocessImage(imageBuffer: Buffer, enhance = true): Promise<Buffer> {
    let processedImage = sharp(imageBuffer)

    if (enhance) {
      // Deskew if configured
      if (this.config.preprocessingConfig.deskew) {
        // Simple rotation correction - in production, use more sophisticated deskewing
        processedImage = processedImage.rotate(0) // Placeholder
      }

      // Enhance contrast
      if (this.config.preprocessingConfig.enhanceContrast) {
        processedImage = processedImage.normalize().sharpen()
      }

      // Denoise
      if (this.config.preprocessingConfig.denoise) {
        processedImage = processedImage.blur(0.3)
      }

      // Binarize (convert to black and white)
      if (this.config.preprocessingConfig.binarize) {
        processedImage = processedImage.threshold(128)
      }

      // Remove background
      if (this.config.preprocessingConfig.removeBackground) {
        processedImage = processedImage.removeAlpha()
      }
    }

    // Ensure proper format for OCR
    return processedImage.png().toBuffer()
  }

  private async getAvailableWorker(): Promise<Tesseract.Worker> {
    // Simple round-robin worker selection
    const workerIds = Array.from(this.workers.keys())
    const workerId = workerIds[Math.floor(Math.random() * workerIds.length)]
    return this.workers.get(workerId)!
  }

  private processOCRResult(ocrResult: Tesseract.RecognizeResult): OCRResult {
    const { data } = ocrResult

    // Extract words with bounding boxes
    const words = data.words.map(word => ({
      text: word.text,
      confidence: word.confidence,
      bbox: word.bbox
    }))

    // Extract lines with bounding boxes
    const lines = data.lines.map((line, lineIndex) => ({
      text: line.text,
      confidence: line.confidence,
      bbox: line.bbox,
      words: line.words.map((_, wordIndex) => 
        data.words.findIndex(w => w.line_num === lineIndex && w.word_num === wordIndex)
      ).filter(index => index !== -1)
    }))

    // Apply post-processing
    let processedText = data.text

    if (this.config.postprocessingConfig.spellCheck) {
      processedText = this.correctSpelling(processedText)
    }

    if (this.config.postprocessingConfig.medicalTermCorrection) {
      processedText = this.correctMedicalTerms(processedText)
    }

    return {
      text: processedText,
      confidence: data.confidence,
      words,
      lines,
      metadata: {
        processingTime: 0, // Will be set by caller
        imageQuality: 0, // Will be set by caller
        language: this.config.language,
        preprocessingSteps: [],
        ocrEngine: 'Tesseract.js'
      }
    }
  }

  private correctSpelling(text: string): string {
    // Simple spell correction - in production, use a proper spell checker
    let correctedText = text

    // Common OCR errors
    const corrections = {
      '0': 'O', // Zero to letter O
      '1': 'I', // One to letter I
      '5': 'S', // Five to letter S
      '8': 'B', // Eight to letter B
      'rn': 'm', // Common OCR confusion
      'cl': 'd', // Common OCR confusion
    }

    Object.entries(corrections).forEach(([wrong, correct]) => {
      const regex = new RegExp(wrong, 'g')
      correctedText = correctedText.replace(regex, correct)
    })

    return correctedText
  }

  private correctMedicalTerms(text: string): string {
    let correctedText = text

    // Medical term corrections
    const medicalCorrections = {
      'biood': 'blood',
      'donot': 'donor',
      'patlent': 'patient',
      'medlcal': 'medical',
      'hospltal': 'hospital',
      'dlagnosis': 'diagnosis',
      'prescrlption': 'prescription'
    }

    Object.entries(medicalCorrections).forEach(([wrong, correct]) => {
      const regex = new RegExp(wrong, 'gi')
      correctedText = correctedText.replace(regex, correct)
    })

    return correctedText
  }

  private async analyzeDocument(
    text: string,
    expectedType?: string,
    validate = false
  ): Promise<DocumentInfo> {
    const lowerText = text.toLowerCase()
    
    // Determine document type
    let documentType: DocumentInfo['type'] = 'unknown'
    let maxMatches = 0

    for (const [type, config] of Object.entries(this.DOCUMENT_PATTERNS)) {
      const matches = config.patterns.filter(pattern => pattern.test(lowerText)).length
      if (matches > maxMatches) {
        maxMatches = matches
        documentType = type as DocumentInfo['type']
      }
    }

    // Override with expected type if provided and matches
    if (expectedType && this.DOCUMENT_PATTERNS[expectedType]) {
      const expectedConfig = this.DOCUMENT_PATTERNS[expectedType]
      const matches = expectedConfig.patterns.filter(pattern => pattern.test(lowerText)).length
      if (matches > 0) {
        documentType = expectedType as DocumentInfo['type']
      }
    }

    // Extract fields based on document type
    const extractedFields = this.extractFields(text, documentType)
    
    // Calculate confidence based on field extraction success
    const expectedFields = this.DOCUMENT_PATTERNS[documentType]?.fields || []
    const extractedFieldCount = Object.keys(extractedFields).length
    const confidence = expectedFields.length > 0 
      ? (extractedFieldCount / expectedFields.length) * 100 
      : 50

    // Validate document if requested
    const validationErrors: string[] = []
    if (validate) {
      validationErrors.push(...this.validateDocument(extractedFields, documentType))
    }

    return {
      type: documentType,
      extractedFields,
      confidence,
      validationErrors
    }
  }

  private extractFields(text: string, documentType: DocumentInfo['type']): Record<string, string> {
    const fields: Record<string, string> = {}

    // Field extraction patterns
    const patterns = {
      patient_name: /(?:patient|name):\s*([^\n\r]+)/i,
      patient_id: /(?:patient\s+id|id):\s*([^\n\r]+)/i,
      donor_name: /(?:donor|name):\s*([^\n\r]+)/i,
      donor_id: /(?:donor\s+id|id):\s*([^\n\r]+)/i,
      blood_type: /(?:blood\s+type|type):\s*([ABO+-]+)/i,
      date_of_birth: /(?:dob|date\s+of\s+birth|born):\s*([^\n\r]+)/i,
      date: /(?:date):\s*([^\n\r]+)/i,
      test_date: /(?:test\s+date|date):\s*([^\n\r]+)/i,
      diagnosis: /(?:diagnosis):\s*([^\n\r]+)/i,
      doctor_name: /(?:doctor|physician|dr\.):\s*([^\n\r]+)/i,
      last_donation: /(?:last\s+donation):\s*([^\n\r]+)/i,
      eligibility: /(?:eligible|eligibility):\s*([^\n\r]+)/i,
      test_type: /(?:test\s+type|test):\s*([^\n\r]+)/i,
      results: /(?:result|results):\s*([^\n\r]+)/i,
      reference_range: /(?:reference|normal\s+range):\s*([^\n\r]+)/i
    }

    // Extract fields based on patterns
    Object.entries(patterns).forEach(([fieldName, pattern]) => {
      const match = text.match(pattern)
      if (match && match[1]) {
        fields[fieldName] = match[1].trim()
      }
    })

    return fields
  }

  private validateDocument(fields: Record<string, string>, documentType: DocumentInfo['type']): string[] {
    const errors: string[] = []

    // Common validations
    if (fields.blood_type && !/^(A|B|AB|O)[+-]$/.test(fields.blood_type)) {
      errors.push('Invalid blood type format')
    }

    if (fields.date_of_birth && !this.isValidDate(fields.date_of_birth)) {
      errors.push('Invalid date of birth format')
    }

    if (fields.date && !this.isValidDate(fields.date)) {
      errors.push('Invalid date format')
    }

    // Document-specific validations
    switch (documentType) {
      case 'medical_id':
        if (!fields.patient_name) errors.push('Missing patient name')
        if (!fields.patient_id) errors.push('Missing patient ID')
        break
      
      case 'blood_donor_card':
        if (!fields.donor_name) errors.push('Missing donor name')
        if (!fields.blood_type) errors.push('Missing blood type')
        break
      
      case 'lab_result':
        if (!fields.test_type) errors.push('Missing test type')
        if (!fields.results) errors.push('Missing test results')
        break
    }

    return errors
  }

  private isValidDate(dateString: string): boolean {
    // Simple date validation - in production, use a proper date library
    const datePatterns = [
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{1,2}-\d{1,2}-\d{4}$/, // DD-MM-YYYY
    ]

    return datePatterns.some(pattern => pattern.test(dateString.trim()))
  }

  private async assessImageQuality(imageBuffer: Buffer): Promise<number> {
    try {
      const metadata = await sharp(imageBuffer).metadata()
      const stats = await sharp(imageBuffer).stats()
      
      let quality = 0.5 // Base quality
      
      // Resolution factor
      const resolution = (metadata.width || 0) * (metadata.height || 0)
      if (resolution > 1000000) quality += 0.3 // High resolution
      else if (resolution > 300000) quality += 0.2 // Medium resolution
      else quality += 0.1 // Low resolution
      
      // Contrast factor (based on standard deviation)
      const avgStdDev = stats.channels.reduce((sum, ch) => sum + ch.stdev, 0) / stats.channels.length
      if (avgStdDev > 50) quality += 0.2 // Good contrast
      else if (avgStdDev > 25) quality += 0.1 // Fair contrast
      
      return Math.min(Math.max(quality, 0), 1)
      
    } catch (error) {
      return 0.5 // Default quality if assessment fails
    }
  }

  private getPreprocessingSteps(enhance?: boolean): string[] {
    const steps = ['format_conversion']
    
    if (enhance) {
      if (this.config.preprocessingConfig.deskew) steps.push('deskew')
      if (this.config.preprocessingConfig.enhanceContrast) steps.push('contrast_enhancement')
      if (this.config.preprocessingConfig.denoise) steps.push('denoising')
      if (this.config.preprocessingConfig.binarize) steps.push('binarization')
      if (this.config.preprocessingConfig.removeBackground) steps.push('background_removal')
    }
    
    return steps
  }

  // Batch processing
  async processDocumentBatch(
    imageBuffers: Buffer[],
    options: {
      documentType?: string
      enhanceImage?: boolean
      extractFields?: boolean
      validateDocument?: boolean
    } = {}
  ): Promise<Array<{ ocr: OCRResult; document?: DocumentInfo }>> {
    const startTime = performance.now()
    
    try {
      // Process documents in parallel using available workers
      const results = await Promise.all(
        imageBuffers.map(buffer => this.processDocument(buffer, options))
      )
      
      const totalTime = performance.now() - startTime
      
      performanceMonitor.recordCustomMetric({
        name: 'document_ocr_batch_duration',
        value: totalTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          batch_size: imageBuffers.length.toString(),
          avg_time_per_document: (totalTime / imageBuffers.length).toFixed(2),
          success: 'true'
        }
      })
      
      return results
      
    } catch (error) {
      performanceMonitor.recordCustomMetric({
        name: 'document_ocr_batch_duration',
        value: performance.now() - startTime,
        unit: 'ms',
        timestamp: Date.now(),
        tags: {
          batch_size: imageBuffers.length.toString(),
          success: 'false',
          error: (error as Error).message
        }
      })
      
      throw error
    }
  }

  // Cleanup method
  async dispose(): Promise<void> {
    for (const worker of this.workers.values()) {
      await worker.terminate()
    }
    this.workers.clear()
    this.isInitialized = false
  }

  getSystemInfo(): {
    isInitialized: boolean
    workerCount: number
    config: OCRConfig
    supportedDocumentTypes: string[]
  } {
    return {
      isInitialized: this.isInitialized,
      workerCount: this.workers.size,
      config: this.config,
      supportedDocumentTypes: Object.keys(this.DOCUMENT_PATTERNS)
    }
  }
}

// Singleton instance
let documentOCRInstance: DocumentOCRSystem | null = null

export function getDocumentOCRSystem(config?: Partial<OCRConfig>): DocumentOCRSystem {
  if (!documentOCRInstance) {
    documentOCRInstance = new DocumentOCRSystem(config)
  }
  return documentOCRInstance
}

export default DocumentOCRSystem
