// Field Visit App - Main JavaScript
let currentVisit = {
  companyId: null,
  companyName: null,
  gps: null,
  photos: [],
  notes: '',
  products: []
};

let selectedCompany = null;
let catalogData = {
  sections: [],
  products: [],
  selectedProducts: []
};

// Initialize app
  initApp();
});

async function initApp() {
  // Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/sw.js');
      console.log('Service Worker registered');
    } catch (err) {
      console.log('SW registration failed');
    }
  }
  
  // Load user info
  loadUserInfo();
  
  // Load companies
  loadCompanies();
  
  // Setup event listeners
  setupEventListeners();
}

// User Info
async function loadUserInfo() {
  try {
    const response = await fetch('/api/user');
    const user = await response.json();
    document.querySelector('.user-name').textContent = user.name;
  } catch (err) {
    console.error('Failed to load user:', err);
  }
}

// Companies
async function loadCompanies(search = '') {
  try {
    const url = search ? `/api/companies?search=${encodeURIComponent(search)}` : '/api/companies';
    const response = await fetch(url);
    const companies = await response.json();
    renderCompanies(companies);
  } catch (err) {
    console.error('Failed to load companies:', err);
  }
}

function renderCompanies(companies) {
  const container = document.getElementById('companiesList');
  container.innerHTML = companies.map(company => `
    <div class="company-item" onclick="showCompanyCard(${company.id})">
      <h3>${company.name}</h3>
      <p>📍 ${company.address}</p>
    </div>
  `).join('');
}

async function showCompanyCard(companyId) {
  try {
    const response = await fetch(`/api/companies/${companyId}`);
    const company = await response.json();
    selectedCompany = company;
    
    document.getElementById('selectedCompanyName').textContent = company.name;
    document.getElementById('selectedCompanyAddress').textContent = company.address;
    document.getElementById('selectedCompanyPhone').textContent = company.phone;
    
    document.getElementById('companyCard').classList.remove('hidden');
  } catch (err) {
    console.error('Failed to load company:', err);
  }
}

function closeCompanyCard() {
  document.getElementById('companyCard').classList.add('hidden');
  selectedCompany = null;
}

function selectCompany() {
  if (selectedCompany) {
    currentVisit.companyId = selectedCompany.id;
    currentVisit.companyName = selectedCompany.name;
    
    // Switch to visit step
    showStep('visit');
    
    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.step === 'visit');
    });
  }
}

// GPS
function getGPS() {
  const statusEl = document.getElementById('gpsStatus');
  const coordsEl = document.getElementById('gpsCoords');
  
  if (!navigator.geolocation) {
    statusEl.innerHTML = '<p class="error">❌ Геолокация не поддерживается</p>';
    return;
  }
  
  statusEl.innerHTML = '<p>⏳ Определение местоположения...</p>';
  
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const coords = {
        lat: position.coords.latitude.toFixed(6),
        lng: position.coords.longitude.toFixed(6),
        accuracy: Math.round(position.coords.accuracy)
      };
      
      currentVisit.gps = coords;
      
      statusEl.innerHTML = '<p class="success">✓ Координаты определены</p>';
      coordsEl.innerHTML = `
        <p>Широта: ${coords.lat}</p>
        <p>Долгота: ${coords.lng}</p>
        <p>Точность: ±${coords.accuracy}м</p>
      `;
      coordsEl.classList.remove('hidden');
    },
    (error) => {
      let message = '❌ Не удалось определить местоположение';
      switch(error.code) {
        case error.PERMISSION_DENIED:
          message = '❌ Доступ к геолокации запрещен';
          break;
        case error.POSITION_UNAVAILABLE:
          message = '❌ Информация о местоположении недоступна';
          break;
        case error.TIMEOUT:
          message = '❌ Превышено время ожидания';
          break;
      }
      statusEl.innerHTML = `<p class="error">${message}</p>
        <button class="btn-secondary" onclick="getGPS()">Повторить</button>`;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

// Photos
function setupEventListeners() {
  // Company search
  document.getElementById('companySearch').addEventListener('input', (e) => {
    loadCompanies(e.target.value);
  });
  
  // Photo input
  document.getElementById('photoInput').addEventListener('change', handlePhotoSelect);
  
  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      const step = item.dataset.step;
      showStep(step);
      document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
    });
  });
}

function handlePhotoSelect(e) {
  const files = Array.from(e.target.files);
  const remainingSlots = 10 - currentVisit.photos.length;
  
  if (files.length > remainingSlots) {
    alert(`Можно добавить не более 10 фотографий. Осталось: ${remainingSlots}`);
    files.splice(remainingSlots);
  }
  
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => {
      currentVisit.photos.push({
        id: Date.now() + Math.random(),
        data: event.target.result,
        timestamp: new Date().toISOString()
      });
      updatePhotosPreview();
    };
    reader.readAsDataURL(file);
  });
  
  e.target.value = '';
}

function updatePhotosPreview() {
  const container = document.getElementById('photosPreview');
  document.getElementById('photoCount').textContent = currentVisit.photos.length;
  
  container.innerHTML = currentVisit.photos.map((photo, index) => `
    <div class="photo-item">
      <img src="${photo.data}" alt="Photo ${index + 1}">
      <button class="photo-remove" onclick="removePhoto(${index})">✕</button>
    </div>
  `).join('');
}

function removePhoto(index) {
  currentVisit.photos.splice(index, 1);
  updatePhotosPreview();
}

// Catalog
async function showCatalog() {
  document.getElementById('catalogModal').classList.remove('hidden');
  
  // Load sections if not loaded
  if (catalogData.sections.length === 0) {
    try {
      const response = await fetch('/api/catalog/sections');
      catalogData.sections = await response.json();
    } catch (err) {
      console.error('Failed to load sections:', err);
    }
  }
  
  renderSections();
}

