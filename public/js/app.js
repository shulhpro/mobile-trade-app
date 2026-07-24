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

// Clear cache and reload app
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
  
  // Unregister service worker
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => reg.unregister()));
      console.log('Service workers unregistered');
    } catch (e) {
      console.error('Error unregistering SW:', e);
    }
  }
  
  // Force reload with cache bypass
  window.location.reload(true);
}

// Initialize immediately if DOM is ready
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

// Load user context (info + workgroups + department head)
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
    
    // Handle project selection
    if (data.workgroups && data.workgroups.length > 0) {
      if (data.workgroups.length === 1) {
        // Auto-select if only one project
        selectedProjectId = data.workgroups[0].id;
        console.log('Auto-selected project:', data.workgroups[0].name);
      } else {
        // Show project selector
        renderProjectSelector(data.workgroups);
      }
    }
  } catch (error) {
    console.error('Error loading user context:', error);
  }
}

// Render project selector
function renderProjectSelector(workgroups) {
  const container = document.getElementById('projectSelectorContainer');
  const select = document.getElementById('projectSelect');
  
  if (!container || !select) {
    console.error('Project selector elements not found');
    return;
  }
  
  // Clear and populate select
  select.innerHTML = '<option value="">-- Выберите проект --</option>';
  workgroups.forEach(g => {
    const option = document.createElement('option');
    option.value = g.id;
    option.textContent = g.name;
    select.appendChild(option);
  });
  
  // Add change handler
  select.onchange = function() {
    selectedProjectId = this.value ? parseInt(this.value) : null;
    console.log('Selected project:', selectedProjectId);
  };
  
  // Show container
  container.style.display = 'block';
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
    let address = company.address || company.ADDRESS || 'Адрес не указан';
    if (address.includes('|')) address = address.split('|')[0].trim();
    const phone = company.phone || (company.fm && company.fm.find(f => f.typeId === 'PHONE')?.value) || '';
    
    return '<div class="company-item" onclick="selectCompany(' + (company.id || company.ID) + ')">' +
      '<h3>' + escapeHtml(company.title || company.TITLE) + '</h3>' +
      '<div class="company-address">' + escapeHtml(address) + '</div>' +
      (phone ? '<div class="company-phone">' + escapeHtml(phone) + '</div>' : '') +
      '</div>';
  }).join('');
}

// Select company
async function selectCompany(companyId) {
  currentCompany = companies.find(c => (c.id || c.ID) == companyId);
  if (!currentCompany) return;
  
  // Check for existing task
  try {
    const response = await fetch('/api/tasks/' + (currentCompany.id || currentCompany.ID));
    const data = await response.json();
    currentTask = data.task;
  } catch (error) {
    console.error('Error checking task:', error);
    currentTask = null;
  }
  
  const card = document.getElementById('companyCard');
  let address = currentCompany.address || currentCompany.ADDRESS || 'Адрес не указан';
  if (address.includes('|')) address = address.split('|')[0].trim();
  const phone = currentCompany.phone || (currentCompany.fm && currentCompany.fm.find(f => f.typeId === 'PHONE')?.value) || 'Не указан';
  const email = currentCompany.email || (currentCompany.fm && currentCompany.fm.find(f => f.typeId === 'EMAIL')?.value) || 'Не указан';
  
  let taskInfo = '';
  if (currentTask) {
    taskInfo = '<div class="task-info" style="margin-top: 10px; padding: 10px; background: #e3f2fd; border-radius: 8px;">' +
      '<div style="font-weight: 600; color: #1976d2;">📝 Есть открытая задача</div>' +
      '<div style="font-size: 12px; color: #666; margin-top: 4px;">Новые данные будут добавлены в существующую задачу</div>' +
      '</div>';
  }
  
  card.innerHTML = '<h2>' + escapeHtml(currentCompany.title || currentCompany.TITLE) + '</h2>' +
    '<div class="detail-row"><span class="detail-label">Адрес:</span><span>' + escapeHtml(address) + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">Телефон:</span><span>' + escapeHtml(phone) + '</span></div>' +
    '<div class="detail-row"><span class="detail-label">✉️ Email:</span><span>' + escapeHtml(email) + '</span></div>' +
    taskInfo;
  
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
function setupEventListeners() {
  const searchInput = document.getElementById('companySearch');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase();
      const filtered = companies.filter(c => 
        (c.title || c.TITLE || '').toLowerCase().includes(query) ||
        ((c.address || c.ADDRESS) && (c.address || c.ADDRESS).toLowerCase().includes(query))
      );
      renderCompanies(filtered);
    });
    
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') e.preventDefault();
    });
  }
}

