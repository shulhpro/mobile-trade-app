class MobileTradeApp {
  constructor() {
    this.companies = [];
    this.products = [];
    this.currentCompany = null;
    this.currentVisit = null;
    this.currentStep = 1;
    this.orderItems = [];
    this.photos = [];
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadCompanies();
    await this.loadProducts();
  }

  bindEvents() {
    document.getElementById('companySearch').addEventListener('input', (e) => this.handleSearch(e));
    document.getElementById('clearSearch').addEventListener('click', () => this.clearSearch());
    document.getElementById('refreshBtn').addEventListener('click', () => this.loadCompanies());
    document.getElementById('backToHome').addEventListener('click', () => this.showPage('home-page'));
    document.getElementById('startVisitBtn').addEventListener('click', () => this.startVisit());
    document.getElementById('backToDetail').addEventListener('click', () => this.showPage('company-detail-page'));
    document.getElementById('nextStepBtn').addEventListener('click', () => this.nextStep());
    document.getElementById('prevStepBtn').addEventListener('click', () => this.prevStep());
    document.getElementById('captureLocationBtn').addEventListener('click', () => this.captureLocation());
    document.getElementById('takePhotoBtn').addEventListener('click', () => document.getElementById('cameraInput').click());
    document.getElementById('cameraInput').addEventListener('change', (e) => this.handlePhoto(e));
    document.getElementById('visitNote').addEventListener('input', (e) => this.autoSaveNote(e));
    document.getElementById('createTaskBtn').addEventListener('click', () => this.createBitrixTask());
    document.getElementById('skipTaskBtn').addEventListener('click', () => this.finishVisit());
  }

  showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    window.scrollTo(0, 0);
  }

  showStep(stepNum) {
    this.currentStep = stepNum;
    const titles = ['Location', 'Photo', 'Note', 'Order'];
    document.getElementById('visitStepTitle').textContent = `Step ${stepNum}: ${titles[stepNum - 1]}`;
    document.getElementById('currentStep').textContent = stepNum;
    document.querySelectorAll('.step-content').forEach((el, i) => {
      el.classList.toggle('active', i + 1 === stepNum);
    });
    document.getElementById('prevStepBtn').style.display = stepNum > 1 ? 'flex' : 'none';
    document.getElementById('nextStepBtn').innerHTML = stepNum === 4 ? 
      'Complete <span class="btn-icon">V</span>' : 
      'Next <span class="btn-icon">-&gt;</span>';
  }

  async apiCall(method, endpoint, body = null) {
    try {
      const options = { method, headers: { 'Content-Type': 'application/json' } };
      if (body) options.body = JSON.stringify(body);
      const response = await fetch(`/api${endpoint}`, options);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      this.showToast('Connection error', 'error');
      throw error;
    }
  }

  async loadCompanies() {
    try {
      const search = document.getElementById('companySearch').value;
      const url = search ? `/api/companies?search=${encodeURIComponent(search)}` : '/api/companies';
      this.companies = await this.apiCall('GET', url);
      this.renderCompanies();
    } catch (error) {
      this.showToast('Failed to load companies', 'error');
    }
  }

  renderCompanies() {
    const container = document.getElementById('companiesList');
    if (this.companies.length === 0) {
      container.innerHTML = '<div class="empty-state"><div class="empty-state-icon">S</div><p>No companies found</p></div>';
      return;
    }
    container.innerHTML = this.companies.map(company => `
      <div class="company-card-item" onclick="app.showCompany(${company.id})">
        <div class="company-name">${company.name}</div>
        <div class="company-address">A: ${company.address}</div>
        <div class="company-contact">C: ${company.contact} | P: ${company.phone}</div>
      </div>
    `).join('');
  }

  handleSearch(e) {
    const value = e.target.value;
    document.getElementById('clearSearch').style.display = value ? 'block' : 'none';
    this.loadCompanies();
  }

  clearSearch() {
    document.getElementById('companySearch').value = '';
    document.getElementById('clearSearch').style.display = 'none';
    this.loadCompanies();
  }

  showCompany(id) {
    this.currentCompany = this.companies.find(c => c.id === id);
    if (!this.currentCompany) return;
    document.getElementById('detailCompanyName').textContent = this.currentCompany.name;
    document.getElementById('detailAddress').textContent = this.currentCompany.address;
    document.getElementById('detailContact').textContent = this.currentCompany.contact;
    document.getElementById('detailPhone').textContent = this.currentCompany.phone;
    document.getElementById('detailPhone').href = `tel:${this.currentCompany.phone}`;
    document.getElementById('detailEmail').textContent = this.currentCompany.email;
    document.getElementById('detailEmail').href = `mailto:${this.currentCompany.email}`;
    this.showPage('company-detail-page');
  }

  async loadProducts() {
    try {
      this.products = await this.apiCall('GET', '/api/products');
    } catch (error) {
      console.error('Failed to load products');
    }
  }

  renderProducts() {
    const container = document.getElementById('productsList');
    container.innerHTML = this.products.map(product => {
      const orderItem = this.orderItems.find(item => item.productId === product.id);
      const qty = orderItem ? orderItem.qty : 0;
      return `
        <div class="product-item">
          <div class="product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-price">${product.price} RUB / ${product.unit}</div>
          </div>
          <div class="product-controls">
            <button class="qty-btn" onclick="app.updateQty(${product.id}, -1)">-</button>
            <span class="qty-value">${qty}</span>
            <button class="qty-btn" onclick="app.updateQty(${product.id}, 1)">+</button>
          </div>
          <div class="product-total">${(qty * product.price).toLocaleString()} RUB</div>
        </div>
      `;
    }).join('');
    this.updateOrderSummary();
  }

  updateQty(productId, delta) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;
    const existingItem = this.orderItems.find(item => item.productId === productId);
    if (existingItem) {
      existingItem.qty = Math.max(0, existingItem.qty + delta);
      existingItem.total = existingItem.qty * product.price;
      if (existingItem.qty === 0) {
        this.orderItems = this.orderItems.filter(item => item.productId !== productId);
      }
    } else if (delta > 0) {
      this.orderItems.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: 1,
        total: product.price,
        unit: product.unit
      });
    }
    this.renderProducts();
  }

  updateOrderSummary() {
    const totalItems = this.orderItems.reduce((sum, item) => sum + item.qty, 0);
    const totalAmount = this.orderItems.reduce((sum, item) => sum + item.total, 0);
    document.getElementById('orderItemsCount').textContent = totalItems;
    document.getElementById('orderTotalAmount').textContent = `${totalAmount.toLocaleString()} RUB`;
  }

  async startVisit() {
    try {
      this.currentVisit = await this.apiCall('POST', '/api/visits', {
        companyId: this.currentCompany.id,
        companyName: this.currentCompany.name
      });
      this.currentStep = 1;
      this.orderItems = [];
      this.photos = [];
      document.getElementById('locationStatus').className = 'status-box';
      document.getElementById('locationStatus').innerHTML = '<span class="status-icon">W</span><span class="status-text">Waiting...</span>';
      document.getElementById('photoPreview').innerHTML = '<div class="photo-placeholder"><span class="photo-icon">C</span><span>No photo</span></div>';
      document.getElementById('photoGallery').innerHTML = '';
      document.getElementById('visitNote').value = '';
      this.showStep(1);
      this.showPage('visit-flow-page');
      this.showToast('Visit started!');
    } catch (error) {
      this.showToast('Failed to start visit', 'error');
    }
  }

  async nextStep() {
    if (this.currentStep < 4) {
      if (this.currentStep === 3) {
        await this.saveNote();
      }
      this.showStep(this.currentStep + 1);
      if (this.currentStep === 4) {
        this.renderProducts();
      }
    } else {
      await this.completeVisit();
    }
  }

  prevStep() {
    if (this.currentStep > 1) {
      this.showStep(this.currentStep - 1);
    }
  }

  captureLocation() {
    const statusBox = document.getElementById('locationStatus');
    statusBox.innerHTML = '<span class="status-icon">L</span><span class="status-text">Locating...</span>';
    if (!navigator.geolocation) {
      statusBox.className = 'status-box error';
      statusBox.innerHTML = '<span class="status-icon">X</span><span class="status-text">Geolocation not supported</span>';
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        };
        try {
          await this.apiCall('PATCH', `/visits/${this.currentVisit.id}/coords`, { coords });
          this.currentVisit.coords = coords;
          statusBox.className = 'status-box success';
          statusBox.innerHTML = `<span class="status-icon">V</span><span class="status-text">${coords.lat.toFixed(6)}, ${coords.lng.toFixed(6)}</span>`;
        } catch (error) {
          statusBox.className = 'status-box error';
          statusBox.innerHTML = '<span class="status-icon">X</span><span class="status-text">Save error</span>';
        }
      },
      (error) => {
        statusBox.className = 'status-box error';
        const messages = { 1: 'Permission denied', 2: 'Position unavailable', 3: 'Timeout' };
        statusBox.innerHTML = `<span class="status-icon">X</span><span class="status-text">${messages[error.code] || 'Error'}</span>`;
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }

  async handlePhoto(event) {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('photo', file);
    try {
      const response = await fetch(`/api/visits/${this.currentVisit.id}/photos`, {
        method: 'POST',
        body: formData
      });
      const data = await response.json();
      if (data.success) {
        this.photos.push(data.photo);
        this.updatePhotoGallery();
        this.showToast('Photo added!');
      }
    } catch (error) {
      this.showToast('Photo upload error', 'error');
    }
    event.target.value = '';
  }

  updatePhotoGallery() {
    const preview = document.getElementById('photoPreview');
    const gallery = document.getElementById('photoGallery');
    if (this.photos.length > 0) {
      const lastPhoto = this.photos[this.photos.length - 1];
      preview.innerHTML = `<img src="${lastPhoto.url}" alt="Photo">`;
    }
    gallery.innerHTML = this.photos.map(photo => `
      <img src="${photo.url}" alt="Photo" onclick="app.showPhotoFullscreen('${photo.url}')">
    `).join('');
  }

  showPhotoFullscreen(url) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `<div style="padding: 20px;" onclick="this.parentElement.remove()"><img src="${url}" style="max-width: 100%; max-height: 90vh; border-radius: 12px;"></div>`;
    document.body.appendChild(modal);
  }

  async autoSaveNote(event) {
    const note = event.target.value;
    if (this.currentVisit) {
      this.currentVisit.note = note;
    }
  }

  async saveNote() {
    if (!this.currentVisit) return;
    const note = document.getElementById('visitNote').value;
    try {
      await this.apiCall('PATCH', `/visits/${this.currentVisit.id}/note`, { note });
    } catch (error) {
      console.error('Failed to save note');
    }
  }

  async completeVisit() {
    try {
      const order = {
        items: this.orderItems,
        total: this.orderItems.reduce((sum, item) => sum + item.total, 0)
      };
      await this.apiCall('PATCH', `/visits/${this.currentVisit.id}/order`, { order });
      const result = await this.apiCall('POST', `/visits/${this.currentVisit.id}/complete`);
      if (result.success) {
        document.getElementById('completionModal').classList.add('active');
      }
    } catch (error) {
      this.showToast('Complete visit error', 'error');
    }
  }

  async createBitrixTask() {
    try {
      const result = await this.apiCall('POST', `/visits/${this.currentVisit.id}/create-task`);
      if (result.success) {
        this.showToast('Task created in Bitrix24!');
        this.finishVisit();
      }
    } catch (error) {
      this.showToast('Task creation error', 'error');
      this.finishVisit();
    }
  }

  finishVisit() {
    document.getElementById('completionModal').classList.remove('active');
    this.showPage('home-page');
    this.showToast('Visit completed!');
    this.loadCompanies();
  }

  showToast(message, type = 'success') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
}

const app = new MobileTradeApp();
