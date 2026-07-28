// Mobile Trade App
class MobileTradeApp {
  constructor() {
    this.currentVisit = null;
    this.visits = [];
    this.orders = [];
    this.currentOrder = null;
    this.isOnline = navigator.onLine;
    
    this.init();
  }

  init() {
    this.setupEventListeners();
    this.setupNetworkMonitoring();
    this.loadVisits();
    this.loadOrders();
    this.updateConnectionStatus();
  }

  setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.handleNavigation(e));
    });

    // New Visit
    document.getElementById('newVisitBtn').addEventListener('click', () => {
      this.showModal('newVisitModal');
    });

    document.getElementById('closeNewVisit').addEventListener('click', () => {
      this.hideModal('newVisitModal');
    });

    document.getElementById('cancelVisit').addEventListener('click', () => {
      this.hideModal('newVisitModal');
    });

    document.getElementById('visitForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.createVisit();
    });

    // Location
    document.getElementById('getLocationBtn').addEventListener('click', () => {
      this.getCurrentLocation();
    });

    // Active Visit Actions
    document.getElementById('backToVisits').addEventListener('click', () => {
      this.showPage('visitsPage');
    });

    document.getElementById('photoBtn').addEventListener('click', () => {
      document.getElementById('photoInput').click();
    });

    document.getElementById('photoInput').addEventListener('change', (e) => {
      this.handlePhotoUpload(e);
    });

    document.getElementById('noteBtn').addEventListener('click', () => {
      document.getElementById('notesSection').scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('addNoteBtn').addEventListener('click', () => {
      this.addNote();
    });

    document.getElementById('orderBtn').addEventListener('click', () => {
      document.getElementById('orderSection').scrollIntoView({ behavior: 'smooth' });
    });

    document.getElementById('addOrderItemBtn').addEventListener('click', () => {
      this.showModal('orderItemModal');
    });

    document.getElementById('checkoutBtn').addEventListener('click', () => {
      this.showModal('checkoutModal');
    });

    // Order Item Modal
    document.getElementById('closeOrderItem').addEventListener('click', () => {
      this.hideModal('orderItemModal');
    });
    document.getElementById('cancelOrderItem').addEventListener('click', () => {
      this.hideModal('orderItemModal');
    });

    document.getElementById('orderItemForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.addOrderItem();
    });

    // Checkout
    document.getElementById('cancelCheckout').addEventListener('click', () => {
      this.hideModal('checkoutModal');
    });

    document.getElementById('confirmCheckout').addEventListener('click', () => {
      this.completeVisit();
    });
  }

  setupNetworkMonitoring() {
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.updateConnectionStatus();
      this.showToast('Соединение восстановлено', 'success');
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
      this.updateConnectionStatus();
      this.showToast('Работа в офлайн-режиме', 'warning');
    });
  }

  updateConnectionStatus() {
    const indicator = document.querySelector('.status-indicator');
    const text = document.querySelector('.status-text');
    
    if (this.isOnline) {
      indicator.classList.remove('offline');
      text.textContent = 'Онлайн';
    } else {
      indicator.classList.add('offline');
      text.textContent = 'Офлайн';
    }
  }

  handleNavigation(e) {
    const page = e.currentTarget.dataset.page;
    
    // Update active nav button
    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    e.currentTarget.classList.add('active');
    
    // Show corresponding page
    if (page === 'visits') {
      this.showPage('visitsPage');
    } else if (page === 'orders') {
      this.showPage('ordersPage');
      this.loadOrders();
    } else if (page === 'history') {
      this.showPage('historyPage');
      this.loadHistory();
    }
  }

  showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
  }

  showModal(modalId) {
    document.getElementById(modalId).classList.add('show');
  }

  hideModal(modalId) {
    document.getElementById(modalId).classList.remove('show');
  }

  async getCurrentLocation() {
    const btn = document.getElementById('getLocationBtn');
    const coordsDisplay = document.getElementById('coordinates');
    
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Определение...';
    
    if (!navigator.geolocation) {
      this.showToast('Геолокация не поддерживается', 'error');
      btn.disabled = false;
      btn.innerHTML = '📍 Определить координаты';
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        coordsDisplay.innerHTML = `
          <strong>Широта:</strong> ${latitude.toFixed(6)}<br>
          <strong>Долгота:</strong> ${longitude.toFixed(6)}<br>
          <strong>Точность:</strong> ${accuracy.toFixed(0)}м
        `;
        coordsDisplay.dataset.latitude = latitude;
        coordsDisplay.dataset.longitude = longitude;
        btn.disabled = false;
        btn.innerHTML = '📍 Обновить координаты';
        this.showToast('Координаты определены', 'success');
      },
      (error) => {
        let message = 'Ошибка определения местоположения';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = 'Доступ к геолокации запрещен';
            break;
          case error.POSITION_UNAVAILABLE:
            message = 'Информация о местоположении недоступна';
            break;
          case error.TIMEOUT:
            message = 'Превышено время ожидания';
            break;
        }
        this.showToast(message, 'error');
        btn.disabled = false;
        btn.innerHTML = '📍 Определить координаты';
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  async createVisit() {
    const companyName = document.getElementById('companyName').value;
    const contactPerson = document.getElementById('contactPerson').value;
    const address = document.getElementById('address').value;
    const coordsDisplay = document.getElementById('coordinates');
    const latitude = coordsDisplay.dataset.latitude || null;
    const longitude = coordsDisplay.dataset.longitude || null;

    if (!companyName) {
      this.showToast('Введите название компании', 'error');
      return;
    }

    const visitData = {
      companyName,
      contactPerson,
      address,
      latitude,
      longitude
    };

    try {
      const response = await fetch('/api/visits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(visitData)
      });

      if (response.ok) {
        const visit = await response.json();
        this.currentVisit = visit;
        this.visits.push(visit);
        
        // Reset form
        document.getElementById('visitForm').reset();
        coordsDisplay.innerHTML = '';
        delete coordsDisplay.dataset.latitude;
        delete coordsDisplay.dataset.longitude;
        document.getElementById('getLocationBtn').innerHTML = '📍 Определить координаты';
        
        this.hideModal('newVisitModal');
        this.showActiveVisit(visit);
        this.showToast('Визит начат', 'success');
      } else {
        throw new Error('Failed to create visit');
      }
    } catch (error) {
      console.error('Error creating visit:', error);
      this.showToast('Ошибка создания визита', 'error');
    }
  }

  showActiveVisit(visit) {
    document.getElementById('activeVisitCompany').textContent = visit.companyName;
    
    // Clear previous data
    document.getElementById('photosGrid').innerHTML = '';
    document.getElementById('notesList').innerHTML = '';
    document.getElementById('orderItems').innerHTML = '';
    document.getElementById('orderTotal').textContent = '0 ₽';
    
    // Create new order for this visit
    this.createOrder(visit.id);
    
    this.showPage('activeVisitPage');
  }

  async createOrder(visitId) {
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visitId, items: [], totalAmount: 0 })
      });

      if (response.ok) {
        const order = await response.json();
        this.currentOrder = order;
      }
    } catch (error) {
      console.error('Error creating order:', error);
    }
  }

  async handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file || !this.currentVisit) return;

    const formData = new FormData();
    formData.append('photo', file);

    try {
      const response = await fetch(`/api/visits/${this.currentVisit.id}/photos`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const result = await response.json();
        this.currentVisit.photos.push(result.photo);
        this.addPhotoToGrid(result.photo.url);
        this.showToast('Фото добавлено', 'success');
      } else {
        throw new Error('Failed to upload photo');
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      this.showToast('Ошибка загрузки фото', 'error');
    }

    // Reset input
    event.target.value = '';
  }

  addPhotoToGrid(photoUrl) {
    const grid = document.getElementById('photosGrid');
    const photoItem = document.createElement('div');
    photoItem.className = 'photo-item';
    photoItem.innerHTML = `<img src="${photoUrl}" alt="Фото визита">`;
    grid.appendChild(photoItem);
  }

  async addNote() {
    const noteText = document.getElementById('noteText').value.trim();
    if (!noteText || !this.currentVisit) {
      this.showToast('Введите текст заметки', 'error');
      return;
    }

    const note = {
      text: noteText,
      time: new Date().toLocaleString('ru-RU')
    };
    // Add to UI
    this.addNoteToList(note);
    
    // Update visit notes
    const currentNotes = this.currentVisit.notes ? this.currentVisit.notes + '\n' : '';
    this.currentVisit.notes = currentNotes + noteText;
    
    // Clear input
    document.getElementById('noteText').value = '';
    
    this.showToast('Заметка добавлена', 'success');
  }

  addNoteToList(note) {
    const list = document.getElementById('notesList');
    const noteItem = document.createElement('div');
    noteItem.className = 'note-item';
    noteItem.innerHTML = `
      <div>${note.text}</div>
      <div class="note-time">${note.time}</div>
    `;
    list.appendChild(noteItem);
  }

  async addOrderItem() {
    const productName = document.getElementById('productName').value;
    const quantity = parseInt(document.getElementById('productQuantity').value);
    const price = parseFloat(document.getElementById('productPrice').value);

    if (!productName || !quantity || !price) {
      this.showToast('Заполните все поля', 'error');
      return;
    }

    const item = {
      name: productName,
      quantity: quantity,
      price: price,
      total: quantity * price
    };

    // Add to current order
    if (this.currentOrder) {
      this.currentOrder.items.push(item);
      this.currentOrder.totalAmount += item.total;
      
      // Update UI
      this.addOrderItemToUI(item);
      this.updateOrderTotal();
      
      // Update order on server
      try {
        await fetch(`/api/orders/${this.currentOrder.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: this.currentOrder.items,
            totalAmount: this.currentOrder.totalAmount
          })
        });
      } catch (error) {
        console.error('Error updating order:', error);
      }
    }

    // Reset form and close modal
    document.getElementById('orderItemForm').reset();
    this.hideModal('orderItemModal');
    this.showToast('Товар добавлен', 'success');
  }

  addOrderItemToUI(item) {
    const container = document.getElementById('orderItems');
    const orderItem = document.createElement('div');
    orderItem.className = 'order-item';
    orderItem.innerHTML = `
      <div class="order-item-info">
        <div class="order-item-name">${item.name}</div>
        <div class="order-item-details">${item.quantity} × ${item.price.toFixed(2)} ₽</div>
      </div>
      <div class="order-item-price">${item.total.toFixed(2)} ₽</div>
    `;
    container.appendChild(orderItem);
  }

  updateOrderTotal() {
    const total = this.currentOrder ? this.currentOrder.totalAmount : 0;
    document.getElementById('orderTotal').textContent = `${total.toFixed(2)} ₽`;
  }

  async completeVisit() {
    if (!this.currentVisit) return;

    try {
      // Update visit status
      const visitResponse = await fetch(`/api/visits/${this.currentVisit.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkOutTime: new Date().toISOString(),
          orderId: this.currentOrder ? this.currentOrder.id : null
        })
      });

      if (visitResponse.ok) {
        const updatedVisit = await visitResponse.json();
        
        // Create task in Bitrix24
        await this.createBitrixTask(updatedVisit);
        
        // Update local state
        const index = this.visits.findIndex(v => v.id === updatedVisit.id);
        if (index !== -1) {
          this.visits[index] = updatedVisit;
        }
        
        this.currentVisit = null;
        this.currentOrder = null;
        
        this.hideModal('checkoutModal');
        this.showPage('visitsPage');
        this.loadVisits();
        this.showToast('Визит завершен. Задача создана в Битрикс24.', 'success');
      } else {
        throw new Error('Failed to complete visit');
      }
    } catch (error) {
      console.error('Error completing visit:', error);
      this.showToast('Ошибка завершения визита', 'error');
    }
  }

  async createBitrixTask(visit) {
    try {
      const taskData = {
        title: `Визит: ${visit.companyName}`,
        description: `
Компания: ${visit.companyName}
Контакт: ${visit.contactPerson || 'Не указан'}
Адрес: ${visit.address || 'Не указан'}
Координаты: ${visit.latitude}, ${visit.longitude}
Время начала: ${new Date(visit.checkInTime).toLocaleString('ru-RU')}
Время окончания: ${new Date().toLocaleString('ru-RU')}

Заметки:
${visit.notes || 'Нет заметок'}

Заказ: ${visit.orderId ? 'Сформирован' : 'Не оформлен'}
        `.trim(),
        responsibleId: 1 // Default responsible user ID
      };

      const response = await fetch('/api/bitrix/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });

      if (!response.ok) {
        console.error('Failed to create Bitrix task');
      }
    } catch (error) {
      console.error('Error creating Bitrix task:', error);
    }
  }

  async loadVisits() {
    try {
      const response = await fetch('/api/visits');
      if (response.ok) {
        this.visits = await response.json();
        this.renderVisits();
      }
    } catch (error) {
      console.error('Error loading visits:', error);
      this.renderVisits(); // Render from memory
    }
  }

  renderVisits() {
    const container = document.getElementById('visitsList');
    
    if (this.visits.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📍</div>
          <div class="empty-state-text">Нет активных визитов</div>
          <button class="btn btn-primary" onclick="app.showModal('newVisitModal')">Начать визит</button>
        </div>
      `;
      return;
    }

    container.innerHTML = this.visits.map(visit => `
      <div class="visit-card ${visit.status}" data-id="${visit.id}">
        <div class="visit-card-header">
          <div class="visit-card-title">${visit.companyName}</div>
          <span class="visit-card-status ${visit.status}">
            ${visit.status === 'active' ? 'Активен' : 'Завершен'}
          </span>
        </div>
        <div class="visit-card-info">
          ${visit.contactPerson ? `👤 ${visit.contactPerson}` : ''}
          ${visit.address ? `<br>📍 ${visit.address}` : ''}
        </div>
        <div class="visit-card-time">
          🕐 ${new Date(visit.checkInTime).toLocaleString('ru-RU')}
          ${visit.checkOutTime ? ` - ${new Date(visit.checkOutTime).toLocaleString('ru-RU')}` : ''}
        </div>
      </div>
    `).join('');

    // Add click handlers
    container.querySelectorAll('.visit-card').forEach(card => {
      card.addEventListener('click', () => {
        const visitId = card.dataset.id;
        const visit = this.visits.find(v => v.id === visitId);
        if (visit && visit.status === 'active') {
          this.currentVisit = visit;
          this.showActiveVisit(visit);
        }
      });
    });
  }

  async loadOrders() {
    // For now, show orders from visits
    const container = document.getElementById('ordersList');
    const completedVisits = this.visits.filter(v => v.status === 'completed' && v.orderId);
    
    if (completedVisits.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📋</div>
          <div class="empty-state-text">Нет заказов</div>
        </div>
      `;
      return;
    }

    container.innerHTML = completedVisits.map(visit => `
      <div class="order-card">
        <div class="order-card-header">
          <div class="order-card-title">${visit.companyName}</div>
          <span class="order-card-status">Заказ</span>
        </div>
        <div class="order-card-info">
          Заказ №${visit.orderId}<br>
          Визит: ${new Date(visit.checkInTime).toLocaleDateString('ru-RU')}
        </div>
      </div>
    `).join('');
  }

  async loadHistory() {
    const container = document.getElementById('historyList');
    const completedVisits = this.visits.filter(v => v.status === 'completed');
    
    if (completedVisits.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📊</div>
          <div class="empty-state-text">Нет завершенных визитов</div>
        </div>
      `;
      return;
    }

    container.innerHTML = completedVisits.map(visit => `
      <div class="history-card">
        <div class="history-card-header">
          <div class="history-card-title">${visit.companyName}</div>
        </div>
        <div class="history-card-info">
          ${visit.contactPerson ? `👤 ${visit.contactPerson}<br>` : ''}
          🕐 ${new Date(visit.checkInTime).toLocaleString('ru-RU')} - 
          ${new Date(visit.checkOutTime).toLocaleString('ru-RU')}<br>
          📍 ${visit.latitude && visit.longitude ? `${visit.latitude.toFixed(4)}, ${visit.longitude.toFixed(4)}` : 'Нет координат'}
        </div>
      </div>
    `).join('');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }
}

// Initialize app
const app = new MobileTradeApp();
window.app = app; // Make it globally accessible for debugging
