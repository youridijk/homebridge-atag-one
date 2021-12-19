import sys
import json

if __name__ == "__main__":
    if len(sys.argv) > 1:
        json_text = sys.argv[1]
        print(json.dumps(json.loads(json_text), indent=4))

