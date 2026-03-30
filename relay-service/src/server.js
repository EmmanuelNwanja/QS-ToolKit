require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const nodemailer = require('nodemailer');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

const PORT = process.env.PORT || 8080;
const RELAY_TOKEN = process.env.RELAY_TOKEN || '';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 465);
const SMTP_SECURE = String(process.env.SMTP_SECURE || 'true').toLowerCase() === 'true';
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.warn('Relay SMTP config missing. Set SMTP_HOST, SMTP_USER, SMTP_PASS');
}

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  },
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 15000),
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 15000),
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20000),
  tls: {
    minVersion: 'TLSv1.2'
  }
});

function authorized(req) {
  if (!RELAY_TOKEN) return true;
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  const provided = auth.slice('Bearer '.length).trim();
  return provided === RELAY_TOKEN;
}

app.get('/health', async (req, res) => {
  res.json({ success: true, service: 'qstoolkit-email-relay', ts: new Date().toISOString() });
});

app.post('/send-email', async (req, res) => {
  if (!authorized(req)) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }

  try {
    const { from, to, subject, html, text, attachments } = req.body || {};

    if (!from?.email || !Array.isArray(to) || to.length === 0 || !subject || !html) {
      return res.status(400).json({
        success: false,
        message: 'Invalid payload. Required: from.email, to[], subject, html'
      });
    }

    const recipientList = to
      .map((r) => (r?.name ? `${r.name} <${r.email}>` : r?.email))
      .filter(Boolean)
      .join(', ');

    const relayAttachments = Array.isArray(attachments)
      ? attachments.map((a) => {
        if (!a?.name || !a?.content) return null;
        return {
          filename: a.name,
          content: Buffer.from(a.content, 'base64'),
          contentType: a.contentType || 'application/octet-stream'
        };
      }).filter(Boolean)
      : [];

    await transport.sendMail({
      from: from.name ? `${from.name} <${from.email}>` : from.email,
      to: recipientList,
      subject,
      html,
      text: text || undefined,
      ...(relayAttachments.length ? { attachments: relayAttachments } : {})
    });

    return res.json({ success: true, message: 'Email relayed' });
  } catch (err) {
    return res.status(502).json({
      success: false,
      message: 'Relay send failed',
      error: err.message
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Email relay listening on port ${PORT}`);
});