// Visit Form
function showVisitForm() {
  currentLocation = null;
  visitPhotos = [];
  orderItems = {};
  
  document.getElementById('locationDisplay').classList.remove('active');
  document.getElementById('visitComment').value = '';
  document.getElementById('noteText').value = '';
  document.getElementById('photoInput').value = '';
  document.getElementById('photoPreview').innerHTML = '';
  
  updateOrderTotal();
  
  showScreen('visitFormScreen');
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
      display.innerHTML = '✅ Местоположение определено<br>Широта: ' + currentLocation.latitude.toFixed(6) + '<br>Долгота: ' + currentLocation.longitude.toFixed(6);
      display.classList.add('active');
      btn.textContent = 'Обновить местоположение';
    },
    (error) => {
      showToast('Ошибка определения местоположения');
      btn.textContent = 'Определить местоположение';
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// Photo handling
document.addEventListener('DOMContentLoaded', () => {
  const photoInput = document.getElementById('photoInput');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
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
  }
});

// Sections and Products for order
async function loadProductsForOrder() {
  // Load sections first
  await loadSections();
}

async function loadSections() {
  try {
    const response = await fetch('/api/sections');
    const data = await response.json();
    sections = data.result || [];
    renderSections();
  } catch (error) {
    console.error('Error loading sections:', error);
    document.getElementById('sectionsList').innerHTML = 
      '<div class="loading">Ошибка загрузки разделов</div>';
  }
}

function renderSections() {
  const container = document.getElementById('sectionsList');
  
  if (sections.length === 0) {
    container.innerHTML = '<div class="loading">Разделы не найдены</div>';
    return;
  }
  
  container.innerHTML = sections.map(section => {
    return '<div class="section-item" onclick="loadProductsBySection(' + section.id + ')">' +
      '<div class="section-icon">📁</div>' +
      '<div class="section-name">' + escapeHtml(section.name) + '</div>' +
      '<div class="section-arrow">→</div>' +
      '</div>';
  }).join('');
  
  // Show sections, hide products
  document.getElementById('sectionsList').style.display = 'block';
  document.getElementById('productsList').style.display = 'none';
}

async function loadProductsBySection(sectionId) {
  currentSectionId = sectionId;
  
  try {
    const response = await fetch('/api/products?sectionId=' + sectionId);
    const data = await response.json();
    products = data.result || [];
    renderProducts();
  } catch (error) {
    console.error('Error loading products:', error);
    document.getElementById('productsContainer').innerHTML = 
      '<div class="loading">Ошибка загрузки товаров</div>';
  }
}

function showSections() {
  currentSectionId = null;
  document.getElementById('sectionsList').style.display = 'block';
  document.getElementById('productsList').style.display = 'none';
}

function renderProducts() {
  const container = document.getElementById('productsContainer');
  
  if (products.length === 0) {
    container.innerHTML = '<div class="loading">Товары не найдены</div>';
    // Still show products view
    document.getElementById('sectionsList').style.display = 'none';
    document.getElementById('productsList').style.display = 'block';
    return;
  }
  
  container.innerHTML = products.map(product => {
    const productId = product.id || product.ID;
    const item = orderItems[productId];
    const qty = item ? item.quantity : 0;
    const price = parseFloat(product.price || product.PRICE || 0);
    
    return '<div class="product-item">' +
      '<div class="product-info">' +
      '<div class="product-name">' + escapeHtml(product.name || product.NAME) + '</div>' +
      '<div class="product-price">' + price.toFixed(2) + ' ₽</div>' +
      '</div>' +
      '<div class="quantity-control">' +
      '<button type="button" class="qty-btn" onclick="updateQty(' + productId + ', -1, ' + price + ')">−</button>' +
      '<span class="qty-value" id="qty-' + productId + '">' + qty + '</span>' +
      '<button type="button" class="qty-btn" onclick="updateQty(' + productId + ', 1, ' + price + ')">+</button>' +
      '</div>' +
      '</div>';
  }).join('');
  
  // Show products, hide sections
  document.getElementById('sectionsList').style.display = 'none';
  document.getElementById('productsList').style.display = 'block';
}

