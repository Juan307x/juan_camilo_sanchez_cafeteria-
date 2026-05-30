from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('cafeteria_app', '0002_payment_savedcard'),
    ]

    operations = [
        migrations.AlterField(
            model_name='order',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pendiente'),
                    ('cash_pending', 'Pago en caja pendiente'),
                    ('paid', 'Pagado'),
                    ('ready', 'Listo'),
                    ('delivered', 'Entregado'),
                    ('cancelled', 'Cancelado'),
                ],
                default='pending',
                max_length=15,
            ),
        ),
    ]
