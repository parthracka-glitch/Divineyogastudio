import os
from urllib.parse import urlparse

import httpx


class WatiConfigurationError(Exception):
    """Raised when WATI is unavailable or configured unsafely."""


def normalize_phone(phone_number: str) -> str:
    return "".join(character for character in phone_number if character.isdigit())


def configured() -> bool:
    return all(
        os.environ.get(name)
        for name in ["WATI_BASE_URL", "WATI_ALLOWED_HOST", "WATI_API_TOKEN"]
    )


def base_url() -> str:
    value = os.environ.get("WATI_BASE_URL", "").rstrip("/")
    allowed_host = os.environ.get("WATI_ALLOWED_HOST", "")
    parsed = urlparse(value)
    if not value or parsed.scheme != "https" or parsed.netloc != allowed_host:
        raise WatiConfigurationError("WATI delivery is not safely configured")
    return value


async def send_template_message(
    phone_number: str,
    template_name: str,
    parameters: dict[str, str],
) -> dict:
    endpoint = f"{base_url()}/api/v2/sendTemplateMessage"
    payload = {
        "template_name": template_name,
        "broadcast_name": "divine-yoga-payment-reminder",
        "parameters": [
            {"name": key, "value": str(value)}
            for key, value in parameters.items()
        ],
    }
    headers = {
        "Authorization": f"Bearer {os.environ['WATI_API_TOKEN']}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=20) as http_client:
        response = await http_client.post(
            endpoint,
            params={"whatsappNumber": normalize_phone(phone_number)},
            json=payload,
            headers=headers,
        )
        response.raise_for_status()
        return response.json()


def local_message_id(response: dict) -> str | None:
    receivers = response.get("receivers") or []
    if receivers and isinstance(receivers[0], dict):
        return receivers[0].get("localMessageId")
    return response.get("localMessageId")