function safeRedirect(url) {
  const u = new URL(url, window.location.origin);
  if (u.origin !== window.location.origin) return; // reject external origins
  location.href = u.pathname + u.search + u.hash;
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
  safeRedirect(userControlledValue);
}

safeRedirect(location.href);

export { getAccessToken, getRefreshToken, safeRedirect, navigateTo };
