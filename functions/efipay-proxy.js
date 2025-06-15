
const axios = require("axios");

exports.handler = async function(event) {
  try {
    const body = JSON.parse(event.body);

    const requiredFields = [
      "valor",
      "nome_cliente",
      "email_cliente",
      "cpf_cliente",
      "franqueado_codigo"
    ];

    for (const field of requiredFields) {
      if (!body[field]) {
        return {
          statusCode: 400,
          body: JSON.stringify({
            success: false,
            error: "Campos obrigatórios ausentes",
            missing: field
          })
        };
      }
    }

    // Simula chamada à EfiPay (substitua pela chamada real se desejar)
    const mockResponse = {
      qrcode: "qrcode-pix-exemplo",
      txid: "txid-exemplo"
    };

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ...mockResponse
      })
    };

  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: err.message
      })
    };
  }
};
