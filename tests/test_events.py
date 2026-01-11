"""
Server-Sent Events Tests

Tests for the SSE event stream endpoint and helper functions.
"""

import pytest
import json
from unittest.mock import patch, MagicMock


class TestEventStream:
    """Tests for the /api/events SSE endpoint."""

    def test_events_requires_login(self, client):
        """Test that /api/events endpoint requires authentication."""
        response = client.get("/api/events")
        assert response.status_code == 401

    def test_events_initial_connection_message(self, auth_client):
        """Test that SSE stream sends initial connection message."""
        with patch("redis.from_url") as mock_from_url:
            mock_redis_instance = MagicMock()
            mock_pubsub = MagicMock()
            mock_from_url.return_value = mock_redis_instance
            mock_redis_instance.pubsub.return_value = mock_pubsub

            # Make listen() return empty iterator to end the stream
            mock_pubsub.listen.return_value = iter([])

            response = auth_client.get("/api/events")

            assert response.status_code == 200
            assert response.content_type.startswith("text/event-stream")
            assert response.headers.get("Cache-Control") == "no-cache"
            assert response.headers.get("X-Accel-Buffering") == "no"

            data = b"".join(response.response)
            assert b'data: {"type": "connected"}' in data

    def test_events_subscribes_to_user_channel(self, auth_client, sample_user):
        """Test that SSE subscribes to user-specific channel."""
        with patch("redis.from_url") as mock_from_url:
            mock_redis_instance = MagicMock()
            mock_pubsub = MagicMock()
            mock_from_url.return_value = mock_redis_instance
            mock_redis_instance.pubsub.return_value = mock_pubsub
            mock_pubsub.listen.return_value = iter([])

            auth_client.get("/api/events")

            expected_channel = f"user:{sample_user['id']}"
            mock_pubsub.subscribe.assert_called_with(expected_channel)

    def test_events_admin_subscribes_to_broadcast(self, admin_client, sample_admin):
        """Test that admin users also subscribe to broadcast channel."""
        with patch("redis.from_url") as mock_from_url:
            mock_redis_instance = MagicMock()
            mock_pubsub = MagicMock()
            mock_from_url.return_value = mock_redis_instance
            mock_redis_instance.pubsub.return_value = mock_pubsub
            mock_pubsub.listen.return_value = iter([])

            admin_client.get("/api/events")

            # Admin should subscribe to both user channel and admin broadcast
            calls = mock_pubsub.subscribe.call_args_list
            channels_subscribed = [call[0][0] for call in calls]

            assert f"user:{sample_admin['id']}" in channels_subscribed
            assert "admin:broadcast" in channels_subscribed

    def test_events_regular_user_no_admin_broadcast(self, auth_client, sample_user):
        """Test that regular users don't subscribe to admin broadcast."""
        with patch("redis.from_url") as mock_from_url:
            mock_redis_instance = MagicMock()
            mock_pubsub = MagicMock()
            mock_from_url.return_value = mock_redis_instance
            mock_redis_instance.pubsub.return_value = mock_pubsub
            mock_pubsub.listen.return_value = iter([])

            auth_client.get("/api/events")

            # Regular user should only subscribe to their own channel
            calls = mock_pubsub.subscribe.call_args_list
            channels_subscribed = [call[0][0] for call in calls]

            assert f"user:{sample_user['id']}" in channels_subscribed
            assert "admin:broadcast" not in channels_subscribed

    def test_events_receives_messages(self, auth_client):
        """Test that SSE stream receives and forwards messages."""
        with patch("redis.from_url") as mock_from_url:
            mock_redis_instance = MagicMock()
            mock_pubsub = MagicMock()
            mock_from_url.return_value = mock_redis_instance
            mock_redis_instance.pubsub.return_value = mock_pubsub

            # Simulate receiving a message
            test_message = {"type": "timesheet_approved", "timesheet_id": "123"}
            mock_pubsub.listen.return_value = iter([
                {"type": "message", "data": json.dumps(test_message).encode()}
            ])

            response = auth_client.get("/api/events")
            data = b"".join(response.response)

            assert b"timesheet_approved" in data

    def test_events_decodes_bytes_messages(self, auth_client):
        """Test that SSE stream properly decodes byte messages."""
        with patch("redis.from_url") as mock_from_url:
            mock_redis_instance = MagicMock()
            mock_pubsub = MagicMock()
            mock_from_url.return_value = mock_redis_instance
            mock_redis_instance.pubsub.return_value = mock_pubsub

            # Simulate receiving a bytes message
            test_message = '{"type": "note_added", "note_id": "456"}'
            mock_pubsub.listen.return_value = iter([
                {"type": "message", "data": test_message.encode("utf-8")}
            ])

            response = auth_client.get("/api/events")
            data = b"".join(response.response)

            assert b"note_added" in data


class TestPublishEvent:
    """Tests for the publish_event helper function."""

    def test_publish_event_sends_to_user_channel(self, app):
        """Test publishing event to a user's channel."""
        from app.routes.events import publish_event

        with app.app_context():
            with patch("redis.from_url") as mock_from_url:
                mock_redis_instance = MagicMock()
                mock_from_url.return_value = mock_redis_instance

                publish_event("user-123", "timesheet_approved", {"timesheet_id": "ts-456"})

                mock_redis_instance.publish.assert_called_once()
                call_args = mock_redis_instance.publish.call_args

                assert call_args[0][0] == "user:user-123"
                message = json.loads(call_args[0][1])
                assert message["type"] == "timesheet_approved"
                assert message["timesheet_id"] == "ts-456"

    def test_publish_event_handles_redis_error(self, app):
        """Test that publish_event handles Redis connection errors gracefully."""
        from app.routes.events import publish_event
        import redis as redis_module

        with app.app_context():
            with patch("redis.from_url") as mock_from_url:
                mock_from_url.side_effect = redis_module.ConnectionError("Connection refused")

                # Should not raise exception
                publish_event("user-123", "test_event", {"data": "test"})


class TestBroadcastToAdmins:
    """Tests for the broadcast_to_admins helper function."""

    def test_broadcast_to_admins_sends_to_admin_channel(self, app):
        """Test broadcasting event to admin channel."""
        from app.routes.events import broadcast_to_admins

        with app.app_context():
            with patch("redis.from_url") as mock_from_url:
                mock_redis_instance = MagicMock()
                mock_from_url.return_value = mock_redis_instance

                broadcast_to_admins("new_submission", {"user": "Test User", "week": "2026-01-05"})

                mock_redis_instance.publish.assert_called_once()
                call_args = mock_redis_instance.publish.call_args

                assert call_args[0][0] == "admin:broadcast"
                message = json.loads(call_args[0][1])
                assert message["type"] == "new_submission"
                assert message["user"] == "Test User"

    def test_broadcast_to_admins_handles_redis_error(self, app):
        """Test that broadcast_to_admins handles Redis connection errors gracefully."""
        from app.routes.events import broadcast_to_admins
        import redis as redis_module

        with app.app_context():
            with patch("redis.from_url") as mock_from_url:
                mock_from_url.side_effect = redis_module.ConnectionError("Connection refused")

                # Should not raise exception
                broadcast_to_admins("test_event", {"data": "test"})