function updateQty(productId, delta, price) {
  const currentItem = orderItems[productId];
  const currentQty = currentItem ? currentItem.quantity : 0;
  const newQty = Math.max(0, currentQty + delta);
  
  // Find product name from current products list
  const product = products.find(p => (p.id || p.ID) == productId);
  const productName = product ? (product.name || product.NAME) : ('Товар ' + productId);
  const productPrice = price || parseFloat(product ? (product.price || product.PRICE || 0) : 0);
  
  if (newQty === 0) {
    delete orderItems[productId];
  } else {
    orderItems[productId] = {
      quantity: newQty,
      name: productName,
      price: productPrice
    };
  }
  
  document.getElementById('qty-' + productId).textContent = newQty;
  updateOrderTotal();
}

function updateOrderTotal() {
  let total = 0;
  Object.entries(orderItems).forEach(([productId, item]) => {
    const qty = typeof item === 'object' ? item.quantity : item;
    const price = typeof item === 'object' ? item.price : 0;
    total += qty * price;
  });
  document.getElementById('orderTotal').textContent = total.toFixed(2);
}

// Submit visit form - saves to ONE task per company
async function submitVisit(closeVisit) {
  closeVisit = closeVisit || false;
  
  // Prevent double submission
  if (isSubmitting) {
    console.log('Already submitting, please wait...');
    return;
  }
  
  isSubmitting = true;
  showLoadingOverlay(closeVisit);
  
  const formData = new FormData();
  formData.append('companyId', currentCompany.id || currentCompany.ID);
  formData.append('subject', 'Визит к ' + (currentCompany.title || currentCompany.TITLE));
  formData.append('description', document.getElementById('visitComment').value);
  formData.append('noteText', document.getElementById('noteText').value);
  formData.append('closeVisit', closeVisit ? 'true' : 'false');
  
  // Add project/group
  if (selectedProjectId) {
    formData.append('groupId', selectedProjectId);
  }
  
  // Add location
  if (currentLocation) {
    formData.append('location', JSON.stringify(currentLocation));
  }
  
  // Add order data
  if (Object.keys(orderItems).length > 0) {
    const items = Object.entries(orderItems).map(([productId, item]) => {
      const qty = typeof item === 'object' ? item.quantity : item;
      const name = typeof item === 'object' ? item.name : ('Товар ' + productId);
      const price = typeof item === 'object' ? item.price : 0;
      return {
        name: name,
        quantity: qty,
        price: price
      };
    });
    const total = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);
    formData.append('orderData', JSON.stringify({ items: items, total: total }));
  }
  
  // Add photos
  visitPhotos.forEach(file => {
    formData.append('photos', file);
  });
  
  // Log FormData entries
  for (let [key, value] of formData.entries()) {
    console.log('FormData:', key, value instanceof File ? `File(${value.name}, ${value.size})` : value);
  }
  
  try {
    const response = await fetch('/api/visit', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    if (data.success) {
      if (closeVisit) {
        showSuccess('Визит завершен!', 'Задача закрыта. Все данные сохранены.');
      } else {
        showSuccess('Данные сохранены!', 'Продолжайте визит или закройте его');
      }
    } else {
      showToast('Ошибка сохранения');
    }
  } catch (error) {
    console.error('Error:', error);
    showToast('Ошибка соединения');
  } finally {
    hideLoadingOverlay();
    isSubmitting = false;
  }
}

// Loading overlay
function showLoadingOverlay(isClosing) {
  const overlay = document.getElementById('loadingOverlay');
  const text = overlay.querySelector('.loading-text');
  text.textContent = isClosing ? 'Завершение визита...' : 'Сохранение данных...';
  overlay.style.display = 'flex';
}

function hideLoadingOverlay() {
  const overlay = document.getElementById('loadingOverlay');
  overlay.style.display = 'none';
}

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


// ===== TASKS MANAGEMENT =====
let currentTasks = [];
let currentTaskFilter = 'all';

