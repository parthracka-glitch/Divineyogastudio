import re
from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class LoginInput(StrictModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)


class BatchInput(StrictModel):
    name: str = Field(min_length=2, max_length=80)
    category_tag: str = Field(min_length=2, max_length=40)
    description: str = Field(default="", max_length=300)
    instructor_name: str = Field(min_length=2, max_length=80)
    schedule_days: list[str] = Field(min_length=1)
    start_time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    end_time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    capacity: int = Field(ge=1, le=200)
    is_active: bool = True


class PlanInput(StrictModel):
    name: str = Field(min_length=2, max_length=80)
    plan_type: Literal["monthly", "quarterly", "half_yearly", "annual", "drop_in_pack"]
    amount: float = Field(gt=0, le=1000000)
    duration_days: int = Field(gt=0, le=730)
    class_credits: int | None = Field(default=None, ge=1)
    is_active: bool = True


class ClientInput(StrictModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone_number: str = Field(pattern=r"^\+[1-9]\d{7,14}$")
    whatsapp_opt_in: bool = True
    email: EmailStr | None = None
    date_of_birth: date | None = None
    gender: str | None = Field(default=None, max_length=30)
    address: str | None = Field(default=None, max_length=300)
    batch_id: str | None = None
    plan_id: str | None = None
    join_date: date
    status: Literal["trial", "active", "paused", "expired", "cancelled"] = "active"
    initial_payment_status: Literal["paid", "pending", "partial"] | None = None
    initial_amount_paid: float | None = None
    payment_method: str | None = None
    emergency_contact: str | None = Field(default=None, max_length=80)
    medical_notes: str | None = Field(default=None, max_length=1000)
    referral_source: str | None = Field(default=None, max_length=80)
    notes: str | None = Field(default=None, max_length=500)

    @field_validator("phone_number", mode="before")
    @classmethod
    def clean_phone(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        cleaned = re.sub(r"[\s\-\(\)\.]", "", value.strip())
        if not cleaned:
            return cleaned
        if cleaned.startswith("0") and len(cleaned) == 11:
            cleaned = "+91" + cleaned[1:]
        elif len(cleaned) == 10 and not cleaned.startswith("+"):
            cleaned = "+91" + cleaned
        elif not cleaned.startswith("+") and cleaned.isdigit():
            cleaned = "+" + cleaned
        return cleaned

    @field_validator("email", mode="before")
    @classmethod
    def clean_email(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            value = value.strip()
            return value if value else None
        return value


class SubscriptionInput(StrictModel):
    client_id: str
    plan_id: str
    start_date: date
    auto_renew: bool = False


class PaymentInput(StrictModel):
    client_id: str
    subscription_id: str | None = None
    amount_due: float = Field(gt=0, le=1000000)
    amount_paid: float = Field(default=0, ge=0, le=1000000)
    due_date: date
    paid_date: date | None = None
    payment_mode: Literal["cash", "upi", "bank_transfer", "card", "other"] | None = None
    transaction_ref: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=500)


class PaymentUpdate(StrictModel):
    amount_paid: float | None = Field(default=None, ge=0, le=1000000)
    paid_date: date | None = None
    payment_mode: Literal["cash", "upi", "bank_transfer", "card", "other"] | None = None
    transaction_ref: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=500)
    payment_status: Literal["pending", "partial", "paid", "overdue", "waived", "void"] | None = None


class ReminderTemplateInput(StrictModel):
    name: str = Field(min_length=2, max_length=80)
    trigger_type: Literal["before_due", "on_due", "overdue"]
    offset_days: int = Field(ge=0, le=90)
    message_body: str = Field(min_length=10, max_length=1000)
    is_active: bool = True


class ReminderSendInput(StrictModel):
    payment_ids: list[str] = Field(min_length=1, max_length=100)
    template_id: str | None = None


class DirectReminderLogInput(StrictModel):
    client_id: str
    client_name: str | None = None
    phone_number: str | None = None
    template_name: str | None = None
    message_text: str = Field(min_length=1, max_length=2000)
    payment_id: str | None = None