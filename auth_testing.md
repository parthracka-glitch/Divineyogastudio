# Auth testing playbook

- Confirm the stored owner password uses Argon2.
- Log in with the owner account and confirm secure session cookies are issued.
- Call `/api/v1/auth/me` using the access session and confirm the owner profile is returned.
- Submit five invalid sign-in attempts and confirm the account is locked for fifteen minutes.
- Confirm protected admin requests without a session return 401.