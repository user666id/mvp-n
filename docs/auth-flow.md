# Auth Flow — авторизация и активация

> Профиль создаётся **только** после успешной активации ключа.
> До этого юзер — анонимный с JWT, но без записи в `users`.

---

## Шаги входа

```
1. Юзер открывает Mini App в Telegram
   │
   ▼
2. Telegram WebApp передаёт initData (HMAC-подпись)
   │
   ▼
3. Frontend → POST /auth/token { init_data }
   │
   ▼
4. API: проверяет HMAC-подпись initData
   API: смотрит существует ли user в БД  (НЕ создаёт)
   API: выдаёт JWT (валидный 30 дней)
   │
   ▼
5. Ответ:
   {
     token: "...",
     user_exists:      false,     ← НЕТ в БД
     needs_activation: true,
     is_admin:         false
   }
   │
   ▼
6. Frontend по флагу needs_activation:
   • true  → показывает ActivationScreen (ввод ключа)
   • false → показывает обычный UI с вкладками
```

## Активация ключа

```
7. Юзер вводит ключ формата XXXX-XXXX → жмёт «Активировать»
   │
   ▼
8. Frontend → POST /auth/key { key } (с JWT)
   │
   ▼
9. API в одной транзакции:
   ├─ Блокирует строку access_keys (FOR UPDATE)
   ├─ Проверяет: used_at IS NULL AND expires_at > NOW()
   ├─ INSERT INTO users (id=TG_ID, internal_id=SERIAL, is_active=true)
   ├─ UPDATE access_keys SET used_by, used_at = NOW()
   └─ COMMIT
   │
   ▼
10. Ответ: { activated: true, internal_id: 0002 }
   Frontend перезагружает auth → needs_activation=false → главный UI
```

## Особые случаи

### Админ (TG ID в `ADMIN_TG_IDS`)
- Пред-создан через `SeedAdmin()` при первом старте API
- `user_exists=true, is_active=true` с самого начала
- Ключ вводить не нужно — сразу попадает в основной UI

### Существующий юзер
- При повторном открытии Mini App → JWT уже в localStorage
- `/auth/token` снова вызывается → видит запись → `needs_activation=false`
- Главный UI без задержки

### Удалил аккаунт
- `DELETE /profile` → строка из `users` удалена (CASCADE)
- При следующем входе → нет записи → нужен новый ключ
- Старый ключ уже использован — не подойдёт

### Ключ просрочен (12ч)
- Cron `cleanupKeys` каждый час удаляет неиспользованные просроченные
- API возвращает `KEY_NOT_FOUND` или `KEY_EXPIRED`
- Юзер просит у админа новый

---

## Что в JWT

```json
{
  "user_id":    123456789,
  "username":   "user666id",
  "first_name": "Alex",
  "last_name":  "",
  "iat":        1748275200,
  "exp":        1750867200
}
```

`username`, `first_name`, `last_name` нужны чтобы `/auth/key` мог создать
запись юзера без повторной проверки initData.

---

## Защита от race condition

При параллельных запросах двух Mini App инстансов с одним TG ID:
- `BEGIN TX`
- `SELECT ... FOR UPDATE` блокирует строку ключа
- Второй вызов ждёт коммита, потом видит `used_at IS NOT NULL` → ошибка
- Только один ключ-юзер биндинг происходит атомарно
