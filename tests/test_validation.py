"""
Validation Module Tests (REQ-035)

Tests for app/utils/validation.py
"""

import pytest
from datetime import date, datetime
from app.utils.validation import (
    Field,
    validate_request,
    validate_uuid,
    validate_date,
    validate_datetime,
    validate_positive_number,
    validate_string_length,
    validate_enum,
    ValidationError,
)
from app.utils.errors import ErrorCode


class TestField:
    """Tests for Field validation class."""

    def test_required_field_missing(self):
        """Test that required field raises error when missing."""
        field = Field(required=True)
        with pytest.raises(ValidationError) as exc_info:
            field.validate(None, "test_field")
        assert "required" in exc_info.value.message.lower()

    def test_required_field_present(self):
        """Test that required field passes when present."""
        field = Field(required=True)
        result = field.validate("value", "test_field")
        assert result == "value"

    def test_nullable_field(self):
        """Test nullable vs non-nullable fields."""
        nullable_field = Field(nullable=True)
        non_nullable_field = Field(nullable=False)
        
        assert nullable_field.validate(None, "test") is None
        with pytest.raises(ValidationError):
            non_nullable_field.validate(None, "test")

    def test_string_type_validation(self):
        """Test string type validation and coercion."""
        field = Field(field_type=str)
        assert field.validate("hello", "test") == "hello"
        assert field.validate(123, "test") == "123"

    def test_int_type_validation(self):
        """Test integer type validation."""
        field = Field(field_type=int)
        assert field.validate(42, "test") == 42
        assert field.validate("42", "test") == 42
        
        with pytest.raises(ValidationError):
            field.validate("not a number", "test")

    def test_float_type_validation(self):
        """Test float type validation."""
        field = Field(field_type=float)
        assert field.validate(3.14, "test") == 3.14
        assert field.validate("3.14", "test") == 3.14
        assert field.validate(42, "test") == 42.0

    def test_bool_type_validation(self):
        """Test boolean type validation."""
        field = Field(field_type=bool)
        assert field.validate(True, "test") is True
        assert field.validate(False, "test") is False
        assert field.validate(1, "test") is True
        assert field.validate(0, "test") is False
        assert field.validate("true", "test") is True
        assert field.validate("false", "test") is False

    def test_list_type_validation(self):
        """Test list type validation."""
        field = Field(field_type=list)
        assert field.validate([1, 2, 3], "test") == [1, 2, 3]
        
        with pytest.raises(ValidationError):
            field.validate("not a list", "test")

    def test_dict_type_validation(self):
        """Test dict type validation."""
        field = Field(field_type=dict)
        assert field.validate({"key": "value"}, "test") == {"key": "value"}
        
        with pytest.raises(ValidationError):
            field.validate("not a dict", "test")

    def test_min_length_constraint(self):
        """Test minimum length constraint."""
        field = Field(min_length=3)
        assert field.validate("hello", "test") == "hello"
        
        with pytest.raises(ValidationError) as exc_info:
            field.validate("ab", "test")
        assert "at least 3" in exc_info.value.message

    def test_max_length_constraint(self):
        """Test maximum length constraint."""
        field = Field(max_length=5)
        assert field.validate("hello", "test") == "hello"
        
        with pytest.raises(ValidationError) as exc_info:
            field.validate("hello world", "test")
        assert "at most 5" in exc_info.value.message

    def test_min_value_constraint(self):
        """Test minimum value constraint."""
        field = Field(field_type=int, min_value=0)
        assert field.validate(5, "test") == 5
        
        with pytest.raises(ValidationError) as exc_info:
            field.validate(-1, "test")
        assert "at least 0" in exc_info.value.message

    def test_max_value_constraint(self):
        """Test maximum value constraint."""
        field = Field(field_type=int, max_value=100)
        assert field.validate(50, "test") == 50
        
        with pytest.raises(ValidationError) as exc_info:
            field.validate(150, "test")
        assert "at most 100" in exc_info.value.message

    def test_choices_constraint(self):
        """Test choices constraint."""
        field = Field(choices=["apple", "banana", "cherry"])
        assert field.validate("apple", "test") == "apple"
        
        with pytest.raises(ValidationError) as exc_info:
            field.validate("orange", "test")
        assert "must be one of" in exc_info.value.message

    def test_default_value(self):
        """Test default value for optional fields."""
        field = Field(default="default_value")
        assert field.validate(None, "test") == "default_value"

    def test_pattern_validation(self):
        """Test regex pattern validation."""
        field = Field(pattern=r"^\d{3}-\d{4}$")
        assert field.validate("123-4567", "test") == "123-4567"
        
        with pytest.raises(ValidationError) as exc_info:
            field.validate("invalid", "test")
        assert "invalid format" in exc_info.value.message

    def test_custom_validator(self):
        """Test custom validator function."""
        def must_be_even(value, field_name):
            if value % 2 != 0:
                raise ValidationError(f"{field_name} must be even", field_name)
            return value
        
        field = Field(field_type=int, custom_validator=must_be_even)
        assert field.validate(4, "test") == 4
        
        with pytest.raises(ValidationError) as exc_info:
            field.validate(3, "test")
        assert "must be even" in exc_info.value.message


