"""URL configuration for FundFlow."""

from django.contrib import admin
from django.urls import path, include
from django.http import JsonResponse

def api_root(request):
    return JsonResponse({
        "status": "healthy",
        "app": "FundFlow Capital Call Reconciliation API",
        "version": "1.0",
        "endpoints": {
            "organizations": "/api/organizations/",
            "transactions": "/api/transactions/",
            "line_items": "/api/line-items/",
            "import_csv": "/api/import/",
            "admin": "/admin/"
        }
    })

urlpatterns = [
    path('', api_root, name='api-root'),
    path('admin/', admin.site.urls),
    path('api/', include('reconciliation.urls')),
]
