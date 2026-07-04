const CAPTCHA_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generatePracticeCaptcha(length = 6) {
  return Array.from({ length })
    .map(() => CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)])
    .join("");
}
