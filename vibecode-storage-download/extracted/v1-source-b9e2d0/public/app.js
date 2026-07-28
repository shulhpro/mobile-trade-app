// Mobile Trade App v45
// Application State
const state = {
  user: null,
  token: null,
  companies: [],
  sections: [],
  products: [],
  currentCompany: null,
  currentTask: null,
  visitData: {
    location: null,
    photos: [],
    notes: '',
    order: []
  },
  projects: [],
  department: null,
  isSaving: false
};

// DOM Elements
const screens = {
  loading: document.getElementById('loadingScreen'),
  client: document.getElementById('clientScreen'),
  visit: document.getElementById('visitScreen'),
  products: document.getElementById('productsScreen'),
  dashboard: document.getElementById('dashboardScreen')
};

// Initialize App
    const urlParams = new URLSearchParams(window.location.search);
    state.token = urlParams.get('token') || localStorage.getItem('vibecode_token');
    
    if (!state.token) {
      showNotification('Требуется авторизация', 'error');
      return;
    }
    
    localStorage.setItem('vibecode_token', state.token);
    
    // Load user data
    await loadUserData();
    
    // Load companies
    await loadCompanies();
    
    // Show client selection screen
    showScreen('client');
  } catch (error) {
    console.error('Init error:', error);
    showNotification('Ошибка загрузки: ' + error.message, 'error');
  }
});

