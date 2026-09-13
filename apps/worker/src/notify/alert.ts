import { Resend } from 'resend'

const from = process.env.ALERT_EMAIL_FROM ?? 'bid-portal@example.com'
const apiKey = process.env.RESEND_API_KEY

const resend = apiKey ? new Resend(apiKey) : null

/**
 * Khong co RESEND_API_KEY thi ghi log thay vi im lang nuot canh bao —
 * moi truong dev van phai thay duoc canh bao.
 */
export async function sendAlert(to: string, subject: string, text: string): Promise<void> {
  if (!resend) {
    console.warn(`[alert:log-only] to=${to} subject=${subject}\n${text}`)
    return
  }

  try {
    await resend.emails.send({ from, to, subject, text })
  } catch (err) {
    console.error(`[alert:failed] to=${to}: ${(err as Error).message}`)
  }
}
