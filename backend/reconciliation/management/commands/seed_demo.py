"""
Management command: python manage.py seed_demo

Creates demo organizations, capital calls, investor entities and line items.
Running it twice must not create duplicates.
"""

from decimal import Decimal
from django.core.management.base import BaseCommand
from reconciliation.models import (
    CapitalCall,
    InvestorEntity,
    LineItem,
    Organization,
)


class Command(BaseCommand):
    help = 'Seed demo data for FundFlow (idempotent).'

    def handle(self, *args, **options):
        # ------------------------------------------------------------------
        # Organizations
        # ------------------------------------------------------------------
        northwind, _ = Organization.objects.get_or_create(
            slug='northwind',
            defaults={'name': 'Northwind Ventures'},
        )
        bluebird, _ = Organization.objects.get_or_create(
            slug='bluebird',
            defaults={'name': 'Bluebird Capital'},
        )
        self.stdout.write(f'  Organizations: {northwind.name}, {bluebird.name}')

        # ------------------------------------------------------------------
        # Northwind – Capital Call #1 (2026-03-25, due 2026-04-10)
        # ------------------------------------------------------------------
        nw_call1, _ = CapitalCall.objects.get_or_create(
            organization=northwind,
            call_date='2026-03-25',
            due_date='2026-04-10',
        )

        nw_call1_items = [
            ('Haller Capital LLC',  'CC-1001', Decimal('27500.00')),
            ('Rahul Shah Trust',    'CC-1002', Decimal('25000.00')),
            ('Patel Family Trust',  'CC-1003', Decimal('12500.00')),
            ('Meridian Partners LP','CC-1004', Decimal('15000.00')),
            ('Oakridge Holdings LLC','CC-1005',Decimal('15000.00')),
        ]

        for investor_name, ref, amount in nw_call1_items:
            entity, _ = InvestorEntity.objects.get_or_create(
                organization=northwind,
                name=investor_name,
            )
            LineItem.objects.get_or_create(
                capital_call=nw_call1,
                investor_entity=entity,
                defaults={
                    'wire_reference': ref,
                    'amount_called': amount,
                    'amount_funded': Decimal('0.00'),
                    'status': 'open',
                },
            )

        # ------------------------------------------------------------------
        # Northwind – Capital Call #2 (2026-04-01, due 2026-04-20)
        # ------------------------------------------------------------------
        nw_call2, _ = CapitalCall.objects.get_or_create(
            organization=northwind,
            call_date='2026-04-01',
            due_date='2026-04-20',
        )

        oakridge, _ = InvestorEntity.objects.get_or_create(
            organization=northwind,
            name='Oakridge Holdings LLC',
        )
        LineItem.objects.get_or_create(
            capital_call=nw_call2,
            investor_entity=oakridge,
            defaults={
                'wire_reference': 'CC-1006',
                'amount_called': Decimal('15000.00'),
                'amount_funded': Decimal('0.00'),
                'status': 'open',
            },
        )

        # ------------------------------------------------------------------
        # Bluebird – Capital Call #1 (2026-04-01, due 2026-04-15)
        # ------------------------------------------------------------------
        bb_call1, _ = CapitalCall.objects.get_or_create(
            organization=bluebird,
            call_date='2026-04-01',
            due_date='2026-04-15',
        )

        cedar, _ = InvestorEntity.objects.get_or_create(
            organization=bluebird,
            name='Cedar Grove Fund LP',
        )
        LineItem.objects.get_or_create(
            capital_call=bb_call1,
            investor_entity=cedar,
            defaults={
                'wire_reference': 'CC-2001',
                'amount_called': Decimal('40000.00'),
                'amount_funded': Decimal('0.00'),
                'status': 'open',
            },
        )

        self.stdout.write(self.style.SUCCESS('Demo data seeded successfully.'))
