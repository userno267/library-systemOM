// backend/services/mailer.js
import nodemailer from "nodemailer";

// Requires a Gmail App Password (not your regular Gmail password) —
// generate one at https://myaccount.google.com/apppasswords
// (requires 2-Step Verification to be enabled on the Gmail account).
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,     // STARTTLS, not implicit SSL
  family: 4,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});
export function generateVerificationCode() {
  return String(Math.floor(100000 + Math.random() * 900000)); // 6-digit code
}

export async function sendVerificationEmail(to, code) {
  await transporter.sendMail({
    from: `"LibPortal" <${process.env.GMAIL_USER}>`,
    to,
    subject: "Verify your LibPortal account",
    html: `
      <div style="font-family: 'Poppins', Arial, sans-serif; max-width: 420px; margin: 0 auto; padding: 24px; border: 1px solid #eee; border-radius: 12px;">
        <h2 style="color: #2e7d32; margin-bottom: 4px;">📚 LibPortal</h2>
        <p style="color: #555;">Oriental Mindoro National High School</p>
        <p>Use the code below to verify your email address:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1b5e20; text-align: center; margin: 20px 0;">
          ${code}
        </p>
        <p style="color: #777; font-size: 0.85rem;">This code expires in 10 minutes. If you didn't request this, you can ignore this email.</p>
      </div>
    `,
  });
}

export default transporter;