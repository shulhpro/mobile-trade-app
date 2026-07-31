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
- ✅ **Задачи в Битрикс24** — просмотр, завершение и комментарии
- 📊 **Отчеты** — статистика визитов (день/неделя/месяц)
- 🗺️ **Маршруты** — генерация HTML-карты с маршрутом по клиентам
- 📁 **Проекты** — выбор рабочей группы для задач
- 🎨 **Премиальный дизайн** — темная тема в стиле Industrial Premium
- 🔐 **Авторизация через Bitrix24** — вход через Black Hole Gateway
- 🚪 **Выход из сессии** — полный logout с очисткой всех данных

## 🚀 Быстрый старт

``ash
# Установка зависимостей
npm install

# Запуск в режиме разработки
npm start

# Приложение будет доступно на http://localhost:3000
`

## 🔧 Переменные окружения

Создайте файл .env:

`env
# VibeCode API Key (обязательно)
VIBECODE_API_KEY=vibe_api_...

# OAuth App Key (для мультипользовательской авторизации)
VIBECODE_APP_KEY=vibe_app_local_...

# URL приложения (опционально)
APP_URL=https://app-116f18205548.vibecode.bitrix24.tech

# Порт (опционально, по умолчанию 3000)
PORT=3000
`

## 🏗 Архитектура

`
📦 mobile-trade-app
├── 📁 public/
│   ├── 📄 index.html          # Главная страница
│   ├── 📁 css/
│   │   └── 🎨 style.css       # Стили (Dark Premium Industrial)
│   ├── 📁 js/
│   │   └── ⚡ app.js          # Логика фронтенда
│   ├── 📄 manifest.json       # PWA манифест
│   └── 📄 sw.js               # Service Worker
├── 📄 server.js               # Express сервер
├── 📄 package.json            # Зависимости
├── 📄 .env                    # Конфигурация API
├── 📄 API.md                  # Документация API
└── 📄 README.md               # Этот файл
`

## 🔐 Авторизация

Приложение использует **Black Hole Gateway** для авторизации через Bitrix24:

1. Пользователь открывает приложение по ссылке
2. Black Hole Gateway перенаправляет на Bitrix24 OAuth
3. После успешной авторизации Gateway инжектирует заголовки:
   - X-Vibe-User-Id — ID пользователя
   - X-Vibe-Portal-Id — ID портала
4. Сервер извлекает userId из заголовков и работает от имени пользователя

### Выход из сессии

Нажмите кнопку 🚪 в шапке приложения. Происходит:
1. Очистка серверной сессии
2. Очистка localStorage и sessionStorage
3. Удаление всех cookies
4. Очистка кэша приложения
5. Отмена регистрации Service Worker
6. Перенаправление на /_gw/logout (страница входа)

## 🛠 Технологии

- **Backend:** Node.js + Express + Axios
- **Frontend:** Vanilla JavaScript (ES6+)
- **Styling:** CSS3 с CSS Variables (Dark Premium Industrial)
- **API:** VibeCode REST API (Bitrix24)
- **Auth:** Black Hole Gateway + Bitrix24 OAuth
- **Deploy:** VibeCode Platform

## 📡 API Endpoints

| Endpoint | Метод | Описание |
|----------|-------|----------|
| /health | GET | Проверка работоспособности |
| /api/companies | GET | Список компаний |
| /api/sections | GET | Разделы каталога |
| /api/products | GET | Товары |
| /api/tasks | GET | Все задачи |
| /api/my-tasks | GET | Мои задачи |
| /api/tasks/:id | GET | Детали задачи |
| /api/tasks/:id/complete | POST | Завершить задачу |
| /api/tasks/:id/comment | POST | Комментарий с файлами |
| /api/tasks/:id/comments | GET | Комментарии задачи |
| /api/visit | POST | Создать визит |
| /api/me | GET | Текущий пользователь |
| /api/user-context | GET | Контекст пользователя |
| /api/logout | POST | Выход из сессии |
| /api/reports/stats | GET | Статистика визитов |
| /api/reports/route | POST | Генерация маршрута |

Подробная документация в [API.md](API.md)

## 🌐 Демо

🔗 [Открыть приложение](https://app-116f18205548.vibecode.bitrix24.tech)

## 📝 Лицензия

MIT © 2026



## 📋 История изменений

| Дата | Версия | Изменение |
|------|--------|-----------|
| 2026-07-31 | v1.4.1 | Актуализирована документация API и README |
| 2026-07-30 | v1.4 | Добавлен раздел Отчеты (статистика + маршруты) |
| 2026-07-30 | v1.4 | Добавлены комментарии задач из портала |
| 2026-07-30 | v1.4 | Добавлен выбор проекта для задач |
| 2026-07-30 | v1.3 | Добавлен поиск компаний через API |
| 2026-07-30 | v1.3 | Сортировка задач: новые сначала |
| 2026-07-30 | v1.3 | Улучшена геолокация с запросом разрешения |
| 2026-07-28 | v1.2 | Добавлена авторизация через Black Hole Gateway |
| 2026-07-28 | v1.2 | Добавлена функция logout |
| 2026-07-28 | v1.2 | Добавлены endpoint'ы задач |
| 2026-07-26 | v1.1 | Исправлена загрузка файлов (timestamp) |
| 2026-07-25 | v1.0 | Первоначальная версия |
