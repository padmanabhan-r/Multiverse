from __future__ import annotations

from functools import lru_cache
from typing import TYPE_CHECKING, Any, BinaryIO

import boto3
from botocore.client import Config

from app.config import Settings, get_settings

if TYPE_CHECKING:  # pragma: no cover
    from mypy_boto3_s3 import S3Client
else:
    S3Client = Any


@lru_cache(maxsize=1)
def _client() -> "S3Client":
    s = get_settings()
    endpoint = f"https://{s.R2_ACCOUNT_ID}.r2.cloudflarestorage.com" if s.R2_ACCOUNT_ID else None
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=s.R2_ACCESS_KEY_ID,
        aws_secret_access_key=s.R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


def put_bytes(key: str, data: bytes, content_type: str, settings: Settings | None = None) -> str:
    s = settings or get_settings()
    _client().put_object(Bucket=s.R2_BUCKET, Key=key, Body=data, ContentType=content_type)
    return public_url(key, s)


def put_stream(
    key: str, body: BinaryIO, content_type: str, settings: Settings | None = None
) -> str:
    s = settings or get_settings()
    _client().upload_fileobj(
        Fileobj=body, Bucket=s.R2_BUCKET, Key=key, ExtraArgs={"ContentType": content_type}
    )
    return public_url(key, s)


def presigned_get(key: str, expires_in: int = 3600, settings: Settings | None = None) -> str:
    s = settings or get_settings()
    return _client().generate_presigned_url(
        "get_object", Params={"Bucket": s.R2_BUCKET, "Key": key}, ExpiresIn=expires_in
    )


def public_url(key: str, settings: Settings | None = None) -> str:
    s = settings or get_settings()
    if s.R2_PUBLIC_BASE_URL:
        return f"{s.R2_PUBLIC_BASE_URL.rstrip('/')}/{key.lstrip('/')}"
    return f"r2://{s.R2_BUCKET}/{key}"
