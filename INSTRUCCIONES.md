# 🍽️ Cafetería IES — Arranque rápido

## BACKEND (Django)

```cmd
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_data
python manage.py runserver
```

El servidor arranca en: http://localhost:8000

Cuentas de prueba creadas por seed_data:
- admin / admin123  (rol administrador)
- alumno / alumno123
- profe / profe123

---

## FRONTEND (React + Vite)

Abre otra terminal:

```cmd
cd frontend
npm install
npm run dev
```

La app arranca en: http://localhost:5173

---

## Notas

- La base de datos es SQLite (db.sqlite3), se crea sola al hacer migrate.
- Para producción en Render, configurar la variable DATABASE_URL.
