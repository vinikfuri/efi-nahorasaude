const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

app.post("/", async (req, res) => {
  const { endpoint, method, body } = req.body;

  if (!endpoint || !method || !body) {
    return res.status(400).json({
      success: false,
      error: "Campos obrigatórios ausentes",
      details: "Você precisa enviar 'endpoint', 'method' e 'body'"
    });
  }

  try {
    const efipayBaseUrl = "https://pix.api.efipay.com.br";
    const credentials = Buffer.from(`${process.env.EFIPAY_CLIENT_ID}:${process.env.EFIPAY_CLIENT_SECRET}`).toString("base64");

    const authRes = await axios.post(`${efipayBaseUrl}/oauth/token`, {
      grant_type: "client_credentials"
    }, {
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/json"
      }
    });

    const token = authRes.data.access_token;

    const response = await axios({
      method,
      url: `${efipayBaseUrl}/${endpoint}`,
      data: body,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json"
      }
    });

    return res.status(200).json(response.data);
  } catch (error) {
    console.error("Erro no proxy:", error?.response?.data || error.message);
    return res.status(500).json({
      success: false,
      error: "Erro ao processar proxy",
      details: error?.response?.data || error.message
    });
  }
});

// 👇 ESSENCIAL PARA FUNCIONAR NO RAILWAY
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ EfiPay proxy server running on port ${PORT}`);
});
