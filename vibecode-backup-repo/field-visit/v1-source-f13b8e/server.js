const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.static('public'));

// Хранилище данных визитов (в памяти)
const visits = new Map();

// API Routes

// Получить текущего пользователя
app.get('/api/user', (req, res) => {
  const userId = req.headers['x-user-id'] || '1';
  res.json({
    id: userId,
    name: 'Текущий пользователь',
    role: 'manager'
  });
});

// Получить список компаний
app.get('/api/companies', (req, res) => {
  const search = req.query.search || '';
  const companies = [
    { id: 1, name: 'ООО "ТехноПром"', address: 'г. Москва, ул. Ленина, 1', phone: '+7 (999) 123-45-67' },
    { id: 2, name: 'ЗАО "СтройИнвест"', address: 'г. Санкт-Петербург, Невский пр., 25', phone: '+7 (999) 234-56-78' },
    { id: 3, name: 'ИП Иванов', address: 'г. Казань, ул. Баумана, 10', phone: '+7 (999) 345-67-89' },
    { id: 4, name: 'ООО "МегаТорг"', address: 'г. Новосибирск, Красный пр., 50', phone: '+7 (999) 456-78-90' },
    { id: 5, name: 'АО "ЭнергоСбыт"', address: 'г. Екатеринбург, ул. Малышева, 15', phone: '+7 (999) 567-89-01' }
  ];
  
  const filtered = search 
    ? companies.filter(c => c.name.toLowerCase().includes(search.toLowerCase()))
    : companies;
  
  res.json(filtered);
});

// Получить компанию по ID
app.get('/api/companies/:id', (req, res) => {
  const companies = [
    { id: 1, name: 'ООО "ТехноПром"', address: 'г. Москва, ул. Ленина, 1', phone: '+7 (999) 123-45-67' },
    { id: 2, name: 'ЗАО "СтройИнвест"', address: 'г. Санкт-Петербург, Невский пр., 25', phone: '+7 (999) 234-56-78' },
    { id: 3, name: 'ИП Иванов', address: 'г. Казань, ул. Баумана, 10', phone: '+7 (999) 345-67-89' },
    { id: 4, name: 'ООО "МегаТорг"', address: 'г. Новосибирск, Красный пр., 50', phone: '+7 (999) 456-78-90' },
    { id: 5, name: 'АО "ЭнергоСбыт"', address: 'г. Екатеринбург, ул. Малышева, 15', phone: '+7 (999) 567-89-01' }
  ];
  const company = companies.find(c => c.id === parseInt(req.params.id));
  if (company) {
    res.json(company);
  } else {
    res.status(404).json({ error: 'Компания не найдена' });
  }
});

// Получить разделы каталога
app.get('/api/catalog/sections', (req, res) => {
  const sections = [
    { id: 1, name: 'Электроника', icon: '💻' },
    { id: 2, name: 'Строительные материалы', icon: '🧱' },
    { id: 3, name: 'Офисная мебель', icon: '🪑' },
    { id: 4, name: 'Инструменты', icon: '🔧' },
    { id: 5, name: 'Сантехника', icon: '🚿' }
  ];
  res.json(sections);
});

// Получить товары раздела
app.get('/api/catalog/products', (req, res) => {
  const sectionId = parseInt(req.query.section);
  const products = [
    { id: 1, name: 'Ноутбук Dell XPS 15', price: 120000, sectionId: 1, unit: 'шт' },
    { id: 2, name: 'Монитор 27" LG', price: 35000, sectionId: 1, unit: 'шт' },
    { id: 3, name: 'Клавиатура механическая', price: 8000, sectionId: 1, unit: 'шт' },
    { id: 4, name: 'Цемент М500', price: 450, sectionId: 2, unit: 'мешок' },
    { id: 5, name: 'Кирпич красный', price: 25, sectionId: 2, unit: 'шт' },
    { id: 6, name: 'Песок строительный', price: 3000, sectionId: 2, unit: 'т' },
    { id: 7, name: 'Стол офисный', price: 15000, sectionId: 3, unit: 'шт' },
    { id: 8, name: 'Кресло руководителя', price: 25000, sectionId: 3, unit: 'шт' },
    { id: 9, name: 'Шкаф для документов', price: 12000, sectionId: 3, unit: 'шт' },
    { id: 10, name: 'Дрель ударная Bosch', price: 18000, sectionId: 4, unit: 'шт' },
    { id: 11, name: 'Набор отверток', price: 2500, sectionId: 4, unit: 'набор' },
    { id: 12, name: 'Уровень лазерный', price: 12000, sectionId: 4, unit: 'шт' },
    { id: 13, name: 'Смеситель для кухни', price: 8500, sectionId: 5, unit: 'шт' },
    { id: 14, name: 'Унитаз компакт', price: 12000, sectionId: 5, unit: 'шт' },
    { id: 15, name: 'Душевая кабина', price: 45000, sectionId: 5, unit: 'шт' }
  ];
  
  const filtered = sectionId 
    ? products.filter(p => p.sectionId === sectionId)
    : products;
  
  res.json(filtered);
});

// Создать визит
app.post('/api/visits', (req, res) => {
  const visitId = Date.now().toString();
  const visit = {
    id: visitId,
    ...req.body,
    createdAt: new Date().toISOString(),
    status: 'active'
  };
  visits.set(visitId, visit);
  res.json({ id: visitId, status: 'created' });
});

// Обновить визит
app.put('/api/visits/:id', (req, res) => {
  const visit = visits.get(req.params.id);
  if (visit) {
    Object.assign(visit, req.body, { updatedAt: new Date().toISOString() });
    res.json({ id: req.params.id, status: 'updated' });
  } else {
    res.status(404).json({ error: 'Визит не найден' });
  }
});

// Завершить визит
app.post('/api/visits/:id/complete', (req, res) => {
  const visit = visits.get(req.params.id);
  if (visit) {
    visit.status = 'completed';
    visit.completedAt = new Date().toISOString();
    res.json({ id: req.params.id, status: 'completed' });
  } else {
    res.status(404).json({ error: 'Визит не найден' });
  }
});

// Получить визит
app.get('/api/visits/:id', (req, res) => {
  const visit = visits.get(req.params.id);
  if (visit) {
    res.json(visit);
  } else {
    res.status(404).json({ error: 'Визит не найден' });
  }
});

// Сохранить фото
app.post('/api/visits/:id/photos', (req, res) => {
  const visit = visits.get(req.params.id);
  if (!visit) {
    return res.status(404).json({ error: 'Визит не найден' });
  }
  
  if (!visit.photos) visit.photos = [];
  const photoData = req.body.photo;
  visit.photos.push({
    id: Date.now(),
    data: photoData,
    timestamp: new Date().toISOString()
  });
  
  res.json({ status: 'photo_added', count: visit.photos.length });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Field Visit App running on port ${PORT}`);
});
