# Deploy notes (Nginx, static)

## 1) Build

```bash
npm install
npm run build
```

Готовая статика будет в папке `dist/`.

## 2) Nginx config snippet

```nginx
server {
    listen 80;
    server_name your-domain.example;

    root /var/www/edu-game/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /assets/ {
        expires 7d;
        add_header Cache-Control "public";
    }
}
```

## 3) Verify

1. Открыть главную страницу.
2. Пройти путь: первый вход -> никнейм -> игра -> итоги -> прогресс.
3. Обновить страницу и убедиться, что данные сохранены.
