# Mobile Trade App — Серверная документация

## Общая информация

**Приложение:** Mobile Trade (Мобильная торговля)  
**Тип:** PWA (Progressive Web App) для торговых представителей  
**Бэкенд:** Node.js + Express  
**API:** VibeCode Entity API (https://vibecode.bitrix24.tech/v1)  
**Порт:** `process.env.PORT || 3000`  

## Переменные окружения (.env)

| Переменная | Описание | Пример |
|------------|----------|--------|
| `VIBECODE_API_KEY` | API ключ для доступа к VibeCode | `vibe_api_...` |
| `PORT` | Порт сервера (опционально) | `3000` |
| `NODE_ENV` | Режим работы | `production` |

## Базовый URL API

```
VIBECODE_API = 'https://vibecode.bitrix24.tech/v1'
```

---

## Endpoints

### 1. Health Check

```
GET /health
```

**Описание:** Проверка работоспособности сервера (используется при деплое)  
**Ответ:**
```json
{
  "status": "ok",
  "timestamp": "2026-07-26T12:00:00.000Z"
}
```

---

### 2. Главная страница

```
GET /
```

**Описание:** Отдает `index.html` из папки `public`  
**Ответ:** HTML страница приложения

---

### 3. Текущий пользователь

```
GET /api/session
```

**Описание:** Получение данных текущего авторизованного пользователя  
**Ответ:**
```json
{
  "success": true,
  "user": {
    "id": 10,
    "name": "Иван",
    "lastName": "Иванов",
    "email": "ivanov@company.ru"
  }
}
```

---

### 4. Контекст пользователя

```
GET /api/user-context
```

**Описание:** Получение расширенного контекста пользователя (рабочие группы, отдел)  
**Ответ:**
```json
{
  "user": { ... },
  "workgroups": [ ... ],
  "department": { ... }
}
```

---

### 5. Список компаний

```
GET /api/companies
```

**Описание:** Получение списка компаний из CRM  
**Параметры:** `limit=100`, `select=id,title,phone,email,address`  
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
  ]
}
```

---

### 6. Разделы каталога

```
GET /api/sections
```

**Описание:** Получение разделов товарного каталога  
**Фильтр:** `iblockId=24`  
**Ответ:**
```json
{
  "result": [
    {
      "id": 1,
      "name": "Масла",
      "iblockId": 24
    }
  ]
}
```

---

### 7. Товары по разделу

```
GET /api/products?sectionId={id}
```

**Описание:** Получение списка товаров (опционально по разделу)  
**Параметры:**
- `sectionId` (опционально) — ID раздела каталога
**Фильтр:** `active=Y`, `limit=100`  
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

### 8. Список задач

```
GET /api/tasks
GET /api/my-tasks
```

**Описание:** Получение задач текущего пользователя  
**Фильтр:** `responsibleId={userId}`, `limit=50`, сортировка по ID DESC  
**Ответ `/api/tasks`:**
```json
{
  "result": [ ... ]
}
```
**Ответ `/api/my-tasks`:**
```json
{
  "success": true,
  "tasks": [ ... ]
}
```

---

### 9. Детали задачи

```
GET /api/tasks/:id
```

**Описание:** Получение детальной информации о задаче  
**Параметры:** `id` — ID задачи  
**Ответ:**
```json
{
  "task": {
    "id": "12345",
    "title": "Визит к клиенту",
    "status": "2",
    "description": "...",
    "ufTaskWebdavFiles": [20288]
  }
}
```

---

### 10. Завершение задачи

```
POST /api/tasks/:id/complete
```

**Описание:** Закрытие задачи (установка статуса 5)  
**Параметры:** `id` — ID задачи  
**Ответ:**
```json
{
  "success": true,
  "result": { ... }
}
```

---

### 11. Комментарий к задаче с файлами

```
POST /api/tasks/:id/comment
Content-Type: multipart/form-data
```

**Описание:** Добавление комментария к задаче с прикреплением файлов  
**Параметры:**
- `id` — ID задачи (в URL)
- `text` — текст комментария
- `files` — файлы (multipart, до 5 файлов)

**Логика работы:**
1. Получает `folderId` папки `FOR_CREATED_FILES` на диске пользователя
2. Загружает каждый файл на диск через `/files/upload`
3. Прикрепляет файлы к задаче через `ufTaskWebdavFiles` (формат `n{fileId}`)
4. Создает комментарий с BBCode-ссылками на файлы

**Ответ:**
```json
{
  "success": true,
  "result": {
    "id": 875340
  }
}
```

---

### 12. Создание визита

```
POST /api/visit
Content-Type: multipart/form-data
```

**Описание:** Создание визита к клиенту (создает задачу в Битрикс24)  
**Параметры (form-data):**
- `companyId` — ID компании
- `subject` — тема визита
- `description` — описание/комментарий
- `noteText` — заметки
- `closeVisit` — `true`/`false` (закрыть задачу сразу)
- `groupId` — ID рабочей группы (опционально)
- `location` — JSON с геолокацией (опционально)
- `orderData` — JSON с данными заказа (опционально)
- `photos` — файлы фото (multipart, до 10 файлов)

**Логика работы:**
1. Создает задачу через `POST /tasks`
2. Формирует описание задачи с заметками, геолокацией, заказом
3. Получает `folderId` папки `FOR_CREATED_FILES`
4. Загружает фото на диск (с уникальным timestamp в имени)
5. Прикрепляет фото к задаче через `ufTaskWebdavFiles`
6. Добавляет комментарий с BBCode-ссылками на фото
7. Если `closeVisit=true` — закрывает задачу (статус 5)

**Ответ:**
```json
{
  "success": true,
  "taskId": "174962",
  "closed": true
}
```

---

## Вспомогательные функции

### getCurrentUser()

```javascript
async function getCurrentUser()
```

**Описание:** Получает текущего пользователя через `GET /users/me`  
**Возвращает:** Объект пользователя (`data.data`)  
**Используется:** Во всех endpoints для определения `responsibleId`

---

### getUserDiskFolderId()

```javascript
async function getUserDiskFolderId()
```

**Описание:** Находит папку `FOR_CREATED_FILES` на диске пользователя  
**Логика:**
1. Получает `user.id`
2. Ищет хранилище пользователя (`storages?entityType=user&entityId={id}`)
3. Получает `rootFolderId` хранилища
4. Ищет папку с кодом `FOR_CREATED_FILES` внутри корневой
5. Если не найдена — возвращает `rootFolderId`

**Возвращает:** `folderId` (число, например `86648`)  
**Важно:** Папка `FOR_CREATED_FILES` нужна для загрузки файлов, которые можно прикрепить к задачам

---

### uploadFileToDisk(filename, base64Content, folderId)

```javascript
async function uploadFileToDisk(filename, base64Content, folderId)
```

**Описание:** Загружает файл на диск Битрикс24  
**Параметры:**
- `filename` — имя файла (добавляется timestamp для уникальности)
- `base64Content` — содержимое файла в base64
- `folderId` — ID папки на диске

**Endpoint:** `POST /files/upload`  
**Тело запроса:**
```json
{
  "filename": "1753514523456_image.jpg",
  "content": "base64...",
  "folderId": 86648
}
```

**Важно:** К имени файла добавляется `Date.now()` для избежания ошибки `DISK_OBJ_22000` (файл с таким именем уже существует)

**Возвращает:** Объект файла с полями `id`, `name`, `downloadUrl`, `detailUrl`

---

### attachFilesToTask(taskId, fileIds)

```javascript
async function attachFilesToTask(taskId, fileIds)
```

**Описание:** Прикрепляет файлы к задаче через пользовательское поле `ufTaskWebdavFiles`  
**Параметры:**
- `taskId` — ID задачи
- `fileIds` — массив ID файлов (числа)

**Endpoint:** `PATCH /tasks/{taskId}`  
**Тело запроса:**
```json
{
  "ufTaskWebdavFiles": ["n93692", "n93693"]
}
```

**Важно:** Формат значений — строка с префиксом `n` (например, `"n93692"`)

**Возвращает:** Обновленный объект задачи

---

## Структура данных

### Задача (Task)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | string | ID задачи |
| `title` | string | Название |
| `description` | string | Описание |
| `status` | string | Статус: 1=новая, 2=в работе, 3=выполнена, 4=отложена, 5=закрыта |
| `responsibleId` | string | ID ответственного |
| `groupId` | string | ID рабочей группы |
| `ufTaskWebdavFiles` | array | Прикрепленные файлы (ID) |
| `createdDate` | string | Дата создания |
| `deadline` | string | Крайний срок |

### Файл (DiskFile)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | number | ID файла |
| `name` | string | Имя файла |
| `folderId` | number | ID папки |
| `storageId` | number | ID хранилища |
| `downloadUrl` | string | URL для скачивания |
| `detailUrl` | string | URL детальной страницы |
| `size` | number | Размер в байтах |
| `createdBy` | number | ID создателя |

### Компания (Company)

| Поле | Тип | Описание |
|------|-----|----------|
| `id` | number | ID компании |
| `title` | string | Название |
| `phone` | string | Телефон |
| `email` | string | Email |
| `address` | string | Адрес |

---

## Ошибки и их решения

### DISK_OBJ_22000

**Причина:** Файл с таким именем уже существует в папке на диске  
**Решение:** Добавить уникальный префикс (timestamp) к имени файла перед загрузкой

### 422 VALIDATION_ERROR

**Причина:** Неверные параметры запроса  
**Решение:** Проверить формат данных, особенно `ufTaskWebdavFiles` (должен быть массив строк с префиксом `n`)

### 500 Internal Server Error

**Причина:** Ошибка на сервере (часто из-за отсутствия `.env` или `VIBECODE_API_KEY`)  
**Решение:** Проверить наличие переменных окружения

---

## Деплой

### Требования

- `package.json` с `scripts.start`
- Сервер слушает `process.env.PORT || 3000`
- Файл `.env` с `VIBECODE_API_KEY`

### Процесс деплоя

1. Код пушится в GitHub
2. Через VibeCode API вызывается `POST /v1/infra/servers/{id}/deploy`
3. Параметры деплоя:
   - `source.url` — URL архива с GitHub
   - `start` — `node server.js`
   - `install` — `npm install`
   - `env.VIBECODE_API_KEY` — API ключ
   - `healthPath` — `/health`

### URL приложения

```
https://app-116f18205548.vibecode.bitrix24.tech
```

---

## История изменений

| Дата | Изменение |
|------|-----------|
| 2026-07-26 | Добавлено уникальное имя файла (timestamp) для исправления DISK_OBJ_22000 |
| 2026-07-26 | Добавлено логирование запросов и ошибок |
| 2026-07-25 | Исправлена структура server.js, добавлен /health endpoint |
| 2026-07-25 | Переход на VibeCode Entity API |
| 2026-07-22 | Первоначальная версия |
