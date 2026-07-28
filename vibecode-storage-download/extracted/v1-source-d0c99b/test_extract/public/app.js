// Mobile Trade App - Frontend Logic
let currentCompany = null;
let companies = [];
let products = [];
let orderItems = {};
let currentLocation = null;

// РџРѕР»СѓС‡Р°РµРј userId Рё С‚РѕРєРµРЅ РёР· РІСЃС‚СЂРѕРµРЅРЅРѕР№ РєРѕРЅС„РёРіСѓСЂР°С†РёРё
const USER_ID = window.APP_CONFIG?.userId || '';
let AUTH_TOKEN = window.APP_CONFIG?.token || '';

// РЎРѕС…СЂР°РЅСЏРµРј С‚РѕРєРµРЅ РІ sessionStorage РґР»СЏ РїРѕСЃР»РµРґСѓСЋС‰РёС… Р·Р°РїСЂРѕСЃРѕРІ
if (AUTH_TOKEN) {
  sessionStorage.setItem('auth_token', AUTH_TOKEN);
  console.log('Token saved to sessionStorage');
} else {
  // РџСЂРѕР±СѓРµРј РІРѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ С‚РѕРєРµРЅ РёР· sessionStorage
  AUTH_TOKEN = sessionStorage.getItem('auth_token') || '';
  console.log('Token restored from sessionStorage:', AUTH_TOKEN ? 'yes' : 'no');
}

// Р‘Р°Р·РѕРІС‹Рµ РѕРїС†РёРё РґР»СЏ fetch СЃ Р°РІС‚РѕСЂРёР·Р°С†РёРµР№
function getFetchOptions(options = {}) {
  const headers = {
    ...options.headers,
    'X-User-Id': USER_ID
  };
  
  // Р”РѕР±Р°РІР»СЏРµРј С‚РѕРєРµРЅ Р°РІС‚РѕСЂРёР·Р°С†РёРё РµСЃР»Рё РµСЃС‚СЊ
  if (AUTH_TOKEN) {
    headers['Authorization'] = AUTH_TOKEN;
  }
  
  return {
    ...options,
    credentials: 'include',
    headers
  };
}

// Initialize
  loadUserInfo();
  loadCompanies();
  setupEventListeners();
});

// Load user info
async function loadUserInfo() {
  try {
    const response = await fetch('/api/me', getFetchOptions());
    const data = await response.json();
    if (data.data && data.data.currentUser) {
      const user = data.data.currentUser;
      document.getElementById('userInfo').textContent = 
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ';
    }
  } catch (error) {
    console.error('Error loading user info:', error);
  }
}

// Load companies
async function loadCompanies() {
  try {
    const response = await fetch('/api/companies', getFetchOptions());
    const data = await response.json();
    companies = data.result || [];
    renderCompanies(companies);
  } catch (error) {
    console.error('Error loading companies:', error);
    document.getElementById('companiesList').innerHTML = 
      '<div class="loading">РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РєРѕРјРїР°РЅРёР№</div>';
  }
}

