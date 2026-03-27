#!/bin/bash
PAYLOAD_API_URL=https://autosite-payload-cms.peachsquad.workers.dev \
PAYLOAD_API_EMAIL=admin@foove.nl \
PAYLOAD_API_PASSWORD='BKniG@f$RE84Bhod' \
node scripts/provision-payload.js \
  --name "Lie Dental" \
  --slug lie-dental \
  --cf-project dentist-lie-dental \
  --email balie@liedental.nl \
  --password test-client-pass
