class MobileTradeApp {
  constructor() {
    this.currentUser = null;
    this.currentCompany = null;
    this.currentTask = null;
    this.photos = [];
    this.gpsCoords = null;
    this.orderItems = [];
    this.sections = [];
    this.products = [];
    this.manager = null;
    this.projects = [];
    this.isSaving = false;
    this.companies = [];
    this.apiBase = '';
    this.init();
  }

  async init() {
    this.bindEvents();
    try {
      await this.loadUserData();
      await this.loadCompanies();
      this.showScreen('clientScreen');
    } catch (error) {
      console.error('Init error:', error);
      this.showToast('Ошибка загрузки данных', 'error');
    }
  }

  bindEvents() {
    document.getElementById('dashboardBtn').addEventListener('click', () => this.openDashboard());
    document.getElementById('refreshBtn').addEventListener('click', () => this.refreshApp());
    document.getElementById('clientSearch').addEventListener('input', (e) => this.filterClients(e.target.value));
    document.getElementById('backToClients').addEventListener('click', () => this.showScreen('clientScreen'));
    document.getElementById('getGpsBtn').addEventListener('click', () => this.getGPS());
    document.getElementById('addPhotoBtn').addEventListener('click', () => document.getElementById('photoInput').click());
    document.getElementById('photoInput').addEventListener('change', (e) => this.handlePhotos(e));
    document.getElementById('addOrderBtn').addEventListener('click', () => this.openProducts());
    document.getElementById('saveVisitBtn').addEventListener('click', () => this.saveVisit(false));
    document.getElementById('completeVisitBtn').addEventListener('click', () => this.saveVisit(true));
    document.getElementById('backToVisit').addEventListener('click', () => this.showScreen('visitScreen'));
    document.getElementById('backToSections').addEventListener('click', () => this.showSections());
    document.getElementById('confirmOrderBtn').addEventListener('click', () => this.confirmOrder());
    document.getElementById('backFromDashboard').addEventListener('click', () => this.showScreen('clientScreen'));
    document.getElementById('applyFilterBtn').addEventListener('click', () => this.loadDashboard());
  }