// Render companies list
function renderCompanies(companiesList) {
  const container = document.getElementById('companiesList');
  
  if (companiesList.length === 0) {
    container.innerHTML = '<div class="loading">РљРѕРјРїР°РЅРёРё РЅРµ РЅР°Р№РґРµРЅС‹</div>';
    return;
  }
  
  container.innerHTML = companiesList.map(company => {
    const address = company.ADDRESS || 'РђРґСЂРµСЃ РЅРµ СѓРєР°Р·Р°РЅ';
    const phone = company.PHONE && company.PHONE[0] ? company.PHONE[0].VALUE : '';
    
    return `
      <div class="company-item" onclick="selectCompany(${company.ID})">
        <h3>${escapeHtml(company.TITLE)}</h3>
        <div class="company-address">рџ“Ќ ${escapeHtml(address)}</div>
        ${phone ? `<div class="company-phone">рџ“ћ ${escapeHtml(phone)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// Select company
function selectCompany(companyId) {
  currentCompany = companies.find(c => c.ID == companyId);
  if (!currentCompany) return;
  
  // Render company details
  const card = document.getElementById('companyCard');
  const address = currentCompany.ADDRESS || 'РђРґСЂРµСЃ РЅРµ СѓРєР°Р·Р°РЅ';
  const phone = currentCompany.PHONE && currentCompany.PHONE[0] ? currentCompany.PHONE[0].VALUE : 'РќРµ СѓРєР°Р·Р°РЅ';
  const email = currentCompany.EMAIL && currentCompany.EMAIL[0] ? currentCompany.EMAIL[0].VALUE : 'РќРµ СѓРєР°Р·Р°РЅ';
  
  card.innerHTML = `
    <h2>${escapeHtml(currentCompany.TITLE)}</h2>
    <div class="detail-row">
      <span class="detail-label">рџ“Ќ РђРґСЂРµСЃ:</span>
      <span>${escapeHtml(address)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">рџ“ћ РўРµР»РµС„РѕРЅ:</span>
      <span>${escapeHtml(phone)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">вњ‰пёЏ Email:</span>
      <span>${escapeHtml(email)}</span>
    </div>
  `;
  
  // Update company names in forms
  document.getElementById('visitCompanyName').textContent = currentCompany.TITLE;
  document.getElementById('photoCompanyName').textContent = currentCompany.TITLE;
  document.getElementById('noteCompanyName').textContent = currentCompany.TITLE;
  document.getElementById('orderCompanyName').textContent = currentCompany.TITLE;
  
  showScreen('companyDetailScreen');
}

// Show screen
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
  window.scrollTo(0, 0);
}

// Search companies
document.getElementById('companySearch')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = companies.filter(c => 
    c.TITLE.toLowerCase().includes(query) ||
    (c.ADDRESS && c.ADDRESS.toLowerCase().includes(query))
  );
  renderCompanies(filtered);
});

// Visit Form
function showVisitForm() {
  currentLocation = null;
  document.getElementById('locationDisplay').classList.remove('active');
  document.getElementById('visitComment').value = '';
  showScreen('visitFormScreen');
}

function getLocation() {
  if (!navigator.geolocation) {
    showToast('Р“РµРѕР»РѕРєР°С†РёСЏ РЅРµ РїРѕРґРґРµСЂР¶РёРІР°РµС‚СЃСЏ');
    return;
  }
  
  const btn = document.querySelector('.btn-location');
  btn.textContent = 'вЏі РћРїСЂРµРґРµР»РµРЅРёРµ...';
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      
      const display = document.getElementById('locationDisplay');
      display.innerHTML = `
        вњ… РњРµСЃС‚РѕРїРѕР»РѕР¶РµРЅРёРµ РѕРїСЂРµРґРµР»РµРЅРѕ<br>
        РЁРёСЂРѕС‚Р°: ${currentLocation.latitude.toFixed(6)}<br>
        Р”РѕР»РіРѕС‚Р°: ${currentLocation.longitude.toFixed(6)}
      `;
      display.classList.add('active');
      btn.textContent = 'рџ“Ќ РћР±РЅРѕРІРёС‚СЊ РјРµСЃС‚РѕРїРѕР»РѕР¶РµРЅРёРµ';
    },
    (error) => {
      showToast('РћС€РёР±РєР° РѕРїСЂРµРґРµР»РµРЅРёСЏ РјРµСЃС‚РѕРїРѕР»РѕР¶РµРЅРёСЏ');
      btn.textContent = 'рџ“Ќ РћРїСЂРµРґРµР»РёС‚СЊ РјРµСЃС‚РѕРїРѕР»РѕР¶РµРЅРёРµ';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

document.getElementById('visitForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const comment = document.getElementById('visitComment').value;
  
  try {
    const response = await fetch('/api/activities', getFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: currentCompany.ID,
        type: 'visit',
        subject: 'РџРѕСЃРµС‰РµРЅРёРµ С‚РѕСЂРіРѕРІРѕР№ С‚РѕС‡РєРё',
        description: comment,
        location: currentLocation
      })
    }));
    
    const data = await response.json();
    if (data.result) {
      showSuccess('РћС‚РјРµС‚РєР° СЃРѕС…СЂР°РЅРµРЅР°!', 'РџРѕСЃРµС‰РµРЅРёРµ С‚РѕСЂРіРѕРІРѕР№ С‚РѕС‡РєРё Р·Р°С„РёРєСЃРёСЂРѕРІР°РЅРѕ РІ CRM');
    } else {
      showToast('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('РћС€РёР±РєР° СЃРѕРµРґРёРЅРµРЅРёСЏ');
  }
});

