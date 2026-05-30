from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('cafeteria_app', '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='SavedCard',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('alias', models.CharField(blank=True, max_length=50)),
                ('card_last4', models.CharField(max_length=4)),
                ('card_brand', models.CharField(max_length=20)),
                ('cardholder_name', models.CharField(max_length=100)),
                ('expiry_month', models.CharField(max_length=2)),
                ('expiry_year', models.CharField(max_length=4)),
                ('token', models.CharField(blank=True, max_length=100)),
                ('is_default', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE,
                                           related_name='saved_cards', to=settings.AUTH_USER_MODEL)),
            ],
            options={
                'ordering': ['-is_default', '-created_at'],
            },
        ),
        migrations.CreateModel(
            name='Payment',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('method', models.CharField(choices=[('card', 'Tarjeta'), ('cash', 'Efectivo')], max_length=10)),
                ('status', models.CharField(choices=[('pending', 'Pendiente'), ('completed', 'Completado'),
                                                       ('failed', 'Fallido'), ('refunded', 'Reembolsado')],
                                             default='pending', max_length=15)),
                ('amount', models.DecimalField(decimal_places=2, max_digits=7)),
                ('cash_tendered', models.DecimalField(decimal_places=2, max_digits=7, null=True, blank=True)),
                ('cash_change', models.DecimalField(decimal_places=2, max_digits=7, null=True, blank=True)),
                ('transaction_ref', models.CharField(blank=True, max_length=100)),
                ('paid_at', models.DateTimeField(null=True, blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('order', models.OneToOneField(on_delete=django.db.models.deletion.CASCADE,
                                                related_name='payment', to='cafeteria_app.order')),
                ('saved_card', models.ForeignKey(blank=True, null=True,
                                                  on_delete=django.db.models.deletion.SET_NULL,
                                                  to='cafeteria_app.savedcard')),
            ],
        ),
    ]
