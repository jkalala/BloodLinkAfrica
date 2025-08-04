import { defineConfig } from 'cypress'

export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
    defaultCommandTimeout: 10000,
    requestTimeout: 10000,
    responseTimeout: 10000,
    pageLoadTimeout: 30000,
    
    // Test files
    specPattern: 'cypress/e2e/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/e2e.ts',
    fixturesFolder: 'cypress/fixtures',
    screenshotsFolder: 'cypress/screenshots',
    videosFolder: 'cypress/videos',
    
    // Environment variables
    env: {
      SUPABASE_URL: 'https://test-project.supabase.co',
      SUPABASE_ANON_KEY: 'test-anon-key',
    },
    
    setupNodeEvents(on, config) {
      // implement node event listeners here
      on('task', {
        log(message) {
          console.log(message)
          return null
        },
        
        // Database seeding tasks
        seedDatabase() {
          // Implement database seeding logic
          return null
        },
        
        cleanDatabase() {
          // Implement database cleanup logic
          return null
        },
        
        // Email testing tasks
        getLastEmail() {
          // Implement email retrieval logic
          return null
        },
        
        // File system tasks
        readFile(filename) {
          // Implement file reading logic
          return null
        },
      })
      
      // Code coverage
      require('@cypress/code-coverage/task')(on, config)
      
      return config
    },
  },
  
  component: {
    devServer: {
      framework: 'next',
      bundler: 'webpack',
    },
    specPattern: 'cypress/component/**/*.cy.{js,jsx,ts,tsx}',
    supportFile: 'cypress/support/component.ts',
  },
  
  // Global configuration
  retries: {
    runMode: 2,
    openMode: 0,
  },
  
  // Browser configuration
  chromeWebSecurity: false,
  
  // Experimental features
  experimentalStudio: true,
  experimentalWebKitSupport: true,
})
