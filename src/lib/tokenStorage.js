/**
 * Token Storage Helper
 * Retrieves tokens exclusively from cookies.
 * Eliminates XSS token exfiltration by preventing storage in localStorage/sessionStorage.
 */
export const getAccessToken = () => {
  const m = document.cookie.match(/(?:^|;\s*)(?:sb_)?access_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};

export const getRefreshToken = () => {
  const m = document.cookie.match(/(?:^|;\s*)(?:sb_)?refresh_token=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : null;
};