// Load tasks from Bitrix24
async function loadTasks() {
  showScreen('tasksScreen');
  const container = document.getElementById('tasksList');
  container.innerHTML = '<div class="loading">Загрузка задач...</div>';
  
  try {
    const response = await fetch('/api/my-tasks');
    const data = await response.json();
    currentTasks = data.tasks || [];
    renderTasks();
  } catch (error) {
    console.error('Error loading tasks:', error);
    container.innerHTML = '<div class="loading">Ошибка загрузки задач</div>';
  }
}

// Render tasks list
function renderTasks() {
  const container = document.getElementById('tasksList');
  
  let filteredTasks = currentTasks;
  if (currentTaskFilter === 'open') {
    filteredTasks = currentTasks.filter(t => t.status !== '5' && t.status !== 'completed');
  } else if (currentTaskFilter === 'closed') {
    filteredTasks = currentTasks.filter(t => t.status === '5' || t.status === 'completed');
  }
  
  if (filteredTasks.length === 0) {
    container.innerHTML = '<div class="loading">Задачи не найдены</div>';
    return;
  }
  
  container.innerHTML = filteredTasks.map(task => {
    const isCompleted = task.status === '5' || task.status === 'completed';
    const statusClass = isCompleted ? 'completed' : 'open';
    const statusText = isCompleted ? 'Завершена' : 'Открыта';
    const deadline = task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : 'Без срока';
    
    return '<div class="task-item ' + statusClass + '" onclick="showTaskDetail(' + task.id + ')">' +
      '<div class="task-title">' + escapeHtml(task.title) + '</div>' +
      '<div class="task-meta">' +
        '<span class="task-status ' + statusClass + '">' + statusText + '</span>' +
        '<span>Срок: ' + deadline + '</span>' +
      '</div>' +
    '</div>';
  }).join('');
}

// Filter tasks
function filterTasks(filter) {
  currentTaskFilter = filter;
  
  // Update active button
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');
  
  renderTasks();
}

// Current task ID for comment operations
let currentTaskIdForComment = null;
let taskCommentFiles = [];

// Show task detail
function showTaskDetail(taskId) {
  const task = currentTasks.find(t => t.id == taskId);
  if (!task) return;
  
  currentTaskIdForComment = taskId;
  taskCommentFiles = [];
  
  const isCompleted = task.status === '5' || task.status === 'completed';
  const statusText = isCompleted ? 'Завершена' : 'Открыта';
  const deadline = task.deadline ? new Date(task.deadline).toLocaleDateString('ru-RU') : 'Без срока';
  const createdDate = task.createdDate ? new Date(task.createdDate).toLocaleDateString('ru-RU') : 'Неизвестно';
  
  const detailHtml = '<h2>' + escapeHtml(task.title) + '</h2>' +
    '<div class="task-detail-content">' +
      '<div class="task-detail-row">' +
        '<span class="task-detail-label">Статус</span>' +
        '<span class="task-detail-value">' + statusText + '</span>' +
      '</div>' +
      '<div class="task-detail-row">' +
        '<span class="task-detail-label">Срок выполнения</span>' +
        '<span class="task-detail-value">' + deadline + '</span>' +
      '</div>' +
      '<div class="task-detail-row">' +
        '<span class="task-detail-label">Создана</span>' +
        '<span class="task-detail-value">' + createdDate + '</span>' +
      '</div>' +
      '<div class="task-detail-row">' +
        '<span class="task-detail-label">Приоритет</span>' +
        '<span class="task-detail-value">' + (task.priority || 'Средний') + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="task-detail-content">' +
      '<div class="task-detail-label" style="margin-bottom: 8px;">Описание</div>' +
      '<div style="color: var(--text-secondary); line-height: 1.6;">' + escapeHtml(task.description || 'Нет описания') + '</div>' +
    '</div>';
  
  document.getElementById('taskDetail').innerHTML = detailHtml;
  
  // Show/hide comment section
  const commentSection = document.getElementById('taskCommentSection');
  if (isCompleted) {
    commentSection.style.display = 'none';
  } else {
    commentSection.style.display = 'block';
    // Reset form
    document.getElementById('taskCommentText').value = '';
    document.getElementById('taskFileInput').value = '';
    document.getElementById('taskFilePreview').innerHTML = '';
  }
  
  // Bottom complete button
  const bottomHtml = isCompleted 
    ? '<button class="btn-complete-task" disabled>Задача уже завершена</button>'
    : '<button class="btn-complete-task" onclick="completeTaskWithComment(' + task.id + ')">Завершить задачу</button>';
  
  document.getElementById('taskCompleteBottom').innerHTML = bottomHtml;
  
  showScreen('taskDetailScreen');
}

