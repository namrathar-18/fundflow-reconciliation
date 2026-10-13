"""
Views for the FundFlow REST API.

All views read request.organization (set by OrganizationMiddleware).
"""

from decimal import Decimal

from django.db import transaction as db_transaction
from rest_framework import status
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView

from reconciliation.importer import import_csv
from reconciliation.models import (
    BankTransaction,
    LineItem,
    Match,
    MatchStatus,
    TransactionStatus,
)
from reconciliation.serializers import (
    BankTransactionSerializer,
    ImportSummarySerializer,
    LineItemSerializer,
    OrganizationSerializer,
)


# ---------------------------------------------------------------------------
# Organization info
# ---------------------------------------------------------------------------

class OrganizationView(APIView):
    """GET /api/organizations/ — list all organizations (for the switcher)."""

    def get(self, request):
        from reconciliation.models import Organization
        orgs = Organization.objects.all().order_by('name')
        serializer = OrganizationSerializer(orgs, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Import
# ---------------------------------------------------------------------------

class ImportView(APIView):
    """POST /api/import/ — upload a CSV bank statement."""
    parser_classes = [MultiPartParser]

    def post(self, request):
        file_obj = request.FILES.get('file')
        if file_obj is None:
            return Response(
                {'detail': 'No file uploaded. Send a multipart field named "file".'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = import_csv(request.organization, file_obj)

        serializer = ImportSummarySerializer(result)
        return Response(serializer.data, status=status.HTTP_200_OK)


# ---------------------------------------------------------------------------
# Transactions
# ---------------------------------------------------------------------------

class TransactionListView(APIView):
    """GET /api/transactions/ — list transactions newest first."""

    def get(self, request):
        qs = (
            BankTransaction.objects
            .filter(organization=request.organization)
            .prefetch_related('matches__line_item__investor_entity')
            .order_by('-date', '-imported_at')
        )
        serializer = BankTransactionSerializer(qs, many=True)
        return Response(serializer.data)


class TransactionIgnoreView(APIView):
    """POST /api/transactions/<id>/ignore/ — mark a credit transaction ignored."""

    def post(self, request, pk):
        try:
            tx = BankTransaction.objects.get(pk=pk, organization=request.organization)
        except BankTransaction.DoesNotExist:
            return Response({'detail': 'Transaction not found.'}, status=status.HTTP_404_NOT_FOUND)

        if tx.status == TransactionStatus.RECONCILED:
            return Response(
                {'detail': 'Cannot ignore a reconciled transaction.'},
                status=status.HTTP_409_CONFLICT,
            )

        if tx.transaction_type == 'debit':
            return Response(
                {'detail': 'Debits are already ignored.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Reject all proposed matches and mark transaction ignored
        tx.matches.filter(status=MatchStatus.PROPOSED).update(status=MatchStatus.REJECTED)
        tx.status = TransactionStatus.IGNORED
        tx.save()

        serializer = BankTransactionSerializer(tx)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Line Items
# ---------------------------------------------------------------------------

class LineItemListView(APIView):
    """GET /api/line-items/ — list all line items for the organization."""

    def get(self, request):
        qs = (
            LineItem.objects
            .filter(capital_call__organization=request.organization)
            .select_related('capital_call', 'investor_entity')
            .order_by('capital_call__call_date', 'wire_reference')
        )
        serializer = LineItemSerializer(qs, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# Matches
# ---------------------------------------------------------------------------

class MatchApproveView(APIView):
    """POST /api/matches/<id>/approve/ — approve a proposed match."""

    def post(self, request, pk):
        try:
            match = (
                Match.objects
                .select_related(
                    'transaction__organization',
                    'line_item__capital_call__organization',
                    'line_item__investor_entity',
                )
                .get(pk=pk)
            )
        except Match.DoesNotExist:
            return Response({'detail': 'Match not found.'}, status=status.HTTP_404_NOT_FOUND)

        # Organization isolation
        if match.transaction.organization != request.organization:
            return Response({'detail': 'Match not found.'}, status=status.HTTP_404_NOT_FOUND)

        if match.status != MatchStatus.PROPOSED:
            return Response(
                {'detail': f'Match is already {match.status}, cannot approve.'},
                status=status.HTTP_409_CONFLICT,
            )

        try:
            with db_transaction.atomic():
                # Lock the line item to prevent race conditions
                line_item = (
                    LineItem.objects
                    .select_for_update()
                    .get(pk=match.line_item_id)
                )

                tx_amount = match.transaction.amount
                remaining = line_item.amount_called - line_item.amount_funded

                # Re-check amount
                if tx_amount > remaining:
                    return Response(
                        {
                            'detail': (
                                f'Transaction amount {tx_amount} now exceeds '
                                f'remaining {remaining} for this line item.'
                            )
                        },
                        status=status.HTTP_409_CONFLICT,
                    )

                # Update line item
                line_item.amount_funded += tx_amount
                line_item.update_status()
                line_item.save()

                # Approve chosen match
                match.status = MatchStatus.APPROVED
                match.save()

                # Reject all other proposed matches for this transaction
                match.transaction.matches.filter(
                    status=MatchStatus.PROPOSED
                ).exclude(pk=match.pk).update(status=MatchStatus.REJECTED)

                # Mark transaction reconciled
                match.transaction.status = TransactionStatus.RECONCILED
                match.transaction.save()

        except Exception as exc:
            return Response(
                {'detail': str(exc)},
                status=status.HTTP_409_CONFLICT,
            )

        # Reload and return full transaction
        tx = (
            BankTransaction.objects
            .prefetch_related('matches__line_item__investor_entity')
            .get(pk=match.transaction_id)
        )
        return Response(BankTransactionSerializer(tx).data)


class MatchRejectView(APIView):
    """POST /api/matches/<id>/reject/ — reject a proposed match."""

    def post(self, request, pk):
        try:
            match = Match.objects.select_related(
                'transaction__organization'
            ).get(pk=pk)
        except Match.DoesNotExist:
            return Response({'detail': 'Match not found.'}, status=status.HTTP_404_NOT_FOUND)

        if match.transaction.organization != request.organization:
            return Response({'detail': 'Match not found.'}, status=status.HTTP_404_NOT_FOUND)

        if match.status != MatchStatus.PROPOSED:
            return Response(
                {'detail': f'Match is already {match.status}, cannot reject.'},
                status=status.HTTP_409_CONFLICT,
            )

        match.status = MatchStatus.REJECTED
        match.save()

        # If no proposed matches remain, set transaction to needs_review
        tx = match.transaction
        if not tx.matches.filter(status=MatchStatus.PROPOSED).exists():
            if tx.status != TransactionStatus.RECONCILED:
                tx.status = TransactionStatus.NEEDS_REVIEW
                tx.review_reason = 'All suggested matches were rejected.'
                tx.save()

        tx_refreshed = (
            BankTransaction.objects
            .prefetch_related('matches__line_item__investor_entity')
            .get(pk=tx.pk)
        )
        return Response(BankTransactionSerializer(tx_refreshed).data)
