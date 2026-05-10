const token = process.env.TOKEN;
const session = {
  access_token: token,
  token_type: "bearer",
  expires_in: 31536000,
  refresh_token: "dummy-refresh-token",
  user: {
    id: "7198536e-f7a9-436b-93c5-08783e62acc4",
    email: "wheslancardoso1064@gmail.com",
    aud: "authenticated",
    role: "authenticated"
  }
};
const cookieValue = Buffer.from(JSON.stringify(session)).toString('base64');
const cookieHeader = `sb-localhost-auth-token.0=${cookieValue}`;

console.log("Sending cookie header:", cookieHeader);

fetch('http://localhost:3000/api/debug-auth', {
  headers: {
    'Cookie': cookieHeader
  }
}).then(r => r.json()).then(console.log).catch(console.error);
