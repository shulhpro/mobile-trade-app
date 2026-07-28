// Mobile SFA App
class SFAApp {
  constructor() {
    this.apiKey = '';
    this.portalUrl = '';
    this.user = null;
    this.companies = [];
    this.products = [];
    this.currentCompany = null;
    this.cart = {};
    this.photos = [];
    this.location = null;
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadSession();
  }

  bindEvents() {
    // Auth
    document.getElementById('login-btn').addEventListener('click', () => this.login());
    document.getElementById('logout-btn').addEventListener('click', () => this.logout());
    
    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => this.navigate(e.currentTarget.dataset.section));
    });
    
    // Companies
    document.getElementById('refresh-companies').addEventListener('click', () => this.loadCompanies());
    document.getElementById('company-search').addEventListener('input', (e) => this.searchCompanies(e.target.value));
    document.getElementById('back-to-list').addEventListener('click', () => this.showSection('companies-section'));
    
    // Actions
    document.getElementById('btn-checkin').addEventListener('click', () => this.showCheckin());
    document.getElementById('btn-photo').addEventListener('click', () => this.showPhoto());
    document.getElementById('btn-note').addEventListener('click', () => this.showNote());
    document.getElementById('btn-order').addEventListener('click', () => this.showOrder());
    document.getElementById('btn-activity').addEventListener('click', () => this.showActivity());
    
    // Back buttons
    document.getElementById('back-from-checkin').addEventListener('click', () => this.showSection('company-detail'));
    document.getElementById('back-from-photo').addEventListener('click', () => this.showSection('company-detail'));
    document.getElementById('back-from-note').addEventListener('click', () => this.showSection('company-detail'));
    document.getElementById('back-from-order').addEventListener('click', () => this.showSection('company-detail'));
    document.getElementById('back-from-activity').addEventListener('click', () => this.showSection('company-detail'));
    
    // Submit forms
    document.getElementById('submit-checkin').addEventListener('click', () => this.submitCheckin());
    document.getElementById('submit-photo').addEventListener('click', () => this.submitPhoto());
    document.getElementById('submit-note').addEventListener('click', () => this.submitNote());
    document.getElementById('submit-order').addEventListener('click', () => this.submitOrder());
    document.getElementById('submit-activity').addEventListener('click', () => this.submitActivity());
    
    // Photo
    document.getElementById('photo-input').addEventListener('change', (e) => this.handlePhotoSelect(e));
  }

  loadSession() {
    const session = localStorage.getItem('sfa_session');
    if (session) {
      const data = JSON.parse(session);
      this.apiKey = data.apiKey;
      this.portalUrl = data.portalUrl;
      this.user = data.user;
      this.showMainScreen();
      this.loadCompanies();
    }
  }

  saveSession() {
    localStorage.setItem('sfa_session', JSON.stringify({
      apiKey: this.apiKey,
      portalUrl: this.portalUrl,
      user: this.user
    }));
  }

  async login() {
    this.apiKey = document.getElementById('auth-key').value.trim();
    this.portalUrl = document.getElementById('portal-url').value.trim();
    
    if (!this.apiKey || !this.portalUrl) {
      this.showNotification('Заполните все поля', 'error');
      return;
    }
    
    try {
      // Test connection
      const response = await this.apiCall('/v1/me');
      if (response && response.data) {
        this.user = response.data;
        this.saveSession();
        this.showMainScreen();
        this.loadCompanies();
        this.showNotification('Успешный вход', 'success');
      }
    } catch (error) {
      this.showNotification('Ошибка авторизации: ' + error.message, 'error');
    }
  }

  logout() {
    localStorage.removeItem('sfa_session');
    this.apiKey = '';
    this.portalUrl = '';
    this.user = null;
    this.showAuthScreen();
  }

  showAuthScreen() {
    document.getElementById('auth-screen').classList.add('active');
    document.getElementById('main-screen').classList.remove('active');
  }

  showMainScreen() {
    document.getElementById('auth-screen').classList.remove('active');
    document.getElementById('main-screen').classList.add('active');
    if (this.user) {
      document.getElementById('user-name').textContent = this.user.name || this.user.login || 'Пользователь';
    }
  }

  showSection(sectionId) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.getElementById(sectionId).classList.add('active');
  }

  navigate(section) {
    document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
    document.querySelector(`[data-section="${section}"]`).classList.add('active');
    
    if (section === 'companies') {
      this.showSection('companies-section');
    } else if (section === 'map') {
      this.showNotification('Карта в разработке', 'success');
    } else if (section === 'stats') {
      this.showNotification('Статистика в разработке', 'success');
    } else if (section === 'profile') {
      this.showNotification('Профиль в разработке', 'success');
    }
  }

  async apiCall(endpoint, params = {}) {
    const url = `https://${this.portalUrl}${endpoint}`;
    const queryParams = new URLSearchParams({
      ...params,
      auth: this.apiKey
    });
    
    const response = await fetch(`${url}?${queryParams}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  }

  async apiPost(endpoint, data = {}) {
    const url = `https://${this.portalUrl}${endpoint}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        ...data,
        auth: this.apiKey
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    return await response.json();
  }

  async loadCompanies() {
    const listEl = document.getElementById('companies-list');
    listEl.innerHTML = '<div class="loading">Загрузка компаний...</div>';
    
    try {
      // Try to load from CRM companies
      const response = await this.apiCall('/v1/crm.company.list', {
        select: ['ID', 'TITLE', 'PHONE', 'ADDRESS', 'ASSIGNED_BY_ID'],
        order: { ID: 'DESC' },
        limit: 50
      });
      
      if (response && response.result) {
        this.companies = response.result;
      } else {
        // Fallback: create demo companies
        this.companies = this.getDemoCompanies();
      }
      
      this.renderCompanies();
    } catch (error) {
      console.error('Error loading companies:', error);
      this.companies = this.getDemoCompanies();
      this.renderCompanies();
    }
  }

  getDemoCompanies() {
    return [
      { ID: '1', TITLE: 'ООО "Продукты"', PHONE: [{ VALUE: '+7 (999) 123-45-67' }], ADDRESS: 'ул. Ленина, 1' },
      { ID: '2', TITLE: 'ИП Иванов', PHONE: [{ VALUE: '+7 (999) 234-56-78' }], ADDRESS: 'ул. Гагарина, 15' },
      { ID: '3', TITLE: 'ООО "ТехноМаркет"', PHONE: [{ VALUE: '+7 (999) 345-67-89' }], ADDRESS: 'пр. Мира, 42' },
      { ID: '4', TITLE: 'Магазин "У дома"', PHONE: [{ VALUE: '+7 (999) 456-78-90' }], ADDRESS: 'ул. Садовая, 8' },
      { ID: '5', TITLE: 'ООО "ФудСити"', PHONE: [{ VALUE: '+7 (999) 567-89-01' }], ADDRESS: 'ул. Промышленная, 25' }
    ];
  }

  renderCompanies() {
    const listEl = document.getElementById('companies-list');
    
    if (this.companies.length === 0) {
      listEl.innerHTML = '<div class="empty-state">Нет компаний</div>';
      return;
    }
    
    listEl.innerHTML = this.companies.map(company => `
      <div class="company-card" data-id="${company.ID}">
        <h3>${company.TITLE}</h3>
        <p>📞 ${company.PHONE && company.PHONE[0] ? company.PHONE[0].VALUE : 'Нет телефона'}</p>
        <p>📍 ${company.ADDRESS || 'Нет адреса'}</p>
        <span class="company-status status-active">Активна</span>
      </div>
    `).join('');
    
    listEl.querySelectorAll('.company-card').forEach(card => {
      card.addEventListener('click', () => {
        const companyId = card.dataset.id;
        this.openCompany(companyId);
      });
    });
  }

  searchCompanies(query) {
    const cards = document.querySelectorAll('.company-card');
    const lowerQuery = query.toLowerCase();
    
    cards.forEach(card => {
      const text = card.textContent.toLowerCase();
      card.style.display = text.includes(lowerQuery) ? 'block' : 'none';
    });
  }

  openCompany(companyId) {
    this.currentCompany = this.companies.find(c => c.ID === companyId);
    if (!this.currentCompany) return;
    
    document.getElementById('company-name').textContent = this.currentCompany.TITLE;
    document.getElementById('company-phone').textContent = 'Телефон: ' + 
      (this.currentCompany.PHONE && this.currentCompany.PHONE[0] ? this.currentCompany.PHONE[0].VALUE : '-');
    document.getElementById('company-address').textContent = 'Адрес: ' + 
      (this.currentCompany.ADDRESS || '-');
    
    this.loadCompanyActivities();
    this.showSection('company-detail');
  }

  async loadCompanyActivities() {
    const contentEl = document.getElementById('activities-content');
    contentEl.innerHTML = '<div class="loading">Загрузка...</div>';
    
    try {
      // Try to load activities from CRM
      const response = await this.apiCall('/v1/crm.activity.list', {
        filter: { OWNER_ID: this.currentCompany.ID, OWNER_TYPE_ID: '4' },
        select: ['ID', 'TYPE_NAME', 'SUBJECT', 'CREATED', 'DESCRIPTION'],
        order: { CREATED: 'DESC' },
        limit: 20
      });
      
      if (response && response.result && response.result.length > 0) {
        contentEl.innerHTML = response.result.map(activity => `
          <div class="activity-item">
            <div class="activity-type">${activity.TYPE_NAME || 'Дело'}</div>
            <div>${activity.SUBJECT || 'Без темы'}</div>
            <div class="activity-date">${new Date(activity.CREATED).toLocaleString('ru-RU')}</div>
          </div>
        `).join('');
      } else {
        contentEl.innerHTML = '<div class="empty-state">Нет записей</div>';
      }
    } catch (error) {
      contentEl.innerHTML = '<div class="empty-state">Нет записей</div>';
    }
  }

  showCheckin() {
    this.showSection('checkin-form');
    this.getLocation();
  }

  getLocation() {
    const locationText = document.getElementById('location-text');
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          this.location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          locationText.textContent = `📍 ${this.location.lat.toFixed(6)}, ${this.location.lng.toFixed(6)}`;
        },
        (error) => {
          locationText.textContent = 'Не удалось определить местоположение';
        }
      );
    } else {
      locationText.textContent = 'Геолокация не поддерживается';
    }
  }

  async submitCheckin() {
    const comment = document.getElementById('checkin-comment').value.trim();
    
    try {
      // Create activity in CRM
      await this.apiPost('/v1/crm.activity.add', {
        fields: {
          OWNER_TYPE_ID: '4',
          OWNER_ID: this.currentCompany.ID,
          TYPE_ID: '2',
          SUBJECT: 'Посещение торговой точки',
          DESCRIPTION: `Отметка в точке\n${comment ? 'Комментарий: ' + comment : ''}\n${this.location ? `Координаты: ${this.location.lat}, ${this.location.lng}` : ''}`,
          COMPLETED: 'Y'
        }
      });
      
      this.showNotification('Отметка сохранена', 'success');
      document.getElementById('checkin-comment').value = '';
      this.showSection('company-detail');
      this.loadCompanyActivities();
    } catch (error) {
      // Save locally if API fails
      this.saveLocalActivity('checkin', { comment, location: this.location });
      this.showNotification('Отметка сохранена локально', 'success');
      this.showSection('company-detail');
    }
  }

  showPhoto() {
    this.showSection('photo-form');
    this.photos = [];
    document.getElementById('photo-preview').innerHTML = '';
    document.getElementById('photo-description').value = '';
  }

  handlePhotoSelect(event) {
    const files = event.target.files;
    const preview = document.getElementById('photo-preview');
    
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (e) => {
        this.photos.push(e.target.result);
        const img = document.createElement('img');
        img.src = e.target.result;
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  }

  async submitPhoto() {
    const description = document.getElementById('photo-description').value.trim();
    
    if (this.photos.length === 0) {
      this.showNotification('Добавьте фото', 'error');
      return;
    }
    
    try {
      // Create activity with photos
      await this.apiPost('/v1/crm.activity.add', {
        fields: {
          OWNER_TYPE_ID: '4',
          OWNER_ID: this.currentCompany.ID,
          TYPE_ID: '2',
          SUBJECT: 'Фотоотчет',
          DESCRIPTION: `Фотоотчет\n${description ? 'Описание: ' + description : ''}\nКоличество фото: ${this.photos.length}`,
          COMPLETED: 'Y'
        }
      });
      
      this.showNotification('Фотоотчет сохранен', 'success');
      this.showSection('company-detail');
      this.loadCompanyActivities();
    } catch (error) {
      this.saveLocalActivity('photo', { description, photosCount: this.photos.length });
      this.showNotification('Фотоотчет сохранен локально', 'success');
      this.showSection('company-detail');
    }
  }

  showNote() {
    this.showSection('note-form');
    document.getElementById('note-title').value = '';
    document.getElementById('note-text').value = '';
  }

  async submitNote() {
    const title = document.getElementById('note-title').value.trim();
    const text = document.getElementById('note-text').value.trim();
    
    if (!title && !text) {
      this.showNotification('Заполните заметку', 'error');
      return;
    }
    
    try {
      await this.apiPost('/v1/crm.activity.add', {
        fields: {
          OWNER_TYPE_ID: '4',
          OWNER_ID: this.currentCompany.ID,
          TYPE_ID: '2',
          SUBJECT: title || 'Заметка',
          DESCRIPTION: text,
          COMPLETED: 'Y'
        }
      });
      
      this.showNotification('Заметка сохранена', 'success');
      this.showSection('company-detail');
      this.loadCompanyActivities();
    } catch (error) {
      this.saveLocalActivity('note', { title, text });
      this.showNotification('Заметка сохранена локально', 'success');
      this.showSection('company-detail');
    }
  }

  async showOrder() {
    this.showSection('order-form');
    this.cart = {};
    await this.loadProducts();
  }

  async loadProducts() {
    const listEl = document.getElementById('products-list');
    listEl.innerHTML = '<div class="loading">Загрузка товаров...</div>';
    
    try {
      const response = await this.apiCall('/v1/crm.product.list', {
        select: ['ID', 'NAME', 'PRICE', 'CURRENCY_ID'],
        limit: 50
      });
      
      if (response && response.result) {
        this.products = response.result;
      } else {
        this.products = this.getDemoProducts();
      }
      
      this.renderProducts();
    } catch (error) {
      this.products = this.getDemoProducts();
      this.renderProducts();
    }
  }

  getDemoProducts() {
    return [
      { ID: '1', NAME: 'Молоко 1л', PRICE: '89.00', CURRENCY_ID: 'RUB' },
      { ID: '2', NAME: 'Хлеб', PRICE: '45.00', CURRENCY_ID: 'RUB' },
      { ID: '3', NAME: 'Яйца 10шт', PRICE: '120.00', CURRENCY_ID: 'RUB' },
      { ID: '4', NAME: 'Сыр 200г', PRICE: '250.00', CURRENCY_ID: 'RUB' },
      { ID: '5', NAME: 'Йогурт', PRICE: '75.00', CURRENCY_ID: 'RUB' },
      { ID: '6', NAME: 'Масло сливочное', PRICE: '180.00', CURRENCY_ID: 'RUB' }
    ];
  }

  renderProducts() {
    const listEl = document.getElementById('products-list');
    
    listEl.innerHTML = this.products.map(product => {
      const qty = this.cart[product.ID] || 0;
      return `
        <div class="product-item" data-id="${product.ID}">
          <div class="product-info">
            <h4>${product.NAME}</h4>
            <p>${product.PRICE} ${product.CURRENCY_ID || '₽'}</p>
          </div>
          <div class="product-quantity">
            <button class="qty-btn" onclick="app.changeQty('${product.ID}', -1)">−</button>
            <span class="qty-value">${qty}</span>
            <button class="qty-btn" onclick="app.changeQty('${product.ID}', 1)">+</button>
          </div>
        </div>
      `;
    }).join('');
    
    this.updateOrderTotal();
  }

  changeQty(productId, delta) {
    const currentQty = this.cart[productId] || 0;
    const newQty = Math.max(0, currentQty + delta);
    
    if (newQty === 0) {
      delete this.cart[productId];
    } else {
      this.cart[productId] = newQty;
    }
    
    this.renderProducts();
  }

  updateOrderTotal() {
    let total = 0;
    Object.entries(this.cart).forEach(([productId, qty]) => {
      const product = this.products.find(p => p.ID === productId);
      if (product) {
        total += parseFloat(product.PRICE) * qty;
      }
    });
    
    document.getElementById('order-total').textContent = total.toFixed(2) + ' ₽';
  }

  async submitOrder() {
    if (Object.keys(this.cart).length === 0) {
      this.showNotification('Добавьте товары в заказ', 'error');
      return;
    }
    
    const comment = document.getElementById('order-comment').value.trim();
    const total = document.getElementById('order-total').textContent;
    
    try {
      // Create deal for order
      const orderItems = Object.entries(this.cart).map(([productId, qty]) => {
        const product = this.products.find(p => p.ID === productId);
        return `${product.NAME} x${qty} = ${(parseFloat(product.PRICE) * qty).toFixed(2)} ₽`;
      }).join('\n');
      
      await this.apiPost('/v1/crm.deal.add', {
        fields: {
          TITLE: `Заказ от ${new Date().toLocaleDateString('ru-RU')}`,
          COMPANY_ID: this.currentCompany.ID,
          COMMENTS: `Заказ:\n${orderItems}\n\nИтого: ${total}\n${comment ? 'Комментарий: ' + comment : ''}`
        }
      });
      
      this.showNotification('Заказ создан', 'success');
      this.showSection('company-detail');
    } catch (error) {
      this.saveLocalActivity('order', { cart: this.cart, total, comment });
      this.showNotification('Заказ сохранен локально', 'success');
      this.showSection('company-detail');
    }
  }

  showActivity() {
    this.showSection('activity-form');
    document.getElementById('activity-type').value = 'call';
    document.getElementById('activity-subject').value = '';
    document.getElementById('activity-description').value = '';
    document.getElementById('activity-deadline').value = '';
  }

  async submitActivity() {
    const type = document.getElementById('activity-type').value;
    const subject = document.getElementById('activity-subject').value.trim();
    const description = document.getElementById('activity-description').value.trim();
    const deadline = document.getElementById('activity-deadline').value;
    
    if (!subject) {
      this.showNotification('Введите тему', 'error');
      return;
    }
    
    const typeNames = {
      call: 'Звонок',
      meeting: 'Встреча',
      task: 'Задача',
      email: 'Письмо'
    };
    
    try {
      await this.apiPost('/v1/crm.activity.add', {
        fields: {
          OWNER_TYPE_ID: '4',
          OWNER_ID: this.currentCompany.ID,
          TYPE_ID: '2',
          SUBJECT: `${typeNames[type]}: ${subject}`,
          DESCRIPTION: description,
          DEADLINE: deadline ? new Date(deadline).toISOString() : undefined,
          COMPLETED: 'N'
        }
      });
      
      this.showNotification('Дело создано', 'success');
      this.showSection('company-detail');
      this.loadCompanyActivities();
    } catch (error) {
      this.saveLocalActivity('activity', { type, subject, description, deadline });
      this.showNotification('Дело сохранено локально', 'success');
      this.showSection('company-detail');
    }
  }

  saveLocalActivity(type, data) {
    const activities = JSON.parse(localStorage.getItem('sfa_activities') || '[]');
    activities.push({
      type,
      companyId: this.currentCompany.ID,
      companyName: this.currentCompany.TITLE,
      data,
      created: new Date().toISOString()
    });
    localStorage.setItem('sfa_activities', JSON.stringify(activities));
  }

  showNotification(message, type = 'info') {
    const container = document.getElementById('notifications');
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    container.appendChild(notification);
    
    setTimeout(() => {
      notification.remove();
    }, 3000);
  }
}

// Initialize app
const app = new SFAApp();
