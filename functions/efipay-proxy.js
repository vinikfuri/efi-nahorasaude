const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

app.post('/efipay-proxy', async (req, res) => {
  const { EFIPAY_CLIENT_ID, EFIPAY_CLIENT_SECRET, EFIPAY_PIX_KEY } = process.env;

  if (!EFIPAY_CLIENT_ID || !EFIPAY_CLIENT_SECRET || !EFIPAY_PIX_KEY) {
    return res.status(500).json({ success: false, error: 'Credenciais EfiPay não configuradas' });
  }

  try {
    const payload = req.body;
    const valorNumerico = Number(payload.valor);
    const nome_cliente = (payload.nome_cliente || payload.nome || '').trim();
    const cpf_cliente = (payload.cpf_cliente || payload.cpf || '').replace(/\D/g, '');
    const franqueado_codigo = (payload.franqueado_codigo || payload.codigo || payload.franqueado_id || '').toString().toUpperCase();

    if (!nome_cliente || !cpf_cliente || !valorNumerico || !franqueado_codigo) {
      throw new Error('Campos obrigatórios ausentes');
    }

    const timestamp = Date.now();
    const txid = `txid-na-hora-${timestamp}`;

    const basic = Buffer.from(`${EFIPAY_CLIENT_ID}:${EFIPAY_CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await fetch('https://pix.api.efipay.com.br/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return res.status(500).json({ success: false, error: 'Erro ao autenticar com a EfiPay', details: errorText });
    }

    const tokenData = await tokenResponse.json();
    const efipay_token = tokenData.access_token;

    const chargePayload = {
      calendario: { expiracao: 3600 },
      devedor: { nome: nome_cliente, cpf: cpf_cliente },
      valor: { original: valorNumerico.toFixed(2) },
      chave: EFIPAY_PIX_KEY,
      solicitacaoPagador: payload.descricao || `Plano NaHoraSaude para ${nome_cliente}`.substring(0, 140),
      infoAdicionais: [
        { nome: "Cliente", valor: nome_cliente.substring(0, 50) },
        { nome: "Franqueado", valor: franqueado_codigo },
        { nome: "Plano", valor: "NaHoraSaude" }
      ]
    };

    const chargeResponse = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txid}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${efipay_token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(chargePayload)
    });

    const chargeResult = await chargeResponse.json();

    if (!chargeResponse.ok) {
      return res.status(500).json({ success: false, error: 'Erro ao criar cobrança', details: chargeResult });
    }

    return res.status(200).json({
      success: true,
      data: {
        txid,
        valor: valorNumerico,
        nome_cliente,
        qr_code: chargeResult.pixCopiaECola || null,
        qr_code_image: chargeResult.qrcode || null,
        vencimento: new Date(Date.now() + 3600 * 1000).toISOString(),
        efipay_response: chargeResult
      }
    });
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      success: false,
      error: 'Erro interno no proxy',
      details: error.message || error.toString()
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});