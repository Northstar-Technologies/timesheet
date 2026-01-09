"""
SMS Utility Tests (REQ-037)

Tests for app/utils/sms.py
"""

import pytest
from unittest.mock import patch, MagicMock
from app.utils.sms import (
    is_twilio_configured,
    send_sms,
    format_phone_number,
)


class TestIsTwilioConfigured:
    """Tests for is_twilio_configured function."""

    def test_not_configured_when_missing_sid(self, app):
        """Test returns False when account SID is missing."""
        with app.app_context():
            app.config["TWILIO_ACCOUNT_SID"] = ""
            app.config["TWILIO_AUTH_TOKEN"] = "test_token"
            app.config["TWILIO_PHONE_NUMBER"] = "+15551234567"
            assert is_twilio_configured() is False

    def test_not_configured_when_missing_token(self, app):
        """Test returns False when auth token is missing."""
        with app.app_context():
            app.config["TWILIO_ACCOUNT_SID"] = "ACtest123"
            app.config["TWILIO_AUTH_TOKEN"] = ""
            app.config["TWILIO_PHONE_NUMBER"] = "+15551234567"
            assert is_twilio_configured() is False

    def test_not_configured_when_missing_phone(self, app):
        """Test returns False when phone number is missing."""
        with app.app_context():
            app.config["TWILIO_ACCOUNT_SID"] = "ACtest123"
            app.config["TWILIO_AUTH_TOKEN"] = "test_token"
            app.config["TWILIO_PHONE_NUMBER"] = ""
            assert is_twilio_configured() is False

    def test_not_configured_with_placeholder_sid(self, app):
        """Test returns False when SID contains placeholder."""
        with app.app_context():
            app.config["TWILIO_ACCOUNT_SID"] = "your-account-sid"
            app.config["TWILIO_AUTH_TOKEN"] = "test_token"
            app.config["TWILIO_PHONE_NUMBER"] = "+15551234567"
            assert is_twilio_configured() is False

    def test_not_configured_with_invalid_sid_prefix(self, app):
        """Test returns False when SID doesn't start with AC."""
        with app.app_context():
            app.config["TWILIO_ACCOUNT_SID"] = "invalid_sid"
            app.config["TWILIO_AUTH_TOKEN"] = "test_token"
            app.config["TWILIO_PHONE_NUMBER"] = "+15551234567"
            assert is_twilio_configured() is False

    def test_configured_with_valid_credentials(self, app):
        """Test returns True with valid credentials."""
        with app.app_context():
            app.config["TWILIO_ACCOUNT_SID"] = "ACvalidsid123456789012345678901234"
            app.config["TWILIO_AUTH_TOKEN"] = "valid_auth_token"
            app.config["TWILIO_PHONE_NUMBER"] = "+15551234567"
            assert is_twilio_configured() is True


class TestSendSMS:
    """Tests for send_sms function."""

    def test_send_sms_invalid_phone_format(self, app):
        """Test send_sms rejects invalid phone format."""
        with app.app_context():
            result = send_sms("5551234567", "Test message")
            assert result["success"] is False
            assert "Invalid phone number" in result["error"]

    def test_send_sms_empty_phone(self, app):
        """Test send_sms rejects empty phone."""
        with app.app_context():
            result = send_sms("", "Test message")
            assert result["success"] is False
            assert "Invalid phone number" in result["error"]

    def test_send_sms_empty_message(self, app):
        """Test send_sms rejects empty message."""
        with app.app_context():
            result = send_sms("+15551234567", "")
            assert result["success"] is False
            assert "cannot be empty" in result["error"]

    def test_send_sms_dev_mode_logs_message(self, app):
        """Test send_sms logs message in dev mode."""
        with app.app_context():
            # Ensure Twilio is not configured (dev mode)
            app.config["TWILIO_ACCOUNT_SID"] = ""
            
            result = send_sms("+15551234567", "Test message for dev mode")
            
            assert result["success"] is True
            assert result["dev_mode"] is True
            assert "dev mode" in result["message"].lower()

    @patch("app.utils.sms.is_twilio_configured")
    def test_send_sms_twilio_success(self, mock_configured, app):
        """Test send_sms succeeds with real Twilio."""
        mock_configured.return_value = True
        
        with app.app_context():
            app.config["TWILIO_ACCOUNT_SID"] = "ACtest"
            app.config["TWILIO_AUTH_TOKEN"] = "test_token"
            app.config["TWILIO_PHONE_NUMBER"] = "+15551234567"
            
            # Mock the Twilio client
            with patch("app.utils.sms.Client") as MockClient:
                mock_client = MagicMock()
                mock_message = MagicMock()
                mock_message.sid = "SM123456"
                mock_message.status = "sent"
                mock_client.messages.create.return_value = mock_message
                MockClient.return_value = mock_client
                
                result = send_sms("+15559876543", "Hello from test")
                
                assert result["success"] is True
                assert result["message_sid"] == "SM123456"
                assert result["status"] == "sent"

    @patch("app.utils.sms.is_twilio_configured")
    def test_send_sms_twilio_error(self, mock_configured, app):
        """Test send_sms handles Twilio errors."""
        mock_configured.return_value = True
        
        with app.app_context():
            app.config["TWILIO_ACCOUNT_SID"] = "ACtest"
            app.config["TWILIO_AUTH_TOKEN"] = "test_token"
            app.config["TWILIO_PHONE_NUMBER"] = "+15551234567"
            
            # Mock the Twilio client to raise an exception
            with patch("app.utils.sms.Client") as MockClient:
                from twilio.base.exceptions import TwilioRestException
                mock_client = MagicMock()
                mock_client.messages.create.side_effect = TwilioRestException(
                    status=400, uri="/test", msg="Invalid number"
                )
                MockClient.return_value = mock_client
                
                result = send_sms("+15559876543", "Hello from test")
                
                assert result["success"] is False
                assert "Twilio error" in result["error"]


class TestFormatPhoneNumber:
    """Tests for format_phone_number function."""

    def test_format_none(self):
        """Test formatting None returns None."""
        assert format_phone_number(None) is None

    def test_format_empty_string(self):
        """Test formatting empty string returns None."""
        assert format_phone_number("") is None

    def test_format_already_e164(self):
        """Test E.164 number passes through unchanged."""
        assert format_phone_number("+15551234567") == "+15551234567"

    def test_format_10_digit_us_number(self):
        """Test 10-digit US number gets +1 prefix."""
        assert format_phone_number("5551234567") == "+15551234567"

    def test_format_10_digit_with_formatting(self):
        """Test 10-digit number with formatting characters."""
        assert format_phone_number("555-123-4567") == "+15551234567"
        assert format_phone_number("(555) 123-4567") == "+15551234567"
        assert format_phone_number("555.123.4567") == "+15551234567"

    def test_format_11_digit_with_country_code(self):
        """Test 11-digit US number with country code."""
        assert format_phone_number("15551234567") == "+15551234567"

    def test_format_11_digit_with_formatting(self):
        """Test 11-digit number with formatting."""
        assert format_phone_number("1-555-123-4567") == "+15551234567"
        assert format_phone_number("1 (555) 123-4567") == "+15551234567"

    def test_format_international_number(self):
        """Test international number without + prefix."""
        # 12+ digit numbers get + prefix added
        result = format_phone_number("447911123456")
        assert result.startswith("+")
        assert "447911123456" in result
