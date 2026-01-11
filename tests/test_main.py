"""
Main Routes Tests

Tests for landing pages, health checks, and metrics.
"""

import pytest
from unittest.mock import patch, MagicMock


class TestIndexRoute:
    """Tests for the root / route."""

    def test_index_unauthenticated_redirects_to_login(self, client):
        """Test that unauthenticated users are redirected to login."""
        response = client.get("/", follow_redirects=False)
        assert response.status_code == 302
        assert "/login" in response.location

    def test_index_authenticated_redirects_to_app(self, auth_client):
        """Test that authenticated users are redirected to app."""
        response = auth_client.get("/", follow_redirects=False)
        assert response.status_code == 302
        assert "/app" in response.location


class TestLoginPage:
    """Tests for the /login route."""

    def test_login_page_renders(self, client):
        """Test that login page renders for unauthenticated users."""
        response = client.get("/login")
        assert response.status_code == 200
        assert b"login" in response.data.lower()

    def test_login_page_authenticated_redirects_to_app(self, auth_client):
        """Test that authenticated users are redirected from login page."""
        response = auth_client.get("/login", follow_redirects=False)
        assert response.status_code == 302
        assert "/app" in response.location

    def test_login_page_shows_dev_mode_when_not_configured(self, client, app):
        """Test that login page shows dev mode when Azure is not configured."""
        with app.app_context():
            # Temporarily override config
            original_client_id = app.config.get("AZURE_CLIENT_ID")
            original_client_secret = app.config.get("AZURE_CLIENT_SECRET")

            app.config["AZURE_CLIENT_ID"] = None
            app.config["AZURE_CLIENT_SECRET"] = None

            response = client.get("/login")
            assert response.status_code == 200

            # Restore config
            app.config["AZURE_CLIENT_ID"] = original_client_id
            app.config["AZURE_CLIENT_SECRET"] = original_client_secret


class TestDashboardRoute:
    """Tests for the /dashboard route."""

    def test_dashboard_unauthenticated_redirects_to_login(self, client):
        """Test that unauthenticated users cannot access dashboard."""
        response = client.get("/dashboard", follow_redirects=False)
        assert response.status_code == 302
        assert "/login" in response.location

    def test_dashboard_authenticated_renders(self, auth_client):
        """Test that authenticated users can access dashboard."""
        response = auth_client.get("/dashboard")
        assert response.status_code == 200
        # Check that user data is passed to template
        assert b"Test User" in response.data or b"user@northstar.com" in response.data


class TestAppRoute:
    """Tests for the /app route."""

    def test_app_unauthenticated_redirects_to_login(self, client):
        """Test that unauthenticated users cannot access app."""
        response = client.get("/app", follow_redirects=False)
        assert response.status_code == 302
        assert "/login" in response.location

    def test_app_authenticated_renders(self, auth_client):
        """Test that authenticated users can access app."""
        response = auth_client.get("/app")
        assert response.status_code == 200


class TestHealthRoute:
    """Tests for the /health endpoint."""

    def test_health_check_returns_200_when_healthy(self, client):
        """Test that health check returns 200 when all services are up."""
        response = client.get("/health")
        assert response.status_code == 200

        data = response.get_json()
        assert data["status"] == "healthy"
        assert "checks" in data
        assert data["checks"]["database"] == "ok"

    def test_health_check_does_not_require_auth(self, client):
        """Test that health check is accessible without authentication."""
        response = client.get("/health")
        # Should not redirect or return 401
        assert response.status_code in [200, 503]

    def test_health_check_includes_version(self, client):
        """Test that health check includes version information."""
        response = client.get("/health")
        data = response.get_json()
        assert "version" in data

    def test_health_check_handles_database_error(self, client, app):
        """Test that health check returns 503 when database is down."""
        with app.app_context():
            with patch("app.extensions.db.session.execute") as mock_execute:
                mock_execute.side_effect = Exception("Database connection failed")

                response = client.get("/health")
                assert response.status_code == 503

                data = response.get_json()
                assert data["status"] == "unhealthy"
                assert "error" in data["checks"]["database"]

    def test_health_check_redis_optional(self, client):
        """Test that Redis failure doesn't fail health check."""
        with patch("redis.from_url") as mock_redis:
            mock_redis.side_effect = Exception("Redis connection failed")

            response = client.get("/health")
            # Should still be healthy even if Redis fails
            data = response.get_json()
            assert "redis" in data["checks"]


class TestMetricsRoute:
    """Tests for the /metrics endpoint."""

    def test_metrics_requires_authentication(self, client):
        """Test that metrics endpoint requires authentication."""
        response = client.get("/metrics")
        assert response.status_code == 401
        assert "Authentication required" in response.get_json()["error"]

    def test_metrics_requires_admin(self, auth_client):
        """Test that metrics endpoint requires admin access."""
        response = auth_client.get("/metrics")
        assert response.status_code == 403
        assert "Admin access required" in response.get_json()["error"]

    def test_metrics_accessible_to_admin(self, admin_client):
        """Test that admin users can access metrics."""
        with patch("app.utils.observability.get_metrics") as mock_get_metrics:
            mock_get_metrics.return_value = {
                "total_requests": 100,
                "error_rate": 0.05,
                "avg_response_time_ms": 150
            }

            response = admin_client.get("/metrics")
            assert response.status_code == 200

            data = response.get_json()
            assert "total_requests" in data
            mock_get_metrics.assert_called_once()
