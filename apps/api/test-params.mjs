
async function test() {
  console.log('Logging in...');
  const loginRes = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@rusertech.com', password: 'Gusta_Rusertech86' })
  });
  
  if (!loginRes.ok) {
    console.log('Login failed:', await loginRes.text());
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
}

test().catch(console.error);
