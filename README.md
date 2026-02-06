# Çay Üreticisi Platformu

Çay üreticileri için dijital platform - Monorepo yapısında NestJS + Vue.js projesi.

## Teknolojiler

### Backend (`apps/api`)
- **Framework:** NestJS 10
- **Database:** PostgreSQL + TypeORM
- **Auth:** JWT (Passport.js)
- **Email:** Mailgun
- **Validation:** class-validator

### Frontend (`apps/web`)
- **Framework:** Vue 3 (Composition API)
- **Build Tool:** Vite
- **State:** Pinia
- **Router:** Vue Router
- **Styling:** Vanilla CSS (Dark Theme)

## Kurulum

### Gereksinimler
- Node.js >= 18
- pnpm >= 8
- PostgreSQL

### Adımlar

```bash
# Bağımlılıkları yükle
pnpm install

# Backend env ayarları
cp apps/api/.env.example apps/api/.env
# .env dosyasını düzenleyin

# Backend geliştirme
pnpm dev:api

# Frontend geliştirme
pnpm dev:web
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Kayıt ol |
| GET | `/api/auth/verify-email` | Email doğrula |
| POST | `/api/auth/login` | Giriş yap |
| POST | `/api/auth/forgot-password` | Şifre sıfırlama |
| POST | `/api/auth/reset-password` | Yeni şifre |
| POST | `/api/auth/change-password` | Şifre değiştir |
| POST | `/api/auth/request-deletion` | Hesap silme talebi |
| POST | `/api/auth/delete-account` | Hesap sil |

## Proje Yapısı

```
cayhesabim/
├── apps/
│   ├── api/          # NestJS Backend
│   │   └── src/
│   │       ├── auth/
│   │       ├── users/
│   │       └── mail/
│   └── web/          # Vue.js Frontend
│       └── src/
│           ├── pages/
│           ├── stores/
│           └── services/
└── packages/         # Shared packages
```

## Docker

### Local Development
```bash
# PostgreSQL + hot-reload enabled
docker-compose up -d

# Logs
docker-compose logs -f
```

- API: http://localhost:3000
- Web: http://localhost:5173
- PostgreSQL: localhost:5432

### Production
```bash
# Create .env from template
cp .env.example .env
# Edit .env with production values

# Build and run
docker-compose -f docker-compose.prod.yml up -d --build
```

## Swagger Dokümantasyonu

API çalışırken: http://localhost:3000/api/docs
