/**
 * Screenshot Utilities for Visual Regression Testing
 * 
 * Comprehensive screenshot management and visual comparison
 * for mobile E2E testing with baseline management
 */

const { device, element } = require('detox')
const fs = require('fs').promises
const path = require('path')
const { PNG } = require('pngjs')
const pixelmatch = require('pixelmatch')

class ScreenshotUtils {
  static screenshotCounter = 0
  static baselineDir = path.join(__dirname, '../baselines')
  static screenshotDir = path.join(__dirname, '../artifacts/screenshots')
  static diffDir = path.join(__dirname, '../artifacts/diffs')

  static async takeScreenshot(name, options = {}) {
    this.screenshotCounter++
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `${this.screenshotCounter}_${name}_${timestamp}.png`
    const screenshotPath = path.join(this.screenshotDir, filename)
    
    console.log(`📸 Taking screenshot: ${filename}`)
    
    try {
      // Ensure screenshot directory exists
      await this.ensureDirectoryExists(this.screenshotDir)
      
      // Take screenshot with device
      await device.takeScreenshot(filename)
      
      // Move screenshot to artifacts directory
      const deviceScreenshotPath = path.join(process.cwd(), 'artifacts', filename)
      await this.moveFile(deviceScreenshotPath, screenshotPath)
      
      // Add to global test state
      if (global.testState) {
        global.testState.screenshots.push({
          name,
          filename,
          path: screenshotPath,
          timestamp: new Date().toISOString(),
          testName: global.testState.currentTest
        })
      }
      
      console.log(`✅ Screenshot saved: ${screenshotPath}`)
      return screenshotPath
    } catch (error) {
      console.error(`❌ Failed to take screenshot: ${error.message}`)
      throw error
    }
  }

  static async takeElementScreenshot(elementSelector, name, options = {}) {
    console.log(`📸 Taking element screenshot: ${name}`)
    
    try {
      // Wait for element to be visible
      await element(elementSelector).toBeVisible()
      
      // Take full screenshot first
      const fullScreenshotPath = await this.takeScreenshot(`${name}_full`)
      
      // Get element bounds (this would need platform-specific implementation)
      const elementBounds = await this.getElementBounds(elementSelector)
      
      // Crop screenshot to element bounds
      const croppedPath = await this.cropScreenshot(fullScreenshotPath, elementBounds, name)
      
      return croppedPath
    } catch (error) {
      console.error(`❌ Failed to take element screenshot: ${error.message}`)
      throw error
    }
  }

  static async getElementBounds(elementSelector) {
    // This would need platform-specific implementation
    // For now, return placeholder bounds
    return {
      x: 0,
      y: 100,
      width: 375,
      height: 200
    }
  }

  static async cropScreenshot(screenshotPath, bounds, name) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const croppedFilename = `cropped_${name}_${timestamp}.png`
    const croppedPath = path.join(this.screenshotDir, croppedFilename)
    
