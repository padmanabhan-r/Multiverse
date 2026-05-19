"""ARQ workers — Redis-backed background tasks.

Currently used for Professional Voice Cloning status polling. Each PVC
training job (24–72h on ElevenLabs) is tracked by a row in
``voice_clone_jobs`` and a long-lived ARQ task that self-reschedules
every 5 minutes until ElevenLabs reports ``fine_tuned`` or ``failed``.
"""

from __future__ import annotations
