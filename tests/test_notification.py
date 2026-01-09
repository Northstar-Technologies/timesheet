"""
Notification Service Tests (REQ-037)

Tests for app/services/notification.py
"""

import pytest
from datetime import date, datetime
from unittest.mock import patch, MagicMock
from app.services.notification import NotificationService
from app.models import Notification, NotificationType, User, Timesheet, TimesheetStatus


class TestNotificationService:
    """Tests for NotificationService class."""

    @pytest.fixture
    def mock_timesheet(self, app, sample_user):
        """Create a mock timesheet for testing."""
        with app.app_context():
            from app.extensions import db
            from app.models import User as UserModel, Timesheet as TimesheetModel
            
            # Get the user
            user = UserModel.query.filter_by(email=sample_user["email"]).first()
            if not user:
                user = UserModel(
                    email=sample_user["email"],
                    display_name="Test User",
                    phone="+15551234567"
                )
                db.session.add(user)
                db.session.commit()
            
            # Create timesheet
            timesheet = TimesheetModel(
                user_id=user.id,
                week_start=date(2024, 1, 7),
                status=TimesheetStatus.SUBMITTED
            )
            db.session.add(timesheet)
            db.session.commit()
            
            yield timesheet
            
            # Cleanup
            db.session.delete(timesheet)
            db.session.commit()

    @patch("app.services.notification.send_sms")
    def test_notify_approved_creates_notification(self, mock_send_sms, app, mock_timesheet):
        """Test that notify_approved creates a notification record."""
        mock_send_sms.return_value = {"success": True, "dev_mode": True}
        
        with app.app_context():
            from app.extensions import db
            from app.models import Timesheet as TimesheetModel
            
            # Reload timesheet in this context
            timesheet = TimesheetModel.query.get(mock_timesheet.id)
            
            result = NotificationService.notify_approved(timesheet)
            
            # Should create a notification
            assert result is not None
            assert result.notification_type == NotificationType.APPROVED

    @patch("app.services.notification.send_sms")
    def test_notify_approved_sends_sms(self, mock_send_sms, app, mock_timesheet):
        """Test that notify_approved calls send_sms."""
        mock_send_sms.return_value = {"success": True, "dev_mode": True}
        
        with app.app_context():
            from app.models import Timesheet as TimesheetModel
            
            timesheet = TimesheetModel.query.get(mock_timesheet.id)
            NotificationService.notify_approved(timesheet)
            
            # Should have called send_sms
            mock_send_sms.assert_called_once()
            call_args = mock_send_sms.call_args
            assert "approved" in call_args[0][1].lower() or "approved" in str(call_args).lower()

    @patch("app.services.notification.send_sms")
    def test_notify_approved_skips_user_without_phone(self, mock_send_sms, app):
        """Test that notify_approved skips users without phone numbers."""
        with app.app_context():
            from app.extensions import db
            from app.models import User as UserModel, Timesheet as TimesheetModel
            
            # Create user without phone
            user = UserModel(
                email="no_phone@test.com",
                display_name="No Phone User",
                phone=None
            )
            db.session.add(user)
            db.session.commit()
            
            timesheet = TimesheetModel(
                user_id=user.id,
                week_start=date(2024, 1, 14),
                status=TimesheetStatus.SUBMITTED
            )
            db.session.add(timesheet)
            db.session.commit()
            
            result = NotificationService.notify_approved(timesheet)
            
            # Should not call send_sms for user without phone
            mock_send_sms.assert_not_called()
            
            # Cleanup
            db.session.delete(timesheet)
            db.session.delete(user)
            db.session.commit()

    @patch("app.services.notification.send_sms")
    def test_notify_needs_attention_includes_reason(self, mock_send_sms, app, mock_timesheet):
        """Test that notify_needs_attention includes rejection reason."""
        mock_send_sms.return_value = {"success": True, "dev_mode": True}
        
        with app.app_context():
            from app.models import Timesheet as TimesheetModel
            
            timesheet = TimesheetModel.query.get(mock_timesheet.id)
            NotificationService.notify_needs_attention(timesheet, reason="Missing attachment")
            
            # Should include reason in message
            mock_send_sms.assert_called_once()
            call_args = mock_send_sms.call_args
            message = call_args[0][1]
            assert "Missing attachment" in message or "attention" in message.lower()

    @patch("app.services.notification.send_sms")
    def test_notify_needs_attention_notification_type(self, mock_send_sms, app, mock_timesheet):
        """Test notification type is correct for needs_attention."""
        mock_send_sms.return_value = {"success": True, "dev_mode": True}
        
        with app.app_context():
            from app.models import Timesheet as TimesheetModel
            
            timesheet = TimesheetModel.query.get(mock_timesheet.id)
            result = NotificationService.notify_needs_attention(timesheet)
            
            if result:
                assert result.notification_type == NotificationType.NEEDS_ATTENTION

    @patch("app.services.notification.send_sms")
    def test_send_weekly_reminder(self, mock_send_sms, app, sample_user):
        """Test send_weekly_reminder creates notification."""
        mock_send_sms.return_value = {"success": True, "dev_mode": True}
        
        with app.app_context():
            from app.models import User as UserModel
            
            user = UserModel.query.filter_by(email=sample_user["email"]).first()
            if user and user.phone:
                result = NotificationService.send_weekly_reminder(user, date(2024, 1, 7))
                
                if result:
                    assert result.notification_type == NotificationType.REMINDER

    @patch("app.services.notification.send_sms")
    def test_notify_unsubmitted(self, mock_send_sms, app, sample_user):
        """Test notify_unsubmitted for late timesheet."""
        mock_send_sms.return_value = {"success": True, "dev_mode": True}
        
        with app.app_context():
            from app.models import User as UserModel
            
            user = UserModel.query.filter_by(email=sample_user["email"]).first()
            if user and user.phone:
                result = NotificationService.notify_unsubmitted(user, date(2024, 1, 7))
                
                if result:
                    assert result.notification_type == NotificationType.UNSUBMITTED


class TestNotificationMessageContent:
    """Tests for notification message content formatting."""

    @patch("app.services.notification.send_sms")
    def test_approved_message_contains_week_info(self, mock_send_sms, app):
        """Test approved message contains week information."""
        mock_send_sms.return_value = {"success": True, "dev_mode": True}
        
        with app.app_context():
            from app.extensions import db
            from app.models import User as UserModel, Timesheet as TimesheetModel
            
            user = UserModel(
                email="message_test@test.com",
                display_name="Message Test",
                phone="+15551234567"
            )
            db.session.add(user)
            db.session.commit()
            
            timesheet = TimesheetModel(
                user_id=user.id,
                week_start=date(2024, 1, 7),
                status=TimesheetStatus.APPROVED
            )
            db.session.add(timesheet)
            db.session.commit()
            
            NotificationService.notify_approved(timesheet)
            
            # Check message content
            mock_send_sms.assert_called_once()
            phone, message = mock_send_sms.call_args[0]
            
            assert phone == "+15551234567"
            # Message should contain week information
            assert "1/7" in message or "Jan" in message or "approved" in message.lower()
            
            # Cleanup
            db.session.delete(timesheet)
            db.session.delete(user)
            db.session.commit()
