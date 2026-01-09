"""
Observability Module (REQ-036)

Provides structured JSON logging and request metrics.

Features:
- JSON-formatted logs with request_id, user_id, route, latency
- X-Request-ID generation and propagation
- Request duration tracking
- Error rate monitoring
"""

import time
import json
import logging
import uuid
from functools import wraps
from flask import request, g, session, current_app


# ============================================================================
# JSON Formatter for Structured Logging
# ============================================================================
class JSONFormatter(logging.Formatter):
    """
    Custom formatter that outputs logs as JSON objects.
    
    Each log entry includes:
    - timestamp: ISO format timestamp
    - level: Log level name
    - message: Log message
    - request_id: Current request ID (if in request context)
    - user_id: Current user ID (if authenticated)
    - path: Request path (if in request context)
    - method: HTTP method (if in request context)
    - logger: Logger name
    - module: Module where log was generated
    - Additional fields from extra dict
    """
    
    def format(self, record):
        log_data = {
            "timestamp": self.formatTime(record, self.datefmt),
            "level": record.levelname,
            "message": record.getMessage(),
            "logger": record.name,
            "module": record.module,
            "line": record.lineno,
        }
        
        # Add request context if available
        try:
            if hasattr(g, 'request_id'):
                log_data["request_id"] = g.request_id
            
            if request:
                log_data["path"] = request.path
                log_data["method"] = request.method
                log_data["remote_addr"] = request.remote_addr
            
            if session and "user" in session:
                log_data["user_id"] = session["user"].get("id")
                log_data["user_email"] = session["user"].get("email")
        except RuntimeError:
            # Outside of request context
            pass
        
        # Add any extra fields
        if hasattr(record, 'extra_fields'):
            log_data.update(record.extra_fields)
        
        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)
        
        return json.dumps(log_data)


class ContextFilter(logging.Filter):
    """Filter that adds request context to log records."""
    
    def filter(self, record):
        # Add extra_fields attribute if not present
        if not hasattr(record, 'extra_fields'):
            record.extra_fields = {}
        
        try:
            if hasattr(g, 'request_id'):
                record.extra_fields['request_id'] = g.request_id
            if hasattr(g, 'request_start_time'):
                elapsed = time.time() - g.request_start_time
                record.extra_fields['elapsed_ms'] = round(elapsed * 1000, 2)
        except RuntimeError:
            pass
        
        return True


# ============================================================================
# Request Metrics
# ============================================================================
class RequestMetrics:
    """
    Tracks request metrics for monitoring.
    
    Metrics tracked:
    - Total requests
    - Requests by status code
    - Request durations
    - Error count
    """
    
    def __init__(self):
        self.total_requests = 0
        self.requests_by_status = {}
        self.requests_by_route = {}
        self.total_errors = 0
        self.total_duration_ms = 0
        self.slow_requests = []  # Requests > 1 second
        self._lock = None  # For thread safety if needed
    
    def record_request(self, path, method, status_code, duration_ms):
        """Record a completed request."""
        self.total_requests += 1
        self.total_duration_ms += duration_ms
        
        # Track by status code
        status_key = str(status_code)
        self.requests_by_status[status_key] = self.requests_by_status.get(status_key, 0) + 1
        
        # Track by route
        route_key = f"{method} {path}"
        if route_key not in self.requests_by_route:
            self.requests_by_route[route_key] = {"count": 0, "total_ms": 0}
        self.requests_by_route[route_key]["count"] += 1
        self.requests_by_route[route_key]["total_ms"] += duration_ms
        
        # Track errors
        if status_code >= 400:
            self.total_errors += 1
        
        # Track slow requests (> 1 second)
        if duration_ms > 1000:
            self.slow_requests.append({
                "path": path,
                "method": method,
                "duration_ms": duration_ms,
                "timestamp": time.time()
            })
            # Keep only last 100 slow requests
            if len(self.slow_requests) > 100:
                self.slow_requests = self.slow_requests[-100:]
    
    def get_stats(self):
        """Get current metrics summary."""
        avg_duration = (
            self.total_duration_ms / self.total_requests 
            if self.total_requests > 0 else 0
        )
        error_rate = (
            (self.total_errors / self.total_requests) * 100 
            if self.total_requests > 0 else 0
        )
        
        return {
            "total_requests": self.total_requests,
            "total_errors": self.total_errors,
            "error_rate_percent": round(error_rate, 2),
            "avg_duration_ms": round(avg_duration, 2),
            "requests_by_status": self.requests_by_status,
            "slow_request_count": len(self.slow_requests),
            "top_routes": self._get_top_routes(10),
        }
    
    def _get_top_routes(self, limit):
        """Get top routes by request count."""
        routes = [
            {"route": k, "count": v["count"], "avg_ms": round(v["total_ms"] / v["count"], 2)}
            for k, v in self.requests_by_route.items()
        ]
        return sorted(routes, key=lambda x: x["count"], reverse=True)[:limit]
    
    def reset(self):
        """Reset all metrics."""
        self.total_requests = 0
        self.requests_by_status = {}
        self.requests_by_route = {}
        self.total_errors = 0
        self.total_duration_ms = 0
        self.slow_requests = []


