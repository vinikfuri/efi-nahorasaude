const express = require("express");
const axios = require("axios");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;

app.post("/", async (req, res) => {
  try {
    const { endpoint, method, body } = req.body;

    console.log("📥 Requisição recebida no proxy");
    console.log("🔗 Endpoint:", endpoint);
    console.log("📦 Método:", method);
    console.log("🧾 Corpo:", JSON.stringify(body));

    // Autenticação
    const tokenResponse = await axios({
      method: "POST",
      url: `${process.env.EFIPAY_BASE_URL}/v1/authorize`,
      headers: {
        "Content-Type": "application/json",
      },
      auth: {
        username: process.env.EFIPAY_CLIENT_ID,
        password: process.env.EFIPAY_CLIENT_SECRET,
      },
    });

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) {
      console.error("❌ Falha ao obter token: nenhum token retornado");
      return res.status(500).json({ error: "Erro ao obter token da EfiPay" });
    }

    // Enviar requisição real
    const efipayResponse = await axios({
      method: method,
      url: `${process.env.EFIPAY_BASE_URL}/${endpoint}`,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      data: body,
    });

    console.log("✅ Resposta da EfiPay recebida com sucesso");
    res.json(efipayResponse.data);
  } catch (err) {
    console.error("❌ Erro no proxy:", err.message);
    if (err.response) {
      console.error("📡 Resposta da EfiPay:", err.response.data);
      res.status(err.response.status).json({
        error: "Erro ao processar requisição",
        details: err.response.data,
      });
    } else {
      res.status(500).json({
        error: "Erro inesperado no servidor proxy",
        details: err.message,
      });
    }
  }
});

app.listen(PORT, () => {
  console.log(`✅ EfiPay proxy server rodando na porta ${PORT}`);
});
