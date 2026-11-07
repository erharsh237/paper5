const getAccessToken = () => {
  const m = document.cookie.match(/access_token=([^;]+)/);
  return m ? m[1] : null;
};

const getRefreshToken = () => {
  const m = document.cookie.match(/refresh_token=([^;]+)/);
  return m ? m[1] : null;
};

export { getAccessToken, getRefreshToken };
