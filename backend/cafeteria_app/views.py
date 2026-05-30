import random
import string
import uuid
from decimal import Decimal
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .models import (UserProfile, Category, Product, TimeSlot,
                     Order, OrderItem, Favorite, SavedCard, Payment)
from .serializers import (UserSerializer, CategorySerializer, ProductSerializer,
                          TimeSlotSerializer, OrderSerializer, FavoriteSerializer,
                          SavedCardSerializer, SavedCardCreateSerializer, PaymentSerializer)


def generate_code():
    return "#" + "".join(random.choices(string.digits, k=6))


def generate_transaction_ref():
    return f"TXN-{uuid.uuid4().hex[:12].upper()}"


# ─── AUTH ─────────────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([AllowAny])
def register_view(request):
    """Registro con correo electrónico, nombre y contraseña."""
    email      = request.data.get("email", "").strip().lower()
    first_name = request.data.get("first_name", "").strip()
    last_name  = request.data.get("last_name", "").strip()
    password   = request.data.get("password", "").strip()
    role       = request.data.get("role", "alumno")

    if not email or not password or not first_name:
        return Response({"error": "Nombre, correo y contraseña son obligatorios."}, status=400)
    if len(password) < 6:
        return Response({"error": "La contraseña debe tener al menos 6 caracteres."}, status=400)
    if "@" not in email:
        return Response({"error": "Correo electrónico no válido."}, status=400)
    if User.objects.filter(email=email).exists():
        return Response({"error": "Ya existe una cuenta con este correo."}, status=400)

    # Usar el email como username (único)
    username = email
    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
    )
    UserProfile.objects.create(user=user, role=role if role in ('admin', 'alumno') else 'alumno')

    refresh = RefreshToken.for_user(user)
    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    }, status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def login_view(request):
    """Login con correo electrónico y contraseña."""
    email    = request.data.get("email", "").strip().lower()
    password = request.data.get("password", "").strip()

    if not email or not password:
        return Response({"error": "Correo y contraseña son obligatorios."}, status=400)

    # Buscar usuario por email
    try:
        user_obj = User.objects.get(email=email)
    except User.DoesNotExist:
        return Response({"error": "No existe ninguna cuenta con ese correo."}, status=401)

    user = authenticate(request, username=user_obj.username, password=password)
    if not user:
        return Response({"error": "Contraseña incorrecta."}, status=401)

    refresh = RefreshToken.for_user(user)
    return Response({
        "access": str(refresh.access_token),
        "refresh": str(refresh),
        "user": UserSerializer(user).data,
    })


@api_view(["POST"])
def logout_view(request):
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me_view(request):
    return Response(UserSerializer(request.user).data)


# ─── PRODUCTS / CATEGORIES / TIMESLOTS ────────────────────────────────────────

