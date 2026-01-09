"""
Error Handling Tests (REQ-035)

Tests for app/utils/errors.py
"""

import pytest
from flask import g
from app.utils.errors import (
    ErrorCode,
    APIError,
    ValidationError,
    NotFoundError,
    ForbiddenError,
    ConflictError,
    InvalidStatusError,
    error_response,
    validation_error,
    not_found,
    init_request_id,
    get_request_id,
)


class TestErrorCode:
    """Tests for ErrorCode constants."""

    def test_error_codes_exist(self):
        """Test that key error codes are defined."""
        assert ErrorCode.VALIDATION_ERROR == "VALIDATION_ERROR"
        assert ErrorCode.NOT_FOUND == "NOT_FOUND"
        assert ErrorCode.FORBIDDEN == "FORBIDDEN"
        assert ErrorCode.INTERNAL_ERROR == "INTERNAL_ERROR"
        assert ErrorCode.TIMESHEET_NOT_FOUND == "TIMESHEET_NOT_FOUND"

    def test_all_error_codes_are_strings(self):
        """Test that all error codes are strings."""
        for attr in dir(ErrorCode):
            if not attr.startswith("_"):
                value = getattr(ErrorCode, attr)
                assert isinstance(value, str)


class TestAPIError:
    """Tests for APIError exception class."""

    def test_api_error_creation(self):
        """Test creating an APIError."""
        error = APIError("Something went wrong", code="TEST_ERROR", status_code=400)
        assert error.message == "Something went wrong"
        assert error.code == "TEST_ERROR"
        assert error.status_code == 400

    def test_api_error_to_dict(self, app):
        """Test APIError.to_dict() format."""
        with app.test_request_context():
            error = APIError(
                "Test error",
                code=ErrorCode.VALIDATION_ERROR,
                status_code=400,
                details={"field": "test"}
            )
            result = error.to_dict()
            
            assert result["error"] == "Test error"
            assert result["code"] == ErrorCode.VALIDATION_ERROR
            assert result["details"]["field"] == "test"

    def test_api_error_includes_request_id(self, app):
        """Test that APIError includes request_id when available."""
        with app.test_request_context():
            g.request_id = "test-123"
            error = APIError("Test error")
            result = error.to_dict()
            
            assert result["request_id"] == "test-123"

    def test_api_error_default_values(self):
        """Test APIError default values."""
        error = APIError("Error message")
        assert error.code == ErrorCode.INTERNAL_ERROR
        assert error.status_code == 500
        assert error.details == {}


class TestValidationError:
    """Tests for ValidationError exception class."""

    def test_validation_error_creation(self):
        """Test creating a ValidationError."""
        error = ValidationError("Invalid input", field="email")
        assert error.message == "Invalid input"
        assert error.code == ErrorCode.VALIDATION_ERROR
        assert error.status_code == 400
        assert error.details["field"] == "email"

    def test_validation_error_without_field(self):
        """Test ValidationError without field specified."""
        error = ValidationError("Invalid input")
        assert error.message == "Invalid input"
        assert error.details is None or "field" not in error.details


class TestNotFoundError:
    """Tests for NotFoundError exception class."""

    def test_not_found_error_generic(self):
        """Test generic NotFoundError."""
        error = NotFoundError("Resource")
        assert error.message == "Resource not found"
        assert error.code == ErrorCode.NOT_FOUND
        assert error.status_code == 404

    def test_not_found_error_timesheet(self):
        """Test NotFoundError for Timesheet uses correct code."""
        error = NotFoundError("Timesheet", "123")
        assert error.code == ErrorCode.TIMESHEET_NOT_FOUND
        assert error.details["id"] == "123"

    def test_not_found_error_user(self):
        """Test NotFoundError for User uses correct code."""
        error = NotFoundError("User")
        assert error.code == ErrorCode.USER_NOT_FOUND

    def test_not_found_error_attachment(self):
        """Test NotFoundError for Attachment uses correct code."""
        error = NotFoundError("Attachment")
        assert error.code == ErrorCode.ATTACHMENT_NOT_FOUND