  async apiCall(endpoint, options = {}) {
    const url = this.apiBase + endpoint;
    const config = { 
      headers: { 'Content-Type': 'application/json' },
      ...options 
    };
    
    if (options.body && typeof options.body === 'object') {
      config.body = JSON.stringify(options.body);
    }
    
    const response = await fetch(url, config);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'HTTP ' + response.status);
    }
    
    return response.json();
  }

  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    window.scrollTo(0, 0);
  }

  async loadUserData() {
    const userData = await this.apiCall('/api/user');
    this.currentUser = userData.result;
    
    const deptData = await this.apiCall('/api/department');
    this.manager = deptData.manager;
    
    const projectsData = await this.apiCall('/api/projects');
    this.projects = projectsData.result || [];
  }

  async loadCompanies() {
    const data = await this.apiCall('/api/companies');
    this.companies = data.result || [];
    this.renderCompanies(this.companies);
  }

  renderCompanies(companies) {
    const container = document.getElementById('clientsList');
    if (companies.length === 0) { 
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🏢</div><p>Компании не найдены</p></div>'; 
      return; 
    }
    container.innerHTML = companies.map(company => '<div class="client-card" data-id="' + company.ID + '" onclick="app.selectCompany(' + "'" + company.ID + "'" + ')"><div class="client-name">' + this.escapeHtml(company.TITLE) + '</div><div class="client-address">' + this.escapeHtml(company.ADDRESS || 'Адрес не указан') + '</div></div>').join('');
  }

  filterClients(search) {
    const filtered = this.companies.filter(c => c.TITLE.toLowerCase().includes(search.toLowerCase()));
    this.renderCompanies(filtered);
  }

  selectCompany(companyId) {
    this.currentCompany = this.companies.find(c => c.ID === companyId);
    if (!this.currentCompany) return;
    document.getElementById('visitClientName').textContent = 'Визит к ' + this.currentCompany.TITLE;
    this.resetVisitForm();
    this.getGPS();
    this.showScreen('visitScreen');
  }

  resetVisitForm() {
    this.currentTask = null; this.photos = []; this.orderItems = []; this.gpsCoords = null;
    document.getElementById('gpsCoords').textContent = 'Определение...';
    document.getElementById('photosPreview').innerHTML = '';
    document.getElementById('photoCount').textContent = '0';
    document.getElementById('visitNotes').value = '';
    document.getElementById('orderItemsCount').textContent = '0';
    document.getElementById('orderTotal').textContent = '0';
  }

  getGPS() {
    if (!navigator.geolocation) { 
      document.getElementById('gpsCoords').textContent = 'GPS не поддерживается'; 
      return; 
    }
    document.getElementById('gpsCoords').textContent = 'Определение...';
    navigator.geolocation.getCurrentPosition(
      (position) => { 
        this.gpsCoords = { lat: position.coords.latitude, lng: position.coords.longitude }; 
        document.getElementById('gpsCoords').textContent = this.gpsCoords.lat.toFixed(6) + ', ' + this.gpsCoords.lng.toFixed(6); 
      },
      (error) => { 
        document.getElementById('gpsCoords').textContent = 'Не удалось определить'; 
        console.error('GPS error:', error); 
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  handlePhotos(event) {
    const files = Array.from(event.target.files);
    const remainingSlots = 10 - this.photos.length;
    const toAdd = files.slice(0, remainingSlots);
    toAdd.forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => { 
        this.photos.push({ name: file.name, data: e.target.result, file: file }); 
        this.renderPhotos(); 
      };
      reader.readAsDataURL(file);
    });
    if (files.length > remainingSlots) this.showToast('Максимум 10 фото. Добавлено ' + toAdd.length, 'warning');
    event.target.value = '';
  }

  renderPhotos() {
    const container = document.getElementById('photosPreview');
    document.getElementById('photoCount').textContent = this.photos.length;
    container.innerHTML = this.photos.map((photo, index) => '<div class="photo-item"><img src="' + photo.data + '" alt="Photo ' + (index + 1) + '"><button class="photo-remove" onclick="app.removePhoto(' + index + ')">×</button></div>').join('');
  }

  removePhoto(index) { 
    this.photos.splice(index, 1); 
    this.renderPhotos(); 
  }

  async openProducts() { 
    this.showScreen('productsScreen'); 
    await this.loadSections(); 
  }

  async loadSections() {
    try { 
      const data = await this.apiCall('/api/catalog/sections'); 
      this.sections = data.result?.sections || []; 
      this.renderSections(); 
    }
    catch (error) { 
      console.error('Error loading sections:', error); 
      this.showToast('Ошибка загрузки разделов', 'error'); 
    }
  }

  renderSections() {
    document.getElementById('sectionsView').style.display = 'block';
    document.getElementById('productsView').style.display = 'none';
    const container = document.getElementById('sectionsList');
    if (this.sections.length === 0) { 
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📁</div><p>Разделы не найдены</p></div>'; 
      return; 
    }
    container.innerHTML = this.sections.map(section => '<div class="section-card" onclick="app.selectSection(' + "'" + section.id + "'" + ')"><span class="section-icon">📁</span><span class="section-name">' + this.escapeHtml(section.name) + '</span><span>→</span></div>').join('');
  }

  async selectSection(sectionId) {
    try {
      const data = await this.apiCall('/api/catalog/products?sectionId=' + sectionId);
      this.products = data.result?.products || [];
      const section = this.sections.find(s => s.id === sectionId);
      document.getElementById('currentSectionName').textContent = section ? section.name : 'Товары';
      document.getElementById('sectionsView').style.display = 'none';
      document.getElementById('productsView').style.display = 'block';
      this.renderProducts();
    } catch (error) { 
      console.error('Error loading products:', error); 
      this.showToast('Ошибка загрузки товаров', 'error'); 
    }
  }

  showSections() { 
    document.getElementById('sectionsView').style.display = 'block'; 
    document.getElementById('productsView').style.display = 'none'; 
  }

  renderProducts() {
    const container = document.getElementById('productsList');
    if (this.products.length === 0) { 
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📦</div><p>Товары не найдены</p></div>'; 
      return; 
    }
    container.innerHTML = this.products.map(product => {
      const cartItem = this.orderItems.find(item => item.id === product.id);
      const quantity = cartItem ? cartItem.quantity : 0;
      return '<div class="product-card"><div class="product-info"><div class="product-name">' + this.escapeHtml(product.name) + '</div><div class="product-price">' + product.price + ' ' + product.currency + '</div></div><div class="product-controls"><button class="qty-btn" onclick="app.updateQuantity(' + "'" + product.id + "'" + ', -1)">−</button><span class="qty-value">' + quantity + '</span><button class="qty-btn" onclick="app.updateQuantity(' + "'" + product.id + "'" + ', 1)">+</button></div></div>';
    }).join('');
    this.renderCart();
  }

  updateQuantity(productId, delta) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;
    const existingItem = this.orderItems.find(item => item.id === productId);
    if (existingItem) {
      existingItem.quantity += delta;
      if (existingItem.quantity <= 0) { 
        this.orderItems = this.orderItems.filter(item => item.id !== productId); 
      }
      else { 
        existingItem.total = existingItem.quantity * existingItem.price; 
      }
    } else if (delta > 0) { 
      this.orderItems.push({ id: product.id, name: product.name, article: product.xmlId || '', price: parseFloat(product.price), quantity: 1, total: parseFloat(product.price) }); 
    }
    this.renderProducts();
  }

  renderCart() {
    const container = document.getElementById('cartItems');
    const total = this.orderItems.reduce((sum, item) => sum + item.total, 0);
    document.getElementById('cartTotal').textContent = total.toLocaleString('ru-RU');
    if (this.orderItems.length === 0) { 
      container.innerHTML = '<p style="text-align:center;color:#666">Корзина пуста</p>'; 
      return; 
    }
    container.innerHTML = this.orderItems.map(item => '<div class="cart-item"><span>' + this.escapeHtml(item.name) + '</span><span>' + item.quantity + ' x ' + item.price + ' = ' + item.total.toLocaleString('ru-RU') + ' ₽</span></div>').join('');
  }

  confirmOrder() {
    this.showScreen('visitScreen');
    document.getElementById('orderItemsCount').textContent = this.orderItems.length;
    const total = this.orderItems.reduce((sum, item) => sum + item.total, 0);
    document.getElementById('orderTotal').textContent = total.toLocaleString('ru-RU');
  }

  async saveVisit(complete = false) {
    if (this.isSaving) return;
    this.isSaving = true;
    const loadingText = complete ? 'Завершение визита...' : 'Сохранение...';
    this.showLoading(loadingText);
    try {
      const uploadedFiles = [];
      for (const photo of this.photos) {
        try { 
          const fileData = await this.uploadFile(photo.file, photo.name); 
          if (fileData.result?.ID) uploadedFiles.push(fileData.result.ID); 
        }
        catch (error) { 
          console.error('Error uploading photo:', error); 
        }
      }
      let description = this.buildDescription();
      const projectId = this.projects.length > 0 ? this.projects[0].ID : 0;
      const auditors = this.manager ? [this.manager.ID] : [];
      const taskData = { 
        taskId: this.currentTask, 
        title: 'Визит к ' + this.currentCompany.TITLE, 
        description: description, 
        companyId: this.currentCompany.ID, 
        responsibleId: this.currentUser.ID, 
        projectId: projectId, 
        auditors: auditors, 
        files: uploadedFiles 
      };
      const taskResponse = await this.apiCall('/api/tasks', { method: 'POST', body: taskData });
      const taskId = taskResponse.result?.task?.id || this.currentTask;
      this.currentTask = taskId;
      if (this.orderItems.length > 0) await this.createOrderSubtask(taskId, projectId, auditors);
      if (complete) await this.apiCall('/api/tasks/close', { method: 'POST', body: { taskId: taskId } });
      this.hideLoading();
      this.showToast(complete ? 'Визит завершён!' : 'Сохранено!', 'success');
      if (complete) setTimeout(() => { this.showScreen('clientScreen'); this.resetVisitForm(); }, 1500);
    } catch (error) {
      console.error('Error saving visit:', error);
      this.hideLoading();
      this.showToast('Ошибка сохранения', 'error');
    } finally { 
      this.isSaving = false; 
    }
  }

  buildDescription() {
    const parts = [];
    const now = new Date().toLocaleString('ru-RU');
    if (this.gpsCoords) parts.push('📍 Координаты: ' + this.gpsCoords.lat.toFixed(6) + ', ' + this.gpsCoords.lng.toFixed(6));
    const notes = document.getElementById('visitNotes').value.trim();
    if (notes) parts.push('📝 Заметки:' + String.fromCharCode(10) + notes);
    if (this.orderItems.length > 0) {
      parts.push('📦 ЗАКАЗ:');
      parts.push('Артикул | Наименование | Кол-во | Цена | Сумма');
      parts.push('—'.repeat(50));
      let total = 0;
      this.orderItems.forEach(item => { 
        parts.push((item.article || '-') + ' | ' + item.name + ' | ' + item.quantity + ' | ' + item.price + ' ₽ | ' + item.total + ' ₽'); 
        total += item.total; 
      });
      parts.push('—'.repeat(50));
      parts.push('💰 Итого: ' + total.toLocaleString('ru-RU') + ' ₽');
    }
    parts.push(String.fromCharCode(10) + '⏰ Обновлено: ' + now);
    return parts.join(String.fromCharCode(10) + String.fromCharCode(10));
  }

  async createOrderSubtask(parentId, projectId, auditors) {
    try {
      const total = this.orderItems.reduce((sum, item) => sum + item.total, 0);
      const clientName = this.currentCompany.TITLE;
      let description = '📦 ЗАКАЗ для ' + clientName + String.fromCharCode(10) + String.fromCharCode(10);
      description += 'Артикул | Наименование | Кол-во | Цена | Сумма' + String.fromCharCode(10);
      description += '—'.repeat(50) + String.fromCharCode(10);
      this.orderItems.forEach(item => { 
        description += (item.article || '-') + ' | ' + item.name + ' | ' + item.quantity + ' | ' + item.price + ' ₽ | ' + item.total + ' ₽' + String.fromCharCode(10); 
      });
      description += '—'.repeat(50) + String.fromCharCode(10);
      description += '💰 Итого: ' + total.toLocaleString('ru-RU') + ' ₽' + String.fromCharCode(10) + String.fromCharCode(10);
      description += '⏰ ' + new Date().toLocaleString('ru-RU');
      const excelData = await this.apiCall('/api/excel/order', { 
        method: 'POST', 
        body: { 
          clientName: clientName, 
          date: new Date().toLocaleDateString('ru-RU'), 
          items: this.orderItems, 
          total: total 
        } 
      });
      const excelBlob = this.base64ToBlob(excelData.fileData, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      const excelFile = new File([excelBlob], excelData.fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const uploadedExcel = await this.uploadFile(excelFile, excelData.fileName);
      const excelFileId = uploadedExcel.result?.ID;
      const subtaskData = { 
        parentId: parentId, 
        title: 'Заказ (' + clientName + ')', 
        description: description, 
        responsibleId: this.currentUser.ID, 
        projectId: projectId, 
        auditors: auditors 
      };
      if (excelFileId) subtaskData.files = [excelFileId];
      await this.apiCall('/api/tasks/subtask', { method: 'POST', body: subtaskData });
    } catch (error) { 
      console.error('Error creating order subtask:', error); 
    }
  }

  async uploadFile(file, fileName) {
    const formData = new FormData();
    formData.append('file', file, fileName);
    const response = await fetch(this.apiBase + '/api/upload', { 
      method: 'POST', 
      body: formData 
    });
    if (!response.ok) throw new Error('Upload failed');
    return response.json();
  }

  base64ToBlob(base64, type) {
    const binary = atob(base64);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
    return new Blob([array], { type: type });
  }

  async openDashboard() {
    this.showScreen('dashboardScreen');
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    document.getElementById('dateFrom').value = firstDay.toISOString().split('T')[0];
    document.getElementById('dateTo').value = now.toISOString().split('T')[0];
    await this.loadDashboard();
  }

  async loadDashboard() {
    try {
      const dateFrom = document.getElementById('dateFrom').value;
      const dateTo = document.getElementById('dateTo').value;
      let url = '/api/dashboard';
      if (dateFrom || dateTo) { 
        const params = new URLSearchParams(); 
        if (dateFrom) params.append('dateFrom', dateFrom); 
        if (dateTo) params.append('dateTo', dateTo); 
        url += '?' + params.toString(); 
      }
      const data = await this.apiCall(url);
      document.getElementById('totalVisits').textContent = data.summary.totalVisits;
      document.getElementById('totalOrders').textContent = data.summary.totalOrders;
      document.getElementById('totalAmount').textContent = data.summary.totalAmount.toLocaleString('ru-RU') + ' ₽';
      const employeeIds = Object.keys(data.byEmployee);
      let userNames = {};
      if (employeeIds.length > 0) { 
        const usersData = await this.apiCall('/api/users?ids=' + employeeIds.join(',')); 
        (usersData.result || []).forEach(user => { 
          userNames[user.ID] = user.NAME + ' ' + user.LAST_NAME; 
        }); 
      }
      const employeeTable = document.getElementById('employeeTable');
      const employeeRows = Object.entries(data.byEmployee).map(([id, stats]) => '<tr><td>' + this.escapeHtml(userNames[id] || 'ID: ' + id) + '</td><td>' + stats.visits + '</td><td>' + stats.orders + '</td><td>' + stats.total.toLocaleString('ru-RU') + ' ₽</td><td>' + stats.clients.map(c => this.escapeHtml(c)).join(', ') + '</td></tr>').join('');
      employeeTable.innerHTML = '<table><thead><tr><th>Сотрудник</th><th>Визиты</th><th>Заказы</th><th>Сумма</th><th>Клиенты</th></tr></thead><tbody>' + employeeRows + '</tbody></table>';
      const clientTable = document.getElementById('clientTable');
      const clientRows = Object.entries(data.byClient).map(([name, stats]) => '<tr><td>' + this.escapeHtml(name) + '</td><td>' + stats.visits + '</td><td>' + stats.orders + '</td><td>' + stats.total.toLocaleString('ru-RU') + ' ₽</td></tr>').join('');
      clientTable.innerHTML = '<table><thead><tr><th>Клиент</th><th>Визиты</th><th>Заказы</th><th>Сумма</th></tr></thead><tbody>' + clientRows + '</tbody></table>';
    } catch (error) { 
      console.error('Error loading dashboard:', error); 
      this.showToast('Ошибка загрузки аналитики', 'error'); 
    }
  }

  refreshApp() {
    if ('caches' in window) caches.keys().then(names => names.forEach(name => caches.delete(name)));
    if ('serviceWorker' in navigator) navigator.serviceWorker.getRegistrations().then(registrations => registrations.forEach(reg => reg.unregister()));
    window.location.reload(true);
  }

  showLoading(text) { 
    document.getElementById('loadingText').textContent = text; 
    document.getElementById('loadingModal').classList.add('active'); 
  }
  hideLoading() { 
    document.getElementById('loadingModal').classList.remove('active'); 
  }

  showToast(message, type) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = 'toast ' + type + ' show';
    setTimeout(() => toast.classList.remove('show'), 3000);
  }

  escapeHtml(text) { 
    if (!text) return ''; 
    const div = document.createElement('div'); 
    div.textContent = text; 
    return div.innerHTML; 
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => { 
    navigator.serviceWorker.register('/sw.js').then(reg => console.log('SW registered')).catch(err => console.log('SW error:', err)); 
  });
}

const app = new MobileTradeApp();
