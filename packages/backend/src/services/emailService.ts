import nodemailer from 'nodemailer';
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { config } from '../config.js';

function createTransport() {
  if (config.SES_FROM_ADDRESS) {
    const sesClient = new SESv2Client({ region: config.AWS_REGION });
    return nodemailer.createTransport({ SES: { sesClient, SendEmailCommand } } as nodemailer.TransportOptions);
  }
  // Console fallback — logs the email instead of sending
  return nodemailer.createTransport({ jsonTransport: true });
}

export async function sendInviteEmail(to: string, token: string, senderName?: string): Promise<void> {
  const transport = createTransport();
  const link = `${config.APP_URL}/accept-invite?token=${token}`;
  const from = config.SES_FROM_ADDRESS ?? 'noreply@family-tree.local';
  const intro = senderName
    ? `${senderName} has invited you to explore and contribute to the Yap Family Tree.`
    : `You've been invited to explore and contribute to the Yap Family Tree.`;

  const info = await transport.sendMail({
    from,
    to,
    subject: "You're invited to the Yap Family Tree",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#2d2d2d">
        <h2 style="color:#4a6b55">The Yap Family Tree</h2>
        <p>${intro} Click the button below to set your password and get started.</p>
        <p style="margin:32px 0">
          <a href="${link}"
             style="background:#8faa98;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Accept invitation
          </a>
        </p>
        <p style="color:#888;font-size:13px">This link expires in 48 hours. If you weren't expecting this invitation, you can safely ignore this email.</p>
      </div>
    `,
    text: `${intro}\n\nAccept your invitation: ${link}\n\nThis link expires in 48 hours.`,
  });

  if (process.env.NODE_ENV !== 'production' || !config.SES_FROM_ADDRESS) {
    console.log('[email] Invite email (not sent — no SES config):');
    console.log(`  To: ${to}`);
    console.log(`  Link: ${link}`);
    if ('message' in info) {
      console.log(`  Raw: ${JSON.stringify(JSON.parse((info as { message: string }).message), null, 2)}`);
    }
  }
}
