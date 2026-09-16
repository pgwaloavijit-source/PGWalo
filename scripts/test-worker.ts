/**
 * Test script for Cloudflare Workers API
 * Run locally to test the API endpoints
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:8787';

async function testHealth() {
  console.log('Testing health endpoint...');
  const response = await fetch(`${API_BASE_URL}/api/health`);
  const data = await response.json();
  console.log('Health check:', data);
  return response.ok;
}

async function testBootstrap(role: string) {
  console.log(`Testing bootstrap endpoint with role: ${role}...`);
  const response = await fetch(`${API_BASE_URL}/api/bootstrap`, {
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': role,
      'x-organization-id': 'org-demo-blue-haven',
    },
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log(`Bootstrap successful. Collections loaded:`, Object.keys(data));
    return true;
  } else {
    console.error('Bootstrap failed:', await response.text());
    return false;
  }
}

async function testCollection(role: string, collection: string) {
  console.log(`Testing ${collection} endpoint with role: ${role}...`);
  const response = await fetch(`${API_BASE_URL}/api/${collection}`, {
    headers: {
      'Content-Type': 'application/json',
      'x-user-role': role,
      'x-organization-id': 'org-demo-blue-haven',
    },
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log(`${collection} count:`, Array.isArray(data) ? data.length : 'N/A');
    return true;
  } else {
    console.error(`${collection} failed:`, await response.text());
    return false;
  }
}

async function testMediaUpload() {
  console.log('Testing media upload...');
  
  // Create a simple test file
  const testContent = 'This is a test file content';
  const blob = new Blob([testContent], { type: 'text/plain' });
  const file = new File([blob], 'test.txt', { type: 'text/plain' });
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('category', 'test');

  const response = await fetch(`${API_BASE_URL}/api/media/upload`, {
    method: 'POST',
    headers: {
      'x-user-role': 'admin',
      'x-organization-id': 'org-demo-blue-haven',
    },
    body: formData,
  });
  
  if (response.ok) {
    const data = await response.json();
    console.log('Media upload successful:', data);
    return true;
  } else {
    console.error('Media upload failed:', await response.text());
    return false;
  }
}

async function runTests() {
  console.log('Starting PGNest Workers API tests...');
  console.log('API Base URL:', API_BASE_URL);
  console.log('');

  const results = {
    health: await testHealth(),
    bootstrapPublic: await testBootstrap('public'),
    bootstrapOwner: await testBootstrap('owner'),
    propertiesPublic: await testCollection('public', 'properties'),
    propertiesOwner: await testCollection('owner', 'properties'),
    residentsOwner: await testCollection('owner', 'residents'),
    mediaUpload: await testMediaUpload(),
  };

  console.log('');
  console.log('Test Results:');
  console.log('--------------');
  Object.entries(results).forEach(([test, passed]) => {
    console.log(`${test}: ${passed ? '✓ PASSED' : '✗ FAILED'}`);
  });

  const allPassed = Object.values(results).every(r => r);
  console.log('');
  console.log(allPassed ? 'All tests passed! ✓' : 'Some tests failed. ✗');
  process.exit(allPassed ? 0 : 1);
}

runTests().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});