// Photo Form
function showPhotoForm() {
  document.getElementById('photoInput').value = '';
  document.getElementById('photoPreview').innerHTML = '';
  document.getElementById('photoComment').value = '';
  showScreen('photoFormScreen');
}

document.getElementById('photoInput')?.addEventListener('change', (e) => {
  const files = e.target.files;
  const preview = document.getElementById('photoPreview');
  preview.innerHTML = '';
  
  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target.result;
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
});

document.getElementById('photoForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData();
  formData.append('companyId', currentCompany.ID);
  formData.append('description', document.getElementById('photoComment').value);
  
  const files = document.getElementById('photoInput').files;
  if (files.length === 0) {
    showToast('Р’С‹Р±РµСЂРёС‚Рµ С„РѕС‚РѕРіСЂР°С„РёРё');
    return;
  }
  
  Array.from(files).forEach(file => {
    formData.append('photos', file);
  });
  
  try {
    const response = await fetch('/api/activities/with-photo', getFetchOptions({
      method: 'POST',
      body: formData
    }));
    
    const data = await response.json();
    if (data.result) {
      showSuccess('Р¤РѕС‚РѕРѕС‚С‡РµС‚ РѕС‚РїСЂР°РІР»РµРЅ!', 'Р¤РѕС‚РѕРіСЂР°С„РёРё Рё РєРѕРјРјРµРЅС‚Р°СЂРёР№ СЃРѕС…СЂР°РЅРµРЅС‹ РІ CRM');
    } else {
      showToast('РћС€РёР±РєР° РѕС‚РїСЂР°РІРєРё');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('РћС€РёР±РєР° СЃРѕРµРґРёРЅРµРЅРёСЏ');
  }
});

// Note Form
function showNoteForm() {
  document.getElementById('noteSubject').value = '';
  document.getElementById('noteText').value = '';
  showScreen('noteFormScreen');
}

document.getElementById('noteForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const subject = document.getElementById('noteSubject').value;
  const text = document.getElementById('noteText').value;
  
  if (!subject || !text) {
    showToast('Р—Р°РїРѕР»РЅРёС‚Рµ РІСЃРµ РїРѕР»СЏ');
    return;
  }
  
  try {
    const response = await fetch('/api/activities', getFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: currentCompany.ID,
        type: 'note',
        subject: subject,
        description: text
      })
    }));
    
    const data = await response.json();
    if (data.result) {
      showSuccess('Р—Р°РјРµС‚РєР° СЃРѕС…СЂР°РЅРµРЅР°!', 'Р—Р°РјРµС‚РєР° РґРѕР±Р°РІР»РµРЅР° РІ РґРµР»Р° РєРѕРјРїР°РЅРёРё');
    } else {
      showToast('РћС€РёР±РєР° СЃРѕС…СЂР°РЅРµРЅРёСЏ');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('РћС€РёР±РєР° СЃРѕРµРґРёРЅРµРЅРёСЏ');
  }
});

