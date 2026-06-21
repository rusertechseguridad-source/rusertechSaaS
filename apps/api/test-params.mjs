
async function test() {
  console.log('Logging in...');
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@rusertech.com', password: 'TempPassword123!' })
  });
  
  if (!loginRes.ok) {
    console.log('Login failed:', await loginRes.text());
    // Try other password if needed, but let's assume it works or we get a 401
    return;
  }
  
  const { access_token } = await loginRes.json();
  console.log('Got token');

  console.log('Fetching /api/v1/settings/parameters...');
  const settingsRes = await fetch('http://localhost:3000/api/v1/settings/parameters', {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  console.log('Settings status:', settingsRes.status);
  console.log('Settings body:', await settingsRes.text());
  
  console.log('Fetching /api/v1/admin/parameters...');
  const adminRes = await fetch('http://localhost:3000/api/v1/admin/parameters', {
    headers: { Authorization: `Bearer ${access_token}` }
  });
  console.log('Admin status:', adminRes.status);
  console.log('Admin body:', await adminRes.text());
}

test().catch(console.error);
