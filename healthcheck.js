#!/usr/bin/env node

/**
 * BloodLink Africa Health Check Script
 * Used by Docker containers to verify application health
 */

const http = require('http');
const process = require('process');

const options = {
  hostname: 'localhost',
  port: process.env.PORT || 3001,
  path: '/health',
  method: 'GET',
  timeout: 3000
};

const healthCheck = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

healthCheck.on('error', (err) => {
  console.error('Health check failed:', err.message);
  process.exit(1);
});

healthCheck.on('timeout', () => {
  console.error('Health check timed out');
  healthCheck.destroy();
  process.exit(1);
});

healthCheck.end();
