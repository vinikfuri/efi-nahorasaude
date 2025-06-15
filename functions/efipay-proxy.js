const express = require('express');
const fetch = require('node-fetch');
const app = express();
app.use(express.json());

app.post('/efipay-proxy', async (req, res) => {
  const EFIPAY_CLIENT_ID = process.env.EFIPAY_CLIENT_ID;
  const EFIPAY_CLIENT_SECRET = process.env.EFIPAY_CLIENT_SECRET;
  const EFIPAY_PIX_KEY = process.env.EFIPAY_PIX_KEY;

  if (!EFIPAY_CLIENT_ID || !EFIPAY_CLIENT_SECRET || !EFIPAY_PIX_KEY) {
    return res.status(500).json({
      success: false,
      error: 'Credenciais EfiPay não configuradas corretamente.'
    });
  }

  try {
    const payload = req.body;

    const valorNumerico = Number(payload.valor);
    const nome_cliente = (payload.nome_cliente || payload.nome || '').trim();
    const cpf_cliente = (payload.cpf_cliente || payload.cpf || '').replace(/\D/g, '');
    const franqueado_codigo = (payload.franqueado_codigo || payload.codigo || payload.franqueado_id || '').toString().toUpperCase();

    if (!nome_cliente || !cpf_cliente || !valorNumerico || !franqueado_codigo) {
      return res.status(400).json({ success: false, error: 'Campos obrigatórios ausentes.' });
    }

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const txid = `txid-na-hora-${timestamp}-${randomSuffix}`;

    // Autenticar na EfiPay
    const basic = Buffer.from(`${EFIPAY_CLIENT_ID}:${EFIPAY_CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await fetch('https://pix.api.efipay.com.br/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString()
    });

    const tokenData = await tokenResponse.json();
    const efipay_token = tokenData.access_token;

    if (!efipay_token) {
      return res.status(500).json({ success: false, error: 'Falha na autenticação com a EfiPay.' });
    }

    // Criar cobrança
    const chargePayload = {
      calendario: { expiracao: 3600 },
      devedor: { nome: nome_cliente, cpf: cpf_cliente },
      valor: { original: valorNumerico.toFixed(2) },
      chave: EFIPAY_PIX_KEY,
      solicitacaoPagador: payload.descricao || `Plano NaHoraSaude para ${nome_cliente}`.substring(0, 140),
      infoAdicionais: [
        { nome: 'Cliente', valor: nome_cliente.substring(0, 50) },
        { nome: 'Franqueado', valor: franqueado_codigo },
        { nome: 'Plano', valor: 'NaHoraSaude' }
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

    if (!chargeResult || !chargeResult.pixCopiaECola) {
      return res.status(500).json({ success: false, error: 'Erro ao gerar cobrança.', detalhes: chargeResult });
    }

    res.json({
      success: true,
      data: {
        txid,
        valor: valorNumerico,
        nome_cliente,
        qr_code: chargeResult.pixCopiaECola,
        qr_code_image: chargeResult.qrcode,
        vencimento: new Date(Date.now() + 3600 * 1000).toISOString(),
        efipay_response: chargeResult,
        cliente_id: payload.cliente_id || null,
        franqueado_id: payload.franqueado_id || null,
        referente_a: payload.referente_a || null,
        user_id: payload.user_id || null,
        tipo: payload.tipo || 'cliente'
      }
    });

  } catch (err) {
    console.error('Erro no proxy:', err);
    res.status(500).json({ success: false, error: 'Erro inesperado no proxy', detalhes: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('EfiPay proxy rodando com sucesso.');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
