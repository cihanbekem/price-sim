# Dijital Etiket ve Market Asistanı

FastAPI tabanlı dijital etiket yönetim sistemi.

## Docker ile Çalıştırma

### Hızlı Başlangıç

```bash
# Projeyi klonlayın
git clone <https://github.com/cihanbekem/price-sim.git>
cd price-sim

# Docker Compose ile çalıştırın
docker-compose up -d

# Uygulama http://localhost:8000 adresinde çalışacak
```

### Manuel Docker Build

```bash
# Image build edin
docker build -t price-sim .

# Container çalıştırın
docker run -d \
  --name price-sim \
  -p 8000:8000 \
  -v $(pwd)/data:/data \
  -e DATABASE_URL=sqlite+aiosqlite:////data/app.db \
  -e APP_SECRET=your-secret-key-here \
  price-sim
```

## Ortam Değişkenleri

- `DATABASE_URL`: SQLite veritabanı URL'i (varsayılan: `sqlite+aiosqlite:///./esl.db`)
- `APP_SECRET`: JWT token imzalama için gizli anahtar
- `GOOGLE_CLIENT_ID`: Google OAuth için Client ID (opsiyonel)

## Veritabanı

SQLite veritabanı `/data` volume'unda saklanır. Container yeniden başlatıldığında veriler korunur.

## API Dokümantasyonu

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Özellikler

- ✅ Kullanıcı kimlik doğrulama (local + Google)
- ✅ Ürün ve etiket yönetimi
- ✅ Fiyat değişikliği onay süreci
- ✅ Canlı metrikler ve WebSocket
- ✅ Dijital etiket simülasyonu
- ✅ Responsive web arayüzü


# Çalıştırma
LIVE_DEBUG_DB=1 uvicorn app.main:app --reload



# Uygulama Görüntüleri
<img width="1502" height="796" alt="Ekran Resmi 2025-08-29 15 52 16" src="https://github.com/user-attachments/assets/5578a92e-86c0-48b6-9b30-5c9e168e0e67" />
<img width="1503" height="793" alt="Ekran Resmi 2025-08-29 15 52 32" src="https://github.com/user-attachments/assets/8609d256-3c7b-40e2-9112-17eebfd4ab3d" />
<img width="1509" height="787" alt="Ekran Resmi 2025-08-29 15 52 46" src="https://github.com/user-attachments/assets/5aa55065-5753-4b24-ac76-fe2d1ef57fde" />
<img width="1504" height="791" alt="Ekran Resmi 2025-08-29 15 53 01" src="https://github.com/user-attachments/assets/79f74a24-e9ff-40d1-a150-7617efa1b501" />
<img width="1506" height="796" alt="Ekran Resmi 2025-08-29 15 53 13" src="https://github.com/user-attachments/assets/848ee26c-eea8-42e2-8ae1-62d6742ef161" />
<img width="1506" height="797" alt="Ekran Resmi 2025-08-29 15 53 29" src="https://github.com/user-attachments/assets/e4d5d77f-44f9-4d6a-98dc-b5774ef7a474" />
<img width="516" height="352" alt="Ekran Resmi 2025-08-29 15 57 49" src="https://github.com/user-attachments/assets/8c4376fe-cc38-4b37-9d4b-7c329cf8bd15" />
<img width="511" height="287" alt="Ekran Resmi 2025-08-29 15 58 01" src="https://github.com/user-attachments/assets/f559a2df-7b51-4007-94d3-2ec6aec52a37" />
