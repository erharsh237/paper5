function isSafeUrl(url) {
  try {
    const u = new URL(url, location.origin);
    return u.origin === location.origin && (u.protocol === 'http:' || u.protocol === 'https:');
  } catch {
    return false;
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
  if (isSafeUrl(userControlledValue)) {
    location.href = userControlledValue;
  } else {
    // optional: fallback to a safe page or ignore
    console.warn('Unsafe URL blocked:', userControlledValue);
  }
}

export { getAccessToken, getRefreshToken, isSafeUrl, navigateTo };
