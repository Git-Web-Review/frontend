#!/usr/bin/env python3
"""Minimal git-web-review webhook receiver, standard library only.

Point a user's webhook URL (Settings > Notifications) at this daemon, then
write one handler per event type:

    @on_comment_received
    def comment(delivery):
        print(delivery.actor, "commented:", delivery.payload["commentExcerpt"])

Run it with `python3 webhook_receiver.py [port]` (default 8080).
The request format is described in the http-relay README.
"""

import json
import sys
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

_handlers = {}


def on(*events):
    """Registers a handler for the given event types; "*" catches them all."""

    def register(handler):
        for event in events:
            _handlers.setdefault(event, []).append(handler)
        return handler

    return register


# Payload fields, besides the review fields every review event carries:
# reviewId, title, gitwebUrl, gitwebTitle, ownerEmail, sourceProject,
# sourceBranch, sourceCommit.

# A message sent by an admin: title, message. No review fields.
on_text = on("TEXT")
# You were added as a reviewer.
on_review_pending = on("REVIEW_PENDING")
# previousStatus, nextStatus, actorEmail, actorNickname.
on_review_status_changed = on("REVIEW_STATUS_CHANGED")
# Someone commented on your review: commitHash, filePath, lineNumber (all
# null for a general comment), commentExcerpt, actorEmail, actorNickname.
on_comment_received = on("COMMENT_RECEIVED")
# Same fields as COMMENT_RECEIVED, plus addedAsReviewer.
on_comment_mention = on("COMMENT_MENTION")
# Commits of your review were reviewed: commitCount, commitTitles (one per
# line), actorEmail, actorNickname.
on_commit_reviewed = on("COMMIT_REVIEWED")
# The review was synced: version, commitCount, newCount, modifiedCount,
# logModifiedCount, rebasedCount, droppedCount, actorEmail, actorNickname.
on_review_new_version = on("REVIEW_NEW_VERSION")

# Every review-related event, or every comment event.
on_review = on(
    "REVIEW_PENDING",
    "REVIEW_STATUS_CHANGED",
    "COMMENT_RECEIVED",
    "COMMENT_MENTION",
    "COMMIT_REVIEWED",
    "REVIEW_NEW_VERSION",
)
on_comment = on("COMMENT_RECEIVED", "COMMENT_MENTION")


@dataclass
class Delivery:
    event: str
    payload: dict
    user: dict  # who the notification is for: id, email, nickname, locale
    url: str  # link to the review, "" when there is none
    delivery_id: str  # same across retries: use it to deduplicate
    notification_id: str
    created_at: str
    raw: dict

    @property
    def actor(self):
        return self.payload.get("actorNickname") or self.payload.get("actorEmail")


class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        except (TypeError, ValueError):
            # A 4xx is final: the relay will not retry it.
            self.send_response(400)
            self.end_headers()
            return

        delivery = Delivery(
            event=body.get("event", ""),
            payload=body.get("payload") or {},
            user=body.get("user") or {},
            url=body.get("url", ""),
            delivery_id=body.get("deliveryId", ""),
            notification_id=body.get("notificationId", ""),
            created_at=body.get("createdAt", ""),
            raw=body,
        )
        try:
            for handler in _handlers.get(delivery.event, []) + _handlers.get("*", []):
                handler(delivery)
        except Exception:
            # A 5xx makes the relay retry, with the same delivery id.
            self.send_response(500)
            self.end_headers()
            raise
        self.send_response(204)
        self.end_headers()


def serve(port=8080):
    print(f"Listening for git-web-review webhooks on :{port}")
    ThreadingHTTPServer(("", port), WebhookHandler).serve_forever()


# --- Example handlers: replace them with your own. ---


@on_review_pending
def review_pending(delivery):
    print(f"[{delivery.user.get('nickname')}] to review: {delivery.payload['title']} {delivery.url}")


@on_review_status_changed
def status_changed(delivery):
    payload = delivery.payload
    print(
        f"{payload['title']}: {payload['previousStatus']} -> "
        f"{payload['nextStatus']} by {delivery.actor}"
    )


@on_comment
def comment(delivery):
    payload = delivery.payload
    where = payload.get("filePath") or "review"
    if payload.get("lineNumber") is not None:
        where += f":{payload['lineNumber']}"
    print(f"{delivery.actor} on {where}: {payload['commentExcerpt']} {delivery.url}")


@on("*")
def log_everything(delivery):
    print(f"<- {delivery.event} ({delivery.delivery_id})")


if __name__ == "__main__":
    # Shows the prints right away, even when stdout is a pipe or a log file.
    sys.stdout.reconfigure(line_buffering=True)
    serve(int(sys.argv[1]) if len(sys.argv) > 1 else 8080)
