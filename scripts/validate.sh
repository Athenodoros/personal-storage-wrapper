#!/usr/bin/env bash

set -euo pipefail # Exit on first failure

# Fails on console.log usage
if [ ! -z "$(grep -r 'console.log' personal-storage-wrapper/src)" ]
then 
    echo "console.log found!"
    exit 1
fi

# Runs all tests in CI mode (fails on test.only)
if ! CI=true yarn test run >/dev/null 2>/dev/null
then 
    echo "Testing failed"
    exit 1
fi

# Fails in case of TS compiler warnings or errors
for WORKSPACE in personal-storage-wrapper personal-storage-wrapper-browser-tests personal-storage-wrapper-example
do
    if ! yarn workspace $WORKSPACE build >/dev/null 2>/dev/null
    then 
        echo "Build failed for: $WORKSPACE"
        exit 1
    fi
done

echo "Validation Passed!"
