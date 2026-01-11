"""
Server-Sent Events Routes

Real-time updates for the frontend.
"""

from flask import Blueprint, Response, session, current_app
from ..utils.decorators import login_required

events_bp = Blueprint("events", __name__)


@events_bp.route("/events")
@login_required
def event_stream():
    """
    SSE endpoint for real-time updates.

    Clients subscribe to receive notifications about:
    - Timesheet status changes
    - New notes
    - Approval updates

    Returns:
        Response: SSE stream
    """
    user_id = session["user"]["id"]
    is_admin = session["user"].get("is_admin", False)

    def generate():
        """Generator for SSE messages."""
        import redis
        import json

        # Connect to Redis for pub/sub
        redis_url = current_app.config.get("REDIS_URL", "redis://localhost:6379/0")

        try:
            r = redis.from_url(redis_url)
            pubsub = r.pubsub()

            # Subscribe to user-specific channel
            channel = f"user:{user_id}"
            pubsub.subscribe(channel)

            # Also subscribe to broadcast channel for admin announcements
            if is_admin:
                pubsub.subscribe("admin:broadcast")

            # Send initial connection message
            yield f"data: {json.dumps({'type': 'connected'})}\n\n"

            # Listen for messages
            for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode("utf-8")
                    yield f"data: {data}\n\n"

        except redis.ConnectionError as e:
            # Redis not available - fall back to no real-time updates
            current_app.logger.warning(f"Redis not available for SSE: {e}")
            error_message = json.dumps(
                {"type": "error", "message": "Real-time updates unavailable"}
            )
            yield f"data: {error_message}\n\n"

            # Keep connection alive with heartbeat
            import time

            while True:
                time.sleep(30)
                yield ": heartbeat\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable Nginx buffering
        },
    )


def publish_event(user_id, event_type, data):
    """
    Publish an event to a user's SSE channel.

    Args:
        user_id: Target user ID
        event_type: Event type string
        data: Event data dict
    """
    import redis
    import json
    from flask import current_app

    redis_url = current_app.config.get("REDIS_URL", "redis://localhost:6379/0")

    try:
        r = redis.from_url(redis_url)
        channel = f"user:{user_id}"
        message = json.dumps(
            {
                "type": event_type,
                **data,
            }
        )
        r.publish(channel, message)
    except redis.ConnectionError:
        current_app.logger.warning(f"Could not publish event to user {user_id}")


def broadcast_to_admins(event_type, data):
    """
    Broadcast an event to all admin users.

    Args:
        event_type: Event type string
        data: Event data dict
    """
    import redis
    import json
    from flask import current_app

    redis_url = current_app.config.get("REDIS_URL", "redis://localhost:6379/0")

    try:
        r = redis.from_url(redis_url)
        message = json.dumps(
            {
                "type": event_type,
                **data,
            }
        )
        r.publish("admin:broadcast", message)
    except redis.ConnectionError:
        current_app.logger.warning("Could not broadcast to admins")
