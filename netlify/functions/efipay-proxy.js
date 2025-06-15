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
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body);
    const EFIPAY_CLIENT_ID = process.env.EFIPAY_CLIENT_ID;
    const EFIPAY_CLIENT_SECRET = process.env.EFIPAY_CLIENT_SECRET;
    const EFIPAY_PIX_KEY = process.env.EFIPAY_PIX_KEY;

    if (!EFIPAY_CLIENT_ID || !EFIPAY_CLIENT_SECRET || !EFIPAY_PIX_KEY) {
      throw new Error('Credenciais EfiPay não configuradas');
    }

    const valorNumerico = Number(payload.valor);
    const nome_cliente = (payload.nome_cliente || payload.nome || "").trim();
    const cpf_cliente = (payload.cpf_cliente || payload.cpf || "").replace(/\D/g, "");
    const franqueado_codigo = (payload.franqueado_codigo || payload.codigo || payload.franqueado_id || "").toString().toUpperCase();

    if (!nome_cliente || !cpf_cliente || !valorNumerico || !franqueado_codigo) {
      throw new Error('Campos obrigatórios ausentes');
    }

    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const txid = `txid-na-hora-${timestamp}-${randomSuffix}`;

    const basic = Buffer.from(`${EFIPAY_CLIENT_ID}:${EFIPAY_CLIENT_SECRET}`).toString('base64');
    const tokenResponse = await fetch('https://pix.api.efipay.com.br/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'NaHoraSaude-NetlifyProxy/1.0'
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString()
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`EfiPay auth failed: ${errorText}`);
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
        'Content-Type': 'application/json',
        'User-Agent': 'NaHoraSaude-NetlifyProxy/1.0',
        'Accept': 'application/json'
      },
      body: JSON.stringify(chargePayload)
    });

    if (!chargeResponse.ok) {
      const errorText = await chargeResponse.text();
      throw new Error(`EfiPay charge failed: ${errorText}`);
    }

    const chargeResult = await chargeResponse.json();

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        data: {
          txid,
          valor: valorNumerico,
          nome_cliente,
          qr_code: chargeResult.pixCopiaECola || null,
          qr_code_image: chargeResult.qrcode || null,
          vencimento: new Date(Date.now() + (3600 * 1000)).toISOString(),
          efipay_response: chargeResult,
          cliente_id: payload.cliente_id || null,
          franqueado_id: payload.franqueado_id || null,
          referente_a: payload.referente_a || null,
          user_id: payload.user_id || null,
          tipo: payload.tipo || "cliente"
        }
      })
    };
  } catch (error) {
    console.error('Proxy error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ success: false, error: error.message || 'Erro interno do proxy' })
    };
  }
};
