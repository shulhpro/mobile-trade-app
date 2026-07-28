// Mobile Trade App - Frontend Logic
let currentCompany = null;
let companies = [];
let products = [];
let orderItems = {};
let currentLocation = null;

// Получаем userId и токен из встроенной конфигурации
const USER_ID = window.APP_CONFIG?.userId || '';
let AUTH_TOKEN = window.APP_CONFIG?.token || '';

// Сохраняем токен в sessionStorage для последующих запросов
if (AUTH_TOKEN) {
  sessionStorage.setItem('auth_token', AUTH_TOKEN);
  console.log('Token saved to sessionStorage');
} else {
  // Пробуем восстановить токен из sessionStorage
  AUTH_TOKEN = sessionStorage.getItem('auth_token') || '';
  console.log('Token restored from sessionStorage:', AUTH_TOKEN ? 'yes' : 'no');
}

// Базовые опции для fetch с авторизацией
function getFetchOptions(options = {}) {
  const headers = {
    ...options.headers,
    'X-User-Id': USER_ID
  };
  
  // Добавляем токен авторизации если есть
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
        `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email || 'Пользователь';
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
      '<div class="loading">Ошибка загрузки компаний</div>';
  }
}

// Render companies list
function renderCompanies(companiesList) {
  const container = document.getElementById('companiesList');
  
  if (companiesList.length === 0) {
    container.innerHTML = '<div class="loading">Компании не найдены</div>';
    return;
  }
  
  container.innerHTML = companiesList.map(company => {
    const address = company.ADDRESS || 'Адрес не указан';
    const phone = company.PHONE && company.PHONE[0] ? company.PHONE[0].VALUE : '';
    
    return `
      <div class="company-item" onclick="selectCompany(${company.ID})">
        <h3>${escapeHtml(company.TITLE)}</h3>
        <div class="company-address">📍 ${escapeHtml(address)}</div>
        ${phone ? `<div class="company-phone">📞 ${escapeHtml(phone)}</div>` : ''}
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
  const address = currentCompany.ADDRESS || 'Адрес не указан';
  const phone = currentCompany.PHONE && currentCompany.PHONE[0] ? currentCompany.PHONE[0].VALUE : 'Не указан';
  const email = currentCompany.EMAIL && currentCompany.EMAIL[0] ? currentCompany.EMAIL[0].VALUE : 'Не указан';
  
  card.innerHTML = `
    <h2>${escapeHtml(currentCompany.TITLE)}</h2>
    <div class="detail-row">
      <span class="detail-label">📍 Адрес:</span>
      <span>${escapeHtml(address)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">📞 Телефон:</span>
      <span>${escapeHtml(phone)}</span>
    </div>
    <div class="detail-row">
      <span class="detail-label">✉️ Email:</span>
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
    showToast('Геолокация не поддерживается');
    return;
  }
  
  const btn = document.querySelector('.btn-location');
  btn.textContent = '⏳ Определение...';
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      };
      
      const display = document.getElementById('locationDisplay');
      display.innerHTML = `
        ✅ Местоположение определено<br>
        Широта: ${currentLocation.latitude.toFixed(6)}<br>
        Долгота: ${currentLocation.longitude.toFixed(6)}
      `;
      display.classList.add('active');
      btn.textContent = '📍 Обновить местоположение';
    },
    (error) => {
      showToast('Ошибка определения местоположения');
      btn.textContent = '📍 Определить местоположение';
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
        subject: 'Посещение торговой точки',
        description: comment,
        location: currentLocation
      })
    }));
    
    const data = await response.json();
    if (data.result) {
      showSuccess('Отметка сохранена!', 'Посещение торговой точки зафиксировано в CRM');
    } else {
      showToast('Ошибка сохранения');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Ошибка соединения');
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
    showToast('Выберите фотографии');
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
      showSuccess('Фотоотчет отправлен!', 'Фотографии и комментарий сохранены в CRM');
    } else {
      showToast('Ошибка отправки');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Ошибка соединения');
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
    showToast('Заполните все поля');
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
      showSuccess('Заметка сохранена!', 'Заметка добавлена в дела компании');
    } else {
      showToast('Ошибка сохранения');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Ошибка соединения');
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
      '<div class="loading">Ошибка загрузки товаров</div>';
  }
}

function renderProducts() {
  const container = document.getElementById('productsList');
  
  if (products.length === 0) {
    container.innerHTML = '<div class="loading">Товары не найдены</div>';
    return;
  }
  
  container.innerHTML = products.map(product => {
    const qty = orderItems[product.ID] || 0;
    const price = parseFloat(product.PRICE) || 0;
    
    return `
      <div class="product-item">
        <div class="product-info">
          <div class="product-name">${escapeHtml(product.NAME)}</div>
          <div class="product-price">${price.toFixed(2)} ₽</div>
        </div>
        <div class="quantity-control">
          <button type="button" class="qty-btn" onclick="updateQty(${product.ID}, -1, ${price})">−</button>
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
    showToast('Добавьте товары в заказ');
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
        subject: 'Заказ от торгового представителя',
        description: document.getElementById('orderComment').value,
        orderData: { items, total }
      })
    }));
    
    const data = await response.json();
    if (data.result) {
      showSuccess('Заказ оформлен!', 'Заказ сохранен в дела компании');
    } else {
      showToast('Ошибка оформления заказа');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Ошибка соединения');
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
