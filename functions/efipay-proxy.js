// functions/efipay-proxy.js
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const port = 8080;

app.use(cors());
app.use(express.json());

app.post("/", async (req, res) => {
  console.log("✅ Requisição recebida no proxy");

  const { method = "POST", endpoint, body = {} } = req.body;

  if (!endpoint || typeof endpoint !== "string") {
    return res.status(400).json({ success: false, error: "Endpoint inválido" });
  }

  try {
    // 1. Obtem token OAuth da EfiPay
    const tokenRes = await axios({
      method: "POST",
      url: `${process.env.EFIPAY_BASE_URL}/v1/authorize`,
      headers: {
        "Content-Type": "application/json",
        Authorization:
          "Basic " +
          Buffer.from(
            `${process.env.EFIPAY_CLIENT_ID}:${process.env.EFIPAY_CLIENT_SECRET}`
          ).toString("base64"),
      },
      data: {
        grant_type: "client_credentials",
      },
    });

    const token = tokenRes.data?.access_token;

    if (!token) {
      console.error("❌ Falha ao obter token:", tokenRes.data);
      return res.status(500).json({ success: false, error: "Token não retornado pela EfiPay", raw: tokenRes.data });
    }

    // 2. Faz a requisição real para a EfiPay
    const apiRes = await axios({
      method,
      url: `${process.env.EFIPAY_BASE_URL}/${endpoint}`,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      data: body,
    });

    return res.status(200).json({ success: true, data: apiRes.data });
  } catch (err) {
    console.error("❌ ERRO NO PROXY:", err.response?.data || err.message);
    return res.status(500).json({
      success: false,
      error: "Erro no proxy",
      details: err.response?.data || err.message,
    });
  }
});

app.listen(port, () => {
  console.log(`✅ EfiPay proxy server rodando em http://localhost:${port}`);
});
