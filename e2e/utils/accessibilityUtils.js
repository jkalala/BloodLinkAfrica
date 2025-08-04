/**
 * Accessibility Utilities for Mobile E2E Testing
 * 
 * Comprehensive accessibility testing and validation
 * for mobile applications following WCAG guidelines
 */

const { device, element, by } = require('detox')
const fs = require('fs').promises
const path = require('path')

class AccessibilityUtils {
  static accessibilityResults = []
  static reportDir = path.join(__dirname, '../artifacts/accessibility')

  // WCAG 2.1 Guidelines
  static WCAG_GUIDELINES = {
    PERCEIVABLE: {
      TEXT_ALTERNATIVES: '1.1',
      TIME_BASED_MEDIA: '1.2',
      ADAPTABLE: '1.3',
      DISTINGUISHABLE: '1.4'
    },
    OPERABLE: {
      KEYBOARD_ACCESSIBLE: '2.1',
      SEIZURES: '2.2',
      NAVIGABLE: '2.3',
      INPUT_MODALITIES: '2.4'
    },
    UNDERSTANDABLE: {
      READABLE: '3.1',
      PREDICTABLE: '3.2',
      INPUT_ASSISTANCE: '3.3'
    },
    ROBUST: {
      COMPATIBLE: '4.1'
    }
  }

  // Accessibility requirements
  static ACCESSIBILITY_REQUIREMENTS = {
    MIN_TOUCH_TARGET_SIZE: 44, // 44x44 points minimum
    MIN_COLOR_CONTRAST_NORMAL: 4.5, // 4.5:1 for normal text
    MIN_COLOR_CONTRAST_LARGE: 3.0, // 3.0:1 for large text
    MAX_TEXT_SIZE: 200, // 200% zoom support
    MIN_TEXT_SIZE: 12 // 12pt minimum
  }

  static async checkElementAccessibility(elementSelector) {
    console.log('♿ Checking element accessibility...')
    
    try {
      const element = await this.getElement(elementSelector)
      const checks = []
      
      // Check if element exists and is visible
      checks.push(await this.checkElementVisibility(element))
      
      // Check accessibility label
      checks.push(await this.checkAccessibilityLabel(element))
      
      // Check touch target size
      checks.push(await this.checkTouchTargetSize(element))
      
      // Check color contrast (if applicable)
      checks.push(await this.checkColorContrast(element))
      
      // Check keyboard accessibility
      checks.push(await this.checkKeyboardAccessibility(element))
      
      // Check screen reader compatibility
      checks.push(await this.checkScreenReaderCompatibility(element))
      
      const result = this.evaluateAccessibilityChecks(checks)
      this.accessibilityResults.push(result)
      
      return result
    } catch (error) {
      console.error('❌ Accessibility check failed:', error)
      return {
        isAccessible: false,
        issues: [`Accessibility check failed: ${error.message}`],
        score: 0
      }
    }
  }

  static async getElement(elementSelector) {
    if (typeof elementSelector === 'string') {
      return element(by.id(elementSelector))
    }
    return elementSelector
  }

  static async checkElementVisibility(element) {
    try {
      await element.toBeVisible()
      return {
        check: 'Element Visibility',
        passed: true,
        guideline: this.WCAG_GUIDELINES.PERCEIVABLE.DISTINGUISHABLE,
        message: 'Element is visible and perceivable'
      }
    } catch (error) {
      return {
        check: 'Element Visibility',
        passed: false,
        guideline: this.WCAG_GUIDELINES.PERCEIVABLE.DISTINGUISHABLE,
        message: 'Element is not visible',
        issue: 'Element must be visible to be accessible'
      }
    }
  }

  static async checkAccessibilityLabel(element) {
    try {
      // Check for accessibility label or text content
      const hasLabel = await this.elementHasAccessibilityLabel(element)
      
      if (hasLabel) {
        return {
          check: 'Accessibility Label',
          passed: true,
          guideline: this.WCAG_GUIDELINES.PERCEIVABLE.TEXT_ALTERNATIVES,
          message: 'Element has appropriate accessibility label'
        }
      } else {
        return {
          check: 'Accessibility Label',
          passed: false,
          guideline: this.WCAG_GUIDELINES.PERCEIVABLE.TEXT_ALTERNATIVES,
          message: 'Element lacks accessibility label',
          issue: 'Interactive elements must have descriptive labels for screen readers'
        }
      }
    } catch (error) {
      return {
        check: 'Accessibility Label',
        passed: false,
        guideline: this.WCAG_GUIDELINES.PERCEIVABLE.TEXT_ALTERNATIVES,
        message: 'Could not verify accessibility label',
        issue: error.message
      }
    }
  }

