# BloodLink Africa - Developer Guide

Welcome to the BloodLink Africa developer documentation. This guide will help you understand, contribute to, and integrate with our blood donation management platform.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- Python 3.11+ (for ML backend)
- PostgreSQL 15+
- Redis 7+
- Docker (optional but recommended)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/bloodlink/africa
cd BloodLinkAfrica/BloodConnectv0

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your configuration

# Start development server
npm run dev

# In another terminal, start ML backend
cd ../ml-backend
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Docker Setup (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📚 Architecture Overview

### System Components

```mermaid
graph TB
    A[Next.js Frontend] --> B[API Routes]
    A --> C[Supabase Client]
    B --> D[Supabase Database]
    B --> E[Redis Cache]
    B --> F[ML Backend]
    F --> G[ML Models]
    F --> H[Computer Vision]
    A --> I[Mobile App]
    J[Real-time Updates] --> A
    K[Push Notifications] --> I
```

### Technology Stack

#### Frontend
- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + Radix UI
- **State Management**: React Context + Zustand
- **Authentication**: Supabase Auth
- **Real-time**: WebSockets + Server-Sent Events

#### Backend
- **API**: Next.js API Routes + FastAPI (ML)
- **Database**: PostgreSQL with Supabase
- **Caching**: Redis
- **Authentication**: JWT with Supabase
- **File Storage**: Supabase Storage

#### Mobile
- **Framework**: React Native 0.72+
- **Navigation**: React Navigation v6
- **State**: Context API + AsyncStorage
- **Maps**: React Native Maps
- **Camera**: React Native Camera

#### AI/ML
- **Framework**: FastAPI + Python
- **ML Libraries**: scikit-learn, TensorFlow, PyTorch
- **Computer Vision**: OpenCV, Tesseract OCR
- **NLP**: spaCy, Transformers

## 🔧 API Documentation

### Base URLs
- **Development**: `http://localhost:3000/api`
- **Staging**: `https://staging-api.bloodlink.africa/v2`
- **Production**: `https://api.bloodlink.africa/v2`

### Authentication

All API requests require authentication via JWT token:

```bash
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
     https://api.bloodlink.africa/v2/blood-requests
```

### Rate Limiting
- **Authenticated users**: 1000 requests/hour
- **Unauthenticated**: 100 requests/hour

### Response Format

All API responses follow this structure:

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "pagination": {  // For paginated responses
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

Error responses:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  }
}
```

### Key Endpoints

#### Authentication
```bash
# Login
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Register
POST /api/auth/register
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "role": "donor",
  "blood_type": "O+",
  "location": "Lagos, Nigeria"
}
```

#### Blood Requests
```bash
# Get blood requests
GET /api/blood-requests?page=1&limit=20&blood_type=O+

# Create blood request
POST /api/blood-requests
{
  "blood_type": "O+",
  "units_needed": 2,
  "urgency": "high",
  "location": "Lagos University Teaching Hospital",
  "notes": "Emergency surgery patient"
}

# Update blood request
PUT /api/blood-requests/{id}
{
  "status": "fulfilled",
  "notes": "Request completed successfully"
}
```

#### AI/ML Integration
```bash
# Find matching donors
POST /api/ai/donor-matching
{
  "request_id": "123e4567-e89b-12d3-a456-426614174000",
  "max_results": 10,
  "radius": 25
}

# Blood type recognition
POST /api/ai/vision/blood-type-recognition
Content-Type: multipart/form-data
# Include image file in form data
```

## 🧪 Testing

### Running Tests

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage

# All tests
npm run test:all
```

### Writing Tests

#### Component Tests
```typescript
// __tests__/components/Button.test.tsx
import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

describe('Button', () => {
  it('renders correctly', () => {
    render(<Button>Click me</Button>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
})
```

#### API Tests
```typescript
// __tests__/api/blood-requests.test.ts
import { createMocks } from 'node-mocks-http'
import handler from '@/app/api/blood-requests/route'

describe('/api/blood-requests', () => {
  it('creates blood request', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: { blood_type: 'O+', units_needed: 2 }
    })
    
    await handler(req, res)
    expect(res._getStatusCode()).toBe(201)
  })
})
```

## 🔒 Security

### Authentication Flow

1. User logs in with email/password
2. Server validates credentials
3. JWT token issued with user claims
4. Token included in subsequent requests
5. Server validates token on each request

### Security Headers

```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  
  return response
}
```

### Data Protection

- All sensitive data encrypted at rest
- HTTPS enforced in production
- Row Level Security (RLS) in database
- Input validation and sanitization
- SQL injection prevention

## 📱 Mobile Development

### React Native Setup

```bash
# Install dependencies
cd mobile-app
npm install

# iOS setup
cd ios && pod install && cd ..

# Run on iOS
npx react-native run-ios

# Run on Android
npx react-native run-android
```