// Order Form
async function showOrderForm() {
  orderItems = {};
  document.getElementById('orderComment').value = '';
  updateOrderTotal();
  showScreen('orderFormScreen');
  
  // Load products
  try {
    const response = await fetch('/api/products', getFetchOptions());
    const data = await response.json();
    products = data.result || [];
    renderProducts();
  } catch (error) {
    console.error('Error loading products:', error);
    document.getElementById('productsList').innerHTML = 
      '<div class="loading">РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё С‚РѕРІР°СЂРѕРІ</div>';
  }
}

function renderProducts() {
  const container = document.getElementById('productsList');
  
  if (products.length === 0) {
    container.innerHTML = '<div class="loading">РўРѕРІР°СЂС‹ РЅРµ РЅР°Р№РґРµРЅС‹</div>';
    return;
  }
  
  container.innerHTML = products.map(product => {
    const qty = orderItems[product.ID] || 0;
    const price = parseFloat(product.PRICE) || 0;
    
    return `
      <div class="product-item">
        <div class="product-info">
          <div class="product-name">${escapeHtml(product.NAME)}</div>
          <div class="product-price">${price.toFixed(2)} в‚Ѕ</div>
        </div>
        <div class="quantity-control">
          <button type="button" class="qty-btn" onclick="updateQty(${product.ID}, -1, ${price})">в€’</button>
          <span class="qty-value" id="qty-${product.ID}">${qty}</span>
          <button type="button" class="qty-btn" onclick="updateQty(${product.ID}, 1, ${price})">+</button>
        </div>
      </div>
    `;
  }).join('');
}

function updateQty(productId, delta, price) {
  const currentQty = orderItems[productId] || 0;
  const newQty = Math.max(0, currentQty + delta);
  
  if (newQty === 0) {
    delete orderItems[productId];
  } else {
    orderItems[productId] = newQty;
  }
  
  document.getElementById(`qty-${productId}`).textContent = newQty;
  updateOrderTotal();
}

function updateOrderTotal() {
  let total = 0;
  Object.entries(orderItems).forEach(([productId, qty]) => {
    const product = products.find(p => p.ID == productId);
    if (product) {
      total += qty * parseFloat(product.PRICE || 0);
    }
  });
  document.getElementById('orderTotal').textContent = total.toFixed(2);
}

document.getElementById('orderForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  if (Object.keys(orderItems).length === 0) {
    showToast('Р”РѕР±Р°РІСЊС‚Рµ С‚РѕРІР°СЂС‹ РІ Р·Р°РєР°Р·');
    return;
  }
  
  const items = Object.entries(orderItems).map(([productId, qty]) => {
    const product = products.find(p => p.ID == productId);
    return {
      name: product.NAME,
      quantity: qty,
      price: parseFloat(product.PRICE || 0)
    };
  });
  
  const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
  
  try {
    const response = await fetch('/api/activities', getFetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: currentCompany.ID,
        type: 'order',
        subject: 'Р—Р°РєР°Р· РѕС‚ С‚РѕСЂРіРѕРІРѕРіРѕ РїСЂРµРґСЃС‚Р°РІРёС‚РµР»СЏ',
        description: document.getElementById('orderComment').value,
        orderData: { items, total }
      })
    }));
    
    const data = await response.json();
    if (data.result) {
      showSuccess('Р—Р°РєР°Р· РѕС„РѕСЂРјР»РµРЅ!', 'Р—Р°РєР°Р· СЃРѕС…СЂР°РЅРµРЅ РІ РґРµР»Р° РєРѕРјРїР°РЅРёРё');
    } else {
      showToast('РћС€РёР±РєР° РѕС„РѕСЂРјР»РµРЅРёСЏ Р·Р°РєР°Р·Р°');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('РћС€РёР±РєР° СЃРѕРµРґРёРЅРµРЅРёСЏ');
  }
});

// Success screen
function showSuccess(title, message) {
  document.getElementById('successTitle').textContent = title;
  document.getElementById('successMessage').textContent = message;
  showScreen('successScreen');
}

// Toast
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// Escape HTML
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Setup event listeners
function setupEventListeners() {
  // Prevent form submission on Enter for search
  document.getElementById('companySearch')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });
}

// Service Worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}
