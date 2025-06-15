const express = require('express');
const fetch = require('node-fetch');
const app = express();

app.use(express.json());

app.post('/', async (req, res) => {
  const EFIPAY_CLIENT_ID = process.env.EFIPAY_CLIENT_ID;
  const EFIPAY_CLIENT_SECRET = process.env.EFIPAY_CLIENT_SECRET;
  const EFIPAY_PIX_KEY = process.env.EFIPAY_PIX_KEY;

  if (!EFIPAY_CLIENT_ID || !EFIPAY_CLIENT_SECRET || !EFIPAY_PIX_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Credenciais EfiPay não configuradas',
    });
  }

  const payload = req.body;

  if (
    !payload ||
    !payload.nome_cliente ||
    !payload.cpf_cliente ||
    !payload.valor ||
    !payload.franqueado_codigo
  ) {
    return res.status(400).json({
      success: false,
      error: 'Campos obrigatórios ausentes',
    });
  }

  const basicAuth = Buffer.from(`${EFIPAY_CLIENT_ID}:${EFIPAY_CLIENT_SECRET}`).toString('base64');

  try {
    // OAuth2
    const tokenRes = await fetch('https://pix.api.efipay.com.br/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      throw new Error(`Erro ao autenticar EfiPay: ${err}`);
    }

    const tokenJson = await tokenRes.json();
    const accessToken = tokenJson.access_token;

    const txid = `txid-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    const chargePayload = {
      calendario: { expiracao: 3600 },
      devedor: {
        nome: payload.nome_cliente,
        cpf: payload.cpf_cliente.replace(/\D/g, ''),
      },
      valor: {
        original: Number(payload.valor).toFixed(2),
      },
      chave: EFIPAY_PIX_KEY,
      solicitacaoPagador: payload.descricao || 'Plano NaHoraSaude',
      infoAdicionais: [
        { nome: 'Cliente', valor: payload.nome_cliente },
        { nome: 'Franqueado', valor: payload.franqueado_codigo },
        { nome: 'Plano', valor: 'NaHoraSaude' },
      ],
    };

    const chargeRes = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txid}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(chargePayload),
    });

    if (!chargeRes.ok) {
      const err = await chargeRes.text();
      throw new Error(`Erro ao criar cobrança: ${err}`);
    }

    const charge = await chargeRes.json();

    return res.status(200).json({
      success: true,
      data: {
        txid,
        valor: chargePayload.valor.original,
        nome_cliente: payload.nome_cliente,
        qr_code: charge.pixCopiaECola,
        qr_code_image: charge.qrcode,
        vencimento: new Date(Date.now() + 3600 * 1000).toISOString(),
        efipay_response: charge,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Erro ao processar proxy',
      details: err.message,
    });
  }
});

app.listen(3000, () => {
  console.log('EfiPay proxy server running on port 3000');
});
