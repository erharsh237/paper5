// Inside assets/index-Cpc01hb9.js
function safeNavigate(rawUrl) {
  try {
    const url = new URL(rawUrl, location.origin);
    // Allow only http: or https: and same origin
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== location.origin) {
      console.warn('Blocked unsafe navigation:', rawUrl);
      return;
    }
    location.href = url.href;
  } catch (e) {
    console.warn('Invalid URL:', rawUrl);
  }
}

const getAccessToken = () => {
  const m = document.cookie.match(/access_token=([^;]+)/);
  return m ? m[1] : null;
};

const getRefreshToken = () => {
  const m = document.cookie.match(/refresh_token=([^;]+)/);
  return m ? m[1] : null;
};

function navigateTo(userControlledValue) {
  safeNavigate(userControlledValue);
}

const userControlledValue = typeof location !== 'undefined' ? location.href : '';
safeNavigate(userControlledValue);

export { getAccessToken, getRefreshToken, safeNavigate, navigateTo };
