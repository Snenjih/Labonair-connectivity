/**
 * Docker healthcheck script
 * Handles both HTTP and HTTPS protocols based on ENABLE_SSL environment variable
 */

const http = require('http');
const https = require('https');

// Determine protocol and port based on SSL configuration
const useSSL = process.env.ENABLE_SSL === 'true';
const protocol = useSSL ? https : http;
const port = useSSL ? (process.env.SSL_PORT || 8443) : (process.env.PORT || 30001);
const protocolName = useSSL ? 'https' : 'http';

// Configure request options
const options = {
  hostname: 'localhost',
  port: port,
  path: '/',
  method: 'GET',
  timeout: 5000,
  // For HTTPS, we might need to accept self-signed certificates in development
  rejectUnauthorized: false,
};

// Perform health check
const req = protocol.request(options, (res) => {
  if (res.statusCode === 200) {
    console.log(`Health check passed: ${protocolName}://localhost:${port}/ returned ${res.statusCode}`);
    process.exit(0);
  } else {
    console.error(`Health check failed: ${protocolName}://localhost:${port}/ returned ${res.statusCode}`);
    process.exit(1);
  }
});

req.on('error', (error) => {
  console.error(`Health check error: ${error.message}`);
  process.exit(1);
});

req.on('timeout', () => {
  console.error('Health check timeout');
  req.destroy();
  process.exit(1);
});

req.end();
