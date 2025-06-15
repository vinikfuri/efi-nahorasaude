
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

    const EFIPAY_CLIENT_ID = process.env.EFIPAY_CLIENT_ID;
    const EFIPAY_CLIENT_SECRET = process.env.EFIPAY_CLIENT_SECRET;
    const EFIPAY_PIX_KEY = process.env.EFIPAY_PIX_KEY;

    if (!EFIPAY_CLIENT_ID || !EFIPAY_CLIENT_SECRET || !EFIPAY_PIX_KEY) {
      console.error("Variáveis de ambiente ausentes");
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Variáveis de ambiente ausentes' })
      };
    }

    const valorNumerico = Number(payload.valor);
    const nome_cliente = (payload.nome_cliente || payload.nome || '').trim();
    const cpf_cliente = (payload.cpf_cliente || payload.cpf || '').replace(/\D/g, '');
    const franqueado_codigo = (payload.franqueado_codigo || payload.codigo || payload.franqueado_id || '').toString().toUpperCase();

    if (!nome_cliente || !cpf_cliente || !valorNumerico || !franqueado_codigo) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Dados obrigatórios ausentes' })
      };
    }

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const txid = `txid-na-hora-${timestamp}-${random}`;

    const basic = Buffer.from(`${EFIPAY_CLIENT_ID}:${EFIPAY_CLIENT_SECRET}`).toString('base64');

    const tokenResponse = await fetch('https://pix.api.efipay.com.br/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basic}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'NaHoraSaude-NetlifyProxy/1.0'
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }).toString()
    }).catch(err => {
      throw new Error("Erro ao conectar na API EfiPay (auth): " + err.message);
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error("Erro na resposta da API EfiPay (auth):", errorText);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Falha na autenticação com a EfiPay', details: errorText })
      };
    }

    const { access_token } = await tokenResponse.json();

    const chargePayload = {
      calendario: { expiracao: 3600 },
      devedor: { nome: nome_cliente, cpf: cpf_cliente },
      valor: { original: valorNumerico.toFixed(2) },
      chave: EFIPAY_PIX_KEY,
      solicitacaoPagador: `Plano NaHoraSaude para ${nome_cliente}`.substring(0, 140),
      infoAdicionais: [
        { nome: 'Cliente', valor: nome_cliente.substring(0, 50) },
        { nome: 'Franqueado', valor: franqueado_codigo },
        { nome: 'Plano', valor: 'NaHoraSaude' }
      ]
    };

    const chargeResponse = await fetch(`https://pix.api.efipay.com.br/v2/cob/${txid}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'NaHoraSaude-NetlifyProxy/1.0'
      },
      body: JSON.stringify(chargePayload)
    }).catch(err => {
      throw new Error("Erro ao conectar na API EfiPay (cobrança): " + err.message);
    });

    if (!chargeResponse.ok) {
      const errorText = await chargeResponse.text();
      console.error("Erro na resposta da API EfiPay (cobrança):", errorText);
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Falha ao criar cobrança na EfiPay', details: errorText })
      };
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
          vencimento: new Date(Date.now() + 3600 * 1000).toISOString(),
          efipay_response: chargeResult
        }
      })
    };
  } catch (error) {
    console.error("Erro no proxy:", error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        success: false,
        error: 'Erro interno no proxy',
        details: error.message || 'Erro desconhecido'
      })
    };
  }
};
