import nodemailer from 'nodemailer';
import { config } from '../config.js';

function createTransport() {
  if (config.SES_FROM_ADDRESS && process.env.AWS_ACCESS_KEY_ID) {
    return nodemailer.createTransport({
      SES: {
        aws: { region: config.AWS_REGION },
      },
    } as nodemailer.TransportOptions);
  }
  // Console fallback — logs the email instead of sending
  return nodemailer.createTransport({ jsonTransport: true });
}

export async function sendInviteEmail(to: string, token: string): Promise<void> {
  const transport = createTransport();
  const link = `${config.APP_URL}/accept-invite?token=${token}`;
  const from = config.SES_FROM_ADDRESS ?? 'noreply@family-tree.local';

  const info = await transport.sendMail({
    from,
    to,
    subject: "You've been invited to the family tree",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#1a1a1a">You're invited!</h2>
        <p>You've been invited to join the family tree. Click the button below to set your password and get started.</p>
        <p style="margin:32px 0">
          <a href="${link}"
             style="background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600">
            Accept invitation
          </a>
        </p>
        <p style="color:#666;font-size:14px">This link expires in 48 hours. If you didn't expect this invitation, you can ignore this email.</p>
      </div>
    `,
    text: `You've been invited to the family tree.\n\nAccept your invitation: ${link}\n\nThis link expires in 48 hours.`,
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
