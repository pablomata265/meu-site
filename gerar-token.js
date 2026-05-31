require('dotenv').config();
const { google } = require('googleapis');
const readline   = require('readline');

const CLIENT_ID     = process.env.CLIENT_ID;
const CLIENT_SECRET = process.env.CLIENT_SECRET;
const REDIRECT_URI  = 'http://localhost';

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  prompt:      'consent',
  scope: ['https://www.googleapis.com/auth/calendar'],
});

console.log('\n══════════════════════════════════════════════');
console.log('  1. Abra essa URL no navegador:');
console.log('══════════════════════════════════════════════\n');
console.log(url);
console.log('\n══════════════════════════════════════════════');
console.log('  2. Autorize o acesso ao Google Calendar');
console.log('  3. Você será redirecionado para localhost');
console.log('     (vai dar erro de conexão — é normal!)');
console.log('  4. Copie o "code" da URL e cole abaixo');
console.log('══════════════════════════════════════════════\n');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('Cole o código aqui: ', async (code) => {
  rl.close();
  try {
    const { tokens } = await oauth2Client.getToken(code.trim());
    console.log('\n✅ Token gerado com sucesso!\n');
    console.log('══════════════════════════════════════════════');
    console.log('Copie o refresh_token abaixo para o seu .env:');
    console.log('══════════════════════════════════════════════\n');
    console.log('REFRESH_TOKEN=' + tokens.refresh_token);
    console.log('\n');
  } catch (err) {
    console.error('❌ Erro ao gerar token:', err.message);
  }
});