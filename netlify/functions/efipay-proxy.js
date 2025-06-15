
exports.handler = async (event, context) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const payload = JSON.parse(event.body);

    const EFIPAY_CLIEconst express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const app = express();

app.use(bodyParser.json());

app.post('/efipay-proxy', async (req, res) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  try {
    const payload = req.body;

    const EFIPAY_CLIENT_ID = process.env.EFIPAY_CLIENT_ID;
    const EFIPAY_CLIENT_SECRET = process.env.EFIPAY_CLIENT_SECRET;
    const EFIPAY_PIX_KEY = process.env.EFIPAY_PIX_KEY;

    if (!EFIPAY_CLIENT_ID || !EFIPAY_CLIENT_SECRET || !EFIPAY_PIX_KEY) {
      return res.status(500).json({ success: false, error: "Credenciais EfiPay ausentes" });
    }

    const basic = Buffer.from(`${EFIPAY_CLIENT_ID}:${EFIPAY_CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await fetch('https://pix.api.efipay.com.br/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'NaHoraSaude-RenderProxy/1.0'
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      return res.status(500).json({ success: false, error: "Erro ao autenticar", details: errorText });
    }

    const tokenData = await tokenResponse.json();
    const efipay_token = tokenData.access_token;

    const nome_cliente = (payload.nome_cliente || payload.nome || "").trim();
    const cpf_cliente = (payload.cpf_cliente || payload.cpf || "").replace(/\D/g, "");
    const valorNumerico = Number(payload.valor || 0).toFixed(2);
    const txid = `txid-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const chargePayload = {
      calendario: { expiracao: 3600 },
      devedor: { nome: nome_cliente, cpf: cpf_cliente },
      valor: { original: valorNumerico },
      chave: EFIPAY_PIX_KEY,
      solicitacaoPagador: `Plano NaHoraSaude para ${nome_cliente}`.substring(0, 140),
      infoAdicionais: [
        { nome: "Cliente", valor: nome_cliente.substring(0, 50) },
        { nome: "Plano", valor: "NaHoraSaude" }
      ]
    };

    const chargeResponse = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txid}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${efipay_token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'NaHoraSaude-RenderProxy/1.0'
      },
      body: JSON.stringify(chargePayload)
    });

    if (!chargeResponse.ok) {
      const errorText = await chargeResponse.text();
      return res.status(500).json({ success: false, error: "Erro ao criar cobrança", details: errorText });
    }

    const chargeResult = await chargeResponse.json();

    return res.status(200).json({
      success: true,
      data: {
        txid,
        valor: valorNumerico,
        nome_cliente,
        qr_code: chargeResult.pixCopiaECola || null,
        qr_code_image: chargeResult.qrcode || null,
        vencimento: new Date(Date.now() + (3600 * 1000)).toISOString(),
        efipay_response: chargeResult
      }
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: "Erro interno no servidor",
      details: error.message
    });
  }
});

app.listen(3000, () => {
  console.log("EfiPay proxy rodando na porta 3000");
});
