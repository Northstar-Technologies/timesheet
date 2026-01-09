"""
Object Storage Module (REQ-033)

Abstraction layer for attachment storage supporting:
- Local filesystem (development)
- AWS S3 (production)
- Cloudflare R2 (alternative production)

Configuration:
    STORAGE_BACKEND: "local", "s3", or "r2"
    AWS_ACCESS_KEY_ID: AWS credentials (for S3)
    AWS_SECRET_ACCESS_KEY: AWS credentials (for S3)
    AWS_S3_BUCKET: S3 bucket name
    AWS_S3_REGION: S3 region (default: us-east-1)
    R2_ACCOUNT_ID: Cloudflare account ID (for R2)
    R2_ACCESS_KEY_ID: R2 credentials
    R2_SECRET_ACCESS_KEY: R2 credentials
    R2_BUCKET: R2 bucket name
"""

import os
import uuid
from datetime import datetime, timedelta
from abc import ABC, abstractmethod
from flask import current_app


class StorageBackend(ABC):
    """Abstract base class for storage backends."""
    
    @abstractmethod
    def save(self, file_data: bytes, filename: str, content_type: str) -> str:
        """
        Save a file and return its storage key.
        
        Args:
            file_data: Raw file bytes
            filename: Original filename (for extension)
            content_type: MIME type
            
        Returns:
            str: Storage key for retrieving the file
        """
        pass
    
    @abstractmethod
    def get(self, key: str) -> bytes:
        """
        Retrieve file data by storage key.
        
        Args:
            key: Storage key returned from save()
            
        Returns:
            bytes: File data
        """
        pass
    
    @abstractmethod
    def delete(self, key: str) -> bool:
        """
        Delete a file by storage key.
        
        Args:
            key: Storage key
            
        Returns:
            bool: True if deleted successfully
        """
        pass
    
    @abstractmethod
    def get_url(self, key: str, expires_in: int = 3600) -> str:
        """
        Get a URL for accessing the file.
        
        Args:
            key: Storage key
            expires_in: Seconds until URL expires (for signed URLs)
            
        Returns:
            str: URL for accessing the file
        """
        pass


class LocalStorageBackend(StorageBackend):
    """
    Local filesystem storage for development.
    
    Files are stored in UPLOAD_FOLDER with UUID-based filenames.
    """
    
    def __init__(self, upload_folder: str = None):
        self.upload_folder = upload_folder or current_app.config.get(
            "UPLOAD_FOLDER", "/app/uploads"
        )
        os.makedirs(self.upload_folder, exist_ok=True)
    
    def save(self, file_data: bytes, filename: str, content_type: str) -> str:
        """Save file to local filesystem."""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        key = f"{uuid.uuid4()}.{ext}" if ext else str(uuid.uuid4())
        
        filepath = os.path.join(self.upload_folder, key)
        with open(filepath, "wb") as f:
            f.write(file_data)
        
        return key
    
    def get(self, key: str) -> bytes:
        """Read file from local filesystem."""
        filepath = os.path.join(self.upload_folder, key)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"File not found: {key}")
        
        with open(filepath, "rb") as f:
            return f.read()
    
    def delete(self, key: str) -> bool:
        """Delete file from local filesystem."""
        filepath = os.path.join(self.upload_folder, key)
        if os.path.exists(filepath):
            os.remove(filepath)
            return True
        return False
    
    def get_url(self, key: str, expires_in: int = 3600) -> str:
        """
        Get local URL for file.
        
        Note: In production, this should return a signed URL.
        For local dev, returns a direct file URL.
        """
        # For local development, return a relative URL
        return f"/uploads/{key}"


