// Simple test script to verify CORS is working
const API_BASE_URL = "http://localhost:3001";

async function testCORS() {
  console.log("Testing CORS configuration...\n");

  // Test 1: GET request (should work)
  console.log("1. Testing GET /devices (scan devices):");
  try {
    const response = await fetch(`${API_BASE_URL}/devices`);
    console.log(`   Status: ${response.status} ${response.statusText}`);
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }

  console.log("\n");

  // Test 2: POST request (the problematic one)
  console.log("2. Testing POST /devices/connect (connect device):");
  try {
    const response = await fetch(`${API_BASE_URL}/devices/connect`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_id: "test-device-id" }),
    });
    console.log(`   Status: ${response.status} ${response.statusText}`);
    const data = await response.json();
    console.log(`   Response: ${JSON.stringify(data, null, 2)}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }

  console.log("\n");

  // Test 3: OPTIONS request (preflight)
  console.log("3. Testing OPTIONS /devices/connect (preflight):");
  try {
    const response = await fetch(`${API_BASE_URL}/devices/connect`, {
      method: "OPTIONS",
      headers: {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type",
      },
    });
    console.log(`   Status: ${response.status} ${response.statusText}`);
    console.log(`   CORS Headers:`);
    console.log(`     Access-Control-Allow-Origin: ${response.headers.get('Access-Control-Allow-Origin')}`);
    console.log(`     Access-Control-Allow-Methods: ${response.headers.get('Access-Control-Allow-Methods')}`);
    console.log(`     Access-Control-Allow-Headers: ${response.headers.get('Access-Control-Allow-Headers')}`);
  } catch (error) {
    console.log(`   Error: ${error.message}`);
  }
}

// Run the test
testCORS().catch(console.error);
