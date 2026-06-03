import 'dotenv/config';
import fs from 'fs';
import path from 'path';

const ADMIN_EMAIL = process.argv[2] || 'ccharanr7@gmail.com';
const ADMIN_PWD = process.argv[3] || '14021';

const login = async () => {
  const r = await fetch('http://localhost:5005/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PWD })
  });
  return r.json();
};

const upload = async (token) => {
  const form = new (await import('form-data')).default();
  form.append('title', 'E2E Test Book');
  form.append('language', 'Testish');
  form.append('priceIndividual', '999');
  // Ensure we have a binary PNG; decode base64 placeholder if present
  const basePath = path.resolve(process.cwd(),'..','frontend','test-cover.png');
  const tmpPath = path.resolve(process.cwd(),'..','frontend','test-cover-binary.png');
  try{
    const b64 = fs.readFileSync(basePath, 'utf8').trim();
    const buf = Buffer.from(b64, 'base64');
    fs.writeFileSync(tmpPath, buf);
  } catch(e) {
    // fallback: if no base64, assume file already binary
    fs.copyFileSync(basePath, tmpPath);
  }
  form.append('cover', fs.createReadStream(tmpPath));

  const headers = { ...(form.getHeaders ? form.getHeaders() : {}), Authorization: `Bearer ${token}` };
  const r = await fetch('http://localhost:5005/api/admin/books', {
    method: 'POST',
    headers,
    body: form
  });
  return r.json();
};

(async ()=>{
  try{
    const loginRes = await login();
    if (!loginRes?.data?.accessToken) {
      console.error('Login failed', loginRes);
      process.exit(1);
    }
    const token = loginRes.data.accessToken;
    const result = await upload(token);
    console.log('uploadResult', JSON.stringify(result, null, 2));
  }catch(e){console.error(e); process.exit(1);} 
})();
