const CAPTCHA_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generatePracticeCaptcha(length = 6) {
  return Array.from({ length })
    .map(() => CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)])
    .join("");
}
