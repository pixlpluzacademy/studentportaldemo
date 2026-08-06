import nodemailer from 'nodemailer'

function requiredEnv(name: string) {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }
  return value
}

export function createSmtpTransport() {
  const host = process.env.SMTP_HOST?.trim() || 'smtp.titan.email'
  const port = Number(process.env.SMTP_PORT || '465')
  const user = requiredEnv('SMTP_USER')
  const pass = requiredEnv('SMTP_PASS')

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })
}

export async function sendPasswordResetEmail(input: {
  to: string
  resetUrl: string
}) {
  const fromEmail = process.env.SMTP_FROM?.trim() || requiredEnv('SMTP_USER')
  const fromName = process.env.SMTP_FROM_NAME?.trim() || 'Pixel Pluz Academy'
  const transport = createSmtpTransport()

  await transport.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: input.to,
    subject: 'Reset your Pixel Pluz Portal password',
    text: [
      'You requested a password reset for Pixel Pluz Portal.',
      '',
      `Open this link to set a new password (valid for 1 hour):`,
      input.resetUrl,
      '',
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: `
      <p>You requested a password reset for <strong>Pixel Pluz Portal</strong>.</p>
      <p><a href="${input.resetUrl}">Click here to set a new password</a></p>
      <p>This link is valid for <strong>1 hour</strong>.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `,
  })
}