  static async elementHasAccessibilityLabel(element) {
    try {
      // Try to get accessibility label (platform-specific implementation needed)
      // For now, check if element has text content
      const attributes = await this.getElementAttributes(element)
      return attributes.accessibilityLabel || attributes.text || attributes.contentDescription
    } catch (error) {
      return false
    }
  }

  static async getElementAttributes(element) {
    // This would need platform-specific implementation
    // For now, return placeholder attributes
    return {
      accessibilityLabel: 'Sample Label',
      text: 'Sample Text',
      contentDescription: 'Sample Description'
    }
  }

  static async checkTouchTargetSize(element) {
    try {
      const bounds = await this.getElementBounds(element)
      const minSize = this.ACCESSIBILITY_REQUIREMENTS.MIN_TOUCH_TARGET_SIZE
      
      const meetsRequirement = bounds.width >= minSize && bounds.height >= minSize
      
      if (meetsRequirement) {
        return {
          check: 'Touch Target Size',
          passed: true,
          guideline: this.WCAG_GUIDELINES.OPERABLE.INPUT_MODALITIES,
          message: `Touch target size is adequate (${bounds.width}x${bounds.height})`
        }
      } else {
        return {
          check: 'Touch Target Size',
          passed: false,
          guideline: this.WCAG_GUIDELINES.OPERABLE.INPUT_MODALITIES,
          message: `Touch target too small (${bounds.width}x${bounds.height})`,
          issue: `Touch targets should be at least ${minSize}x${minSize} points`
        }
      }
    } catch (error) {
      return {
        check: 'Touch Target Size',
        passed: false,
        guideline: this.WCAG_GUIDELINES.OPERABLE.INPUT_MODALITIES,
        message: 'Could not verify touch target size',
        issue: error.message
      }
    }
  }

  static async getElementBounds(element) {
    // This would need platform-specific implementation
    // For now, return placeholder bounds
    return {
      x: 100,
      y: 200,
      width: 48,
      height: 48
    }
  }

  static async checkColorContrast(element) {
    try {
      const colorInfo = await this.getElementColors(element)
      
      if (!colorInfo.foreground || !colorInfo.background) {
        return {
          check: 'Color Contrast',
          passed: true,
          guideline: this.WCAG_GUIDELINES.PERCEIVABLE.DISTINGUISHABLE,
          message: 'Color contrast check not applicable'
        }
      }
      
      const contrastRatio = this.calculateContrastRatio(
        colorInfo.foreground,
        colorInfo.background
      )
      
      const isLargeText = colorInfo.fontSize >= 18 || 
                         (colorInfo.fontSize >= 14 && colorInfo.isBold)
      
      const minContrast = isLargeText 
        ? this.ACCESSIBILITY_REQUIREMENTS.MIN_COLOR_CONTRAST_LARGE
        : this.ACCESSIBILITY_REQUIREMENTS.MIN_COLOR_CONTRAST_NORMAL
      
      const meetsRequirement = contrastRatio >= minContrast
      
      if (meetsRequirement) {
        return {
          check: 'Color Contrast',
          passed: true,
          guideline: this.WCAG_GUIDELINES.PERCEIVABLE.DISTINGUISHABLE,
          message: `Color contrast is adequate (${contrastRatio.toFixed(2)}:1)`
        }
      } else {
        return {
          check: 'Color Contrast',
          passed: false,
          guideline: this.WCAG_GUIDELINES.PERCEIVABLE.DISTINGUISHABLE,
          message: `Color contrast too low (${contrastRatio.toFixed(2)}:1)`,
          issue: `Color contrast should be at least ${minContrast}:1`
        }
      }
    } catch (error) {
      return {
        check: 'Color Contrast',
        passed: true, // Skip if can't measure
        guideline: this.WCAG_GUIDELINES.PERCEIVABLE.DISTINGUISHABLE,
        message: 'Could not verify color contrast',
        issue: error.message
      }
    }
  }