class S3StorageBackend(StorageBackend):
    """
    AWS S3 storage for production.
    
    Supports signed URLs for secure access.
    """
    
    def __init__(self):
        try:
            import boto3
            from botocore.config import Config
        except ImportError:
            raise ImportError("boto3 is required for S3 storage. Install with: pip install boto3")
        
        self.bucket = current_app.config.get("AWS_S3_BUCKET")
        self.region = current_app.config.get("AWS_S3_REGION", "us-east-1")
        
        if not self.bucket:
            raise ValueError("AWS_S3_BUCKET must be configured")
        
        self.client = boto3.client(
            "s3",
            region_name=self.region,
            aws_access_key_id=current_app.config.get("AWS_ACCESS_KEY_ID"),
            aws_secret_access_key=current_app.config.get("AWS_SECRET_ACCESS_KEY"),
            config=Config(signature_version="s3v4"),
        )
    
    def save(self, file_data: bytes, filename: str, content_type: str) -> str:
        """Upload file to S3."""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        key = f"attachments/{uuid.uuid4()}.{ext}" if ext else f"attachments/{uuid.uuid4()}"
        
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file_data,
            ContentType=content_type,
        )
        
        return key
    
    def get(self, key: str) -> bytes:
        """Download file from S3."""
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()
    
    def delete(self, key: str) -> bool:
        """Delete file from S3."""
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False
    
    def get_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate presigned URL for S3 object."""
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )


class R2StorageBackend(StorageBackend):
    """
    Cloudflare R2 storage (S3-compatible).
    
    Uses S3-compatible API with Cloudflare R2 endpoint.
    """
    
    def __init__(self):
        try:
            import boto3
            from botocore.config import Config
        except ImportError:
            raise ImportError("boto3 is required for R2 storage. Install with: pip install boto3")
        
        self.bucket = current_app.config.get("R2_BUCKET")
        account_id = current_app.config.get("R2_ACCOUNT_ID")
        
        if not self.bucket or not account_id:
            raise ValueError("R2_BUCKET and R2_ACCOUNT_ID must be configured")
        
        endpoint_url = f"https://{account_id}.r2.cloudflarestorage.com"
        
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=current_app.config.get("R2_ACCESS_KEY_ID"),
            aws_secret_access_key=current_app.config.get("R2_SECRET_ACCESS_KEY"),
            config=Config(signature_version="s3v4"),
        )
    
    def save(self, file_data: bytes, filename: str, content_type: str) -> str:
        """Upload file to R2."""
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        key = f"attachments/{uuid.uuid4()}.{ext}" if ext else f"attachments/{uuid.uuid4()}"
        
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=file_data,
            ContentType=content_type,
        )
        
        return key
    
    def get(self, key: str) -> bytes:
        """Download file from R2."""
        response = self.client.get_object(Bucket=self.bucket, Key=key)
        return response["Body"].read()
    
    def delete(self, key: str) -> bool:
        """Delete file from R2."""
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
            return True
        except Exception:
            return False
    
    def get_url(self, key: str, expires_in: int = 3600) -> str:
        """Generate presigned URL for R2 object."""
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": key},
            ExpiresIn=expires_in,
        )


def get_storage_backend() -> StorageBackend:
    """
    Factory function to get the configured storage backend.
    
    Returns:
        StorageBackend: The configured storage backend instance
    """
    backend_type = current_app.config.get("STORAGE_BACKEND", "local").lower()
    
    if backend_type == "s3":
        return S3StorageBackend()
    elif backend_type == "r2":
        return R2StorageBackend()
    else:
        return LocalStorageBackend()


# Convenience functions
def save_file(file_data: bytes, filename: str, content_type: str) -> str:
    """Save a file using the configured storage backend."""
    return get_storage_backend().save(file_data, filename, content_type)


def get_file(key: str) -> bytes:
    """Get a file using the configured storage backend."""
    return get_storage_backend().get(key)


def delete_file(key: str) -> bool:
    """Delete a file using the configured storage backend."""
    return get_storage_backend().delete(key)


def get_file_url(key: str, expires_in: int = 3600) -> str:
    """Get a URL for a file using the configured storage backend."""
    return get_storage_backend().get_url(key, expires_in)
