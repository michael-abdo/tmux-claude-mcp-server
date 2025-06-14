#!/usr/bin/env python3
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
import subprocess
import os
import sys

# Global session with connection pooling
session = requests.Session()
adapter = HTTPAdapter(
    pool_connections=2,  # Only 2 connections to Anthropic
    pool_maxsize=2,
    max_retries=Retry(total=3, backoff_factor=0.3)
)
session.mount('https://', adapter)

# Set this in environment for Claude to use
os.environ['CLAUDE_HTTP_SESSION'] = str(id(session))

# Now run Claude with limited connections
subprocess.run(['claude-code'] + sys.argv[1:])