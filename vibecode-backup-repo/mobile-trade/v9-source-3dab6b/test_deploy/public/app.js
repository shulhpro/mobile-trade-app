// Mobile Trade App - Frontend Logic
let currentCompany = null;
let companies = [];
let products = [];
let orderItems = {};
let currentLocation = null;
let visitPhotos = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadUserInfo();
  loadCompanies();
  setupEventListeners();
});

// Load user info
async function loadUserInfo() {
  try {
    const response = await fetch('/api/me');
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
    const response = await fetch('/api/companies');
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
    const address = company.address || company.ADDRESS || 'Адрес не указан';
    const phone = company.phone || (company.fm && company.fm.find(f => f.typeId === 'PHONE')?.value) || '';
    
    return `
      <div class="company-item" onclick="selectCompany(${company.id || company.ID})">
        <h3>${escapeHtml(company.title || company.TITLE)}</h3>
        <div class="company-address">📍 ${escapeHtml(address)}</div>
        ${phone ? `<div class="company-phone">📞 ${escapeHtml(phone)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// Select company
function selectCompany(companyId) {
  currentCompany = companies.find(c => (c.id || c.ID) == companyId);
  if (!currentCompany) return;
  
  const card = document.getElementById('companyCard');
  const address = currentCompany.address || currentCompany.ADDRESS || 'Адрес не указан';
  const phone = currentCompany.phone || (currentCompany.fm && currentCompany.fm.find(f => f.typeId === 'PHONE')?.value) || 'Не указан';
  const email = currentCompany.email || (currentCompany.fm && currentCompany.fm.find(f => f.typeId === 'EMAIL')?.value) || 'Не указан';
  
  card.innerHTML = `
    <h2>${escapeHtml(currentCompany.title || currentCompany.TITLE)}</h2>
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
  
  const companyName = currentCompany.title || currentCompany.TITLE;
  document.getElementById('visitCompanyName').textContent = companyName;
  
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
    (c.title || c.TITLE || '').toLowerCase().includes(query) ||
    ((c.address || c.ADDRESS) && (c.address || c.ADDRESS).toLowerCase().includes(query))
  );
  renderCompanies(filtered);
});

// Visit Form - Main form for all actions
function showVisitForm() {
  currentLocation = null;
  visitPhotos = [];
  orderItems = {};
  
  document.getElementById('locationDisplay').classList.remove('active');
  document.getElementById('visitComment').value = '';
  document.getElementById('noteText').value = '';
  document.getElementById('photoInput').value = '';
  document.getElementById('photoPreview').innerHTML = '';
  document.getElementById('orderComment').value = '';
  
  // Reset order
  updateOrderTotal();
  
  showScreen('visitFormScreen');
  
  // Load products for order
  loadProductsForOrder();
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

// Photo handling
document.getElementById('photoInput')?.addEventListener('change', (e) => {
  const files = e.target.files;
  const preview = document.getElementById('photoPreview');
  
  Array.from(files).forEach(file => {
    visitPhotos.push(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = document.createElement('img');
      img.src = e.target.result;
      preview.appendChild(img);
    };
    reader.readAsDataURL(file);
  });
});

// Products for order
async function loadProductsForOrder() {
  try {
    const response = await fetch('/api/products');
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
    const qty = orderItems[product.id || product.ID] || 0;
    const price = parseFloat(product.price || product.PRICE || 0);
    
    return `
      <div class="product-item">
        <div class="product-info">
          <div class="product-name">${escapeHtml(product.name || product.NAME)}</div>
          <div class="product-price">${price.toFixed(2)} ₽</div>
        </div>
        <div class="quantity-control">
          <button type="button" class="qty-btn" onclick="updateQty(${product.id || product.ID}, -1, ${price})">−</button>
          <span class="qty-value" id="qty-${product.id || product.ID}">${qty}</span>
          <button type="button" class="qty-btn" onclick="updateQty(${product.id || product.ID}, 1, ${price})">+</button>
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
    const product = products.find(p => (p.id || p.ID) == productId);
    if (product) {
      total += qty * parseFloat(product.price || product.PRICE || 0);
    }
  });
  document.getElementById('orderTotal').textContent = total.toFixed(2);
}

// Submit visit form - creates ONE activity with all data
document.getElementById('visitForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = new FormData();
  formData.append('companyId', currentCompany.id || currentCompany.ID);
  formData.append('subject', 'Визит торгового представителя');
  formData.append('description', document.getElementById('visitComment').value);
  formData.append('noteText', document.getElementById('noteText').value);
  
  // Add location
  if (currentLocation) {
    formData.append('location', JSON.stringify(currentLocation));
  }
  
  // Add order data
  if (Object.keys(orderItems).length > 0) {
    const items = Object.entries(orderItems).map(([productId, qty]) => {
      const product = products.find(p => (p.id || p.ID) == productId);
      return {
        name: product.name || product.NAME,
        quantity: qty,
        price: parseFloat(product.price || product.PRICE || 0)
      };
    });
    const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    formData.append('orderData', JSON.stringify({ items, total }));
  }
  
  // Add photos
  visitPhotos.forEach(file => {
    formData.append('photos', file);
  });
  
  try {
    const response = await fetch('/api/activities', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    if (data.result) {
      showSuccess('Визит сохранен!', 'Все данные сохранены в одно дело с отметкой "Выполнено"');
    } else {
      showToast('Ошибка сохранения');
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
  document.getElementById('companySearch')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') e.preventDefault();
  });
}

// Service Worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}