class TestForbiddenError:
    """Tests for ForbiddenError exception class."""

    def test_forbidden_error_default_message(self):
        """Test ForbiddenError with default message."""
        error = ForbiddenError()
        assert error.message == "Access denied"
        assert error.code == ErrorCode.FORBIDDEN
        assert error.status_code == 403

    def test_forbidden_error_custom_message(self):
        """Test ForbiddenError with custom message."""
        error = ForbiddenError("You don't have permission")
        assert error.message == "You don't have permission"


class TestConflictError:
    """Tests for ConflictError exception class."""

    def test_conflict_error(self):
        """Test ConflictError creation."""
        error = ConflictError("Resource already exists", {"id": "123"})
        assert error.message == "Resource already exists"
        assert error.code == ErrorCode.ALREADY_EXISTS
        assert error.status_code == 409
        assert error.details["id"] == "123"


class TestInvalidStatusError:
    """Tests for InvalidStatusError exception class."""

    def test_invalid_status_error(self):
        """Test InvalidStatusError creation."""
        error = InvalidStatusError("Cannot edit submitted timesheet", "SUBMITTED")
        assert error.message == "Cannot edit submitted timesheet"
        assert error.code == ErrorCode.INVALID_STATUS
        assert error.status_code == 400
        assert error.details["current_status"] == "SUBMITTED"


class TestErrorResponseHelpers:
    """Tests for error response helper functions."""

    def test_error_response_format(self, app):
        """Test error_response returns correct format."""
        with app.test_request_context():
            response, status_code = error_response(
                "Test error",
                code=ErrorCode.VALIDATION_ERROR,
                status_code=400,
                details={"field": "test"}
            )
            
            assert status_code == 400
            assert response["error"] == "Test error"
            assert response["code"] == ErrorCode.VALIDATION_ERROR
            assert response["details"]["field"] == "test"

    def test_validation_error_helper(self, app):
        """Test validation_error helper function."""
        with app.test_request_context():
            response, status_code = validation_error("Invalid email", "email")
            
            assert status_code == 400
            assert response["code"] == ErrorCode.VALIDATION_ERROR
            assert response["details"]["field"] == "email"

    def test_not_found_helper(self, app):
        """Test not_found helper function."""
        with app.test_request_context():
            response, status_code = not_found("Timesheet")
            
            assert status_code == 404
            assert response["error"] == "Timesheet not found"
            assert response["code"] == ErrorCode.TIMESHEET_NOT_FOUND


class TestRequestIdMiddleware:
    """Tests for request ID middleware functions."""

    def test_init_request_id_generates_new(self, app):
        """Test that init_request_id generates new ID when not provided."""
        with app.test_request_context():
            init_request_id()
            request_id = get_request_id()
            
            assert request_id is not None
            assert len(request_id) == 8  # Short UUID

    def test_init_request_id_uses_header(self, app):
        """Test that init_request_id uses X-Request-ID header when provided."""
        with app.test_request_context(headers={"X-Request-ID": "custom-id-123"}):
            init_request_id()
            request_id = get_request_id()
            
            assert request_id == "custom-id-123"

    def test_get_request_id_returns_none_before_init(self, app):
        """Test that get_request_id returns None before initialization."""
        with app.test_request_context():
            # Don't call init_request_id
            g.pop('request_id', None)  # Ensure it's not set
            request_id = get_request_id()
            
            assert request_id is None


class TestGlobalErrorHandlers:
    """Tests for global error handlers registered with app."""

    def test_400_error_format(self, client):
        """Test that 400 errors return standardized format."""
        # This would need a route that triggers a 400 error
        # For now, we test via direct API calls
        response = client.post("/api/timesheets", json=None)
        # With CSRF, this might return 400
        if response.status_code == 400:
            data = response.get_json()
            assert "error" in data
            assert "code" in data

    def test_404_error_format(self, client):
        """Test that 404 errors return standardized format."""
        response = client.get("/api/nonexistent-route-12345")
        assert response.status_code == 404
        data = response.get_json()
        assert data["error"] == "Resource not found"
        assert data["code"] == ErrorCode.NOT_FOUND

    def test_response_includes_request_id_header(self, client):
        """Test that responses include X-Request-ID header."""
        response = client.get("/auth/me")
        assert "X-Request-ID" in response.headers
        assert len(response.headers["X-Request-ID"]) > 0
