from django.urls import path
from . import views

urlpatterns = [
    # Auth con email
    path('auth/register/', views.register_view),
    path('auth/login/',    views.login_view),
    path('auth/logout/',   views.logout_view),
    path('auth/me/',       views.me_view),

    # Catálogo
    path('products/',                views.products_list),
    path('products/create/',         views.create_product),
    path('products/<int:pk>/stock/', views.update_stock),
    path('products/<int:pk>/delete/', views.delete_product),
    path('categories/',            views.categories_list),
    path('timeslots/',             views.timeslots_list),

    # Pedidos
    path('orders/',          views.orders_list),
    path('orders/<int:pk>/', views.order_detail),

    # Favoritos
    path('favorites/',                    views.favorites_list),
    path('favorites/<int:pk>/toggle/',    views.toggle_favorite),

    # Tarjetas
    path('cards/',                        views.cards_list),
    path('cards/add/',                    views.cards_add),
    path('cards/<int:pk>/delete/',        views.card_delete),
    path('cards/<int:pk>/set-default/',   views.card_set_default),

    # Pagos
    path('orders/<int:pk>/pay/',          views.pay_order),
    path('orders/<int:pk>/payment/',      views.payment_detail),
    path('orders/<int:pk>/confirm-cash/', views.confirm_cash_payment),
]
