# Testing Guide for BloodLink Africa

This document provides comprehensive guidance on testing the BloodLink Africa application.

## 🧪 Testing Stack

### Frontend Testing
- **Jest**: Unit testing framework
- **React Testing Library**: Component testing utilities
- **Cypress**: End-to-end testing
- **Playwright**: Alternative E2E testing (optional)
- **MSW**: API mocking for tests

### Backend Testing
- **pytest**: Python testing framework for ML backend
- **Supertest**: API endpoint testing
- **Jest**: Node.js unit testing

### Code Quality
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **TypeScript**: Type checking
- **Husky**: Git hooks for quality gates

## 📁 Test Structure

```
BloodConnectv0/
├── __tests__/
│   ├── components/          # Component tests
│   ├── lib/                # Utility and service tests
│   ├── api/                # API endpoint tests
│   └── utils/              # Test utilities and helpers
├── cypress/
│   ├── e2e/                # End-to-end tests
│   ├── component/          # Component integration tests
│   ├── fixtures/           # Test data
│   └── support/            # Cypress utilities
└── ml-backend/
    └── tests/              # ML backend tests
```

## 🚀 Running Tests

### Unit Tests
```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test suites
npm run test:unit          # Library/utility tests
npm run test:components    # Component tests
npm run test:api          # API tests
```

### End-to-End Tests
```bash
# Run E2E tests headlessly
npm run test:e2e

# Open Cypress Test Runner
npm run test:e2e:open

# Run component tests
npm run test:component
npm run test:component:open
```

### ML Backend Tests
```bash
cd ml-backend
pytest                    # Run all tests
pytest --cov=.           # Run with coverage
pytest -v                # Verbose output
pytest tests/test_ml.py  # Run specific test file
```

### All Tests
```bash
# Run complete test suite
npm run test:all
```

## 📝 Writing Tests

### Component Tests

```typescript
// __tests__/components/ui/button.test.tsx
import { render, screen, fireEvent } from '../utils/test-utils'
import { Button } from '@/components/ui/button'

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    
    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
  })

  it('handles click events', async () => {
    const handleClick = jest.fn()
    const user = userEvent.setup()
    
    render(<Button onClick={handleClick}>Click me</Button>)
    
    const button = screen.getByRole('button', { name: /click me/i })
    await user.click(button)
    
    expect(handleClick).toHaveBeenCalledTimes(1)
  })
})
```

### API Tests

```typescript
// __tests__/api/blood-requests.test.ts
import { createMocks } from 'node-mocks-http'
import handler from '@/app/api/blood-requests/route'

describe('/api/blood-requests', () => {
  it('should create new blood request', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        blood_type: 'A+',
        units_needed: 2,
        urgency: 'high',
        location: 'Test Hospital',
      },
    })

    await handler(req, res)

    expect(res._getStatusCode()).toBe(201)
    const data = JSON.parse(res._getData())
    expect(data.request).toHaveProperty('id')
  })
})
```

### E2E Tests

```typescript
// cypress/e2e/blood-donation-flow.cy.ts
describe('Blood Donation Flow', () => {
  it('should allow donor to respond to request', () => {
    cy.loginAsDonor()
    cy.visit('/dashboard')
    
    cy.get('[data-testid="request-card"]').first().within(() => {
      cy.get('[data-testid="respond-button"]').click()
    })
    
    cy.get('[data-testid="response-modal"]').should('be.visible')
    cy.get('[data-testid="availability-select"]').select('available')
    cy.get('[data-testid="confirm-response-button"]').click()
    
    cy.waitForToast('Response sent successfully')
  })
})
```

### ML Tests

```python
# ml-backend/tests/test_ml_engine.py
import pytest
from services.ml_engine import MLEngine

class TestMLEngine:
    def test_donor_matching_prediction(self):
        engine = MLEngine()
        
        # Train with mock data
        result = engine.train_models(mock_data)
        assert result['success'] is True
        
        # Test prediction
        prediction = engine.predict_donor_match('donor-1', 'request-1')
        assert prediction is not None
        assert 0 <= prediction['score'] <= 1
```

## 🎯 Test Data Management

### Test Utilities

```typescript
// __tests__/utils/test-utils.tsx
export const TestDataFactory = {
  user: (overrides = {}) => ({
    id: 'test-user-id',
    name: 'Test User',
    email: 'test@example.com',
    blood_type: 'O+',
    ...overrides,
  }),
  
  bloodRequest: (overrides = {}) => ({
    id: 'test-request-id',
    blood_type: 'O+',
    units_needed: 2,
    urgency: 'high',
    ...overrides,
  }),
}
```

