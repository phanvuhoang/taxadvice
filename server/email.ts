import nodemailer from "nodemailer";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    console.warn("SMTP not configured. Email features disabled.");
    return null;
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  return transporter;
}

export async function sendPasswordResetEmail(email: string, token: string, appUrl: string): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) {
    console.warn("Cannot send email: SMTP not configured");
    return false;
  }

  const resetUrl = `${appUrl}/#/reset-password?token=${token}`;

  try {
    await transport.sendMail({
      from: process.env.SMTP_USER,
      to: email,
      subject: "TaxAdvice - Đặt lại mật khẩu",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0d5c63;">TaxAdvice - Đặt lại mật khẩu</h2>
          <p>Bạn đã yêu cầu đặt lại mật khẩu. Nhấn vào liên kết bên dưới để tiếp tục:</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background: #0d5c63; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Đặt lại mật khẩu
          </a>
          <p style="color: #666; font-size: 14px;">Liên kết này sẽ hết hạn sau 1 giờ.</p>
          <p style="color: #666; font-size: 14px;">Nếu bạn không yêu cầu đặt lại mật khẩu, vui lòng bỏ qua email này.</p>
        </div>
      `,
    });
    return true;
  } catch (err) {
    console.error("Send email error:", err);
    return false;
  }
}