@api_view(["GET"])
@permission_classes([AllowAny])
def products_list(request):
    products = Product.objects.filter(available=True).select_related("category")
    return Response(ProductSerializer(products, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def create_product(request):
    if not request.user.is_staff:
        return Response({"error": "Sin permisos"}, status=403)
    name     = request.data.get("name", "").strip()
    price    = request.data.get("price")
    emoji    = request.data.get("emoji", "🍽️").strip()
    stock    = request.data.get("stock", 10)
    healthy  = request.data.get("healthy", False)
    cat_id   = request.data.get("category")

    if not name or not price:
        return Response({"error": "Nombre y precio son obligatorios"}, status=400)
    if Product.objects.filter(name__iexact=name).exists():
        return Response({"error": f"Ya existe un producto llamado '{name}'"}, status=400)

    category = None
    if cat_id:
        try:
            category = Category.objects.get(pk=cat_id)
        except Category.DoesNotExist:
            return Response({"error": "Categoría no encontrada"}, status=404)

    product = Product.objects.create(
        name=name, price=price, emoji=emoji,
        stock=int(stock), healthy=bool(healthy),
        category=category, available=True,
    )
    return Response(ProductSerializer(product).data, status=201)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def delete_product(request, pk):
    if not request.user.is_staff:
        return Response({"error": "Sin permisos"}, status=403)
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado"}, status=404)
    product.available = False  # soft delete para no romper pedidos existentes
    product.save()
    return Response({"ok": True})


@api_view(["POST"])
def update_stock(request, pk):
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado"}, status=404)
    product.stock = max(0, int(request.data.get("stock", 0)))
    product.save()
    return Response(ProductSerializer(product).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def categories_list(request):
    return Response(CategorySerializer(Category.objects.all(), many=True).data)


@api_view(["GET"])
@permission_classes([AllowAny])
def timeslots_list(request):
    return Response(TimeSlotSerializer(TimeSlot.objects.all(), many=True).data)


# ─── ORDERS ───────────────────────────────────────────────────────────────────

@api_view(["GET", "POST"])
def orders_list(request):
    if request.method == "GET":
        if not request.user.is_authenticated:
            return Response([])
        try:
            role = request.user.profile.role
        except Exception:
            role = "alumno"
        if role == "admin":
            orders = (Order.objects.all()
                      .prefetch_related("items__product")
                      .select_related("time_slot", "user", "payment__saved_card")
                      .order_by("-created_at"))
        else:
            orders = (Order.objects.filter(user=request.user)
                      .prefetch_related("items__product")
                      .select_related("time_slot", "payment__saved_card")
                      .order_by("-created_at"))
        return Response(OrderSerializer(orders, many=True).data)

    if not request.user.is_authenticated:
        return Response({"error": "Debes iniciar sesión"}, status=401)
    time_slot_id = request.data.get("time_slot_id")
    items_data   = request.data.get("items", [])
    if not time_slot_id or not items_data:
        return Response({"error": "Faltan datos"}, status=400)
    try:
        slot = TimeSlot.objects.get(pk=time_slot_id)
    except TimeSlot.DoesNotExist:
        return Response({"error": "Franja horaria no válida"}, status=400)

    order = Order.objects.create(
        user=request.user, code=generate_code(), time_slot=slot, status="pending")
    total = Decimal("0")
    for item in items_data:
        try:
            product = Product.objects.get(pk=item["product_id"])
        except Product.DoesNotExist:
            continue
        qty = int(item.get("quantity", 1))
        OrderItem.objects.create(order=order, product=product, quantity=qty, price=product.price)
        total += product.price * qty
        product.stock = max(0, product.stock - qty)
        product.save()
    order.total = total
    order.save()
    return Response(OrderSerializer(order).data, status=201)


@api_view(["PATCH"])
def order_detail(request, pk):
    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return Response({"error": "Pedido no encontrado"}, status=404)
    new_status = request.data.get("status")
    if new_status:
        order.status = new_status
        order.save()
    return Response(OrderSerializer(order).data)


# ─── FAVORITES ────────────────────────────────────────────────────────────────

@api_view(["GET"])
def favorites_list(request):
    if not request.user.is_authenticated:
        return Response([])
    favs = Favorite.objects.filter(user=request.user).select_related("product")
    return Response(FavoriteSerializer(favs, many=True).data)


@api_view(["POST"])
def toggle_favorite(request, pk):
    if not request.user.is_authenticated:
        return Response({"error": "No autenticado"}, status=401)
    try:
        product = Product.objects.get(pk=pk)
    except Product.DoesNotExist:
        return Response({"error": "Producto no encontrado"}, status=404)
    fav, created = Favorite.objects.get_or_create(user=request.user, product=product)
    if not created:
        fav.delete()
        return Response({"favorited": False})
    return Response({"favorited": True})


# ─── SAVED CARDS ──────────────────────────────────────────────────────────────

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def cards_list(request):
    cards = SavedCard.objects.filter(user=request.user)
    return Response(SavedCardSerializer(cards, many=True).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def cards_add(request):
    serializer = SavedCardCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=400)
    card = serializer.create_card_for_user(request.user)
    return Response(SavedCardSerializer(card).data, status=201)


@api_view(["DELETE"])
@permission_classes([IsAuthenticated])
def card_delete(request, pk):
    try:
        card = SavedCard.objects.get(pk=pk, user=request.user)
    except SavedCard.DoesNotExist:
        return Response({"error": "Tarjeta no encontrada"}, status=404)
    card.delete()
    return Response({"ok": True})


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def card_set_default(request, pk):
    try:
        card = SavedCard.objects.get(pk=pk, user=request.user)
    except SavedCard.DoesNotExist:
        return Response({"error": "Tarjeta no encontrada"}, status=404)
    SavedCard.objects.filter(user=request.user, is_default=True).update(is_default=False)
    card.is_default = True
    card.save()
    return Response(SavedCardSerializer(card).data)


# ─── PAYMENTS ─────────────────────────────────────────────────────────────────

@api_view(["POST"])
@permission_classes([IsAuthenticated])
def pay_order(request, pk):
    try:
        order = Order.objects.get(pk=pk, user=request.user)
    except Order.DoesNotExist:
        return Response({"error": "Pedido no encontrado"}, status=404)

    if order.status in ("paid", "cash_pending"):
        return Response({"error": "Este pedido ya tiene un pago registrado"}, status=400)
    if order.status == "cancelled":
        return Response({"error": "No se puede pagar un pedido cancelado"}, status=400)

    if hasattr(order, 'payment') and order.payment.status == 'completed':
        return Response({"error": "Este pedido ya tiene un pago completado"}, status=400)

    method = request.data.get("method")
    if method not in ("card", "cash"):
        return Response({"error": "Método de pago inválido. Use 'card' o 'cash'."}, status=400)

    payment_kwargs = dict(order=order, method=method, amount=order.total)

    if method == "card":
        card_id = request.data.get("card_id")
        saved_card = None
        if card_id:
            try:
                saved_card = SavedCard.objects.get(pk=card_id, user=request.user)
            except SavedCard.DoesNotExist:
                return Response({"error": "Tarjeta no encontrada"}, status=404)
        else:
            card_serializer = SavedCardCreateSerializer(data=request.data)
            if not card_serializer.is_valid():
                return Response(card_serializer.errors, status=400)
            save_card = request.data.get("save_card", False)
            if save_card:
                saved_card = card_serializer.create_card_for_user(request.user)
            else:
                number = card_serializer.validated_data['card_number']
                brand  = card_serializer.detect_brand(number)
                saved_card = SavedCard(
                    user=request.user, card_last4=number[-4:], card_brand=brand,
                    cardholder_name=card_serializer.validated_data['cardholder_name'],
                    expiry_month=card_serializer.validated_data['expiry_month'].zfill(2),
                    expiry_year=card_serializer.validated_data['expiry_year'],
                    token=f"tok_{uuid.uuid4().hex[:20]}",
                )
                saved_card.save()

        payment_kwargs['saved_card']       = saved_card
        payment_kwargs['transaction_ref']  = generate_transaction_ref()
        payment_kwargs['status']           = 'completed'
        payment_kwargs['paid_at']          = timezone.now()

        payment, _ = Payment.objects.update_or_create(order=order, defaults=payment_kwargs)
        order.status = "paid"
        order.save()
        order_data = OrderSerializer(Order.objects.select_related('time_slot','payment__saved_card').prefetch_related('items__product').get(pk=order.pk)).data
        return Response({
            "ok": True,
            "message": f"Pago con {saved_card.card_brand} ****{saved_card.card_last4} aprobado.",
            "transaction_ref": payment.transaction_ref,
            "order": order_data,
        })

    elif method == "cash":
        cash_tendered = request.data.get("cash_tendered")
        if cash_tendered is None:
            return Response({"error": "Indica el monto entregado en efectivo."}, status=400)
        try:
            cash_tendered = Decimal(str(cash_tendered))
        except Exception:
            return Response({"error": "Monto inválido."}, status=400)
        if cash_tendered < order.total:
            return Response({"error": f"El monto entregado es menor al total ({order.total})."}, status=400)

        change = cash_tendered - order.total
        payment_kwargs.update({
            'status': 'pending',  # pendiente hasta que el admin confirme
            'cash_tendered': cash_tendered,
            'cash_change': change,
            'transaction_ref': generate_transaction_ref(),
            'paid_at': None,
        })
        payment, _ = Payment.objects.update_or_create(order=order, defaults=payment_kwargs)
        order.status = "cash_pending"  # esperando confirmación del admin
        order.save()
        order_data = OrderSerializer(Order.objects.select_related('time_slot','payment__saved_card').prefetch_related('items__product').get(pk=order.pk)).data
        return Response({
            "ok": True,
            "message": "Pedido registrado. Paga en la cafetería al recogerlo.",
            "cash_tendered": str(cash_tendered),
            "cash_change": str(change),
            "transaction_ref": payment.transaction_ref,
            "order": order_data,
        })


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def confirm_cash_payment(request, pk):
    """El admin confirma que ha recibido el pago en efectivo."""
    if not request.user.is_staff:
        return Response({"error": "Sin permisos"}, status=403)
    try:
        order = Order.objects.get(pk=pk)
    except Order.DoesNotExist:
        return Response({"error": "Pedido no encontrado"}, status=404)

    if order.status != "cash_pending":
        return Response({"error": "Este pedido no está pendiente de pago en caja"}, status=400)

    order.status = "paid"
    order.save()

    if hasattr(order, 'payment'):
        order.payment.status = 'completed'
        order.payment.paid_at = timezone.now()
        order.payment.save()

    order_data = OrderSerializer(
        Order.objects.select_related('time_slot', 'payment__saved_card')
             .prefetch_related('items__product').get(pk=order.pk)
    ).data
    return Response({"ok": True, "order": order_data})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def payment_detail(request, pk):
    try:
        order   = Order.objects.get(pk=pk, user=request.user)
        payment = order.payment
    except Order.DoesNotExist:
        return Response({"error": "Pedido no encontrado"}, status=404)
    except Payment.DoesNotExist:
        return Response({"error": "Este pedido aún no tiene pago"}, status=404)
    return Response(PaymentSerializer(payment).data)
