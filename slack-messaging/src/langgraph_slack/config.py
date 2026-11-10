from os import environ
import logging

LOGGER = logging.getLogger(__name__)

if DEPLOY_MODAL := environ.get("DEPLOY_MODAL"):
    DEPLOY_MODAL = DEPLOY_MODAL.lower() == "true"
BOT_USER_ID = environ.get("SLACK_BOT_USER_ID")
BOT_TOKEN = environ.get("SLACK_BOT_TOKEN")
if not BOT_TOKEN or not BOT_TOKEN.strip() or BOT_TOKEN == "fake-token":
    raise RuntimeError("SLACK_BOT_TOKEN must be set to a valid Slack bot token")

if DEPLOY_MODAL:
    BOT_USER_ID = BOT_USER_ID or "fake-user-id"


LANGGRAPH_URL = environ.get("LANGGRAPH_URL")
ASSISTANT_ID = environ.get("LANGGRAPH_ASSISTANT_ID", "chat")
CONFIG = environ.get("CONFIG") or "{}"
DEPLOYMENT_URL = environ.get("DEPLOYMENT_URL", "")
SLACK_CHANNEL_ID = environ.get("SLACK_CHANNEL_ID")
