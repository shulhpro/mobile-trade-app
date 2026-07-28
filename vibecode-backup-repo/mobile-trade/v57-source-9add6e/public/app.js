// Mobile Trade App - Frontend Logic
let currentCompany = null;
let companies = [];
let products = [];
let orderItems = {};
let currentLocation = null;
let visitPhotos = [];
let currentTask = null;
let userContext = null;
let selectedProjectId = null;
let sections = [];
let currentSectionId = null;
let isSubmitting = false;

// Clear cache and reload
async function clearCacheAndReload() {
  if ('caches' in window) {
    try {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => caches.delete(name)));
      console.log('Cache cleared');
    } catch (e) {
      console.error('Error clearing cache:', e);
    }
  }
  
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('Service workers unregistered');
    } catch (e) {
      console.error('Error unregistering SW:', e);
    }
  }
  
  window.location.reload(true);
}

// Initialize app
function initApp() {
  loadUserContext();
  loadCompanies();
  setupEventListeners();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Setup event listeners
function setupEventListeners() {
  document.getElementById('companySearch').addEventListener('input', filterCompanies);
  document.getElementById('photoInput').addEventListener('change', handlePhotoSelect);
}

// Screen navigation
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(screenId).classList.add('active');
}

// Load user context
async function loadUserContext() {
  try {
    const response = await fetch('/api/user-context');
    const data = await response.json();
    userContext = data;
    
    if (data.user) {
      const user = data.user;
      document.getElementById('userInfo').textContent = 
        (user.name || '') + ' ' + (user.lastName || '').trim() || user.email || 'Пользователь';
    }
    
    if (data.workgroups && data.workgroups.length > 0) {
      const container = document.getElementById('projectSelectorContainer');
      const select = document.getElementById('projectSelect');
      container.style.display = 'block';
      
      data.workgroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.name;
        select.appendChild(option);
      });
      
      select.addEventListener('change', (e) => {
        selectedProjectId = e.target.value;
        console.log('Selected project:', selectedProjectId);
      });
    }
  } catch (error) {
    console.error('Error loading user context:', error);
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
      '<div class="error">Ошибка загрузки компаний</div>';
  }
}

// Render companies list
function renderCompanies(companiesList) {
  const container = document.getElementById('companiesList');
  
  if (companiesList.length === 0) {
    container.innerHTML = '<div class="empty">Компании не найдены</div>';
    return;
  }
  
  container.innerHTML = companiesList.map(company => `
    <div class="company-card" onclick="selectCompany(${company.id})">
      <div class="company-name">${company.title || 'Без названия'}</div>
      <div class="company-info">
        ${company.address ? `<span>📍 ${company.address}</span>` : ''}
        ${company.phone ? `<span>📞 ${company.phone}</span>` : ''}
      </div>
    </div>
  `).join('');
}

// Filter companies
function filterCompanies() {
  const search = document.getElementById('companySearch').value.toLowerCase();
  const filtered = companies.filter(company => 
    (company.title || '').toLowerCase().includes(search)
  );
  renderCompanies(filtered);
}

// Select company
async function selectCompany(companyId) {
  currentCompany = companies.find(c => c.id === companyId);
  if (!currentCompany) return;
  
  document.getElementById('companyDetail').innerHTML = `
    <h2>${currentCompany.title || 'Без названия'}</h2>
    <div class="company-detail-info">
      <div class="detail-row">
        <span class="detail-label">📍 Адрес:</span>
        <span class="detail-value">${currentCompany.address || 'Адрес не указан'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">📞 Телефон:</span>
        <span class="detail-value">${currentCompany.phone || 'Не указан'}</span>
      </div>
      <div class="detail-row">
        <span class="detail-label">✉️ Email:</span>
        <span class="detail-value">${currentCompany.email || 'Не указан'}</span>
      </div>
    </div>
  `;
  
  showScreen('companyDetailScreen');
}

// Start visit
async function startVisit() {
  if (!currentCompany) return;
  
  document.getElementById('visitCompanyName').textContent = currentCompany.title || 'Без названия';
  
  // Reset form
  currentLocation = null;
  visitPhotos = [];
  orderItems = {};
  document.getElementById('gpsResult').innerHTML = '';
  document.getElementById('photoPreview').innerHTML = '';
  document.getElementById('noteText').value = '';
  document.getElementById('orderSummary').innerHTML = '';
  
  showScreen('visitScreen');
}