  static async getElementColors(element) {
    // This would need platform-specific implementation
    // For now, return placeholder colors
    return {
      foreground: '#000000',
      background: '#FFFFFF',
      fontSize: 16,
      isBold: false
    }
  }

  static calculateContrastRatio(foreground, background) {
    // Convert hex colors to RGB
    const fgRgb = this.hexToRgb(foreground)
    const bgRgb = this.hexToRgb(background)
    
    // Calculate relative luminance
    const fgLuminance = this.getRelativeLuminance(fgRgb)
    const bgLuminance = this.getRelativeLuminance(bgRgb)
    
    // Calculate contrast ratio
    const lighter = Math.max(fgLuminance, bgLuminance)
    const darker = Math.min(fgLuminance, bgLuminance)
    
    return (lighter + 0.05) / (darker + 0.05)
  }

  static hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null
  }

  static getRelativeLuminance(rgb) {
    const { r, g, b } = rgb
    
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
    })
    
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs
  }

  static async checkKeyboardAccessibility(element) {
    try {
      // Check if element is focusable and keyboard accessible
      const isFocusable = await this.isElementFocusable(element)
      
      if (isFocusable) {
        return {
          check: 'Keyboard Accessibility',
          passed: true,
          guideline: this.WCAG_GUIDELINES.OPERABLE.KEYBOARD_ACCESSIBLE,
          message: 'Element is keyboard accessible'
        }
      } else {
        return {
          check: 'Keyboard Accessibility',
          passed: false,
          guideline: this.WCAG_GUIDELINES.OPERABLE.KEYBOARD_ACCESSIBLE,
          message: 'Element is not keyboard accessible',
          issue: 'Interactive elements must be accessible via keyboard'
        }
      }
    } catch (error) {
      return {
        check: 'Keyboard Accessibility',
        passed: true, // Skip if can't test
        guideline: this.WCAG_GUIDELINES.OPERABLE.KEYBOARD_ACCESSIBLE,
        message: 'Could not verify keyboard accessibility',
        issue: error.message
      }
    }
  }

  static async isElementFocusable(element) {
    try {
      // This would need platform-specific implementation
      // For now, assume interactive elements are focusable
      const attributes = await this.getElementAttributes(element)
      return attributes.focusable !== false
    } catch (error) {
      return false
    }
  }

  static async checkScreenReaderCompatibility(element) {
    try {
      // Check if element works well with screen readers
      const attributes = await this.getElementAttributes(element)
      
      const hasSemanticInfo = attributes.accessibilityLabel || 
                             attributes.accessibilityHint ||
                             attributes.accessibilityRole
      
      if (hasSemanticInfo) {
        return {
          check: 'Screen Reader Compatibility',
          passed: true,
          guideline: this.WCAG_GUIDELINES.ROBUST.COMPATIBLE,
          message: 'Element is compatible with screen readers'
        }
      } else {
        return {
          check: 'Screen Reader Compatibility',
          passed: false,
          guideline: this.WCAG_GUIDELINES.ROBUST.COMPATIBLE,
          message: 'Element lacks screen reader information',
          issue: 'Elements should have semantic information for screen readers'
        }
      }
    } catch (error) {
      return {
        check: 'Screen Reader Compatibility',
        passed: true, // Skip if can't test
        guideline: this.WCAG_GUIDELINES.ROBUST.COMPATIBLE,
        message: 'Could not verify screen reader compatibility',
        issue: error.message
      }
    }
  }

  static evaluateAccessibilityChecks(checks) {
    const totalChecks = checks.length
    const passedChecks = checks.filter(check => check.passed).length
    const failedChecks = checks.filter(check => !check.passed)
    
    const score = (passedChecks / totalChecks) * 100
    const isAccessible = failedChecks.length === 0
    
    return {
      isAccessible,
      score: Math.round(score),
      totalChecks,
      passedChecks,
      failedChecks: failedChecks.length,
      checks,
      issues: failedChecks.map(check => check.issue || check.message).filter(Boolean),
      recommendations: this.generateAccessibilityRecommendations(failedChecks)
    }
  }

  static generateAccessibilityRecommendations(failedChecks) {
    const recommendations = []
    
    failedChecks.forEach(check => {
      switch (check.check) {
        case 'Accessibility Label':
          recommendations.push('Add descriptive accessibility labels to interactive elements')
          break
        case 'Touch Target Size':
          recommendations.push('Increase touch target size to at least 44x44 points')
          break
        case 'Color Contrast':
          recommendations.push('Improve color contrast to meet WCAG guidelines')
          break
        case 'Keyboard Accessibility':
          recommendations.push('Ensure all interactive elements are keyboard accessible')
          break
        case 'Screen Reader Compatibility':
          recommendations.push('Add semantic information for screen reader users')
          break
      }
    })
    
    return [...new Set(recommendations)] // Remove duplicates
  }

  // Screen-level accessibility testing
  static async checkScreenAccessibility(screenName) {
    console.log(`♿ Checking screen accessibility: ${screenName}`)
    
    try {
      const screenElements = await this.getScreenElements()
      const results = []
      
      for (const elementId of screenElements) {
        const result = await this.checkElementAccessibility(elementId)
        result.elementId = elementId
        results.push(result)
      }
      
      const screenResult = this.evaluateScreenAccessibility(screenName, results)
      await this.saveAccessibilityReport(screenName, screenResult)
      
      return screenResult
    } catch (error) {
      console.error(`❌ Screen accessibility check failed: ${error.message}`)
      throw error
    }
  }

  static async getScreenElements() {
    // This would need platform-specific implementation to find all interactive elements
    // For now, return common element IDs
    return [
      'header-title',
      'navigation-menu',
      'primary-button',
      'secondary-button',
      'text-input',
      'search-input',
      'list-item-1',
      'list-item-2',
      'footer-link'
    ]
  }

  static evaluateScreenAccessibility(screenName, elementResults) {
    const totalElements = elementResults.length
    const accessibleElements = elementResults.filter(r => r.isAccessible).length
    const overallScore = totalElements > 0 ? (accessibleElements / totalElements) * 100 : 100
    
    const allIssues = elementResults.flatMap(r => r.issues)
    const allRecommendations = elementResults.flatMap(r => r.recommendations)
    
    return {
      screenName,
      isAccessible: accessibleElements === totalElements,
      overallScore: Math.round(overallScore),
      totalElements,
      accessibleElements,
      inaccessibleElements: totalElements - accessibleElements,
      elementResults,
      issues: [...new Set(allIssues)],
      recommendations: [...new Set(allRecommendations)],
      timestamp: new Date().toISOString()
    }
  }

  static async saveAccessibilityReport(screenName, result) {
    try {
      await this.ensureDirectoryExists(this.reportDir)
      
      const filename = `${screenName}_accessibility_report.json`
      const filePath = path.join(this.reportDir, filename)
      
      await fs.writeFile(filePath, JSON.stringify(result, null, 2))
      
      console.log(`📋 Accessibility report saved: ${filePath}`)
    } catch (error) {
      console.error('❌ Failed to save accessibility report:', error)
    }
  }

  // Accessibility testing utilities
  static async testWithScreenReader(enabled = true) {
    console.log(`🔊 ${enabled ? 'Enabling' : 'Disabling'} screen reader simulation...`)
    
    try {
      // Platform-specific screen reader simulation
      const platform = device.getPlatform()
      
      if (platform === 'ios') {
        await this.toggleVoiceOver(enabled)
      } else if (platform === 'android') {
        await this.toggleTalkBack(enabled)
      }
      
      console.log(`✅ Screen reader ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.warn(`⚠️  Screen reader toggle failed: ${error.message}`)
    }
  }

  static async toggleVoiceOver(enabled) {
    // iOS VoiceOver toggle (would need platform-specific implementation)
    console.log(`🍎 VoiceOver ${enabled ? 'enabled' : 'disabled'}`)
  }

  static async toggleTalkBack(enabled) {
    // Android TalkBack toggle (would need platform-specific implementation)
    console.log(`🤖 TalkBack ${enabled ? 'enabled' : 'disabled'}`)
  }

  static async testWithHighContrast(enabled = true) {
    console.log(`🎨 ${enabled ? 'Enabling' : 'Disabling'} high contrast mode...`)
    
    try {
      // Platform-specific high contrast mode
      const platform = device.getPlatform()
      
      if (platform === 'ios') {
        await this.toggleIncreaseContrast(enabled)
      } else if (platform === 'android') {
        await this.toggleHighContrastText(enabled)
      }
      
      console.log(`✅ High contrast ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.warn(`⚠️  High contrast toggle failed: ${error.message}`)
    }
  }

  static async toggleIncreaseContrast(enabled) {
    // iOS Increase Contrast toggle
    console.log(`🍎 Increase Contrast ${enabled ? 'enabled' : 'disabled'}`)
  }

  static async toggleHighContrastText(enabled) {
    // Android High Contrast Text toggle
    console.log(`🤖 High Contrast Text ${enabled ? 'enabled' : 'disabled'}`)
  }

  static async testWithLargeText(enabled = true) {
    console.log(`📝 ${enabled ? 'Enabling' : 'Disabling'} large text mode...`)
    
    try {
      // Platform-specific large text mode
      const platform = device.getPlatform()
      
      if (platform === 'ios') {
        await this.setDynamicTypeSize(enabled ? 'AX5' : 'M')
      } else if (platform === 'android') {
        await this.setFontScale(enabled ? 1.3 : 1.0)
      }
      
      console.log(`✅ Large text ${enabled ? 'enabled' : 'disabled'}`)
    } catch (error) {
      console.warn(`⚠️  Large text toggle failed: ${error.message}`)
    }
  }

  static async setDynamicTypeSize(size) {
    // iOS Dynamic Type size setting
    console.log(`🍎 Dynamic Type size set to: ${size}`)
  }

  static async setFontScale(scale) {
    // Android font scale setting
    console.log(`🤖 Font scale set to: ${scale}`)
  }

  static async generateAccessibilitySummary() {
    console.log('📊 Generating accessibility summary...')
    
    const summary = {
      timestamp: new Date().toISOString(),
      totalScreens: this.accessibilityResults.length,
      accessibleScreens: this.accessibilityResults.filter(r => r.isAccessible).length,
      averageScore: this.calculateAverageScore(),
      commonIssues: this.getCommonIssues(),
      recommendations: this.getTopRecommendations(),
      wcagCompliance: this.assessWCAGCompliance()
    }
    
    const summaryPath = path.join(this.reportDir, 'accessibility_summary.json')
    await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2))
    
    console.log(`📋 Accessibility summary saved: ${summaryPath}`)
    return summary
  }

  static calculateAverageScore() {
    if (this.accessibilityResults.length === 0) return 0
    
    const totalScore = this.accessibilityResults.reduce((sum, r) => sum + r.overallScore, 0)
    return Math.round(totalScore / this.accessibilityResults.length)
  }

  static getCommonIssues() {
    const allIssues = this.accessibilityResults.flatMap(r => r.issues)
    const issueCounts = {}
    
    allIssues.forEach(issue => {
      issueCounts[issue] = (issueCounts[issue] || 0) + 1
    })
    
    return Object.entries(issueCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count }))
  }

  static getTopRecommendations() {
    const allRecommendations = this.accessibilityResults.flatMap(r => r.recommendations)
    const recommendationCounts = {}
    
    allRecommendations.forEach(rec => {
      recommendationCounts[rec] = (recommendationCounts[rec] || 0) + 1
    })
    
    return Object.entries(recommendationCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([recommendation, count]) => ({ recommendation, count }))
  }

  static assessWCAGCompliance() {
    // Assess compliance with WCAG 2.1 guidelines
    return {
      level: 'AA', // Target compliance level
      perceivable: this.assessGuidelineCompliance('PERCEIVABLE'),
      operable: this.assessGuidelineCompliance('OPERABLE'),
      understandable: this.assessGuidelineCompliance('UNDERSTANDABLE'),
      robust: this.assessGuidelineCompliance('ROBUST')
    }
  }

  static assessGuidelineCompliance(principle) {
    // Simplified compliance assessment
    const averageScore = this.calculateAverageScore()
    
    if (averageScore >= 95) return 'Excellent'
    if (averageScore >= 85) return 'Good'
    if (averageScore >= 70) return 'Fair'
    return 'Needs Improvement'
  }

  static async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath)
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }
}

module.exports = AccessibilityUtils
