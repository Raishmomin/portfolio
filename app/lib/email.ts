import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

type ContactData = {
  name: string;
  email: string;
  subject: string;
  message: string;
};

export async function sendContactEmail(data: ContactData): Promise<void> {
  const to = process.env.SMTP_TO || process.env.SMTP_USER;
  if (!to || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("SMTP not configured — skipping email");
    return;
  }

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
      <div style="border-bottom: 2px solid #18181b; padding-bottom: 16px; margin-bottom: 24px;">
        <h2 style="margin: 0; color: #18181b; font-size: 20px;">New Contact Message</h2>
        <p style="margin: 4px 0 0; color: #71717a; font-size: 14px;">From your portfolio website</p>
      </div>

      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; width: 100px; vertical-align: top;">Name</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #18181b; font-size: 15px;">${data.name}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: top;">Email</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #18181b; font-size: 15px;">
            <a href="mailto:${data.email}" style="color: #18181b;">${data.email}</a>
          </td>
        </tr>
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #71717a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: top;">Subject</td>
          <td style="padding: 12px 0; border-bottom: 1px solid #e4e4e7; color: #18181b; font-size: 15px;">${data.subject}</td>
        </tr>
        <tr>
          <td style="padding: 12px 0; color: #71717a; font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; vertical-align: top;">Message</td>
          <td style="padding: 12px 0; color: #18181b; font-size: 15px; white-space: pre-wrap;">${data.message}</td>
        </tr>
      </table>

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e4e4e7; color: #a1a1aa; font-size: 12px;">
        Sent from raish-portfolio.vercel.app
      </div>
    </div>
  `;

  await transporter.sendMail({
    from: `"Portfolio Contact" <${to}>`,
    to,
    replyTo: data.email,
    subject: `Portfolio: ${data.subject}`,
    html,
  });
}
