const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

const PORT = 8080;

const EFIPAY_BASE_URL = process.env.EFIPAY_BASE_URL; // Ex: https://api.efipay.com.br
const EFIPAY_CLIENT_ID = process.env.EFIPAY_CLIENT_ID;
const EFIPAY_CLIENT_SECRET = process.env.EFIPAY_CLIENT_SECRET;
const EFIPAY_AUTH_URL = process.env.EFIPAY_AUTH_URL || 'https://oauth.efipay.com.br';

async function getAccessToken() {
  try {
    const credentials = Buffer.from(`${EFIPAY_CLIENT_ID}:${EFIPAY_CLIENT_SECRET}`).toString('base64');

    const response = await axios.post(
      `${EFIPAY_AUTH_URL}/token`,
      { grant_type: 'client_credentials' },
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data?.access_token) {
      return response.data.access_token;
    } else {
      console.error('❌ Falha ao obter token: nenhum token retornado');
      return null;
    }
  } catch (error) {
    console.error('❌ Erro ao obter token da EfiPay:', error.response?.data || error.message);
    return null;
  }
}

app.post('/', async (req, res) => {
  console.log('✅ Requisição recebida no proxy');

  const accessToken = await getAccessToken();

  if (!accessToken) {
    return res.status(500).json({ success: false, error: 'Erro ao obter token da EfiPay' });
  }

  const { endpoint, method = 'POST', body } = req.body;

  if (!endpoint) {
    return res.status(400).json({ success: false, error: 'Endpoint não informado' });
  }

  try {
    console.log(`➡️  Enviando para EfiPay: ${method} ${endpoint}`);
    const response = await axios({
      method,
      url: `${EFIPAY_BASE_URL}/${endpoint}`,
      data: body,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    console.log('✅ Resposta recebida da EfiPay');
    res.json({ success: true, data: response.data });
  } catch (error) {
    console.error('❌ Erro ao chamar API da EfiPay:', error.response?.data || error.message);
    res.status(500).json({
      success: false,
      error: 'Erro na requisição para EfiPay',
      details: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ EfiPay proxy server rodando na porta ${PORT}`);
});

app.listen(PORT, () => {
  console.log(`✅ EfiPay proxy server rodando na porta ${PORT}`);
});