function renderSections() {
  document.getElementById('catalogSections').classList.remove('hidden');
  document.getElementById('catalogProducts').classList.add('hidden');
  
  const container = document.getElementById('catalogSections');
  container.innerHTML = catalogData.sections.map(section => `
    <div class="section-item" onclick="showProducts(${section.id})">
      <div class="section-icon">${section.icon}</div>
      <div class="section-name">${section.name}</div>
    </div>
  `).join('');
}

async function showProducts(sectionId) {
  try {
    const response = await fetch(`/api/catalog/products?section=${sectionId}`);
    const products = await response.json();
    catalogData.products = products;
    
    document.getElementById('catalogSections').classList.add('hidden');
    document.getElementById('catalogProducts').classList.remove('hidden');
    
    const container = document.getElementById('productsList');
    container.innerHTML = products.map(product => {
      const isSelected = catalogData.selectedProducts.find(p => p.id === product.id);
      const quantity = isSelected ? isSelected.quantity : 0;
      
      return `
        <div class="product-item ${isSelected ? 'selected' : ''}" onclick="toggleProduct(${product.id})">
          <div class="product-info">
            <h4>${product.name}</h4>
            <p>${product.price.toLocaleString()} ₽ / ${product.unit}</p>
          </div>
          <div class="product-price">
            ${isSelected ? `<span>✓ ${quantity}</span>` : '<span>+</span>'}
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    console.error('Failed to load products:', err);
  }
}

function backToSections() {
  renderSections();
}

function toggleProduct(productId) {
  const existingIndex = catalogData.selectedProducts.findIndex(p => p.id === productId);
  const product = catalogData.products.find(p => p.id === productId);
  
  if (existingIndex >= 0) {
    catalogData.selectedProducts[existingIndex].quantity++;
  } else {
    catalogData.selectedProducts.push({
      ...product,
      quantity: 1
    });
  }
  
  showProducts(product.sectionId);
}

function addSelectedProducts() {
  currentVisit.products = [...catalogData.selectedProducts];
  renderSelectedProducts();
  closeCatalog();
}

function renderSelectedProducts() {
  const container = document.getElementById('selectedProducts');
  
  if (currentVisit.products.length === 0) {
    container.innerHTML = '<p class="empty">Товары не выбраны</p>';
    return;
  }
  
  container.innerHTML = currentVisit.products.map((product, index) => `
    <div class="selected-product">
      <div class="product-info">
        <h4>${product.name}</h4>
        <p>${product.price.toLocaleString()} ₽ × ${product.quantity} ${product.unit}</p>
      </div>
      <div class="product-quantity">
        <button class="qty-btn" onclick="updateQuantity(${index}, -1)">−</button>
        <span>${product.quantity}</span>
        <button class="qty-btn" onclick="updateQuantity(${index}, 1)">+</button>
      </div>
    </div>
  `).join('');
}

function updateQuantity(index, delta) {
  currentVisit.products[index].quantity += delta;
  if (currentVisit.products[index].quantity <= 0) {
    currentVisit.products.splice(index, 1);
  }
  renderSelectedProducts();
}

function closeCatalog() {
  document.getElementById('catalogModal').classList.add('hidden');
}

// Save & Complete
async function saveVisit() {
  currentVisit.notes = document.getElementById('visitNotes').value;
  
  try {
    const response = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentVisit)
    });
    
    const result = await response.json();
    
    if (result.status === 'created') {
      currentVisit.id = result.id;
      showSuccess('Визит сохранен. Можете продолжить заполнение или завершить.');
    }
  } catch (err) {
    console.error('Failed to save visit:', err);
    alert('Ошибка сохранения. Попробуйте еще раз.');
  }
}

async function completeVisit() {
  currentVisit.notes = document.getElementById('visitNotes').value;
  
  if (!currentVisit.id) {
    // Save first
    await saveVisit();
  }
  
  if (currentVisit.id) {
    try {
      const response = await fetch(`/api/visits/${currentVisit.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const result = await response.json();
      
      if (result.status === 'completed') {
        showSuccess('Визит завершен! Все данные сохранены.');
      }
    } catch (err) {
      console.error('Failed to complete visit:', err);
      alert('Ошибка завершения визита.');
    }
  }
}

function showSuccess(message) {
  document.getElementById('successText').textContent = message;
  document.getElementById('successMessage').classList.remove('hidden');
}

function startNewVisit() {
  // Reset visit data
  currentVisit = {
    companyId: null,
    companyName: null,
    gps: null,
    photos: [],
    notes: '',
    products: []
  };
  
  catalogData.selectedProducts = [];
  selectedCompany = null;
  
  // Reset UI
  document.getElementById('visitNotes').value = '';
  document.getElementById('gpsStatus').innerHTML = '<button class="btn-secondary" onclick="getGPS()">Определить местоположение</button>';
  document.getElementById('gpsCoords').classList.add('hidden');
  updatePhotosPreview();
  renderSelectedProducts();
  
  document.getElementById('successMessage').classList.add('hidden');
  
  // Go to company step
  showStep('company');
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.step === 'company');
  });
  
  // Reload companies
  loadCompanies();
}

// Navigation
function showStep(stepName) {
  document.querySelectorAll('.step').forEach(step => {
    step.classList.remove('active');
  });
  document.getElementById(`step-${stepName}`).classList.add('active');
}

// Close modal on outside click
  if (e.target.id === 'catalogModal') {
    closeCatalog();
  }
});
