# 🏭 Мобильная торговля

[![PWA](https://img.shields.io/badge/PWA-Ready-blueviolet?logo=pwa)](https://app-116f18205548.vibecode.bitrix24.tech)
[![Bitrix24](https://img.shields.io/badge/Bitrix24-Integrated-00aeef?logo=bitrix24)](https://www.bitrix24.ru/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org/)

> 📱 PWA-приложение для торговых представителей с интеграцией Битрикс24

## ✨ Возможности

- 🏢 **Управление компаниями** — просмотр списка клиентов из CRM Битрикс24
- 📍 **Геолокация** — автоматическое определение координат при визите
- 📸 **Фотоотчеты** — прикрепление фотографий к визиту
- 📝 **Заметки** — текстовые заметки по результатам встречи
- 🛒 **Заказы** — оформление заказа с выбором товаров из каталога
- ✅ **Задачи в Битрикс24** — автоматическое создание задач по визиту
- 🎨 **Премиальный дизайн** — темная тема в стиле Industrial Premium

## 🚀 Быстрый старт

```bash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm start

# Приложение будет доступно на http://localhost:3000
```

## 🏗 Архитектура

```
📦 mobile-trade-app
├── 📁 public/
│   ├── 📄 index.html          # Главная страница
│   ├── 📁 css/
│   │   └── 🎨 style.css       # Стили (Dark Premium)
│   ├── 📁 js/
│   │   └── ⚡ app.js          # Логика фронтенда
│   ├── 📄 manifest.json       # PWA манифест
│   └── 📄 sw.js               # Service Worker
├── 📄 server.js               # Express сервер
├── 📄 package.json            # Зависимости
└── 📄 .env                    # Конфигурация API
```

## 🔧 Технологии

- **Backend:** Node.js + Express
- **Frontend:** Vanilla JavaScript (ES6+)
- **Styling:** CSS3 с CSS Variables
- **API:** Bitrix24 REST API
- **Deploy:** VibeCode Platform

## 🌐 Демо

🔗 [Открыть приложение](https://app-116f18205548.vibecode.bitrix24.tech)

## 📄 Лицензия

MIT © 2026