// Handle file selection for task comment
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('taskFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const files = e.target.files;
      const preview = document.getElementById('taskFilePreview');
      preview.innerHTML = '';
      taskCommentFiles = [];
      
      Array.from(files).forEach(file => {
        taskCommentFiles.push(file);
        const fileDiv = document.createElement('div');
        fileDiv.className = 'file-item';
        fileDiv.textContent = '📎 ' + file.name + ' (' + (file.size / 1024).toFixed(1) + ' KB)';
        preview.appendChild(fileDiv);
      });
    });
  }
});

// Add comment with files to task
async function addCommentWithFiles() {
  const taskId = currentTaskIdForComment;
  if (!taskId) return;
  
  const text = document.getElementById('taskCommentText').value.trim();
  if (!text && taskCommentFiles.length === 0) {
    showToast('Введите текст или прикрепите файл');
    return;
  }
  
  showLoadingOverlay(false);
  
  try {
    const formData = new FormData();
    formData.append('text', text);
    taskCommentFiles.forEach(file => {
      formData.append('files', file);
    });
    
    const response = await fetch('/api/tasks/' + taskId + '/comment', {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    if (data.success) {
      document.getElementById('taskCommentText').value = '';
      document.getElementById('taskFileInput').value = '';
      document.getElementById('taskFilePreview').innerHTML = '';
      taskCommentFiles = [];
      showToast('Комментарий добавлен');
    } else {
      showToast('Ошибка: ' + (data.error || 'Не удалось добавить комментарий'));
    }
  } catch (error) {
    console.error('Error adding comment:', error);
    showToast('Ошибка соединения');
  } finally {
    hideLoadingOverlay();
  }
}

// Complete task with optional comment
async function completeTaskWithComment(taskId) {
  const commentText = document.getElementById('taskCommentText').value.trim();
  
  if (!confirm('Вы уверены, что хотите завершить эту задачу?')) {
    return;
  }
  
  showLoadingOverlay(true);
  
  try {
    // Send comment first if exists
    if (commentText) {
      try {
        await fetch('/api/tasks/' + taskId + '/comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: commentText })
        });
      } catch (e) {
        console.error('Error sending comment:', e);
      }
    }
    
    // Complete task
    const response = await fetch('/api/tasks/' + taskId + '/complete', {
      method: 'POST'
    });
    
    const data = await response.json();
    if (data.success) {
      // Update task in list
      const task = currentTasks.find(t => t.id == taskId);
      if (task) {
        task.status = '5';
      }
      
      showSuccess('Задача завершена!', commentText ? 'Задача закрыта с комментарием' : 'Задача успешно закрыта');
    } else {
      showToast('Ошибка: ' + (data.error || 'Не удалось завершить задачу'));
    }
  } catch (error) {
    console.error('Error completing task:', error);
    showToast('Ошибка соединения');
  } finally {
    hideLoadingOverlay();
  }
}

// Complete task (legacy - without comment)
async function completeTask(taskId) {
  if (!confirm('Вы уверены, что хотите завершить эту задачу?')) {
    return;
  }
  
  showLoadingOverlay(true);
  
  try {
    const response = await fetch('/api/tasks/' + taskId + '/complete', {
      method: 'POST'
    });
    
    const data = await response.json();
    if (data.success) {
      // Update task in list
      const task = currentTasks.find(t => t.id == taskId);
      if (task) {
        task.status = '5';
      }
      
      showSuccess('Задача завершена!', 'Задача успешно закрыта');
    } else {
      showToast('Ошибка: ' + (data.error || 'Не удалось завершить задачу'));
    }
  } catch (error) {
    console.error('Error completing task:', error);
    showToast('Ошибка соединения');
  } finally {
    hideLoadingOverlay();
  }
}
// Service Worker for PWA
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}



