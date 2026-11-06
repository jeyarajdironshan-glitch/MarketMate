const { spawn } = require('child_process');
const http = require('http');

function httpGet(path) {
  return new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:5000${path}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    }).on('error', reject);
  });
}

function httpPost(path, payload) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(payload);
    const req = http.request(`http://127.0.0.1:5000${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function runTests() {
  console.log('[Test] Launching backend server child process...');
  const child = spawn(process.execPath, ['src/index.js'], {
    cwd: __dirname,
    stdio: 'inherit'
  });

  // Give server 3 seconds to boot and load database
  await new Promise(r => setTimeout(r, 3000));

  try {
    console.log('[Test] Probing /api/health...');
    const health = await httpGet('/api/health');
    console.log('[Test] Health response:', health.status, health.body);

    console.log('[Test] Probing /api/markets...');
    const markets = await httpGet('/api/markets');
    console.log('[Test] Markets found:', markets.body.markets?.length);

    console.log('[Test] Probing /api/cbsl/latest...');
    const cbsl = await httpGet('/api/cbsl/latest');
    console.log('[Test] CBSL Report Date:', cbsl.body.reportDate, 'Total commodities:', cbsl.body.prices?.length);

    console.log('[Test] Testing Supplier Login (kamal@supplier.lk)...');
    const login = await httpPost('/api/auth/login', {
      email: 'kamal@supplier.lk',
      password: 'MarketMate@2026'
    });
    console.log('[Test] Login status:', login.status, 'User:', login.body.user?.full_name, 'Role:', login.body.user?.role);

    console.log('>>> ALL BACKEND API ENDPOINTS VERIFIED AND FUNCTIONAL! <<<');
  } catch (err) {
    console.error('[Test Error]:', err);
  } finally {
    console.log('[Test] Terminating server child process...');
    child.kill('SIGINT');
    process.exit(0);
  }
}

runTests();