### Fixtures

```json
// cypress/fixtures/users.json
{
  "donor": {
    "email": "donor@bloodlink.com",
    "password": "donor123",
    "name": "John Donor",
    "blood_type": "O+"
  },
  "hospital": {
    "email": "hospital@bloodlink.com",
    "password": "hospital123",
    "name": "City Hospital"
  }
}
```

## 🔧 Test Configuration

### Jest Configuration

```javascript
// jest.config.js
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
}
```

### Cypress Configuration

```typescript
// cypress.config.ts
export default defineConfig({
  e2e: {
    baseUrl: 'http://localhost:3000',
    viewportWidth: 1280,
    viewportHeight: 720,
    video: true,
    screenshotOnRunFailure: true,
  },
})
```

## 📊 Coverage Requirements

### Minimum Coverage Targets
- **Overall**: 80%
- **Critical paths**: 95%
- **UI Components**: 85%
- **API endpoints**: 90%
- **ML algorithms**: 95%

### Coverage Reports
```bash
# Generate coverage report
npm run test:coverage

# Open coverage report
npm run test:coverage:open
```

## 🚨 Quality Gates

### Pre-commit Hooks
```json
// package.json
"lint-staged": {
  "*.{js,jsx,ts,tsx}": [
    "eslint --fix",
    "prettier --write",
    "jest --findRelatedTests --passWithNoTests"
  ]
}
```

### CI/CD Pipeline
- ✅ Linting and formatting
- ✅ Type checking
- ✅ Unit tests (80% coverage)
- ✅ Integration tests
- ✅ E2E tests
- ✅ Security scanning
- ✅ Performance testing

## 🐛 Debugging Tests

### Jest Debugging
```bash
# Debug specific test
node --inspect-brk node_modules/.bin/jest --runInBand test-file.test.ts

# Debug with VS Code
# Add to launch.json:
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

### Cypress Debugging
```typescript
// Add debugging commands
cy.debug()          // Pause execution
cy.pause()          // Interactive pause
cy.screenshot()     // Take screenshot
```

## 📈 Performance Testing

### Lighthouse CI
```json
// lighthouserc.json
{
  "ci": {
    "collect": {
      "url": ["http://localhost:3000"],
      "numberOfRuns": 3
    },
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.8}],
        "categories:accessibility": ["error", {"minScore": 0.9}]
      }
    }
  }
}
```

### Load Testing
```bash
# Install k6
brew install k6

# Run load test
k6 run cypress/load-tests/api-load-test.js
```

## 🔒 Security Testing

### Dependency Scanning
```bash
# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix
```

### OWASP Testing
```bash
# Install OWASP ZAP
# Run security scan
zap-baseline.py -t http://localhost:3000
```

## 📚 Best Practices

### Test Organization
1. **Arrange-Act-Assert**: Structure tests clearly
2. **Single Responsibility**: One assertion per test
3. **Descriptive Names**: Clear test descriptions
4. **Independent Tests**: No test dependencies
5. **Fast Execution**: Keep tests quick

### Mocking Guidelines
1. **Mock External Dependencies**: APIs, databases, services
2. **Don't Mock What You Own**: Test real implementations
3. **Use MSW for API Mocking**: Realistic network mocking
4. **Mock at the Boundary**: Mock at integration points

### E2E Best Practices
1. **Test User Journeys**: Focus on critical paths
2. **Use Page Objects**: Organize selectors and actions
3. **Stable Selectors**: Use data-testid attributes
4. **Independent Tests**: Each test should be isolated
5. **Minimal UI Coupling**: Test behavior, not implementation

## 🚀 Continuous Improvement

### Metrics to Track
- Test coverage percentage
- Test execution time
- Flaky test rate
- Bug escape rate
- Time to feedback

### Regular Reviews
- Weekly test result analysis
- Monthly coverage review
- Quarterly testing strategy review
- Annual tool evaluation

## 📞 Support

For testing questions or issues:
1. Check this documentation
2. Review existing test examples
3. Ask in team Slack channel
4. Create GitHub issue for bugs

---

**Remember**: Good tests are investments in code quality, developer confidence, and user satisfaction. Write tests that provide value and maintain them as carefully as production code.
