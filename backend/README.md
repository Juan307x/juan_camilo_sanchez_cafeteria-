# 🍽️ Cafetería IES — API con Pasarela de Pago

API REST en Django + DRF para la cafetería escolar, con soporte completo de pagos:
- 💳 **Tarjeta** — guarda tarjetas (al estilo KFC/Domino's), paga con tarjeta guardada o nueva
- 💵 **Efectivo** — registra el pago en caja con cálculo de cambio

---

## 🚀 Instalación

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
python manage.py migrate
python manage.py createsuperuser
python manage.py runserver
```

---

## 🔐 Autenticación (JWT)

### `POST /api/auth/login/`
```json
{ "username": "alumno1", "password": "1234" }
```
Respuesta:
```json
{ "access": "<token>", "refresh": "<token>", "user": {...} }
```
Incluir en cabeceras: `Authorization: Bearer <access_token>`

---

## 💳 Pasarela de Pago

### Tarjetas guardadas

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/api/cards/` | Listar tarjetas del usuario |
| POST | `/api/cards/add/` | Agregar nueva tarjeta |
| DELETE | `/api/cards/<id>/delete/` | Eliminar tarjeta |
| PATCH | `/api/cards/<id>/set-default/` | Marcar como predeterminada |

#### Agregar tarjeta — `POST /api/cards/add/`
```json
{
  "card_number": "4111111111111111",
  "cardholder_name": "Juan Pérez",
  "expiry_month": "12",
  "expiry_year": "2028",
  "cvv": "123",
  "alias": "Mi Visa del banco",
  "is_default": true
}
```
Respuesta (el número completo y CVV **nunca se guardan**):
```json
{
  "id": 1,
  "alias": "Mi Visa del banco",
  "card_last4": "1111",
  "card_brand": "Visa",
  "cardholder_name": "Juan Pérez",
  "expiry_month": "12",
  "expiry_year": "2028",
  "is_default": true,
  "created_at": "2025-05-10T10:00:00Z"
}
```

---

### Pagar un pedido — `POST /api/orders/<id>/pay/`

#### Opción A: Pagar con tarjeta guardada
```json
{
  "method": "card",
  "card_id": 1
}
```

#### Opción B: Pagar con tarjeta nueva (sin guardar)
```json
{
  "method": "card",
  "card_number": "4111111111111111",
  "cardholder_name": "Juan Pérez",
  "expiry_month": "12",
  "expiry_year": "2028",
  "cvv": "123",
  "save_card": false
}
```

#### Opción C: Pagar con tarjeta nueva (guardando)
```json
{
  "method": "card",
  "card_number": "4111111111111111",
  "cardholder_name": "Juan Pérez",
  "expiry_month": "12",
  "expiry_year": "2028",
  "cvv": "123",
  "save_card": true,
  "alias": "Visa trabajo"
}
```

#### Opción D: Pagar en efectivo
```json
{
  "method": "cash",
  "cash_tendered": 20.00
}
```
Respuesta:
```json
{
  "ok": true,
  "message": "Pago en efectivo registrado.",
  "cash_tendered": "20.00",
  "cash_change": "5.50",
  "transaction_ref": "TXN-A1B2C3D4E5F6",
  "order": { ... }
}
```

### Ver detalle del pago — `GET /api/orders/<id>/payment/`

---

## 📦 Flujo completo de ejemplo

```
1. POST /api/auth/login/              → obtienes token
2. GET  /api/products/               → ves el menú
3. POST /api/orders/                 → creas pedido
4. POST /api/cards/add/              → guardas tu tarjeta (opcional)
5. POST /api/orders/3/pay/           → pagas (card o cash)
6. GET  /api/orders/3/payment/       → confirmas el pago
```

---

## 🗺️ Todos los endpoints

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/api/auth/login/` | No | Login |
| POST | `/api/auth/logout/` | Sí | Logout |
| GET | `/api/auth/me/` | Sí | Usuario actual |
| GET | `/api/products/` | No | Listar productos |
| POST | `/api/products/<id>/stock/` | Sí | Actualizar stock |
| GET | `/api/categories/` | No | Listar categorías |
| GET | `/api/timeslots/` | No | Franjas horarias |
| GET | `/api/orders/` | Sí | Mis pedidos (admin: todos) |
| POST | `/api/orders/` | Sí | Crear pedido |
| PATCH | `/api/orders/<id>/` | Sí | Actualizar estado |
| GET | `/api/favorites/` | Sí | Mis favoritos |
| POST | `/api/favorites/<id>/toggle/` | Sí | Toggle favorito |
| GET | `/api/cards/` | Sí | Mis tarjetas |
| POST | `/api/cards/add/` | Sí | Agregar tarjeta |
| DELETE | `/api/cards/<id>/delete/` | Sí | Eliminar tarjeta |
| PATCH | `/api/cards/<id>/set-default/` | Sí | Tarjeta predeterminada |
| POST | `/api/orders/<id>/pay/` | Sí | Pagar pedido |
| GET | `/api/orders/<id>/payment/` | Sí | Detalle de pago |

---

## 🔒 Seguridad de tarjetas

- El número completo de tarjeta y el CVV **nunca se almacenan** en la base de datos.
- Solo se guardan los **últimos 4 dígitos**, la marca y los datos del titular.
- Se genera un **token simulado** (`tok_xxxxx`). En producción, este paso lo realiza la SDK de Stripe, PayU, Redsys, etc.
- Se aplica el **algoritmo de Luhn** para validar el número de tarjeta antes de procesar.

---

## 🏭 Integrar pasarela real (producción)

En `views.py`, la función `pay_order` tiene marcado el punto de integración:

```python
# Reemplazar esta línea:
authorized = True  # simulate_card_authorization(...)

# Por la llamada real a tu pasarela, por ejemplo Stripe:
import stripe
stripe.api_key = settings.STRIPE_SECRET_KEY
charge = stripe.PaymentIntent.create(
    amount=int(order.total * 100),  # en céntimos
    currency="eur",
    payment_method=saved_card.token,
    confirm=True,
)
authorized = charge.status == "succeeded"
```
