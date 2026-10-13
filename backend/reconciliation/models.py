"""
Models for FundFlow bank reconciliation.

Data model overview:
- Organization: tenant (GP firm)
- InvestorEntity: LP legal entity belonging to an org
- CapitalCall: a call for money with call_date and due_date
- LineItem: one LP's share of a capital call
- BankTransaction: an imported CSV row
- Match: proposed link between a transaction and a line item
"""

from decimal import Decimal
from django.db import models


class Organization(models.Model):
    """A GP firm (tenant). All data is scoped to an organization."""
    slug = models.SlugField(unique=True)
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name


class InvestorEntity(models.Model):
    """An LP's legal entity, such as 'Patel Family Trust'."""
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='investor_entities',
    )
    name = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('organization', 'name')

    def __str__(self):
        return self.name


class CapitalCall(models.Model):
    """A request for money sent by the GP to all LPs."""
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='capital_calls',
    )
    call_date = models.DateField()
    due_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Capital Call {self.pk} ({self.call_date})"


class LineItemStatus(models.TextChoices):
    OPEN = 'open', 'Open'
    PARTIALLY_FUNDED = 'partially_funded', 'Partially Funded'
    FUNDED = 'funded', 'Funded'


class LineItem(models.Model):
    """One LP's share of one capital call."""
    capital_call = models.ForeignKey(
        CapitalCall,
        on_delete=models.CASCADE,
        related_name='line_items',
    )
    investor_entity = models.ForeignKey(
        InvestorEntity,
        on_delete=models.CASCADE,
        related_name='line_items',
    )
    wire_reference = models.CharField(max_length=50)
    amount_called = models.DecimalField(max_digits=20, decimal_places=2)
    amount_funded = models.DecimalField(max_digits=20, decimal_places=2, default=Decimal('0.00'))
    status = models.CharField(
        max_length=20,
        choices=LineItemStatus.choices,
        default=LineItemStatus.OPEN,
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('capital_call', 'investor_entity')

    @property
    def amount_remaining(self):
        return self.amount_called - self.amount_funded

    def update_status(self):
        """Recompute and save the status based on funded amount."""
        if self.amount_funded <= Decimal('0.00'):
            self.status = LineItemStatus.OPEN
        elif self.amount_funded >= self.amount_called:
            self.status = LineItemStatus.FUNDED
        else:
            self.status = LineItemStatus.PARTIALLY_FUNDED

    def __str__(self):
        return f"{self.investor_entity.name} / {self.wire_reference}"


class TransactionStatus(models.TextChoices):
    SUGGESTED = 'suggested', 'Suggested'
    NEEDS_REVIEW = 'needs_review', 'Needs Review'
    RECONCILED = 'reconciled', 'Reconciled'
    IGNORED = 'ignored', 'Ignored'


class BankTransaction(models.Model):
    """One row from the imported CSV bank statement."""
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name='transactions',
    )
    date = models.DateField()
    description = models.TextField()
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    # type is stored implicitly via amount sign, but we keep original type label
    transaction_type = models.CharField(max_length=10)  # 'credit' or 'debit'
    bank_reference = models.CharField(max_length=100)
    status = models.CharField(
        max_length=20,
        choices=TransactionStatus.choices,
        default=TransactionStatus.IGNORED,
    )
    # For needs_review: a reason explaining why review is needed
    review_reason = models.TextField(blank=True, default='')
    imported_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        # Two orgs may share the same bank_reference; duplicates are per-org
        unique_together = ('organization', 'bank_reference')

    def __str__(self):
        return f"{self.bank_reference} ({self.amount})"


class MatchStatus(models.TextChoices):
    PROPOSED = 'proposed', 'Proposed'
    APPROVED = 'approved', 'Approved'
    REJECTED = 'rejected', 'Rejected'


class Match(models.Model):
    """A proposed link between one bank transaction and one line item."""
    transaction = models.ForeignKey(
        BankTransaction,
        on_delete=models.CASCADE,
        related_name='matches',
    )
    line_item = models.ForeignKey(
        LineItem,
        on_delete=models.CASCADE,
        related_name='matches',
    )
    status = models.CharField(
        max_length=20,
        choices=MatchStatus.choices,
        default=MatchStatus.PROPOSED,
    )
    reason = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('transaction', 'line_item')

    def __str__(self):
        return f"Match: {self.transaction} -> {self.line_item} [{self.status}]"
