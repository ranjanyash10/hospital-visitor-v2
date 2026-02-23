const axios = require('axios');

const BASE_URL = 'http://127.0.0.1:5005/api/kiosk';

async function testLookup(mobile, description) {
    console.log(`\nTesting: ${description} (Mobile: ${mobile})`);
    try {
        const res = await axios.get(`${BASE_URL}/visitor/${mobile}`);
        console.log('Success:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.log('Error Status:', err.response?.status);
        console.log('Error Data:', JSON.stringify(err.response?.data, null, 2));
    }
}

async function runTests() {
    // Check health first
    try {
        const health = await axios.get('http://127.0.0.1:5005/health');
        console.log('Health Check:', health.data);
    } catch (e) {
        console.log('Health Check Failed:', e.response?.status);
    }

    try {
        const debug = await axios.get('http://127.0.0.1:5005/debug');
        console.log('Debug Check:', debug.data);
    } catch (e) {
        console.log('Debug Check Failed:', e.response?.status);
    }

    // 1. Mobile with 1 patient (Sita Sharma's mobile)
    await testLookup('9876543210', 'Single Admission');

    // 2. Mobile with 2 patients (Test multi-patient case)
    await testLookup('9999999999', 'Multiple Admissions');
}

runTests();
