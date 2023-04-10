#!/usr/bin/env bash

set -euo pipefail # Exit on first failure

# Fails on console.log usage
if [ ! -z "$(grep -r 'console.log' */src)" ]
then exit 1
fi

# Runs all tests - fails on test.only
export CI=true
yarn test run

# Fails in case of TS compiler warnings or errors
yarn workspace personal-storage-wrapper build
