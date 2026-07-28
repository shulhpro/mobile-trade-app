// Auth module for Mobile Trade App
// Handles OAuth authentication via VibeCode

const AUTH_TOKEN_KEY = 'mt_auth_token';
const AUTH_EXPIRES_KEY = 'mt_auth_expires';

// Get stored auth token
function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

// Check if user is authenticated
function isAuthenticated() {
  const token = getAuthToken();
  const expires = localStorage.getItem(AUTH_EXPIRES_KEY);
  if (!token) return false;
  if (expires && new Date(expires) < new Date()) {
    clearAuth();
    return false;
  }
  return true;
}

// Clear auth data
function clearAuth() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_EXPIRES_KEY);
}

// Store auth token
function setAuthToken(token, expiresIn = 86400) {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  const expires = new Date(Date.now() + expiresIn * 1000);
  localStorage.setItem(AUTH_EXPIRES_KEY, expires.toISOString());
}

// Fetch with auth header
async function fetchWithAuth(url, options = {}) {
  const token = getAuthToken();
  if (token) {
    options.headers = options.headers || {};
    options.headers['Authorization'] = 'Bearer ' + token;
  }
  return fetch(url, options);
}

// Check auth status on app load
async function checkAuth() {
  try {
    // Try to get user session - if user is authenticated via Bitrix24,
    // Gateway will automatically add X-Vibe-Authorization header
    const response = await fetch('/api/session');
    
    if (response.ok) {
      const data = await response.json();
      if (data.success && data.user) {
        console.log('User authenticated via Bitrix24');
        window.currentUser = data.user;
        return true;
      }
    }
    
    // If /api/session failed, try with stored token
    const token = getAuthToken();
    if (token) {
      const response2 = await fetchWithAuth('/api/session');
      const data2 = await response2.json();
      if (data2.success && data2.user) {
        console.log('User authenticated via stored token');
        window.currentUser = data2.user;
        return true;
      }
    }
    
    console.log('User not authenticated, showing login');
    showLoginScreen();
    return false;
  } catch (error) {
    console.error('Auth check failed:', error);
    showLoginScreen();
    return false;
  }
}

// Show login screen
function showLoginScreen() {
  const app = document.getElementById('app');
  if (!app) return;
  
  app.innerHTML = `
    <div class="login-screen">
      <div class="login-container">
        <h1>🏭 Мобильная торговля</h1>
        <p>Войдите через Битрикс24 для доступа к приложению</p>
        <button class="btn-login" onclick="startOAuth()">
          Войти через Битрикс24
        </button>
      </div>
    </div>
  `;
}

// Start OAuth flow
function startOAuth() {
  window.location.href = '/api/auth/login';
}

// Handle OAuth callback
async function handleOAuthCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  const error = urlParams.get('error');
  
  if (error) {
    console.error('OAuth error:', error);
    alert('Ошибка авторизации: ' + error);
    showLoginScreen();
    return;
  }
  
  if (token) {
    setAuthToken(token);
    window.history.replaceState({}, document.title, window.location.pathname);
    window.location.reload();
  }
}

// Logout
function logout() {
  clearAuth();
  window.location.href = '/api/auth/logout';
}

// Initialize auth on page load
document.addEventListener('DOMContentLoaded', function() {
  if (window.location.search.includes('token=') || window.location.search.includes('error=')) {
    handleOAuthCallback();
  } else {
    checkAuth();
  }
});
