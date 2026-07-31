# Mobile Trade App — API Documentation

## Общая информация

**Приложение:** Mobile Trade (Мобильная торговля)  
**Тип:** PWA для торговых представителей  
**Бэкенд:** Node.js + Express + Axios  
**API:** VibeCode REST API (https://vibecode.bitrix24.tech/v1)  
**Порт:** process.env.PORT || 3000  
**Авторизация:** Black Hole Gateway + Bitrix24 OAuth

## Переменные окружения

| Переменная | Описание | Обязательно |
|------------|----------|-------------|
| VIBECODE_API_KEY | API ключ для доступа к VibeCode | ? |
| VIBECODE_APP_KEY | OAuth App Key для мультипользовательской авторизации | ? |
| PORT | Порт сервера | ? (default: 3000) |
| APP_URL | URL приложения | ? |

## Авторизация

### Black Hole Gateway

Gateway автоматически инжектирует заголовки при открытии из Bitrix24:

```
X-Vibe-User-Id: {user_id}
X-Vibe-Portal-Id: {portal_id}
```

Сервер извлекает userId из заголовков и работает от имени пользователя.

### Logout

```
POST /api/logout
```

Завершает сессию. Фронтенд выполняет:
1. Вызов /api/logout
2. Очистка localStorage/sessionStorage
3. Удаление cookies
4. Очистка кэша
5. Отмена Service Worker
6. Редирект на /_gw/logout

---

## Endpoints

### Health Check

```
GET /health
```

**Ответ:**
```json
{ "status": "ok" }
```

### Компании

#### Список компаний

```
GET /api/companies
```

**Параметры:**
- `limit` (опционально) — количество записей (default: 100, max: 1000)
- `search` (опционально) — поисковый запрос

**Ответ:**
```json
{
  "result": [
    {
      "id": 123,
      "title": "ООО Ромашка",
      "phone": "+7...",
      "email": "info@romashka.ru",
      "address": "Москва..."
    }
  ],
  "total": 100
}
```

#### Поиск компаний

```
GET /api/companies/search?q={query}
```

**Параметры:**
- `q` — поисковый запрос (минимум 2 символа)

**Ответ:**
```json
{
  "result": [
    {
      "id": 123,
      "title": "ООО Ромашка",
      "phone": "+7...",
      "email": "info@romashka.ru",
      "address": "Москва..."
    }
  ],
  "total": 10
}
```

#### Компания по ID

```
GET /api/companies/:id
```

**Ответ:**
```json
{
  "result": {
    "id": 123,
    "title": "ООО Ромашка",
    "phone": "+7...",
    "email": "info@romashka.ru",
    "address": "Москва..."
  }
}
```

---

### Каталог

#### Разделы

```
GET /api/sections
```

**Ответ:**
```json
{
  "result": [
    { "id": 1, "name": "Масла", "iblockId": 24 }
  ]
}
```

#### Товары

```
GET /api/products?sectionId={id}
```

**Параметры:**
- `sectionId` (опционально) — ID раздела

**Ответ:**
```json
{
  "result": [
    {
      "id": 100,
      "name": "Моторное масло 5W-30",
      "price": 2500,
      "active": "Y"
    }
  ]
}
```

---

### Задачи

#### Все задачи

```
GET /api/tasks
```

**Параметры:**
- `limit` (опционально) — количество записей (default: 50)
- `sort` (опционально) — сортировка (default: `-createdDate`, новые сначала)

**Ответ:**
```json
{
  "result": [ ... ]
}
```

#### Мои задачи

```
GET /api/my-tasks
```

**Фильтр:** по responsibleId текущего пользователя  
**Сортировка:** по дате создания, новые сначала (`-createdDate`)

**Ответ:**
```json
{
  "success": true,
  "tasks": [ ... ]
}
```

#### Задача по ID

```
GET /api/tasks/:id
```

**Ответ:**
```json
{
  "task": {
    "id": "12345",
    "title": "Визит к клиенту",
    "status": "2",
    "description": "...",
    "deadline": "2026-07-30T12:00:00Z"
  }
}
```

#### Завершить задачу

```
POST /api/tasks/:id/complete
```

**Действие:** Устанавливает статус 5 (закрыта)

**Ответ:**
```json
{
  "success": true,
  "result": { ... }
}
```

#### Комментарий с файлами

```
POST /api/tasks/:id/comment
Content-Type: multipart/form-data
```

**Параметры:**
- `text` — текст комментария
- `files` — файлы (до 5 шт.)

**Логика:**
1. Загрузка файлов на диск в папку FOR_CREATED_FILES
2. Прикрепление файлов к задаче через ufTaskWebdavFiles
3. Создание комментария с BBCode-ссылками

**Ответ:**
```json
{
  "success": true,
  "result": { "id": 875340 }
}
```

#### Комментарии задачи

```
GET /api/tasks/:id/comments
```

**Описание:** Получает комментарии задачи из портала Битрикс24

**Ответ:**
```json
{
  "success": true,
  "comments": [
    {
      "id": 123,
      "author": { "name": "Иван", "lastName": "Иванов" },
      "message": "Текст комментария",
      "createdAt": "2026-07-30T12:00:00Z",
      "ufTaskWebdavFiles": []
    }
  ]
}
```

#### Задача компании

```
GET /api/tasks/:companyId
```

**Описание:** Находит открытую задачу для компании (по ufCrmTask)

**Ответ:**
```json
{
  "task": { ... } | null
}
```

---

### Визиты

#### Создать визит

```
POST /api/visit
Content-Type: multipart/form-data
```

**Параметры:**
- `companyId` — ID компании
- `subject` — тема
- `description` — описание
- `noteText` — заметки
- `closeVisit` — true/false
- `groupId` — ID группы (опционально)
- `location` — JSON с координатами (опционально)
- `orderData` — JSON с заказом (опционально)
- `photos` — фото (до 10 шт.)

**Логика:**
1. Поиск существующей открытой задачи для компании
2. Если нет — создание новой задачи
3. Формирование описания с заметками, геолокацией, заказом
4. Загрузка фото на диск
5. Прикрепление фото к задаче
6. Добавление комментария
7. Если closeVisit=true — закрытие задачи
8. Если есть заказ — создание подзадачи с Excel-файлом

**Ответ:**
```json
{
  "success": true,
  "taskId": "174962",
  "isNewTask": true,
  "uploadedFiles": 3,
  "closed": false,
  "orderSubtaskId": null
}
```

---


---

### Отчеты

#### Статистика визитов

```
GET /api/reports/stats?period={period}
```

**Параметры:**
- `period` — период: `today` | `week` | `month`

**Описание:** Подсчитывает количество визитов (задач с ufCrmTask) за указанный период для текущего пользователя

**Ответ:**
```json
{
  "success": true,
  "totalVisits": 5,
  "period": "today"
}
```

#### Генерация маршрута

```
POST /api/reports/route
Content-Type: application/x-www-form-urlencoded
```

**Параметры:**
- `date` — дата в формате DD.MM.YYYY (опционально, по умолчанию сегодня)
- `groupId` — ID рабочей группы для задачи-маршрута (опционально)

**Описание:**
1. Находит задачи-визиты за указанную дату
2. Извлекает координаты из описаний задач
3. Генерирует HTML-карту с маршрутом (Leaflet)
4. Создаёт задачу с прикреплённым HTML-файлом

**Ответ:**
```json
{
  "success": true,
  "taskId": "12345",
  "fileId": 67890,
  "pointsCount": 3,
  "date": "31.07.2026"
}
```

---

### Пользователь

#### Текущий пользователь

```
GET /api/me
```

**Ответ:**
```json
{
  "data": {
    "currentUser": {
      "id": 10,
      "name": "Иван",
      "lastName": "Иванов",
      "email": "ivanov@company.ru"
    }
  }
}
```

#### Контекст пользователя

```
GET /api/user-context
```

**Ответ:**
```json
{
  "user": { ... },
  "workgroups": [ ... ],
  "departmentHead": { ... }
}
```

---

## Структуры данных

### Task (Задача)

| Поле | Тип | Описание |
|------|-----|----------|
| id | string | ID задачи |
| title | string | Название |
| description | string | Описание |
| status | string | 1=новая, 2=в работе, 3=выполнена, 4=отложена, 5=закрыта |
| responsibleId | string | ID ответственного |
| groupId | string | ID рабочей группы |
| ufCrmTask | array | Связанные CRM-сущности |
| ufTaskWebdavFiles | array | Прикрепленные файлы |
| createdDate | string | Дата создания |
| deadline | string | Крайний срок |

### Company (Компания)

| Поле | Тип | Описание |
|------|-----|----------|
| id | number | ID |
| title | string | Название |
| phone | string | Телефон |
| email | string | Email |
| address | string | Адрес |

### Product (Товар)

| Поле | Тип | Описание |
|------|-----|----------|
| id | number | ID |
| name | string | Название |
| price | number | Цена |
| sectionId | number | ID раздела |
| active | string | Y/N |

---

## PWA Функции

### Геолокация

```javascript
// Запрос разрешения и получение координат
async function getLocation() {
  // Проверяет разрешение через Permissions API
  // Запрашивает геолокацию с высокой точностью
  // Показывает инструкции при отказе (iOS/Android)
}
```

**Параметры запроса:**
- `enableHighAccuracy: true`
- `timeout: 15000`
- `maximumAge: 0`

### Service Worker

- Кэширование статических ресурсов
- Версионирование кэша (mobile-trade-v2)
- Принудительное обновление при новой версии

### Оффлайн-режим

- Кэширование компаний (localStorage)
- Кэширование товаров
- Fallback на локальные данные при недоступности API

---

## Ошибки

### DISK_OBJ_22000
Файл с таким именем уже существует. **Решение:** Добавить timestamp к имени файла.

### 422 VALIDATION_ERROR
Неверные параметры запроса. **Решение:** Проверить формат данных.

### 500 Internal Server Error
Ошибка сервера. **Решение:** Проверить .env и VIBECODE_API_KEY.

### PERMISSION_DENIED (Geolocation)
Доступ к геолокации запрещён. **Решение:** Проверить настройки приватности устройства.

---

## Деплой

### Требования
- package.json с scripts.start
- Сервер слушает process.env.PORT || 3000
- Файл .env с VIBECODE_API_KEY

### URL
```
https://app-116f18205548.vibecode.bitrix24.tech
```

---

## История изменений

| Дата | Версия | Изменение |
|------|--------|-----------|
| 2026-07-31 | v1.4.1 | Добавлены endpoint'ы комментариев, отчетов и маршрутов |
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

