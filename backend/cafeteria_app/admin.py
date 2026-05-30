from django.contrib import admin
from .models import UserProfile, Category, Product, TimeSlot, Order, OrderItem, Favorite, SavedCard, Payment


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'role']


@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'emoji']


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ['name', 'price', 'category', 'stock', 'available', 'healthy']
    list_filter = ['category', 'available', 'healthy']


@admin.register(TimeSlot)
class TimeSlotAdmin(admin.ModelAdmin):
    list_display = ['label', 'start', 'end']


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ['code', 'user', 'status', 'total', 'time_slot', 'created_at']
    list_filter = ['status']
    inlines = [OrderItemInline]


@admin.register(Favorite)
class FavoriteAdmin(admin.ModelAdmin):
    list_display = ['user', 'product']


@admin.register(SavedCard)
class SavedCardAdmin(admin.ModelAdmin):
    list_display = ['user', 'card_brand', 'card_last4', 'cardholder_name', 'is_default', 'created_at']
    list_filter = ['card_brand', 'is_default']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['order', 'method', 'status', 'amount', 'transaction_ref', 'paid_at']
    list_filter = ['method', 'status']