class TestValidateUUID:
    """Tests for validate_uuid function."""

    def test_valid_uuid(self):
        """Test valid UUID validation."""
        valid_uuid = "12345678-1234-1234-1234-123456789abc"
        result = validate_uuid(valid_uuid, "id")
        assert result == valid_uuid

    def test_invalid_uuid(self):
        """Test invalid UUID raises error."""
        with pytest.raises(ValidationError) as exc_info:
            validate_uuid("not-a-uuid", "id")
        assert "valid UUID" in exc_info.value.message

    def test_empty_uuid(self):
        """Test empty/null UUID raises error."""
        with pytest.raises(ValidationError):
            validate_uuid("", "id")
        with pytest.raises(ValidationError):
            validate_uuid(None, "id")


class TestValidateDate:
    """Tests for validate_date function."""

    def test_valid_date_string(self):
        """Test valid date string validation."""
        result = validate_date("2024-01-15", "date")
        assert result == date(2024, 1, 15)

    def test_date_object(self):
        """Test date object passes through."""
        d = date(2024, 1, 15)
        result = validate_date(d, "date")
        assert result == d

    def test_datetime_object(self):
        """Test datetime object extracts date."""
        dt = datetime(2024, 1, 15, 12, 30)
        result = validate_date(dt, "date")
        assert result == date(2024, 1, 15)

    def test_invalid_date_string(self):
        """Test invalid date string raises error."""
        with pytest.raises(ValidationError) as exc_info:
            validate_date("not-a-date", "date")
        assert "valid date" in exc_info.value.message.lower()

    def test_none_date(self):
        """Test None returns None."""
        assert validate_date(None, "date") is None


class TestValidateDatetime:
    """Tests for validate_datetime function."""

    def test_valid_datetime_string(self):
        """Test valid datetime string validation."""
        result = validate_datetime("2024-01-15T12:30:00", "datetime")
        assert result.year == 2024
        assert result.month == 1
        assert result.day == 15
        assert result.hour == 12

    def test_datetime_with_z_suffix(self):
        """Test datetime with Z timezone suffix."""
        result = validate_datetime("2024-01-15T12:30:00Z", "datetime")
        assert result.year == 2024

    def test_datetime_object(self):
        """Test datetime object passes through."""
        dt = datetime(2024, 1, 15, 12, 30)
        result = validate_datetime(dt, "datetime")
        assert result == dt

    def test_invalid_datetime(self):
        """Test invalid datetime raises error."""
        with pytest.raises(ValidationError):
            validate_datetime("not-a-datetime", "datetime")

    def test_none_datetime(self):
        """Test None returns None."""
        assert validate_datetime(None, "datetime") is None