    try {
      // Read original screenshot
      const originalBuffer = await fs.readFile(screenshotPath)
      const originalPng = PNG.sync.read(originalBuffer)
      
      // Create cropped PNG
      const croppedPng = new PNG({
        width: bounds.width,
        height: bounds.height
      })
      
      // Copy pixels from original to cropped
      PNG.bitblt(
        originalPng, croppedPng,
        bounds.x, bounds.y, bounds.width, bounds.height,
        0, 0
      )
      
      // Save cropped screenshot
      const croppedBuffer = PNG.sync.write(croppedPng)
      await fs.writeFile(croppedPath, croppedBuffer)
      
      console.log(`✂️  Screenshot cropped: ${croppedPath}`)
      return croppedPath
    } catch (error) {
      console.error(`❌ Failed to crop screenshot: ${error.message}`)
      throw error
    }
  }

  static async compareWithBaseline(screenshotPath, baselineName, threshold = 0.1) {
    console.log(`🔍 Comparing with baseline: ${baselineName}`)
    
    const baselinePath = path.join(this.baselineDir, `${baselineName}.png`)
    const diffPath = path.join(this.diffDir, `${baselineName}_diff.png`)
    
    try {
      // Ensure directories exist
      await this.ensureDirectoryExists(this.diffDir)
      
      // Check if baseline exists
      const baselineExists = await this.fileExists(baselinePath)
      if (!baselineExists) {
        console.log(`📝 Creating new baseline: ${baselineName}`)
        await this.createBaseline(screenshotPath, baselineName)
        return {
          isMatch: true,
          isNewBaseline: true,
          diffPercentage: 0
        }
      }
      
      // Read images
      const screenshotBuffer = await fs.readFile(screenshotPath)
      const baselineBuffer = await fs.readFile(baselinePath)
      
      const screenshotPng = PNG.sync.read(screenshotBuffer)
      const baselinePng = PNG.sync.read(baselineBuffer)
      
      // Check dimensions match
      if (screenshotPng.width !== baselinePng.width || 
          screenshotPng.height !== baselinePng.height) {
        console.warn(`⚠️  Image dimensions don't match for ${baselineName}`)
        return {
          isMatch: false,
          diffPercentage: 100,
          error: 'Dimension mismatch'
        }
      }
      
      // Create diff image
      const diffPng = new PNG({
        width: screenshotPng.width,
        height: screenshotPng.height
      })
      
      // Compare images
      const diffPixels = pixelmatch(
        screenshotPng.data,
        baselinePng.data,
        diffPng.data,
        screenshotPng.width,
        screenshotPng.height,
        {
          threshold: 0.1,
          includeAA: false
        }
      )
      
      const totalPixels = screenshotPng.width * screenshotPng.height
      const diffPercentage = (diffPixels / totalPixels) * 100
      
      // Save diff image if there are differences
      if (diffPixels > 0) {
        const diffBuffer = PNG.sync.write(diffPng)
        await fs.writeFile(diffPath, diffBuffer)
        console.log(`💾 Diff image saved: ${diffPath}`)
      }
      
      const isMatch = diffPercentage <= threshold
      
      console.log(`📊 Visual comparison result: ${diffPercentage.toFixed(2)}% difference`)
      
      return {
        isMatch,
        diffPercentage: parseFloat(diffPercentage.toFixed(2)),
        diffPixels,
        totalPixels,
        diffPath: diffPixels > 0 ? diffPath : null
      }
    } catch (error) {
      console.error(`❌ Failed to compare with baseline: ${error.message}`)
      throw error
    }
  }

  static async createBaseline(screenshotPath, baselineName) {
    const baselinePath = path.join(this.baselineDir, `${baselineName}.png`)
    
    try {
      // Ensure baseline directory exists
      await this.ensureDirectoryExists(this.baselineDir)
      
      // Copy screenshot to baseline
      await this.copyFile(screenshotPath, baselinePath)
      
      console.log(`📝 Baseline created: ${baselinePath}`)
    } catch (error) {
      console.error(`❌ Failed to create baseline: ${error.message}`)
      throw error
    }
  }

  static async updateBaseline(screenshotPath, baselineName) {
    console.log(`🔄 Updating baseline: ${baselineName}`)
    
    try {
      await this.createBaseline(screenshotPath, baselineName)
      console.log(`✅ Baseline updated: ${baselineName}`)
    } catch (error) {
      console.error(`❌ Failed to update baseline: ${error.message}`)
      throw error
    }
  }

  static async cleanupOldScreenshots(daysToKeep = 7) {
    console.log(`🧹 Cleaning up screenshots older than ${daysToKeep} days...`)
    
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    try {
      const files = await fs.readdir(this.screenshotDir)
      let deletedCount = 0
      
      for (const file of files) {
        const filePath = path.join(this.screenshotDir, file)
        const stats = await fs.stat(filePath)
        
        if (stats.mtime < cutoffDate) {
          await fs.unlink(filePath)
          deletedCount++
        }
      }
      
      console.log(`✅ Cleaned up ${deletedCount} old screenshots`)
    } catch (error) {
      console.error(`❌ Failed to cleanup screenshots: ${error.message}`)
    }
  }

  static async generateScreenshotReport(screenshots) {
    console.log('📊 Generating screenshot report...')
    
    const report = {
      timestamp: new Date().toISOString(),
      totalScreenshots: screenshots.length,
      screenshots: screenshots.map(screenshot => ({
        name: screenshot.name,
        filename: screenshot.filename,
        testName: screenshot.testName,
        timestamp: screenshot.timestamp,
        size: this.getFileSize(screenshot.path)
      }))
    }
    
    const reportPath = path.join(this.screenshotDir, 'screenshot-report.json')
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2))
    
    console.log(`📋 Screenshot report saved: ${reportPath}`)
    return report
  }

  static async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath)
      return stats.size
    } catch (error) {
      return 0
    }
  }

  // Utility methods
  static async ensureDirectoryExists(dirPath) {
    try {
      await fs.access(dirPath)
    } catch (error) {
      await fs.mkdir(dirPath, { recursive: true })
    }
  }

  static async fileExists(filePath) {
    try {
      await fs.access(filePath)
      return true
    } catch (error) {
      return false
    }
  }

  static async copyFile(source, destination) {
    const data = await fs.readFile(source)
    await fs.writeFile(destination, data)
  }

  static async moveFile(source, destination) {
    await this.copyFile(source, destination)
    try {
      await fs.unlink(source)
    } catch (error) {
      // Source file might not exist
    }
  }

  // Screenshot comparison helpers
  static async compareScreenshots(screenshot1Path, screenshot2Path, threshold = 0.1) {
    try {
      const img1Buffer = await fs.readFile(screenshot1Path)
      const img2Buffer = await fs.readFile(screenshot2Path)
      
      const img1 = PNG.sync.read(img1Buffer)
      const img2 = PNG.sync.read(img2Buffer)
      
      if (img1.width !== img2.width || img1.height !== img2.height) {
        return {
          isMatch: false,
          diffPercentage: 100,
          error: 'Dimension mismatch'
        }
      }
      
      const diffPixels = pixelmatch(
        img1.data,
        img2.data,
        null,
        img1.width,
        img1.height,
        { threshold: 0.1 }
      )
      
      const totalPixels = img1.width * img1.height
      const diffPercentage = (diffPixels / totalPixels) * 100
      
      return {
        isMatch: diffPercentage <= threshold,
        diffPercentage: parseFloat(diffPercentage.toFixed(2)),
        diffPixels,
        totalPixels
      }
    } catch (error) {
      throw new Error(`Failed to compare screenshots: ${error.message}`)
    }
  }

  // Device-specific screenshot methods
  static async takeFullPageScreenshot(name) {
    console.log(`📸 Taking full page screenshot: ${name}`)
    
    try {
      // Scroll to top first
      await device.pressKey('home')
      
      // Take screenshot
      return await this.takeScreenshot(`fullpage_${name}`)
    } catch (error) {
      console.error(`❌ Failed to take full page screenshot: ${error.message}`)
      throw error
    }
  }

  static async takeScreenshotWithDelay(name, delay = 1000) {
    console.log(`📸 Taking screenshot with ${delay}ms delay: ${name}`)
    
    // Wait for animations to complete
    await new Promise(resolve => setTimeout(resolve, delay))
    
    return await this.takeScreenshot(name)
  }

  // Batch screenshot operations
  static async takeScreenshotSeries(baseName, count = 5, interval = 1000) {
    console.log(`📸 Taking screenshot series: ${baseName} (${count} shots)`)
    
    const screenshots = []
    
    for (let i = 0; i < count; i++) {
      const screenshot = await this.takeScreenshot(`${baseName}_${i + 1}`)
      screenshots.push(screenshot)
      
      if (i < count - 1) {
        await new Promise(resolve => setTimeout(resolve, interval))
      }
    }
    
    return screenshots
  }

  // Visual regression test helpers
  static async runVisualRegressionTest(testName, elementSelector, options = {}) {
    const {
      threshold = 0.1,
      updateBaseline = false,
      takeFullScreen = false
    } = options
    
    console.log(`🔍 Running visual regression test: ${testName}`)
    
    try {
      let screenshotPath
      
      if (takeFullScreen) {
        screenshotPath = await this.takeScreenshot(testName)
      } else {
        screenshotPath = await this.takeElementScreenshot(elementSelector, testName)
      }
      
      if (updateBaseline) {
        await this.updateBaseline(screenshotPath, testName)
        return {
          isMatch: true,
          baselineUpdated: true
        }
      }
      
      const comparisonResult = await this.compareWithBaseline(screenshotPath, testName, threshold)
      
      return {
        ...comparisonResult,
        screenshotPath,
        testName
      }
    } catch (error) {
      console.error(`❌ Visual regression test failed: ${error.message}`)
      throw error
    }
  }
}

module.exports = ScreenshotUtils
