# Security

## Supported versions

Only the latest release of MNML gets fixes. Update through HACS, or install the newest `mnml.zip` from the releases.

## Reporting a vulnerability

Report it privately through [GitHub's security advisories](https://github.com/bfmatei/ha-mnml/security/advisories/new), not in a public issue. Say what is affected, how to reproduce it, and what it lets someone do. You get an answer in the advisory; a fix goes out as a release, and the advisory is published with it.

MNML runs inside Home Assistant: the integration serves the cards and keeps the templates, and the cards run in the browser with the signed-in user's rights. A weakness of Home Assistant itself belongs to [Home Assistant's security policy](https://www.home-assistant.io/security/).
