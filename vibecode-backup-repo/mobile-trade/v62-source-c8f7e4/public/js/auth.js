// Auth module for Mobile Trade App
// Handles transparent authentication via Black Hole Gateway
// Gateway automatically injects X-Vibe-Authorization when opened from Bitrix24

const AUTH_TOKEN_KEY = 'mt_auth_token';

// Check for token in URL (from OAuth callback) and store in cookie
function checkUrlToken() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (token) {
    // Store in cookie for subsequent requests
    document.cookie = ibe_session=; Path=/; Max-Age=86400; SameSite=Lax;
    // Also store in localStorage as fallback
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    // Clean URL
    window.history.replaceState({}, document.title, window.location.pathname);
    return token;
  }
  return null;
}

// Get stored auth token
function getAuthToken() {
  // First check URL
  const urlToken = checkUrlToken();
  if (urlToken) return urlToken;
  
  // Then check localStorage
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

// Store auth token
function setAuthToken(token) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  document.cookie = ibe_session=; Path=/; Max-Age=86400; SameSite=Lax;
}

// Clear auth token
function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  document.cookie = 'vibe_session=; Path=/; Max-Age=0; SameSite=Lax';
}

// Fetch with auth - sends token in Authorization header
// When opened from Bitrix24 via Gateway, X-Vibe-Authorization is injected automatically
// For standalone use, we send Authorization header with stored token
async function fetchWithAuth(url, options = {}) {
  const token = getAuthToken();
  
  options.headers = options.headers || {};
  
  // If we have a stored token, add Authorization header
  // Gateway will override this with X-Vibe-Authorization when inside Bitrix24
  if (token) {
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  
  const response = await fetch(url, options);
  
  // Handle auth errors
  if (response.status === 401) {
    const data = await response.json().catch(() => ({}));
    console.log('Auth required, redirecting to login...');
    
    // Clear invalid token
    clearAuth();
    
    // Redirect to login
    if (data.authUrl) {
      window.location.href = data.authUrl;
    } else {
      window.location.href = '/api/auth/login';
    }
    
    // Return a promise that never resolves (we're redirecting)
    return new Promise(() => {});
  }
  
  return response;
}

// Check auth status on app load
async function checkAuth() {
  try {
    // Check URL for token first
    checkUrlToken();
    
    // Try to get user session
    const response = await fetch('/api/session');
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user) {
        console.log('User authenticated:', data.user.name);
        window.currentUser = data.user;
        return true;
      }
    }
    
    // If /api/session failed with 401, try with stored token
    if (response.status === 401) {
      const token = getAuthToken();
      if (token) {
        const response2 = await fetch('/api/session', {
          headers: { 'Authorization': 'Bearer ' + token }
        });
        if (response2.ok) {
          const data2 = await response2.json();
          if (data2.success && data2.user) {
            console.log('User authenticated via stored token');
            window.currentUser = data2.user;
            return true;
          }
        }
      }
    }
    
    console.log('No authentication available');
    return false;
  } catch (error) {
    console.error('Auth check failed:', error);
    return false;
  }
}

// Logout
function logout() {
  clearAuth();
  window.location.reload();
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', function() {
  checkAuth();
});