# Global metrics instance
request_metrics = RequestMetrics()


# ============================================================================
# Middleware Registration
# ============================================================================
def register_observability(app):
    """
    Register observability middleware with the Flask app.
    
    This should be called after register_error_handlers in the app factory.
    
    Features enabled:
    - X-Request-ID generation/propagation
    - Request timing
    - Structured logging
    - Metrics collection
    """
    
    # Configure structured logging if in production
    if not app.debug:
        # Set up JSON formatter for production
        json_handler = logging.StreamHandler()
        json_handler.setFormatter(JSONFormatter())
        json_handler.addFilter(ContextFilter())
        
        # Remove default handlers and add JSON handler
        app.logger.handlers = []
        app.logger.addHandler(json_handler)
        app.logger.setLevel(logging.INFO)
    
    @app.before_request
    def before_request_observability():
        """Record request start time and generate request ID."""
        # Generate or use existing request ID
        request_id = request.headers.get('X-Request-ID')
        if not request_id:
            request_id = str(uuid.uuid4())[:8]
        g.request_id = request_id
        
        # Record start time
        g.request_start_time = time.time()
    
    @app.after_request
    def after_request_observability(response):
        """Record request metrics and add headers."""
        # Add request ID to response
        if hasattr(g, 'request_id'):
            response.headers['X-Request-ID'] = g.request_id
        
        # Calculate duration
        duration_ms = 0
        if hasattr(g, 'request_start_time'):
            duration_ms = (time.time() - g.request_start_time) * 1000
            response.headers['X-Response-Time'] = f"{duration_ms:.2f}ms"
        
        # Record metrics (skip static files and health checks)
        if not request.path.startswith('/static') and request.path != '/health':
            request_metrics.record_request(
                path=request.path,
                method=request.method,
                status_code=response.status_code,
                duration_ms=duration_ms
            )
            
            # Log request (INFO level for success, WARNING for 4xx, ERROR for 5xx)
            log_data = {
                "path": request.path,
                "method": request.method,
                "status_code": response.status_code,
                "duration_ms": round(duration_ms, 2),
                "request_id": getattr(g, 'request_id', None),
            }
            
            if response.status_code >= 500:
                app.logger.error(f"Request failed: {request.method} {request.path}", extra={'extra_fields': log_data})
            elif response.status_code >= 400:
                app.logger.warning(f"Request error: {request.method} {request.path}", extra={'extra_fields': log_data})
            elif duration_ms > 1000:
                app.logger.warning(f"Slow request: {request.method} {request.path}", extra={'extra_fields': log_data})
        
        return response


# ============================================================================
# Metrics Endpoint
# ============================================================================
def get_metrics():
    """Get current application metrics (for admin use)."""
    return request_metrics.get_stats()


def reset_metrics():
    """Reset all metrics (for testing)."""
    request_metrics.reset()


# ============================================================================
# Decorators for Custom Metrics
# ============================================================================
def timed(name=None):
    """
    Decorator to time a function and log its duration.
    
    Usage:
        @timed("database_query")
        def slow_query():
            ...
    """
    def decorator(f):
        @wraps(f)
        def wrapper(*args, **kwargs):
            start = time.time()
            result = f(*args, **kwargs)
            duration = (time.time() - start) * 1000
            
            metric_name = name or f.__name__
            current_app.logger.debug(
                f"Timed function: {metric_name}",
                extra={'extra_fields': {
                    'function': metric_name,
                    'duration_ms': round(duration, 2)
                }}
            )
            
            return result
        return wrapper
    return decorator


def log_event(event_type, **extra_data):
    """
    Log a structured event.
    
    Usage:
        log_event("user_login", user_id="123", method="oauth")
    """
    try:
        current_app.logger.info(
            f"Event: {event_type}",
            extra={'extra_fields': {"event_type": event_type, **extra_data}}
        )
    except RuntimeError:
        # Outside app context
        pass
