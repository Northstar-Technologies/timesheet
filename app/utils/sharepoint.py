"""
SharePoint Sync Utilities (REQ-010)

Handles Microsoft Graph authentication and file uploads to SharePoint.
"""

import os
import time
from typing import Dict

from flask import current_app
from werkzeug.utils import secure_filename


GRAPH_SCOPE = ["https://graph.microsoft.com/.default"]
_TOKEN_CACHE: Dict[str, float] = {
    "access_token": "",
    "expires_at": 0,
}


class SharePointSyncError(RuntimeError):
    pass


def _is_placeholder(value: str) -> bool:
    if not value:
        return True
    lowered = str(value).lower()
    return any(token in lowered for token in ("your-", "example", "placeholder", "xxx"))


def is_sharepoint_configured() -> bool:
    if not current_app.config.get("SHAREPOINT_SYNC_ENABLED", False):
        return False

    required = [
        current_app.config.get("AZURE_CLIENT_ID"),
        current_app.config.get("AZURE_CLIENT_SECRET"),
        current_app.config.get("SP_SITE_ID"),
        current_app.config.get("SP_DRIVE_ID"),
    ]

    return all(not _is_placeholder(value) for value in required)


def _get_graph_token() -> str:
    if not is_sharepoint_configured():
        raise SharePointSyncError("SharePoint sync is not configured")

    now = time.time()
    if _TOKEN_CACHE["access_token"] and now < (_TOKEN_CACHE["expires_at"] - 60):
        return _TOKEN_CACHE["access_token"]

    import msal

    authority = current_app.config.get("AZURE_AUTHORITY")
    client_id = current_app.config.get("AZURE_CLIENT_ID")
    client_secret = current_app.config.get("AZURE_CLIENT_SECRET")

    msal_app = msal.ConfidentialClientApplication(
        client_id,
        authority=authority,
        client_credential=client_secret,
    )
    result = msal_app.acquire_token_for_client(scopes=GRAPH_SCOPE)

    access_token = result.get("access_token")
    if not access_token:
        raise SharePointSyncError(
            f"Failed to acquire Graph token: {result.get('error_description', 'unknown error')}"
        )

    expires_in = int(result.get("expires_in", 3599))
    _TOKEN_CACHE["access_token"] = access_token
    _TOKEN_CACHE["expires_at"] = now + expires_in

    return access_token


def _build_sharepoint_folder(timesheet) -> str:
    base_folder = (current_app.config.get("SP_BASE_FOLDER") or "Timesheets").strip("/")
    year = timesheet.week_start.strftime("%Y")
    week_str = timesheet.week_start.isoformat()

    parts = [part for part in (base_folder, year, week_str) if part]
    return "/".join(parts)


def _create_folder(token: str, drive_id: str, parent_path: str, name: str) -> None:
    import requests

    root = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root"
    if parent_path:
        url = f"{root}:/{parent_path}:/children"
    else:
        url = f"{root}/children"

    payload = {
        "name": name,
        "folder": {},
        "@microsoft.graph.conflictBehavior": "fail",
    }

    response = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
        timeout=30,
    )

    if response.status_code in (200, 201):
        return

    if response.status_code == 409:
        return

    try:
        data = response.json()
        error_code = data.get("error", {}).get("code")
        if error_code == "nameAlreadyExists":
            return
    except Exception:
        pass

    raise SharePointSyncError(
        f"Failed to create folder '{name}': {response.status_code} {response.text}"
    )


def _ensure_folder_path(token: str, drive_id: str, path: str) -> None:
    if not path:
        return

    current = ""
    for segment in path.split("/"):
        _create_folder(token, drive_id, current, segment)
        current = f"{current}/{segment}" if current else segment


def _create_upload_session(token: str, drive_id: str, path: str) -> str:
    import requests

    url = f"https://graph.microsoft.com/v1.0/drives/{drive_id}/root:/{path}:/createUploadSession"
    payload = {
        "item": {
            "@microsoft.graph.conflictBehavior": "replace",
            "name": os.path.basename(path),
        }
    }

    response = requests.post(
        url,
        headers={"Authorization": f"Bearer {token}"},
        json=payload,
        timeout=30,
    )

    if response.status_code not in (200, 201):
        raise SharePointSyncError(
            f"Failed to create upload session: {response.status_code} {response.text}"
        )

    data = response.json()
    upload_url = data.get("uploadUrl")
    if not upload_url:
        raise SharePointSyncError("Upload session did not return an uploadUrl")

    return upload_url


def _upload_file(upload_url: str, filepath: str) -> dict:
    import requests

    file_size = os.path.getsize(filepath)
    if file_size == 0:
        raise SharePointSyncError("File is empty")

    chunk_size = 320 * 1024 * 4
    offset = 0

    with open(filepath, "rb") as handle:
        while True:
            chunk = handle.read(chunk_size)
            if not chunk:
                break

            start = offset
            end = offset + len(chunk) - 1

            headers = {
                "Content-Length": str(len(chunk)),
                "Content-Range": f"bytes {start}-{end}/{file_size}",
                "Content-Type": "application/octet-stream",
            }

            response = requests.put(upload_url, headers=headers, data=chunk, timeout=60)

            if response.status_code in (200, 201):
                return response.json()
            if response.status_code == 202:
                offset += len(chunk)
                continue

            raise SharePointSyncError(
                f"Upload failed: {response.status_code} {response.text}"
            )

    raise SharePointSyncError("Upload session completed without final response")


def upload_attachment_to_sharepoint(attachment) -> dict:
    if not is_sharepoint_configured():
        raise SharePointSyncError("SharePoint sync is disabled or not configured")

    if not attachment.timesheet:
        raise SharePointSyncError("Attachment is missing a timesheet reference")

    upload_folder = current_app.config.get("UPLOAD_FOLDER", "uploads")
    local_path = os.path.join(upload_folder, attachment.filename)
    if not os.path.exists(local_path):
        raise SharePointSyncError(f"Local file not found: {attachment.filename}")

    token = _get_graph_token()
    drive_id = current_app.config.get("SP_DRIVE_ID")
    site_id = current_app.config.get("SP_SITE_ID")
    folder_path = _build_sharepoint_folder(attachment.timesheet)

    safe_name = secure_filename(attachment.original_filename)
    if not safe_name:
        safe_name = attachment.filename
    sharepoint_name = f"{attachment.id}_{safe_name}"
    upload_path = f"{folder_path}/{sharepoint_name}" if folder_path else sharepoint_name

    _ensure_folder_path(token, drive_id, folder_path)
    upload_url = _create_upload_session(token, drive_id, upload_path)
    item = _upload_file(upload_url, local_path)

    return {
        "item_id": item.get("id"),
        "web_url": item.get("webUrl"),
        "drive_id": drive_id,
        "site_id": site_id,
    }
