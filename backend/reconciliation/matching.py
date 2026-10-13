"""
Matching service for FundFlow.

Implements the two-step matching algorithm:
 1. Reference check (normalised wire reference in description/bank_ref)
 2. Name + exact amount check fallback
"""

import re
from decimal import Decimal

from reconciliation.models import (
    BankTransaction,
    LineItem,
    Match,
    MatchStatus,
    TransactionStatus,
)


# ---------------------------------------------------------------------------
# Normalisation helpers
# ---------------------------------------------------------------------------

_NON_ALNUM = re.compile(r'[^A-Z0-9]')
_NON_ALNUM_WITH_SPACE = re.compile(r'[^A-Z0-9 ]')
_MULTI_SPACE = re.compile(r' {2,}')
_SUFFIX = re.compile(r'\b(LLC|LP|LTD|INC)\s*$')


def normalise_reference(ref: str) -> str:
    """Uppercase, remove everything except letters and digits."""
    return _NON_ALNUM.sub('', ref.upper())


def normalise_name(name: str) -> str:
    """
    Uppercase, replace non-alphanum with space, collapse spaces,
    drop trailing LLC/LP/LTD/INC. TRUST is kept.
    """
    s = name.upper()
    s = _NON_ALNUM_WITH_SPACE.sub(' ', s)
    s = _MULTI_SPACE.sub(' ', s).strip()
    s = _SUFFIX.sub('', s).strip()
    return s


def name_found_in_description(investor_name: str, description: str) -> bool:
    """
    True if the normalised investor name appears as whole words in the
    normalised description.
    """
    norm_name = normalise_name(investor_name)
    norm_desc = normalise_name(description)
    # Build a pattern that matches the name as whole words
    pattern = r'(?<![A-Z0-9])' + re.escape(norm_name) + r'(?![A-Z0-9])'
    return bool(re.search(pattern, norm_desc))


# ---------------------------------------------------------------------------
# Eligible line items
# ---------------------------------------------------------------------------

def get_eligible_line_items(organization, transaction_date):
    """
    Line items that:
    - belong to the same organization
    - have amount_remaining > 0
    - belong to a capital call with call_date <= transaction_date
    """
    return (
        LineItem.objects
        .select_related('capital_call', 'investor_entity')
        .filter(
            capital_call__organization=organization,
            capital_call__call_date__lte=transaction_date,
            amount_funded__lt=models_amount_called_ref(),
        )
    )


def models_amount_called_ref():
    # We'll use a different approach – filter in Python after queryset
    # This is just a sentinel; real filtering done in get_eligible_line_items_qs
    pass


def get_eligible_line_items_qs(organization, transaction_date):
    """
    Returns QuerySet of eligible line items (remaining > 0, call_date <= tx date).
    Uses __lt on amount_funded to find items where funded < called.
    """
    from django.db.models import F
    return (
        LineItem.objects
        .select_related('capital_call', 'investor_entity')
        .filter(
            capital_call__organization=organization,
            capital_call__call_date__lte=transaction_date,
        )
        .filter(amount_funded__lt=F('amount_called'))
    )


# ---------------------------------------------------------------------------
# Core matching
# ---------------------------------------------------------------------------

def build_match_reason(match_type: str, extra: str = '') -> str:
    if extra:
        return f"{match_type}; {extra}"
    return match_type


def run_matching(transaction: BankTransaction):
    """
    Run the two-step matching algorithm for a single credit transaction.
    Creates Match records and sets transaction.status.
    Saves the transaction at the end.
    """
    eligible = list(get_eligible_line_items_qs(
        transaction.organization,
        transaction.date,
    ))

    norm_desc = normalise_reference(transaction.description)
    norm_bank_ref = normalise_reference(transaction.bank_reference)

    amount = transaction.amount  # always positive for credits

    # -----------------------------------------------------------------------
    # Step 1: Reference check
    # -----------------------------------------------------------------------
    ref_matches = []
    for li in eligible:
        norm_ref = normalise_reference(li.wire_reference)
        if norm_ref in norm_desc or norm_ref in norm_bank_ref:
            ref_matches.append(li)

    if ref_matches:
        _handle_reference_matches(transaction, ref_matches, amount)
        transaction.save()
        return

    # -----------------------------------------------------------------------
    # Step 2: Name + amount check
    # -----------------------------------------------------------------------
    name_amount_matches = []
    for li in eligible:
        remaining = li.amount_called - li.amount_funded
        if amount == remaining and name_found_in_description(li.investor_entity.name, transaction.description):
            name_amount_matches.append(li)

    _handle_name_amount_matches(transaction, name_amount_matches, amount)
    transaction.save()


def _handle_reference_matches(transaction, ref_matches, amount):
    if len(ref_matches) == 1:
        li = ref_matches[0]
        remaining = li.amount_called - li.amount_funded
        if amount <= remaining:
            reason = (
                f"Reference {li.wire_reference} found in description/bank reference"
                + (f"; partial payment, remaining was {remaining}" if amount < remaining else f"; amount equals remaining {remaining}")
            )
            Match.objects.create(
                transaction=transaction,
                line_item=li,
                status=MatchStatus.PROPOSED,
                reason=reason,
            )
            transaction.status = TransactionStatus.SUGGESTED
            transaction.review_reason = ''
        else:
            # Overpayment
            transaction.status = TransactionStatus.NEEDS_REVIEW
            transaction.review_reason = (
                f"Reference {li.wire_reference} found but amount {amount} exceeds "
                f"remaining {li.amount_called - li.amount_funded}"
            )
    else:
        # Multiple reference matches
        for li in ref_matches:
            remaining = li.amount_called - li.amount_funded
            reason = (
                f"Reference {li.wire_reference} found; multiple reference matches, manual review required"
            )
            Match.objects.create(
                transaction=transaction,
                line_item=li,
                status=MatchStatus.PROPOSED,
                reason=reason,
            )
        transaction.status = TransactionStatus.NEEDS_REVIEW
        transaction.review_reason = (
            f"Multiple references found: {', '.join(li.wire_reference for li in ref_matches)}"
        )


def _handle_name_amount_matches(transaction, name_amount_matches, amount):
    if len(name_amount_matches) == 1:
        li = name_amount_matches[0]
        remaining = li.amount_called - li.amount_funded
        reason = (
            f"Investor name '{li.investor_entity.name}' found in description "
            f"and amount {amount} equals remaining {remaining}"
        )
        Match.objects.create(
            transaction=transaction,
            line_item=li,
            status=MatchStatus.PROPOSED,
            reason=reason,
        )
        transaction.status = TransactionStatus.SUGGESTED
        transaction.review_reason = ''
    elif len(name_amount_matches) > 1:
        for li in name_amount_matches:
            remaining = li.amount_called - li.amount_funded
            reason = (
                f"Investor name '{li.investor_entity.name}' found and amount matches; "
                f"multiple candidates, manual review required"
            )
            Match.objects.create(
                transaction=transaction,
                line_item=li,
                status=MatchStatus.PROPOSED,
                reason=reason,
            )
        transaction.status = TransactionStatus.NEEDS_REVIEW
        transaction.review_reason = (
            f"Multiple name+amount matches: "
            + ', '.join(li.investor_entity.name for li in name_amount_matches)
        )
    else:
        transaction.status = TransactionStatus.NEEDS_REVIEW
        transaction.review_reason = 'No matching reference or name+amount combination found'
