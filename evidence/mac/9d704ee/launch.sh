#!/bin/bash
set -eu
export CORTEX_DATA_DIR=/tmp/opencode/desktop-provider-layout-9d704ee/engine
export CORTEX_LOCALE=en
export CORTEX_START_HASH='#/settings?section=providers&theme=light'
export CORTEX_CATALOG_URL='data:application/json,{"fake":{"id":"fake","name":"Test Provider","env":["FAKE_API_KEY"],"npm":"@ai-sdk/openai-compatible","api":"http://127.0.0.1:1/v1","models":{"test":{"id":"test","name":"Test Model","modalities":{"input":["text"],"output":["text"]},"limit":{"context":4096,"output":1024}}}}}'
open -na /Applications/Cortex.app --args --remote-debugging-port=9444 --user-data-dir=/tmp/opencode/desktop-provider-layout-9d704ee/profile
