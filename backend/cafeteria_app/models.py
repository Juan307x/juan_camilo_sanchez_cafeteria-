from django.db import models
from django.contrib.auth.models import User


class UserProfile(models.Model):
    ROLES = [('admin', 'Admin'), ('alumno', 'Alumno')]
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=10, choices=ROLES, default='alumno')

    def __str__(self):
        return f"{self.user.username} ({self.role})"


class Category(models.Model):
    name = models.CharField(max_length=50)
    emoji = models.CharField(max_length=5, default='🍽️')

    def __str__(self):
        return self.name


class Product(models.Model):
    name = models.CharField(max_length=100)
    price = models.DecimalField(max_digits=5, decimal_places=2)
    category = models.ForeignKey(Category, on_delete=models.SET_NULL, null=True)
    emoji = models.CharField(max_length=5, default='🍽️')
    healthy = models.BooleanField(default=False)
    stock = models.IntegerField(default=20)
    available = models.BooleanField(default=True)

    def __str__(self):
        return self.name


class TimeSlot(models.Model):
    label = models.CharField(max_length=30)
    start = models.TimeField()
    end = models.TimeField()

    def __str__(self):
        return self.label


# ─── PAYMENT MODELS ──────────────────────────────────────────────────────────

class SavedCard(models.Model):
    """Tarjetas guardadas del usuario (datos enmascarados, sin datos reales de tarjeta)."""
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='saved_cards')
    alias = models.CharField(max_length=50, blank=True)          # p.ej. "Mi tarjeta Visa"
    card_last4 = models.CharField(max_length=4)                   # últimos 4 dígitos
    card_brand = models.CharField(max_length=20)                  # Visa / Mastercard / etc.
    cardholder_name = models.CharField(max_length=100)
    expiry_month = models.CharField(max_length=2)
    expiry_year = models.CharField(max_length=4)
    # token simulado (en producción sería el token de Stripe/PayU/etc.)
    token = models.CharField(max_length=100, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-is_default', '-created_at']

    def __str__(self):
        return f"{self.card_brand} ****{self.card_last4} ({self.user.username})"


class Payment(models.Model):
    METHODS = [
        ('card', 'Tarjeta'),
        ('cash', 'Efectivo'),
    ]
    STATUSES = [
        ('pending', 'Pendiente'),
        ('completed', 'Completado'),
        ('failed', 'Fallido'),
        ('refunded', 'Reembolsado'),
    ]
    order = models.OneToOneField('Order', on_delete=models.CASCADE, related_name='payment')
    method = models.CharField(max_length=10, choices=METHODS)
    status = models.CharField(max_length=15, choices=STATUSES, default='pending')
    amount = models.DecimalField(max_digits=7, decimal_places=2)
    # Para pago con tarjeta
    saved_card = models.ForeignKey(SavedCard, on_delete=models.SET_NULL, null=True, blank=True)
    # Para pago en efectivo
    cash_tendered = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    cash_change = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    # Referencia de transacción (simulada)
    transaction_ref = models.CharField(max_length=100, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Pago {self.order.code} - {self.method} ({self.status})"


# ─── ORDER MODELS ─────────────────────────────────────────────────────────────

class Order(models.Model):
    STATUSES = [
        ('pending', 'Pendiente'),
        ('cash_pending', 'Pago en caja pendiente'),
        ('paid', 'Pagado'),
        ('ready', 'Listo'),
        ('delivered', 'Entregado'),
        ('cancelled', 'Cancelado'),
    ]
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='orders')
    code = models.CharField(max_length=10, unique=True)
    status = models.CharField(max_length=15, choices=STATUSES, default='pending')
    time_slot = models.ForeignKey(TimeSlot, on_delete=models.SET_NULL, null=True)
    total = models.DecimalField(max_digits=7, decimal_places=2, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.code


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name='items')
    product = models.ForeignKey(Product, on_delete=models.SET_NULL, null=True)
    quantity = models.IntegerField(default=1)
    price = models.DecimalField(max_digits=5, decimal_places=2)

    def __str__(self):
        return f"{self.quantity}x {self.product}"


class Favorite(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='favorites')
    product = models.ForeignKey(Product, on_delete=models.CASCADE)

    class Meta:
        unique_together = ('user', 'product')
