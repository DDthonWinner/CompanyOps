#!/usr/bin/env python3
"""Control the running backend's durable Neo Bank showcase scheduler (stdlib only)."""
import argparse
import json
import urllib.error
import urllib.request


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["start", "stop", "status"])
    parser.add_argument("--url", default="http://127.0.0.1:8000")
    parser.add_argument("--interval", type=int, default=3, help="seconds per visible phase (1–300)")
    parser.add_argument("--hold", type=int, default=15, help="seconds to show completion (1–3600)")
    args = parser.parse_args()
    path = "/api/demo/replay" + ("" if args.command == "status" else f"/{args.command}")
    body = None if args.command == "status" else json.dumps({
        "intervalSeconds": args.interval, "completionSeconds": args.hold}).encode()
    req = urllib.request.Request(args.url.rstrip("/") + path, data=body,
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            print(json.dumps(json.load(response), ensure_ascii=False, indent=2))
    except urllib.error.HTTPError as exc:
        parser.exit(1, f"Backend rejected replay: {exc.read().decode()}\n")
    except urllib.error.URLError as exc:
        parser.exit(1, f"Cannot reach backend at {args.url}: {exc.reason}\n")


if __name__ == "__main__":
    main()
