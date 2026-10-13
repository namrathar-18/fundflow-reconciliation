"""
Middleware to resolve the X-Organization header into an organization object
and attach it to the request.
"""

from django.http import JsonResponse
from reconciliation.models import Organization


class OrganizationMiddleware:
    """
    Reads X-Organization header on every /api/ request.
    Attaches request.organization or returns 400/404.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Only enforce on API paths
        if request.path.startswith('/api/'):
            slug = request.headers.get('X-Organization', '').strip()
            if not slug:
                return JsonResponse(
                    {'detail': 'X-Organization header is required.'},
                    status=400,
                )
            try:
                request.organization = Organization.objects.get(slug=slug)
            except Organization.DoesNotExist:
                return JsonResponse(
                    {'detail': f'Organization "{slug}" not found.'},
                    status=404,
                )
        return self.get_response(request)
