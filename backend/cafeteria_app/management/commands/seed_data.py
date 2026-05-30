from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from cafeteria_app.models import UserProfile, Category, Product, TimeSlot


class Command(BaseCommand):
    help = 'Crea usuarios, categorías, productos y franjas de prueba'

    def add_arguments(self, parser):
        parser.add_argument('--reset', action='store_true', help='Elimina y recrea los usuarios de prueba')

    def handle(self, *args, **kwargs):
        reset = kwargs.get('reset', False)

        # ── Usuarios con email ────────────────────────────────────────────────
        users = [
            ('admin@cafeteria.es',  'admin123',  'Administrador', '', 'admin', True),
            ('alumno@cafeteria.es', 'alumno123', 'Alumno',        'Demo', 'alumno', False),
            ('profe@cafeteria.es',  'profe123',  'Profesor',      'Demo', 'alumno', False),
        ]
        for email, password, first, last, role, is_super in users:
            # Si --reset, borrar usuario existente con ese email o username
            if reset:
                User.objects.filter(email=email).delete()
                User.objects.filter(username=email).delete()

            if User.objects.filter(email=email).exists():
                # Asegurarse de que el username coincide con el email (fix retroactivo)
                u = User.objects.get(email=email)
                if u.username != email:
                    u.username = email
                    u.save()
                    self.stdout.write(f'🔧 {email} username corregido')
                else:
                    self.stdout.write(f'⏭️  {email} ya existe, omitiendo')
                continue

            if is_super:
                u = User.objects.create_superuser(
                    username=email, email=email, password=password
                )
            else:
                u = User.objects.create_user(
                    username=email, email=email, password=password
                )
            u.first_name = first
            u.last_name  = last
            u.save()
            UserProfile.objects.get_or_create(user=u, defaults={'role': role})
            self.stdout.write(f'✅ {email} creado')

        # ── Categorías ────────────────────────────────────────────────────────
        cats = {
            'Bocadillos': '🥖', 'Bebidas': '🥤', 'Postres': '🍰',
            'Menú del día': '🍽️', 'Snacks': '🍿', 'Ensaladas': '🥗',
        }
        cat_objs = {}
        for name, emoji in cats.items():
            cat, _ = Category.objects.get_or_create(name=name, defaults={'emoji': emoji})
            cat_objs[name] = cat

        # ── Productos ─────────────────────────────────────────────────────────
        products = [
            ('Bocadillo de jamón',    2.50, 'Bocadillos',   '🥖', False, 25),
            ('Bocadillo de queso',    2.20, 'Bocadillos',   '🧀', False, 20),
            ('Bocadillo de atún',     2.30, 'Bocadillos',   '🐟', False, 18),
            ('Bocadillo vegetal',     2.40, 'Bocadillos',   '🥦', True,  15),
            ('Bocadillo de tortilla', 2.60, 'Bocadillos',   '🍳', False, 20),
            ('Agua 500ml',            0.80, 'Bebidas',      '💧', True,  50),
            ('Zumo de naranja',       1.20, 'Bebidas',      '🍊', True,  30),
            ('Café con leche',        1.10, 'Bebidas',      '☕', False, 40),
            ('Refresco 330ml',        1.30, 'Bebidas',      '🥤', False, 35),
            ('Batido de chocolate',   1.50, 'Bebidas',      '🥛', False, 20),
            ('Yogur natural',         0.90, 'Postres',      '🍦', True,  20),
            ('Muffin de chocolate',   1.40, 'Postres',      '🧁', False, 15),
            ('Fruta del tiempo',      1.00, 'Postres',      '🍎', True,  25),
            ('Palmera de chocolate',  1.20, 'Postres',      '🍫', False, 18),
            ('Menú completo',         4.50, 'Menú del día', '🍽️', False, 30),
            ('Menú vegetariano',      4.20, 'Menú del día', '🥗', True,  20),
            ('Primer plato',          2.50, 'Menú del día', '🍲', False, 25),
            ('Segundo plato',         3.00, 'Menú del día', '🥩', False, 25),
            ('Chips de maíz',         0.90, 'Snacks',       '🌽', False, 30),
            ('Barrita energética',    1.10, 'Snacks',       '🍫', True,  20),
            ('Galletas',              0.80, 'Snacks',       '🍪', False, 25),
            ('Ensalada César',        3.20, 'Ensaladas',    '🥗', True,  15),
            ('Ensalada mixta',        2.80, 'Ensaladas',    '🥬', True,  15),
        ]
        for name, price, cat_name, emoji, healthy, stock in products:
            Product.objects.get_or_create(name=name, defaults={
                'price': price, 'category': cat_objs[cat_name],
                'emoji': emoji, 'healthy': healthy, 'stock': stock,
            })
        self.stdout.write('✅ Productos creados')

        # ── Franjas horarias ──────────────────────────────────────────────────
        slots = [
            ('Recreo 1 (10:30-11:00)', '10:30', '11:00'),
            ('Recreo 2 (12:30-13:00)', '12:30', '13:00'),
            ('Mediodía (14:00-14:30)', '14:00', '14:30'),
            ('Tarde (16:00-16:30)',    '16:00', '16:30'),
        ]
        for label, start, end in slots:
            TimeSlot.objects.get_or_create(label=label, defaults={'start': start, 'end': end})
        self.stdout.write('✅ Franjas horarias creadas')

        self.stdout.write(self.style.SUCCESS('\n🎉 Base de datos lista. Cuentas de prueba:'))
        self.stdout.write('   admin@cafeteria.es  / admin123')
        self.stdout.write('   alumno@cafeteria.es / alumno123')
        self.stdout.write('   profe@cafeteria.es  / profe123')
