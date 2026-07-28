class App {
  constructor() {
    this.companies = [];
    this.currentCompany = null;
    this.currentVisit = null;
    this.step = 1;
    this.order = { items: [], total: 0 };
    this.init();
  }
  
  async init() {
    this.bindEvents();
    await this.loadCompanies();
    this.renderCompanies();
  }
  
  bindEvents() {
    document.getElementById('companySearch').addEventListener('input', e => this.search(e.target.value));
    document.getElementById('backToHome').addEventListener('click', () => this.showPage('home-page'));
    document.getElementById('startVisitBtn').addEventListener('click', () => this.startVisit());
    document.getElementById('nextStepBtn').addEventListener('click', () => this.nextStep());
    document.getElementById('prevStepBtn').addEventListener('click', () => this.prevStep());
    document.getElementById('captureLocationBtn').addEventListener('click', () => this.getLocation());
    document.getElementById('takePhotoBtn').addEventListener('click', () => document.getElementById('cameraInput').click());
    document.getElementById('cameraInput').addEventListener('change', e => this.handlePhoto(e));
    document.getElementById('addItemBtn').addEventListener('click', () => this.showModal('item-modal'));
    document.getElementById('saveItemBtn').addEventListener('click', () => this.addItem());
    document.getElementById('cancelItemBtn').addEventListener('click', () => this.hideModal('item-modal'));
  }
  
  async loadCompanies() {
    const r = await fetch('/api/companies');
    this.companies = await r.json();
  }
  
  search(q) {
    const f = q ? this.companies.filter(c => c.name.toLowerCase().includes(q.toLowerCase())) : this.companies;
    this.renderCompanies(f);
  }
  
  renderCompanies(list = this.companies) {
    document.getElementById('companies-list').innerHTML = list.map(c => 
      `<div class="card" onclick="app.showCompany(${c.id})"><h3>${c.name}</h3><p>${c.address}</p></div>`
    ).join('');
  }
  
  showCompany(id) {
    this.currentCompany = this.companies.find(c => c.id == id);
    document.getElementById('detail-name').textContent = this.currentCompany.name;
    document.getElementById('detail-address').textContent = this.currentCompany.address;
    document.getElementById('detail-contact').textContent = this.currentCompany.contact;
    document.getElementById('detail-phone').textContent = this.currentCompany.phone;
    this.showPage('company-detail-page');
  }
  
  async startVisit() {
    const r = await fetch('/api/visits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: this.currentCompany.id, companyName: this.currentCompany.name })
    });
    this.currentVisit = await r.json();
    this.step = 1;
    this.order = { items: [], total: 0 };
    this.showStep(1);
    this.showPage('visit-flow-page');
  }
  
  showStep(n) {
    this.step = n;
    const titles = ['Koordinaty', 'Foto', 'Zametka', 'Zakaz'];
    document.getElementById('visit-step-title').textContent = `Shag ${n}: ${titles[n-1]}`;
    document.getElementById('current-step').textContent = n;
    document.getElementById('prevStepBtn').style.display = n > 1 ? 'block' : 'none';
    document.getElementById('nextStepBtn').textContent = n === 4 ? 'Zavershit' : 'Dalee';
    document.querySelectorAll('.step-content').forEach((el, i) => el.style.display = i + 1 === n ? 'block' : 'none');
  }
  
  nextStep() {
    if (this.step < 4) {
      this.step++;
      this.showStep(this.step);
    } else {
      this.complete();
    }
  }
  
  prevStep() {
    if (this.step > 1) {
      this.step--;
      this.showStep(this.step);
    }
  }
  
  getLocation() {
    const s = document.getElementById('location-status');
    s.textContent = 'Opredelenie...';
    navigator.geolocation.getCurrentPosition(
      p => {
        this.currentVisit.coords = { lat: p.coords.latitude, lng: p.coords.longitude };
        s.textContent = `${p.coords.latitude.toFixed(4)}, ${p.coords.longitude.toFixed(4)}`;
        s.style.color = 'green';
      },
      () => { s.textContent = 'Oshibka'; s.style.color = 'red'; }
    );
  }
  
  async handlePhoto(e) {
    const f = e.target.files[0];
    if (!f) return;
    const d = new FormData();
    d.append('photo', f);
    const r = await fetch(`/api/visits/${this.currentVisit.id}/photos`, { method: 'POST', body: d });
    const data = await r.json();
    if (data.success) {
      document.getElementById('photo-preview').innerHTML = `<img src="${data.url}">`;
      this.toast('Foto dobavleno');
    }
  }
  
  showModal(id) { document.getElementById(id).classList.add('active'); }
  hideModal(id) { document.getElementById(id).classList.remove('active'); }
  
  addItem() {
    const n = document.getElementById('item-name').value;
    const p = parseFloat(document.getElementById('item-price').value);
    const q = parseInt(document.getElementById('item-qty').value);
    if (!n || isNaN(p)) return;
    this.order.items.push({ name: n, price: p, qty: q, total: p * q });
    this.renderOrder();
    this.hideModal('item-modal');
  }
  
  renderOrder() {
    const l = document.getElementById('order-items-list');
    this.order.total = this.order.items.reduce((s, i) => s + i.total, 0);
    l.innerHTML = this.order.items.map((item, idx) => 
      `<div class="order-item"><div><strong>${item.name}</strong><br>${item.qty} x ${item.price} rub</div><div class="order-item-controls"><button class="qty-btn" onclick="app.updateQty(${idx},-1)">-</button><span>${item.qty}</span><button class="qty-btn" onclick="app.updateQty(${idx},1)">+</button><div style="min-width:60px;text-align:right">${item.total} rub</div></div></div>`
    ).join('');
    document.getElementById('order-total-amount').textContent = `${this.order.total} rub`;
  }
  
  updateQty(idx, d) {
    this.order.items[idx].qty = Math.max(1, this.order.items[idx].qty + d);
    this.order.items[idx].total = this.order.items[idx].qty * this.order.items[idx].price;
    this.renderOrder();
  }
  
  async complete() {
    const note = document.getElementById('visit-note').value;
    await fetch(`/api/visits/${this.currentVisit.id}/note`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note })
    });
    await fetch(`/api/visits/${this.currentVisit.id}/order`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order: this.order })
    });
    await fetch(`/api/visits/${this.currentVisit.id}/complete`, { method: 'POST' });
    this.toast('Vizit zavershen!');
    this.showPage('home-page');
  }
  
  showPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
  }
  
  toast(msg) {
    const c = document.getElementById('toast-container');
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
  }
}

const app = new App();
