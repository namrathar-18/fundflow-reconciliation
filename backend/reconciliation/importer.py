"""
CSV import service for FundFlow.

Validates and imports bank statement CSV rows, then triggers matching.
"""

import csv
import io
from decimal import Decimal, InvalidOperation

from reconciliation.models import BankTransaction, Organization, TransactionStatus
from reconciliation.matching import run_matching

REQUIRED_COLUMNS = {'date', 'description', 'amount', 'type', 'reference'}


def parse_amount(raw: str) -> Decimal:
    """Remove thousands separators and parse as Decimal."""
    cleaned = raw.replace(',', '').strip()
    return Decimal(cleaned)


def import_csv(organization: Organization, file_obj) -> dict:
    """
    Parse and import a bank statement CSV for the given organization.

    Returns a dict:
        {
            'imported': int,
            'duplicates': int,
            'errors': [{'line': int, 'message': str}]
        }
    """
    try:
        content = file_obj.read()
        if isinstance(content, bytes):
            content = content.decode('utf-8-sig')  # handle BOM
        reader = csv.DictReader(io.StringIO(content))
    except Exception as exc:
        return {
            'imported': 0,
            'duplicates': 0,
            'errors': [{'line': 1, 'message': f'Could not read file: {exc}'}],
        }

    # Validate columns
    if reader.fieldnames is None:
        return {
            'imported': 0,
            'duplicates': 0,
            'errors': [{'line': 1, 'message': 'File is empty or has no header row.'}],
        }

    actual_columns = {col.strip().lower() for col in reader.fieldnames}
    missing = REQUIRED_COLUMNS - actual_columns
    if missing:
        return {
            'imported': 0,
            'duplicates': 0,
            'errors': [{
                'line': 1,
                'message': f'Missing required columns: {", ".join(sorted(missing))}',
            }],
        }

    imported = 0
    duplicates = 0
    errors = []

    # Track bank references seen within this file to catch intra-file duplicates
    seen_in_file: set[str] = set()

    for line_index, row in enumerate(reader, start=2):  # header is line 1
        # Trim all field values
        trimmed = {k.strip().lower(): v.strip() for k, v in row.items() if k}

        # --- Validate date ---
        raw_date = trimmed.get('date', '')
        if not raw_date:
            errors.append({'line': line_index, 'message': 'Missing date.'})
            continue
        try:
            from datetime import date
            year, month, day = raw_date.split('-')
            tx_date = date(int(year), int(month), int(day))
        except (ValueError, AttributeError):
            errors.append({'line': line_index, 'message': f'Invalid date: "{raw_date}". Expected YYYY-MM-DD.'})
            continue

        # --- Validate description ---
        description = trimmed.get('description', '')
        if not description:
            errors.append({'line': line_index, 'message': 'Missing description.'})
            continue

        # --- Validate amount ---
        raw_amount = trimmed.get('amount', '')
        if not raw_amount:
            errors.append({'line': line_index, 'message': 'Missing amount.'})
            continue
        try:
            amount = parse_amount(raw_amount)
        except InvalidOperation:
            errors.append({'line': line_index, 'message': f'Invalid amount: "{raw_amount}".'})
            continue

        if amount == Decimal('0'):
            errors.append({'line': line_index, 'message': 'Amount cannot be zero.'})
            continue

        # --- Validate type ---
        raw_type = trimmed.get('type', '').lower()
        if raw_type not in ('credit', 'debit'):
            errors.append({'line': line_index, 'message': f'Invalid type: "{raw_type}". Must be credit or debit.'})
            continue

        # Credits must be positive, debits must be negative
        if raw_type == 'credit' and amount < 0:
            errors.append({
                'line': line_index,
                'message': f'Credit transaction must have a positive amount, got {amount}.',
            })
            continue
        if raw_type == 'debit' and amount > 0:
            errors.append({
                'line': line_index,
                'message': f'Debit transaction must have a negative amount, got {amount}.',
            })
            continue

        # --- Validate reference ---
        bank_reference = trimmed.get('reference', '')
        if not bank_reference:
            errors.append({'line': line_index, 'message': 'Missing reference.'})
            continue

        # --- Duplicate check: within this file ---
        file_key = (organization.pk, bank_reference)
        if file_key in seen_in_file:
            duplicates += 1
            errors.append({'line': line_index, 'message': f'Duplicate reference "{bank_reference}" within this file.'})
            continue
        seen_in_file.add(file_key)

        # --- Duplicate check: against database ---
        if BankTransaction.objects.filter(
            organization=organization,
            bank_reference=bank_reference,
        ).exists():
            duplicates += 1
            errors.append({'line': line_index, 'message': f'Duplicate: reference "{bank_reference}" already imported.'})
            continue

        # --- Determine initial status ---
        if raw_type == 'debit':
            status = TransactionStatus.IGNORED
        else:
            status = None  # will be set by matching

        # --- Create transaction ---
        tx = BankTransaction.objects.create(
            organization=organization,
            date=tx_date,
            description=description,
            amount=amount,
            transaction_type=raw_type,
            bank_reference=bank_reference,
            status=TransactionStatus.IGNORED,  # temporary; will be updated for credits
        )

        # --- Run matching for credits ---
        if raw_type == 'credit':
            run_matching(tx)
        # debits stay IGNORED

        imported += 1

    return {
        'imported': imported,
        'duplicates': duplicates,
        'errors': errors,
    }