// API Helper
async function apiCall(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${state.token}`,
      ...options.headers
    }
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }
  
  return response.json();
}

// Load User Data
async function loadUserData() {
  try {
    const userData = await apiCall('/api/user');
    state.user = userData;
    
    // Update user info display
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
      userInfoEl.textContent = `${userData.name || userData.login} | ${userData.department?.[0]?.name || 'Отдел не указан'}`;
    }
    
    // Load department info
    const deptData = await apiCall('/api/department');
    state.department = deptData;
    
    // Load projects
    const projects = await apiCall('/api/projects');
    state.projects = projects || [];
  } catch (error) {
    console.error('Error loading user data:', error);
  }
}

// Load Companies
async function loadCompanies() {
  try {
    const companies = await apiCall('/api/companies');
    state.companies = companies || [];
    renderCompanies(state.companies);
  } catch (error) {
    console.error('Error loading companies:', error);
    showNotification('Ошибка загрузки компаний', 'error');
  }
}

// Render Companies List
function renderCompanies(companies) {
  const listEl = document.getElementById('companiesList');
  if (!listEl) return;
  
  if (companies.length === 0) {
    listEl.innerHTML = '<p class="empty-state">Нет доступных компаний</p>';
    return;
  }
  
  listEl.innerHTML = companies.map(company => `
    <div class="company-card" data-id="${company.id}">
      <div class="company-name">${company.title || company.name || 'Без названия'}</div>
      <div class="company-address">${company.address || company.addressCity || 'Адрес не указан'}</div>
    </div>
  `).join('');
  
  // Add click handlers
  listEl.querySelectorAll('.company-card').forEach(card => {
    card.addEventListener('click', () => selectCompany(card.dataset.id));
  });
}

// Select Company
async function selectCompany(companyId) {
  const company = state.companies.find(c => c.id == companyId);
  if (!company) return;
  
  state.currentCompany = company;
  
  // Reset visit data
  state.visitData = {
    location: null,
    photos: [],
    notes: '',
    order: []
  };
  
  // Update visit screen title
  const visitTitle = document.getElementById('visitTitle');
  if (visitTitle) {
    visitTitle.textContent = `Визит к ${company.title || company.name}`;
  }
  
  // Clear form
  document.getElementById('locationDisplay').innerHTML = '';
  document.getElementById('photosPreview').innerHTML = '';
  document.getElementById('notesInput').value = '';
  document.getElementById('orderDisplay').innerHTML = '';
  
  // Show visit screen
  showScreen('visit');
  
  // Create or get existing task for this visit
  await createOrGetTask(company);
}

// Create or Get Task
async function createOrGetTask(company) {
  try {
    // Check for existing open task
    const tasks = await apiCall('/api/tasks');
    const existingTask = tasks.find(t => 
      t.title === `Визит к ${company.title || company.name}` && 
      t.status !== '5' && t.status !== 'completed'
    );
    
    if (existingTask) {
      state.currentTask = existingTask;
      // Load existing data
      if (existingTask.description) {
        parseExistingData(existingTask.description);
      }
    } else {
      // Create new task
      const taskData = {
        title: `Визит к ${company.title || company.name}`,
        description: `Визит к клиенту: ${company.title || company.name}\nАдрес: ${company.address || company.addressCity || 'Не указан'}`,
        responsibleId: state.user.id,
        ufCrmTask: { company: company.id }
      };
      
      // Add to project if available
      if (state.projects.length > 0) {
        taskData.groupId = state.projects[0].id;
      }
      
      // Add department head as auditor
      if (state.department?.head?.id) {
        taskData.auditors = [state.department.head.id];
      }
      
      const newTask = await apiCall('/api/tasks', {
        method: 'POST',
        body: JSON.stringify(taskData)
      });
      
      state.currentTask = newTask;
    }
  } catch (error) {
    console.error('Error creating/getting task:', error);
    showNotification('Ошибка создания задачи', 'error');
  }
}

// Parse Existing Data from Task Description
function parseExistingData(description) {
  // Parse location
  const locationMatch = description.match(/📍 Координаты: ([\d.,]+)/);
  if (locationMatch) {
    state.visitData.location = locationMatch[1];
    document.getElementById('locationDisplay').innerHTML = `📍 ${state.visitData.location}`;
  }
  
  // Parse notes
  const notesMatch = description.match(/📝 Заметки:\n([\s\S]*?)(?=\n📦|$)/);
  if (notesMatch) {
    state.visitData.notes = notesMatch[1].trim();
    document.getElementById('notesInput').value = state.visitData.notes;
  }
}

// Show Screen
function showScreen(screenName) {
  Object.values(screens).forEach(screen => {
    if (screen) screen.classList.remove('active');
  });
  if (screens[screenName]) {
    screens[screenName].classList.add('active');
  }
}

// Get Location
document.getElementById('getLocationBtn')?.addEventListener('click', async () => {
  const btn = document.getElementById('getLocationBtn');
  btn.disabled = true;
  btn.textContent = 'Определение...';
  
  try {
    const position = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      });
    });
    
    const { latitude, longitude } = position.coords;
    state.visitData.location = `${latitude}, ${longitude}`;
    
    document.getElementById('locationDisplay').innerHTML = `
      📍 Широта: ${latitude.toFixed(6)}<br>
      📍 Долгота: ${longitude.toFixed(6)}
    `;
    
    showNotification('Координаты определены', 'success');
  } catch (error) {
    showNotification('Ошибка определения местоположения: ' + error.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Определить координаты';
  }
});

// Add Photo
document.getElementById('addPhotoBtn')?.addEventListener('click', () => {
  document.getElementById('photoInput')?.click();
});

document.getElementById('photoInput')?.addEventListener('change', (e) => {
  const files = Array.from(e.target.files);
  
  if (state.visitData.photos.length + files.length > 10) {
    showNotification('Максимум 10 фотографий', 'error');
    return;
  }
  
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (event) => {
      state.visitData.photos.push({
        name: file.name,
        data: event.target.result
      });
      renderPhotos();
    };
    reader.readAsDataURL(file);
  });
});

// Render Photos
function renderPhotos() {
  const container = document.getElementById('photosPreview');
  if (!container) return;
  
  container.innerHTML = state.visitData.photos.map((photo, index) => `
    <div class="photo-item">
      <img src="${photo.data}" alt="Фото ${index + 1}">
      <button class="photo-remove" data-index="${index}">×</button>
    </div>
  `).join('');
  
  container.querySelectorAll('.photo-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      state.visitData.photos.splice(index, 1);
      renderPhotos();
    });
  });
}

// Add Order
document.getElementById('addOrderBtn')?.addEventListener('click', async () => {
  await loadProductSections();
  showScreen('products');
});

// Load Product Sections
async function loadProductSections() {
  try {
    const sections = await apiCall('/api/catalog/sections');
    state.sections = sections || [];
    renderSections();
  } catch (error) {
    console.error('Error loading sections:', error);
    showNotification('Ошибка загрузки разделов', 'error');
  }
}

// Render Sections
function renderSections() {
  const container = document.getElementById('sectionsList');
  if (!container) return;
  
  document.getElementById('sectionsView').classList.remove('hidden');
  document.getElementById('productsView').classList.add('hidden');
  
  if (state.sections.length === 0) {
    container.innerHTML = '<p>Нет доступных разделов</p>';
    return;
  }
  
  container.innerHTML = state.sections.map(section => `
    <div class="section-card" data-id="${section.id}">
      <div class="section-icon">📁</div>
      <div class="section-name">${section.name || section.title || 'Без названия'}</div>
    </div>
  `).join('');
  
  container.querySelectorAll('.section-card').forEach(card => {
    card.addEventListener('click', () => loadProducts(card.dataset.id));
  });
}

// Load Products by Section
async function loadProducts(sectionId) {
  try {
    const products = await apiCall(`/api/catalog/products?sectionId=${sectionId}`);
    state.products = products || [];
    renderProducts(sectionId);
  } catch (error) {
    console.error('Error loading products:', error);
    showNotification('Ошибка загрузки товаров', 'error');
  }
}

// Render Products
function renderProducts(sectionId) {
  const container = document.getElementById('productsList');
  if (!container) return;
  
  document.getElementById('sectionsView').classList.add('hidden');
  document.getElementById('productsView').classList.remove('hidden');
  
  const section = state.sections.find(s => s.id == sectionId);
  document.getElementById('sectionTitle').textContent = section?.name || 'Товары';
  
  if (state.products.length === 0) {
    container.innerHTML = '<p>Нет товаров в этом разделе</p>';
    return;
  }
  
  container.innerHTML = state.products.map(product => {
    const existingItem = state.visitData.order.find(item => item.id === product.id);
    const quantity = existingItem ? existingItem.quantity : 0;
    
    return `
      <div class="product-card" data-id="${product.id}">
        <div class="product-name">${product.name || product.title || 'Без названия'}</div>
        <div class="product-price">${product.price || 0} ₽</div>
        <div class="product-quantity">
          <button class="quantity-btn" data-action="decrease" data-id="${product.id}">−</button>
          <span>${quantity}</span>
          <button class="quantity-btn" data-action="increase" data-id="${product.id}">+</button>
        </div>
      </div>
    `;
  }).join('');
  
  container.querySelectorAll('.quantity-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const productId = e.target.dataset.id;
      const action = e.target.dataset.action;
      updateOrderQuantity(productId, action);
    });
  });
  
  updateOrderTotal();
}

// Update Order Quantity
function updateOrderQuantity(productId, action) {
  const product = state.products.find(p => p.id == productId);
  if (!product) return;
  
  const existingItem = state.visitData.order.find(item => item.id === productId);
  
  if (action === 'increase') {
    if (existingItem) {
      existingItem.quantity++;
    } else {
      state.visitData.order.push({
        id: productId,
        name: product.name || product.title,
        article: product.article || product.xmlId || '',
        price: parseFloat(product.price) || 0,
        quantity: 1
      });
    }
  } else if (action === 'decrease') {
    if (existingItem) {
      existingItem.quantity--;
      if (existingItem.quantity <= 0) {
        state.visitData.order = state.visitData.order.filter(item => item.id !== productId);
      }
    }
  }
  
  renderProducts(document.querySelector('.product-card')?.closest('#productsView')?.dataset?.sectionId);
  updateOrderTotal();
}

// Update Order Total
function updateOrderTotal() {
  const total = state.visitData.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('orderTotal').textContent = `${total.toLocaleString('ru-RU')} ₽`;
}

// Confirm Order
document.getElementById('confirmOrderBtn')?.addEventListener('click', () => {
  renderOrderDisplay();
  showScreen('visit');
  showNotification('Заказ добавлен', 'success');
});

// Render Order Display
function renderOrderDisplay() {
  const container = document.getElementById('orderDisplay');
  if (!container) return;
  
  if (state.visitData.order.length === 0) {
    container.innerHTML = '<p class="empty-state">Заказ пуст</p>';
    return;
  }
  
  const total = state.visitData.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  
  container.innerHTML = `
    <div class="order-items">
      ${state.visitData.order.map(item => `
        <div class="order-item">
          <div class="order-item-info">
            <div class="order-item-name">${item.name}</div>
            <div class="order-item-details">${item.quantity} × ${item.price} ₽ = ${(item.quantity * item.price).toLocaleString('ru-RU')} ₽</div>
          </div>
        </div>
      `).join('')}
    </div>
    <div class="order-total" style="margin-top: 12px; font-weight: 700; font-size: 1.1rem;">
      Итого: ${total.toLocaleString('ru-RU')} ₽
    </div>
  `;
}

// Back Buttons
document.getElementById('backToClients')?.addEventListener('click', () => {
  showScreen('client');
});

document.getElementById('backToVisit')?.addEventListener('click', () => {
  showScreen('visit');
});

document.getElementById('backToSections')?.addEventListener('click', () => {
  renderSections();
});

document.getElementById('backFromDashboard')?.addEventListener('click', () => {
  showScreen('client');
});

// Save Visit
document.getElementById('saveVisitBtn')?.addEventListener('click', async () => {
  if (state.isSaving) return;
  await saveVisit(false);
});

// Complete Visit
document.getElementById('completeVisitBtn')?.addEventListener('click', async () => {
  if (state.isSaving) return;
  await saveVisit(true);
});

// Save Visit Function
async function saveVisit(complete = false) {
  if (!state.currentTask) {
    showNotification('Задача не создана', 'error');
    return;
  }
  
  state.isSaving = true;
  showLoadingModal(complete ? 'Завершение визита...' : 'Сохранение...');
  
  try {
    // Get notes
    state.visitData.notes = document.getElementById('notesInput')?.value || '';
    
    // Build description
    let description = `Визит к клиенту: ${state.currentCompany.title || state.currentCompany.name}\n`;
    description += `Адрес: ${state.currentCompany.address || state.currentCompany.addressCity || 'Не указан'}\n\n`;
    
    if (state.visitData.location) {
      description += `📍 Координаты: ${state.visitData.location}\n\n`;
    }
    
    if (state.visitData.notes) {
      description += `📝 Заметки:\n${state.visitData.notes}\n\n`;
    }
    
    // Upload photos
    const photoAttachments = [];
    if (state.visitData.photos.length > 0) {
      for (const photo of state.visitData.photos) {
        try {
          const uploadResult = await apiCall('/api/upload', {
            method: 'POST',
            body: JSON.stringify({
              fileName: `photo_${Date.now()}_${photo.name}`,
              fileContent: photo.data
            })
          });
          if (uploadResult.id) {
            photoAttachments.push(uploadResult.id);
          }
        } catch (error) {
          console.error('Error uploading photo:', error);
        }
      }
    }
    
    // Add order to description
    if (state.visitData.order.length > 0) {
      description += `📦 ЗАКАЗ:\n`;
      description += `Артикул | Наименование | Кол-во | Цена | Сумма\n`;
      description += `-------------------------------------------\n`;
      
      let orderTotal = 0;
      state.visitData.order.forEach(item => {
        const sum = item.quantity * item.price;
        orderTotal += sum;
        description += `${item.article || '-'} | ${item.name} | ${item.quantity} | ${item.price} ₽ | ${sum.toLocaleString('ru-RU')} ₽\n`;
      });
      
      description += `\n💰 Итого: ${orderTotal.toLocaleString('ru-RU')} ₽\n`;
    }
    
    // Update task
    const updateData = {
      description: description
    };
    
    if (photoAttachments.length > 0) {
      updateData.ufTaskWebdavFiles = photoAttachments;
    }
    
    if (complete) {
      updateData.status = '5'; // Completed
      updateData.mark = 'P'; // Positive
    }
    
    await apiCall(`/api/tasks/${state.currentTask.id}`, {
      method: 'PATCH',
      body: JSON.stringify(updateData)
    });
    
    // Create subtask for order if exists
    if (state.visitData.order.length > 0) {
      await createOrderSubtask(description);
    }
    
    hideLoadingModal();
    showNotification(complete ? 'Визит завершен!' : 'Данные сохранены!', 'success');
    
    if (complete) {
      // Reset and go back to clients
      state.currentTask = null;
      state.currentCompany = null;
      state.visitData = { location: null, photos: [], notes: '', order: [] };
      showScreen('client');
    }
  } catch (error) {
    console.error('Error saving visit:', error);
    hideLoadingModal();
    showNotification('Ошибка сохранения: ' + error.message, 'error');
  } finally {
    state.isSaving = false;
  }
}

// Create Order Subtask
async function createOrderSubtask(mainDescription) {
  try {
    const orderTotal = state.visitData.order.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Generate Excel file
    const excelResult = await apiCall('/api/generate-excel', {
      method: 'POST',
      body: JSON.stringify({
        clientName: state.currentCompany.title || state.currentCompany.name,
        items: state.visitData.order,
        total: orderTotal
      })
    });
    
    // Upload Excel to disk
    let excelFileId = null;
    if (excelResult.base64) {
      const uploadResult = await apiCall('/api/upload', {
        method: 'POST',
        body: JSON.stringify({
          fileName: excelResult.fileName,
          fileContent: excelResult.base64
        })
      });
      excelFileId = uploadResult.id;
    }
    
    // Create subtask
    const subtaskData = {
      title: `Заказ (${state.currentCompany.title || state.currentCompany.name})`,
      description: mainDescription,
      responsibleId: state.currentTask.responsibleId || state.user.id,
      parentId: state.currentTask.id,
      groupId: state.currentTask.groupId
    };
    
    if (excelFileId) {
      subtaskData.ufTaskWebdavFiles = [excelFileId];
    }
    
    if (state.currentTask.auditors) {
      subtaskData.auditors = state.currentTask.auditors;
    }
    
    await apiCall('/api/tasks', {
      method: 'POST',
      body: JSON.stringify(subtaskData)
    });
  } catch (error) {
    console.error('Error creating order subtask:', error);
  }
}

// Dashboard
document.getElementById('dashboardBtn')?.addEventListener('click', async () => {
  showScreen('dashboard');
  await loadDashboardData();
});

// Load Dashboard Data
async function loadDashboardData() {
  try {
    const from = document.getElementById('dateFrom')?.value;
    const to = document.getElementById('dateTo')?.value;
    
    let url = '/api/dashboard';
    if (from || to) {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      url += `?${params.toString()}`;
    }
    
    const data = await apiCall(url);
    
    // Update stats
    document.getElementById('statVisits').textContent = data.totalVisits;
    document.getElementById('statOrders').textContent = data.totalOrders;
    document.getElementById('statRevenue').textContent = `${data.totalRevenue.toLocaleString('ru-RU')} ₽`;
    
    // Render employee table
    const employeeTable = document.getElementById('employeeTable');
    const employees = Object.values(data.byEmployee);
    
    if (employees.length === 0) {
      employeeTable.innerHTML = '<p>Нет данных</p>';
    } else {
      employeeTable.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Визиты</th>
              <th>Заказы</th>
              <th>Сумма</th>
              <th>Клиенты</th>
            </tr>
          </thead>
          <tbody>
            ${employees.map(emp => `
              <tr>
                <td>${emp.name}</td>
                <td>${emp.visits}</td>
                <td>${emp.orders}</td>
                <td>${emp.revenue.toLocaleString('ru-RU')} ₽</td>
                <td>${emp.clients.join(', ')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    
    // Render client table
    const clientTable = document.getElementById('clientTable');
    const clients = Object.entries(data.byClient);
    
    if (clients.length === 0) {
      clientTable.innerHTML = '<p>Нет данных</p>';
    } else {
      clientTable.innerHTML = `
        <table>
          <thead>
            <tr>
              <th>Клиент</th>
              <th>Визиты</th>
              <th>Заказы</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            ${clients.map(([name, data]) => `
              <tr>
                <td>${name}</td>
                <td>${data.visits}</td>
                <td>${data.orders}</td>
                <td>${data.revenue.toLocaleString('ru-RU')} ₽</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
  } catch (error) {
    console.error('Error loading dashboard:', error);
    showNotification('Ошибка загрузки аналитики', 'error');
  }
}

// Apply Dashboard Filter
document.getElementById('applyFilterBtn')?.addEventListener('click', async () => {
  await loadDashboardData();
});

// Refresh Button
document.getElementById('refreshBtn')?.addEventListener('click', () => {
  // Clear cache and reload
  if ('caches' in window) {
    caches.keys().then(names => {
      names.forEach(name => caches.delete(name));
    });
  }
  
  // Unregister service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      registrations.forEach(reg => reg.unregister());
    });
  }
  
  // Reload page
  window.location.reload(true);
});

// Search Companies
document.getElementById('clientSearch')?.addEventListener('input', (e) => {
  const query = e.target.value.toLowerCase();
  const filtered = state.companies.filter(company => 
    (company.title || company.name || '').toLowerCase().includes(query)
  );
  renderCompanies(filtered);
});

// Show Loading Modal
function showLoadingModal(text = 'Загрузка...') {
  const modal = document.getElementById('loadingModal');
  const textEl = document.getElementById('loadingText');
  if (modal) {
    modal.classList.remove('hidden');
    if (textEl) textEl.textContent = text;
  }
}

// Hide Loading Modal
function hideLoadingModal() {
  const modal = document.getElementById('loadingModal');
  if (modal) modal.classList.add('hidden');
}

// Show Notification
function showNotification(message, type = 'info') {
  const notification = document.getElementById('notification');
  if (!notification) return;
  
  notification.textContent = message;
  notification.className = `notification ${type}`;
  notification.classList.remove('hidden');
  
  setTimeout(() => {
    notification.classList.add('hidden');
  }, 3000);
}

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered:', registration);
      })
      .catch(error => {
        console.log('SW registration failed:', error);
      });
  });
}
