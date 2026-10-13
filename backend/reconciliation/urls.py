"""URL routing for the reconciliation app."""

from django.urls import path
from reconciliation import views

urlpatterns = [
    # Organizations (for org switcher; no auth required)
    path('organizations/', views.OrganizationView.as_view(), name='organizations'),

    # Import
    path('import/', views.ImportView.as_view(), name='import'),

    # Transactions
    path('transactions/', views.TransactionListView.as_view(), name='transactions'),
    path('transactions/<int:pk>/ignore/', views.TransactionIgnoreView.as_view(), name='transaction-ignore'),

    # Line items
    path('line-items/', views.LineItemListView.as_view(), name='line-items'),

    # Match actions
    path('matches/<int:pk>/approve/', views.MatchApproveView.as_view(), name='match-approve'),
    path('matches/<int:pk>/reject/', views.MatchRejectView.as_view(), name='match-reject'),
]
