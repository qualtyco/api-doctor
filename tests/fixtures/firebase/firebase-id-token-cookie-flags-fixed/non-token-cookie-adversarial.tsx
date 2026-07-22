import { setCookie } from 'cookies-next';

// Adversarial: non-auth cookie — "theme" doesn't match /token/i
export function setThemePreference(theme: string) {
  setCookie('theme', theme, { maxAge: 86400 });
}

// Also adversarial: token cookie with httpOnly properly set — should NOT flag
export function setSessionWithHttpOnly(token: string) {
  setCookie('token', token, {
    httpOnly: true,
    secure: true,
    maxAge: 3600,
  });
}
