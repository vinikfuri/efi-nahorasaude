const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const EFIPAY_BASE_URL = 'https://api.efipay.com.br'; // ou sandbox, se ainda em testes
const CLIENT_ID = process.env.EFIPAY_CLIENT_ID;
const CLIENT_SECRET = process.env.EFIPAY_CLIENT_SECRET;
const PIX_KEY = process.env.EFIPAY_PIX_KEY;

let accessToken = null;

async function getAccessToken() {
  if (accessToken) return accessToken;
  const tokenRes = await axios.post(
    `${EFIPAY_BASE_URL}/oauth/token`,
    {
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    },
    {
      headers: { 'Content-Type': 'application/json' }
    }
  );
  accessToken = tokenRes.data.access_token;
  return accessToken;
}

app.post('/', async (req, res) => {
  try {
    const { endpoint, method, body } = req.body;

    if (!endpoint || !method || !body) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes' });
    }

    const token = await getAccessToken();
    const url = `${EFIPAY_BASE_URL}/${endpoint}`;

    const efipayRes = await axios({
      url,
      method: method.toLowerCase(),
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      data: body
    });

    return res.status(200).json(efipayRes.data);
  } catch (err) {
    console.error('[ERRO NO PROXY]', err?.response?.data || err.message);
    return res.status(500).json({
      error: err?.response?.data || 'Erro inesperado no proxy',
      details: err?.response?.data?.violacoes || null
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy EfiPay rodando na porta ${PORT}`);
});

app.listen(3000, () => {
  console.log('EfiPay proxy server running on port 3000');
});