class TestValidatePositiveNumber:
    """Tests for validate_positive_number function."""

    def test_valid_positive_number(self):
        """Test valid positive number."""
        assert validate_positive_number(42.5, "amount") == 42.5
        assert validate_positive_number("100", "amount") == 100.0

    def test_zero_allowed_by_default(self):
        """Test that zero is allowed by default."""
        assert validate_positive_number(0, "amount") == 0.0

    def test_zero_not_allowed(self):
        """Test that zero can be disallowed."""
        with pytest.raises(ValidationError):
            validate_positive_number(0, "amount", allow_zero=False)

    def test_negative_number_rejected(self):
        """Test that negative numbers are rejected."""
        with pytest.raises(ValidationError) as exc_info:
            validate_positive_number(-5, "amount")
        assert "positive" in exc_info.value.message.lower()

    def test_max_value_enforced(self):
        """Test that max value is enforced."""
        with pytest.raises(ValidationError) as exc_info:
            validate_positive_number(1000, "amount", max_value=100)
        assert "at most" in exc_info.value.message

    def test_null_values_become_zero(self):
        """Test that null/empty values become zero."""
        assert validate_positive_number(None, "amount") == 0.0
        assert validate_positive_number("", "amount") == 0.0
        assert validate_positive_number("null", "amount") == 0.0

    def test_invalid_number_string(self):
        """Test that invalid number strings raise error."""
        with pytest.raises(ValidationError):
            validate_positive_number("not-a-number", "amount")


class TestValidateStringLength:
    """Tests for validate_string_length function."""

    def test_valid_string(self):
        """Test valid string passes."""
        result = validate_string_length("hello", "name")
        assert result == "hello"

    def test_string_trimmed(self):
        """Test string is trimmed."""
        result = validate_string_length("  hello  ", "name")
        assert result == "hello"

    def test_required_empty_string(self):
        """Test required field rejects empty string."""
        with pytest.raises(ValidationError):
            validate_string_length("", "name", required=True)

    def test_min_length_enforced(self):
        """Test minimum length is enforced."""
        with pytest.raises(ValidationError):
            validate_string_length("ab", "name", min_length=3)

    def test_max_length_truncates(self):
        """Test string is truncated to max length."""
        result = validate_string_length("hello world", "name", max_length=5)
        assert result == "hello"
        assert len(result) == 5

    def test_none_returns_none_when_not_required(self):
        """Test None returns None when not required."""
        assert validate_string_length(None, "name") is None


class TestValidateEnum:
    """Tests for validate_enum function."""

    def test_valid_enum_value(self):
        """Test valid enum value passes."""
        choices = ["NEW", "SUBMITTED", "APPROVED"]
        result = validate_enum("SUBMITTED", choices, "status")
        assert result == "SUBMITTED"

    def test_invalid_enum_value(self):
        """Test invalid enum value raises error."""
        choices = ["NEW", "SUBMITTED", "APPROVED"]
        with pytest.raises(ValidationError) as exc_info:
            validate_enum("INVALID", choices, "status")
        assert "must be one of" in exc_info.value.message

    def test_none_enum_value(self):
        """Test None returns None."""
        choices = ["NEW", "SUBMITTED"]
        assert validate_enum(None, choices, "status") is None


class TestValidateRequest:
    """Tests for validate_request function with schema."""

    def test_validate_simple_schema(self, app):
        """Test validating a simple schema."""
        with app.test_request_context(json={"name": "John", "age": 30}):
            schema = {
                "name": Field(required=True, field_type=str),
                "age": Field(required=True, field_type=int, min_value=0),
            }
            result = validate_request(schema)
            assert result["name"] == "John"
            assert result["age"] == 30

    def test_validate_with_missing_required_field(self, app):
        """Test validation fails with missing required field."""
        with app.test_request_context(json={"name": "John"}):
            schema = {
                "name": Field(required=True),
                "age": Field(required=True),
            }
            with pytest.raises(ValidationError) as exc_info:
                validate_request(schema)
            assert "Validation failed" in exc_info.value.message
            assert "errors" in exc_info.value.details

    def test_validate_with_explicit_data(self, app):
        """Test validating explicit data dict."""
        with app.test_request_context():
            schema = {"name": Field(required=True)}
            data = {"name": "Test"}
            result = validate_request(schema, data)
            assert result["name"] == "Test"

    def test_validate_optional_fields(self, app):
        """Test that optional fields use defaults."""
        with app.test_request_context(json={"name": "John"}):
            schema = {
                "name": Field(required=True),
                "nickname": Field(required=False, default="Unknown"),
            }
            result = validate_request(schema)
            assert result["name"] == "John"
            assert result["nickname"] == "Unknown"
