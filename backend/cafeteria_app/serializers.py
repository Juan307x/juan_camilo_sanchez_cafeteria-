from django.contrib.auth.models import User
from rest_framework import serializers
from .models import UserProfile, Category, Product, TimeSlot, Order, OrderItem, Favorite, SavedCard, Payment


class UserSerializer(serializers.ModelSerializer):
    role = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'role']

    def get_role(self, obj):
        try:
            return obj.profile.role
        except UserProfile.DoesNotExist:
            return 'alumno'


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'name', 'emoji']


class ProductSerializer(serializers.ModelSerializer):
    category_name = serializers.SerializerMethodField()

    class Meta:
        model = Product
        fields = ['id', 'name', 'price', 'category', 'category_name', 'emoji', 'healthy', 'stock', 'available']

    def get_category_name(self, obj):
        return obj.category.name if obj.category else ''


class TimeSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = TimeSlot
        fields = ['id', 'label', 'start', 'end']


class OrderItemSerializer(serializers.ModelSerializer):
    product_name = serializers.SerializerMethodField()
    product_emoji = serializers.SerializerMethodField()

    class Meta:
        model = OrderItem
        fields = ['id', 'product', 'product_name', 'product_emoji', 'quantity', 'price']

    def get_product_name(self, obj):
        return obj.product.name if obj.product else 'Producto eliminado'

    def get_product_emoji(self, obj):
        return obj.product.emoji if obj.product else '🍽️'


# ─── PAYMENT SERIALIZERS ──────────────────────────────────────────────────────

class SavedCardSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedCard
        fields = ['id', 'alias', 'card_last4', 'card_brand', 'cardholder_name',
                  'expiry_month', 'expiry_year', 'is_default', 'created_at']
        read_only_fields = ['id', 'created_at']


class SavedCardCreateSerializer(serializers.Serializer):
    card_number = serializers.CharField(min_length=13, max_length=19)
    cardholder_name = serializers.CharField(max_length=100)
    expiry_month = serializers.CharField(min_length=1, max_length=2)
    expiry_year = serializers.CharField(min_length=2, max_length=4)
    cvv = serializers.CharField(min_length=3, max_length=4, write_only=True)
    alias = serializers.CharField(max_length=50, required=False, default='')
    is_default = serializers.BooleanField(default=False)

    def validate_card_number(self, value):
        digits = value.replace(' ', '').replace('-', '')
        if not digits.isdigit():
            raise serializers.ValidationError("Solo dígitos.")
        if len(digits) < 13:
            raise serializers.ValidationError("Número demasiado corto.")
        return digits

    def validate(self, data):
        month = int(data['expiry_month'])
        if not (1 <= month <= 12):
            raise serializers.ValidationError({"expiry_month": "Mes inválido (1-12)."})
        return data

    def detect_brand(self, number):
        if number.startswith('4'):
            return 'Visa'
        elif number[:2] in ['51','52','53','54','55']:
            return 'Mastercard'
        elif number[:4] in ['6011'] or number[:2] == '65':
            return 'Discover'
        elif number[:2] in ['34','37']:
            return 'Amex'
        return 'Tarjeta'

    def create_card_for_user(self, user):
        import uuid
        data = self.validated_data
        number = data['card_number']
        brand = self.detect_brand(number)
        last4 = number[-4:]
        if data.get('is_default'):
            SavedCard.objects.filter(user=user, is_default=True).update(is_default=False)
        token = f"tok_{uuid.uuid4().hex[:20]}"
        card = SavedCard.objects.create(
            user=user,
            alias=data.get('alias') or f"{brand} ****{last4}",
            card_last4=last4,
            card_brand=brand,
            cardholder_name=data['cardholder_name'],
            expiry_month=data['expiry_month'].zfill(2),
            expiry_year=data['expiry_year'],
            token=token,
            is_default=data.get('is_default', False),
        )
        return card


class PaymentSerializer(serializers.ModelSerializer):
    method_display = serializers.CharField(source='get_method_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    card_info = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ['id', 'method', 'method_display', 'status', 'status_display',
                  'amount', 'card_info', 'cash_tendered', 'cash_change',
                  'transaction_ref', 'paid_at', 'created_at']

    def get_card_info(self, obj):
        if obj.saved_card:
            return {
                'brand': obj.saved_card.card_brand,
                'last4': obj.saved_card.card_last4,
                'cardholder': obj.saved_card.cardholder_name,
            }
        return None


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    time_slot_label = serializers.SerializerMethodField()
    user_username = serializers.SerializerMethodField()
    payment = PaymentSerializer(read_only=True)

    class Meta:
        model = Order
        fields = ['id', 'code', 'status', 'time_slot', 'time_slot_label',
                  'total', 'created_at', 'items', 'user_username', 'payment']

    def get_time_slot_label(self, obj):
        return obj.time_slot.label if obj.time_slot else ''

    def get_user_username(self, obj):
        return obj.user.username


class FavoriteSerializer(serializers.ModelSerializer):
    product = ProductSerializer(read_only=True)

    class Meta:
        model = Favorite
        fields = ['id', 'product']