// Get GPS
function getGPS() {
  if (!navigator.geolocation) {
    document.getElementById('gpsResult').innerHTML = '<span class="error">Геолокация не поддерживается</span>';
    return;
  }
  
  document.getElementById('gpsResult').innerHTML = '<span class="loading">Определение местоположения...</span>';
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      currentLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      };
      document.getElementById('gpsResult').innerHTML = `
        <span class="success">✓ Определено</span><br>
        Широта: ${currentLocation.latitude.toFixed(6)}<br>
        Долгота: ${currentLocation.longitude.toFixed(6)}<br>
        Точность: ${Math.round(currentLocation.accuracy)} м
      `;
    },
    (error) => {
      document.getElementById('gpsResult').innerHTML = `<span class="error">Ошибка: ${error.message}</span>`;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Handle photo select
function handlePhotoSelect(event) {
  const files = Array.from(event.target.files);
  const preview = document.getElementById('photoPreview');
  
  files.forEach(file => {
    if (visitPhotos.length >= 10) {
      alert('Максимум 10 фотографий');
      return;
    }
    
    visitPhotos.push(file);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.className = 'photo-item';
      div.innerHTML = `
        <img src="${e.target.result}" alt="Photo">
        <button class="btn-remove-photo" onclick="removePhoto(${visitPhotos.length - 1})">✕</button>
      `;
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
  
  event.target.value = '';
}

// Remove photo
function removePhoto(index) {
  visitPhotos.splice(index, 1);
  const preview = document.getElementById('photoPreview');
  preview.innerHTML = '';
  
  visitPhotos.forEach((file, idx) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const div = document.createElement('div');
      div.className = 'photo-item';
      div.innerHTML = `
        <img src="${e.target.result}" alt="Photo">
        <button class="btn-remove-photo" onclick="removePhoto(${idx})">✕</button>
      `;
      preview.appendChild(div);
    };
    reader.readAsDataURL(file);
  });
}

// Show order modal
async function showOrderModal() {
  document.getElementById('orderModal').style.display = 'flex';
  document.getElementById('sectionsList').style.display = 'grid';
  document.getElementById('productsList').style.display = 'none';
  document.querySelector('.btn-back-sections').style.display = 'none';
  
  try {
    const response = await fetch('/api/sections');
    const data = await response.json();
    sections = data.result || [];
    renderSections();
  } catch (error) {
    console.error('Error loading sections:', error);
  }
  
  renderOrderItems();
}

// Close order modal
function closeOrderModal() {
  document.getElementById('orderModal').style.display = 'none';
}

// Render sections
function renderSections() {
  const container = document.getElementById('sectionsList');
  
  if (sections.length === 0) {
    container.innerHTML = '<div class="empty">Разделы не найдены</div>';
    return;
  }
  
  container.innerHTML = sections.map(section => `
    <div class="section-card" onclick="selectSection(${section.id})">
      <span class="section-icon">📁</span>
      <span class="section-name">${section.name || 'Без названия'}</span>
    </div>
  `).join('');
}

// Select section
async function selectSection(sectionId) {
  currentSectionId = sectionId;
  
  document.getElementById('sectionsList').style.display = 'none';
  document.getElementById('productsList').style.display = 'grid';
  document.querySelector('.btn-back-sections').style.display = 'inline-block';
  
  try {
    const response = await fetch('/api/products?sectionId=' + sectionId);
    const data = await response.json();
    products = data.result || [];
    renderProducts();
  } catch (error) {
    console.error('Error loading products:', error);
  }
}

// Show sections
function showSections() {
  document.getElementById('sectionsList').style.display = 'grid';
  document.getElementById('productsList').style.display = 'none';
  document.querySelector('.btn-back-sections').style.display = 'none';
}

// Render products
function renderProducts() {
  const container = document.getElementById('productsList');
  
  if (products.length === 0) {
    container.innerHTML = '<div class="empty">Товары не найдены</div>';
    return;
  }
  
  container.innerHTML = products.map(product => {
    const currentQty = orderItems[product.id] ? orderItems[product.id].quantity : 0;
    return `
      <div class="product-card">
        <div class="product-name">${product.name || 'Без названия'}</div>
        <div class="product-price">${product.price ? product.price + ' ₽' : 'Цена не указана'}</div>
        <div class="product-quantity">
          <button class="btn-qty" onclick="updateQuantity(${product.id}, -1)">−</button>
          <span class="qty-value">${currentQty}</span>
          <button class="btn-qty" onclick="updateQuantity(${product.id}, 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

// Update quantity
function updateQuantity(productId, delta) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  if (!orderItems[productId]) {
    orderItems[productId] = {
      id: productId,
      name: product.name,
      price: product.price || 0,
      quantity: 0
    };
  }
  
  orderItems[productId].quantity += delta;
  
  if (orderItems[productId].quantity <= 0) {
    delete orderItems[productId];
  }
  
  renderProducts();
  renderOrderItems();
}

// Render order items
function renderOrderItems() {
  const container = document.getElementById('orderItems');
  const items = Object.values(orderItems);
  
  if (items.length === 0) {
    container.innerHTML = '<div class="empty-order">Товары не выбраны</div>';
    return;
  }
  
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  container.innerHTML = `
    <div class="order-items-list">
      ${items.map(item => `
        <div class="order-item">
          <span class="item-name">${item.name}</span>
          <span class="item-qty">${item.quantity} шт.</span>
          <span class="item-price">${(item.price * item.quantity).toFixed(2)} ₽</span>
        </div>
      `).join('')}
    </div>
    <div class="order-total">
      <strong>Итого: ${total.toFixed(2)} ₽</strong>
    </div>
  `;
}

// Confirm order
function confirmOrder() {
  const items = Object.values(orderItems);
  
  if (items.length === 0) {
    document.getElementById('orderSummary').innerHTML = '';
    closeOrderModal();
    return;
  }
  
  const total = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  document.getElementById('orderSummary').innerHTML = `
    <div class="order-summary-content">
      <h4>📦 Заказ</h4>
      <div class="order-summary-items">
        ${items.map(item => `
          <div class="summary-item">
            <span>${item.name}</span>
            <span>${item.quantity} шт. × ${item.price} ₽</span>
          </div>
        `).join('')}
      </div>
      <div class="order-summary-total">
        <strong>Итого: ${total.toFixed(2)} ₽</strong>
      </div>
    </div>
  `;
  
  closeOrderModal();
}

// Show loading
function showLoading(text = 'Сохранение...') {
  document.getElementById('loadingOverlay').style.display = 'flex';
  document.querySelector('.loading-text').textContent = text;
  isSubmitting = true;
}

// Hide loading
function hideLoading() {
  document.getElementById('loadingOverlay').style.display = 'none';
  isSubmitting = false;
}

// Save visit
async function saveVisit() {
  if (isSubmitting) return;
  
  const noteText = document.getElementById('noteText').value.trim();
  const hasPhotos = visitPhotos.length > 0;
  const hasOrder = Object.keys(orderItems).length > 0;
  const hasLocation = currentLocation !== null;
  
  if (!noteText && !hasPhotos && !hasOrder && !hasLocation) {
    alert('Добавьте хотя бы одно действие (GPS, фото, заметку или заказ)');
    return;
  }
  
  showLoading('Сохранение визита...');
  
  try {
    const formData = new FormData();
    formData.append('companyId', currentCompany.id);
    formData.append('type', 'visit');
    formData.append('subject', 'Визит к ' + (currentCompany.title || 'Клиент'));
    
    if (noteText) {
      formData.append('noteText', noteText);
    }
    
    if (currentLocation) {
      formData.append('location', JSON.stringify(currentLocation));
    }
    
    if (hasOrder) {
      const orderData = {
        items: Object.values(orderItems),
        total: Object.values(orderItems).reduce((sum, item) => sum + (item.price * item.quantity), 0)
      };
      formData.append('orderData', JSON.stringify(orderData));
    }
    
    if (selectedProjectId) {
      formData.append('groupId', selectedProjectId);
    }
    
    visitPhotos.forEach(photo => {
      formData.append('photos', photo);
    });
    
    const response = await fetch('/api/visit', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('Визит сохранен!');
      
      // Reset form
      currentLocation = null;
      visitPhotos = [];
      orderItems = {};
      document.getElementById('gpsResult').innerHTML = '';
      document.getElementById('photoPreview').innerHTML = '';
      document.getElementById('noteText').value = '';
      document.getElementById('orderSummary').innerHTML = '';
    } else {
      alert('Ошибка: ' + (result.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Error saving visit:', error);
    alert('Ошибка сохранения: ' + error.message);
  } finally {
    hideLoading();
  }
}

// Close visit
async function closeVisit() {
  if (isSubmitting) return;
  
  if (!confirm('Завершить визит? Задача будет закрыта.')) {
    return;
  }
  
  showLoading('Завершение визита...');
  
  try {
    const formData = new FormData();
    formData.append('companyId', currentCompany.id);
    formData.append('type', 'visit');
    formData.append('subject', 'Визит к ' + (currentCompany.title || 'Клиент'));
    formData.append('closeVisit', 'true');
    
    const noteText = document.getElementById('noteText').value.trim();
    if (noteText) {
      formData.append('noteText', noteText);
    }
    
    if (currentLocation) {
      formData.append('location', JSON.stringify(currentLocation));
    }
    
    if (Object.keys(orderItems).length > 0) {
      const orderData = {
        items: Object.values(orderItems),
        total: Object.values(orderItems).reduce((sum, item) => sum + (item.price * item.quantity), 0)
      };
      formData.append('orderData', JSON.stringify(orderData));
    }
    
    if (selectedProjectId) {
      formData.append('groupId', selectedProjectId);
    }
    
    visitPhotos.forEach(photo => {
      formData.append('photos', photo);
    });
    
    const response = await fetch('/api/visit', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success) {
      alert('Визит завершен!');
      showScreen('companyScreen');
    } else {
      alert('Ошибка: ' + (result.error || 'Неизвестная ошибка'));
    }
  } catch (error) {
    console.error('Error closing visit:', error);
    alert('Ошибка завершения: ' + error.message);
  } finally {
    hideLoading();
  }
}
