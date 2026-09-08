import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const htmlPath = join(__dirname, "whatsapp-test.html");
const port = Number(process.env.WHATSAPP_TEST_PORT || 5055);

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) return;
  const text = readFileSync(filePath, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(join(root, ".env"));

function normalizeE164Phone(phone) {
  const digits = phone.replace(/\D/g, "");
  if (phone.trim().startsWith("+")) return `+${digits}`;
  if (digits.startsWith("0")) return `+234${digits.slice(1)}`;
  if (digits.startsWith("234")) return `+${digits}`;
  return `+${digits}`;
}

function toTwilioWhatsAppAddress(phone) {
  return `whatsapp:${normalizeE164Phone(phone)}`;
}

function getTwilioConfig() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID || "";
  const authToken = process.env.TWILIO_AUTH_TOKEN || "";
  let whatsappFrom = process.env.TWILIO_WHATSAPP_FROM || "";
  if (whatsappFrom && !whatsappFrom.startsWith("whatsapp:")) {
    whatsappFrom = `whatsapp:${whatsappFrom}`;
  }

  return {
    accountSid,
    authToken,
    whatsappFrom,
    otpContentSid:
      process.env.TWILIO_WHATSAPP_OTP_CONTENT_SID ||
      process.env.TWILIO_WHATSAPP_CONTENT_SID ||
      "",
    messageContentSid: process.env.TWILIO_WHATSAPP_MESSAGE_CONTENT_SID || "",
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID || "",
    configured: Boolean(accountSid && authToken && whatsappFrom),
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...corsHeaders,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

async function twilioFetch(accountSid, authToken, path, init) {
  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
        ...(init?.headers || {}),
      },
    },
  );
  const text = await response.text();
  let data = {};
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  return { response, data };
}

async function waitForFinalStatus(accountSid, authToken, sid) {
  for (let i = 0; i < 8; i += 1) {
    await new Promise((r) => setTimeout(r, 700));
    const { data } = await twilioFetch(
      accountSid,
      authToken,
      `/Messages/${sid}.json`,
    );
    if (["delivered", "undelivered", "failed", "read"].includes(data.status)) {
      return data;
    }
  }
  const { data } = await twilioFetch(
    accountSid,
    authToken,
    `/Messages/${sid}.json`,
  );
  return data;
}

async function sendContentTemplate({ phone, contentSid, variables, kind }) {
  const cfg = getTwilioConfig();
  if (!cfg.configured) {
    const err = new Error(
      "Twilio is not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_WHATSAPP_FROM in .env",
    );
    err.status = 400;
    throw err;
  }

  if (!contentSid) {
    const err = new Error(
      kind === "otp"
        ? "Set TWILIO_WHATSAPP_OTP_CONTENT_SID in .env (your verifications_2fa_template HX SID)"
        : "Set TWILIO_WHATSAPP_MESSAGE_CONTENT_SID in .env. Create a Utility/Text template with {{1}} for the course message — do not use message_opt_in",
    );
    err.status = 400;
    throw err;
  }

  const to = toTwilioWhatsAppAddress(phone);
  const params = new URLSearchParams({
    From: cfg.whatsappFrom,
    To: to,
    ContentSid: contentSid,
    ContentVariables: JSON.stringify(variables),
  });

  if (cfg.messagingServiceSid) {
    params.set("MessagingServiceSid", cfg.messagingServiceSid);
  }

  const { response, data } = await twilioFetch(
    cfg.accountSid,
    cfg.authToken,
    "/Messages.json",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params.toString(),
    },
  );

  if (!response.ok) {
    const err = new Error(
      data.message || data.raw || `Twilio error (${response.status})`,
    );
    err.status = response.status;
    err.details = data;
    throw err;
  }

  const final = await waitForFinalStatus(cfg.accountSid, cfg.authToken, data.sid);

  return {
    kind,
    to,
    sid: data.sid,
    status: data.status,
    finalStatus: final.status,
    errorCode: final.error_code,
    errorMessage: final.error_message,
    contentSid,
  };
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    if (req.method === "GET" && req.url === "/favicon.ico") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
      const html = readFileSync(htmlPath);
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }

    if (req.method === "GET" && req.url === "/api/status") {
      const cfg = getTwilioConfig();
      sendJson(res, 200, {
        configured: cfg.configured,
        from: cfg.whatsappFrom || null,
        otpContentSid: cfg.otpContentSid || null,
        messageContentSid: cfg.messageContentSid || null,
        messagingServiceSid: cfg.messagingServiceSid || null,
      });
      return;
    }

    if (req.method === "POST" && req.url === "/api/send") {
      const body = await readJson(req);
      const phone = String(body.phone || "").trim();
      const kind = body.kind === "course" ? "course" : "otp";
      const cfg = getTwilioConfig();

      if (!phone) {
        sendJson(res, 400, { error: "phone is required" });
        return;
      }

      if (kind === "otp") {
        const otp = String(body.otp || "").trim();
        if (!otp) {
          sendJson(res, 400, { error: "otp is required" });
          return;
        }
        const result = await sendContentTemplate({
          kind,
          phone,
          contentSid: cfg.otpContentSid,
          variables: { "1": otp },
        });
        sendJson(res, 200, result);
        return;
      }

      const message = String(body.message || "").trim();
      const courseTitle = String(body.courseTitle || "").trim();
      const links = String(body.links || "").trim();
      if (!courseTitle || !links) {
        if (!message) {
          sendJson(res, 400, {
            error: "courseTitle and links are required (or legacy message)",
          });
          return;
        }
      }
      const result = await sendContentTemplate({
        kind,
        phone,
        contentSid: cfg.messageContentSid,
        variables: message
          ? { "1": message }
          : { "1": courseTitle, "2": links },
      });
      sendJson(res, 200, result);
      return;
    }

    sendJson(res, 404, { error: "Not found" });
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.message || "Unexpected error",
      details: error.details,
    });
  }
});

server.listen(port, () => {
  const cfg = getTwilioConfig();
  console.log(`WhatsApp test UI: http://localhost:${port}`);
  console.log(
    cfg.configured
      ? `Twilio From: ${cfg.whatsappFrom}`
      : "Twilio not configured — fill TWILIO_* in .env",
  );
  console.log(
    cfg.otpContentSid
      ? `OTP Content SID: ${cfg.otpContentSid}`
      : "Missing TWILIO_WHATSAPP_OTP_CONTENT_SID",
  );
  console.log(
    cfg.messageContentSid
      ? `Message Content SID: ${cfg.messageContentSid}`
      : "Missing TWILIO_WHATSAPP_MESSAGE_CONTENT_SID (create Utility/Text template for course links)",
  );
});
