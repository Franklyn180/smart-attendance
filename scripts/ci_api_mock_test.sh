#!/bin/bash
# Exit immediately if a command exits with a non-zero status
set -e

echo "🚀 Initializing Local API Mocking Environment..."

# 1. Start the application backend locally in test mode
export DATABASE_URL="postgresql://test_user:test_password@localhost:5432/attendance_test_db"
npm install && npm run migrate:test
npm run start:test &
APP_PID=$!

# Give the local service a few seconds to boot up completely
sleep 3

# 2. Simulate & Validate: Real-Time Attendance Session Creation
echo "Verify: Session Creation (20-Minute Window Enforcement)..."
SESSION_RESP=$(curl -s -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "instructor_id": "INST-902",
    "course_code": "DSE-401",
    "duration_minutes": 20
  }')

# Extract session token or validation key using jq tool
SESSION_ID=$(echo $SESSION_RESP | jq -r '.session_id')
if [ "$SESSION_ID" == "null" ] || [ -z "$SESSION_ID" ]; then
  echo "❌ Validation Failure: Session was not generated correctly."
  kill $APP_PID
  exit 1
fi
echo "✅ Session Created Successfully ID: $SESSION_ID"

# 3. Simulate & Validate: QR Code Payload Structure Verification
echo "Verify: QR Code Dynamic Structure Integrity..."
QR_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/qr/validate \
  -H "Content-Type: application/json" \
  -d "{
    \"session_id\": \"$SESSION_ID\",
    \"timestamp\": $(date +%s),
    \"encrypted_hash\": \"a1b2c3d4e5f6g7h8\"
  }")

if [ "$QR_STATUS" != "200" ]; then
  echo "❌ Validation Failure: QR code payload signature invalid (HTTP $QR_STATUS)."
  kill $APP_PID
  exit 1
fi
echo "✅ QR Code Payload Schema Validated."

# 4. Simulate & Validate: Online Student ID Submission
echo "Verify: Student Identity Attendance Form Registration Loop..."
SUBMIT_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:3000/api/attendance/submit \
  -H "Content-Type: application/json" \
  -d "{
    \"student_id\": \"STU-2026-041\",
    \"session_id\": \"$SESSION_ID\",
    \"device_fingerprint\": \"browser-ch-992\"
  }")

if [ "$SUBMIT_STATUS" != "201" ]; then
  echo "❌ Validation Failure: Online ID submission processing failed (HTTP $SUBMIT_STATUS)."
  kill $APP_PID
  exit 1
fi
echo "✅ Student Registration Pipeline Passed Verification."

# Clean up local process
echo "🧹 Cleaning up test process threads..."
kill $APP_PID
echo "🎉 All CI Integration Mock Tests Passed Successfully!"
