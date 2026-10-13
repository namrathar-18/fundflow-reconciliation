"""
Serializers for the FundFlow API.
"""

from rest_framework import serializers
from reconciliation.models import (
    BankTransaction,
    CapitalCall,
    InvestorEntity,
    LineItem,
    Match,
    Organization,
)


class OrganizationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Organization
        fields = ['slug', 'name']


class InvestorEntitySerializer(serializers.ModelSerializer):
    class Meta:
        model = InvestorEntity
        fields = ['id', 'name']


class CapitalCallSerializer(serializers.ModelSerializer):
    class Meta:
        model = CapitalCall
        fields = ['id', 'call_date', 'due_date']


class MatchSerializer(serializers.ModelSerializer):
    line_item_id = serializers.IntegerField(source='line_item.id')
    wire_reference = serializers.CharField(source='line_item.wire_reference')
    investor_name = serializers.CharField(source='line_item.investor_entity.name')
    amount_called = serializers.DecimalField(
        source='line_item.amount_called', max_digits=20, decimal_places=2
    )
    amount_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Match
        fields = [
            'id',
            'line_item_id',
            'wire_reference',
            'investor_name',
            'amount_called',
            'amount_remaining',
            'status',
            'reason',
            'created_at',
        ]

    def get_amount_remaining(self, obj):
        return str(obj.line_item.amount_remaining)


class BankTransactionSerializer(serializers.ModelSerializer):
    matches = MatchSerializer(many=True, read_only=True)
    # Convenience fields for the suggested match (if any single suggested one)
    suggested_investor = serializers.SerializerMethodField()
    suggested_reference = serializers.SerializerMethodField()
    match_reason = serializers.SerializerMethodField()

    class Meta:
        model = BankTransaction
        fields = [
            'id',
            'date',
            'description',
            'amount',
            'transaction_type',
            'bank_reference',
            'status',
            'review_reason',
            'suggested_investor',
            'suggested_reference',
            'match_reason',
            'matches',
            'imported_at',
        ]

    def _proposed_matches(self, obj):
        return [m for m in obj.matches.all() if m.status == 'proposed']

    def get_suggested_investor(self, obj):
        proposed = self._proposed_matches(obj)
        if len(proposed) == 1:
            return proposed[0].line_item.investor_entity.name
        return None

    def get_suggested_reference(self, obj):
        proposed = self._proposed_matches(obj)
        if len(proposed) == 1:
            return proposed[0].line_item.wire_reference
        return None

    def get_match_reason(self, obj):
        proposed = self._proposed_matches(obj)
        if len(proposed) == 1:
            return proposed[0].reason
        if obj.review_reason:
            return obj.review_reason
        return None


class LineItemSerializer(serializers.ModelSerializer):
    investor_name = serializers.CharField(source='investor_entity.name')
    capital_call_id = serializers.IntegerField(source='capital_call.id')
    call_date = serializers.DateField(source='capital_call.call_date')
    due_date = serializers.DateField(source='capital_call.due_date')
    amount_remaining = serializers.SerializerMethodField()

    class Meta:
        model = LineItem
        fields = [
            'id',
            'capital_call_id',
            'call_date',
            'due_date',
            'investor_name',
            'wire_reference',
            'amount_called',
            'amount_funded',
            'amount_remaining',
            'status',
        ]

    def get_amount_remaining(self, obj):
        return str(obj.amount_remaining)


class ImportSummarySerializer(serializers.Serializer):
    imported = serializers.IntegerField()
    duplicates = serializers.IntegerField()
    errors = serializers.ListField(child=serializers.DictField())
