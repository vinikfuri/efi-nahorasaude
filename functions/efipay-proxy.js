// efipay-proxy.js

const https = require("https");
const crypto = require("crypto");

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== "POST") {
      return {
        statusCode: 405,
        body: JSON.stringify({ success: false, error: "Method Not Allowed" }),
      };
    }

    const body = event.body;
    const receivedSignature = event.headers["x-signature"] || event.headers["X-Signature"];

    const secret = process.env.EFIPAY_HMAC_SECRET;
    if (!secret) {
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: "HMAC secret not configured" }),
      };
    }

    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(body, "utf8");
    const expectedSignature = hmac.digest("hex");

    if (receivedSignature !== expectedSignature) {
      return {
        statusCode: 401,
        body: JSON.stringify({ success: false, error: "Invalid signature" }),
      };
    }

    const payload = JSON.parse(body);

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ success: false, error: "Supabase credentials not configured" }),
      };
    }

    const baseUrl = "https://api.efipay.com.br"; // sempre produção

    const { txid } = payload;

    const data = JSON.stringify({
      txid,
      recebido_em: new Date().toISOString(),
      valor: payload.valor,
      pagador: payload.devedor || null,
      raw: payload,
    });

    const options = {
      hostname: supabaseUrl.replace("https://", "").replace("/", ""),
      port: 443,
      path: "/rest/v1/pagamentos_pix",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=minimal",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let responseData = "";
        res.on("data", (chunk) => {
          responseData += chunk;
        });
        res.on("end", () => {
          resolve({
            statusCode: res.statusCode,
            body: responseData,
          });
        });
      });

      req.on("error", (e) => {
        reject(e);
      });

      req.write(data);
      req.end();
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Pagamento registrado", supabase: response }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: error.message }),
    };
  }
};