### Key Mobile Features

#### Geolocation
```typescript
import Geolocation from '@react-native-community/geolocation'

const getCurrentLocation = () => {
  Geolocation.getCurrentPosition(
    position => {
      const { latitude, longitude } = position.coords
      // Use coordinates
    },
    error => console.error(error),
    { enableHighAccuracy: true, timeout: 20000 }
  )
}
```

#### Push Notifications
```typescript
import messaging from '@react-native-firebase/messaging'

const requestPermission = async () => {
  const authStatus = await messaging().requestPermission()
  const enabled = authStatus === messaging.AuthorizationStatus.AUTHORIZED
  return enabled
}
```

#### Camera Integration
```typescript
import { Camera } from 'react-native-camera'

const takePicture = async () => {
  if (camera) {
    const options = { quality: 0.8, base64: true }
    const data = await camera.takePictureAsync(options)
    return data
  }
}
```

## 🤖 AI/ML Integration

### ML Backend Architecture

```python
# ml-backend/main.py
from fastapi import FastAPI
from services.ml_engine import MLEngine
from services.computer_vision import CVService

app = FastAPI()
ml_engine = MLEngine()
cv_service = CVService()

@app.post("/predict/donor-match")
async def predict_donor_match(request: DonorMatchRequest):
    prediction = await ml_engine.predict_match(
        request.donor_id, 
        request.request_id
    )
    return {"prediction": prediction}
```

### Model Training

```python
# Training donor matching model
from sklearn.ensemble import RandomForestClassifier
import pandas as pd

class DonorMatchingModel:
    def __init__(self):
        self.model = RandomForestClassifier(n_estimators=100)
    
    def train(self, training_data: pd.DataFrame):
        features = self.extract_features(training_data)
        labels = training_data['success']
        self.model.fit(features, labels)
    
    def predict(self, donor_features):
        return self.model.predict_proba(donor_features)
```

### Computer Vision

```python
# Blood type recognition
import cv2
import numpy as np
from tensorflow import keras

class BloodTypeRecognizer:
    def __init__(self):
        self.model = keras.models.load_model('models/blood_type_classifier.h5')
    
    def recognize(self, image_path: str):
        image = cv2.imread(image_path)
        processed = self.preprocess_image(image)
        prediction = self.model.predict(processed)
        return self.decode_prediction(prediction)
```

## 🚀 Deployment

### Environment Configuration

```bash
# .env.production
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
DATABASE_URL=postgresql://user:pass@host:5432/db
REDIS_URL=redis://host:6379
JWT_SECRET=your-jwt-secret
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

FROM node:18-alpine AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

### Kubernetes Deployment

```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bloodlink-frontend
spec:
  replicas: 3
  selector:
    matchLabels:
      app: bloodlink-frontend
  template:
    metadata:
      labels:
        app: bloodlink-frontend
    spec:
      containers:
      - name: frontend
        image: bloodlink/frontend:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: bloodlink-secrets
              key: database-url
```

## 📊 Monitoring & Observability

### Metrics Collection

```typescript
// lib/metrics.ts
import { createPrometheusMetrics } from 'prom-client'

export const metrics = {
  httpRequests: new Counter({
    name: 'http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status']
  }),
  
  donorMatches: new Histogram({
    name: 'donor_matching_duration_seconds',
    help: 'Donor matching algorithm duration'
  })
}
```

### Logging

```typescript
// lib/logger.ts
import winston from 'winston'

export const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
})
```

### Health Checks

```typescript
// app/api/health/route.ts
export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      ml_backend: await checkMLBackend()
    }
  }
  
  return Response.json(health)
}
```

## 🤝 Contributing

### Development Workflow

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes and add tests
4. Run tests: `npm run test:all`
5. Commit changes: `git commit -m 'Add amazing feature'`
6. Push to branch: `git push origin feature/amazing-feature`
7. Open Pull Request

### Code Standards

- Use TypeScript for type safety
- Follow ESLint and Prettier configurations
- Write tests for new features
- Update documentation
- Use conventional commit messages

### Pull Request Process

1. Ensure all tests pass
2. Update documentation if needed
3. Add description of changes
4. Request review from maintainers
5. Address feedback
6. Merge after approval

## 📞 Support

### Getting Help

- **Documentation**: Check this guide and API docs
- **Issues**: Create GitHub issue for bugs
- **Discussions**: Use GitHub Discussions for questions
- **Email**: developer-support@bloodlink.africa

### Community

- **Discord**: Join our developer community
- **Twitter**: Follow @BloodLinkDev for updates
- **Blog**: Read technical posts on our blog

---

**Happy coding! 🩸💻**

Together, we're building technology that saves lives.
