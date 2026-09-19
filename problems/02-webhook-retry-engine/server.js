const express = require("express");
const db = require("./src/database");

const app = express();
const PORT = process.env.PORT || 3000;

const WEBHOOK_URL =
  process.env.WEBHOOK_URL || "http://localhost:4000/webhook";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

function getRetryDelay(attemptNumber) {
  return RETRY_DELAY_MS * Math.pow(2, attemptNumber - 1);
}
function isRetryableFailure(httpStatus) {
  if (httpStatus === null) {
    return true;
  }

  return (
    httpStatus === 408 ||
    httpStatus === 429 ||
    httpStatus >= 500
  );
}
function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Webhook Retry Engine is running"
  });
});

app.post("/events", (req, res) => {
  const { eventId, type, occurredAt, payload } = req.body;

  if (!eventId || !type || !occurredAt || payload === undefined) {
    return res.status(400).json({
      error: "eventId, type, occurredAt and payload are required",
    });
  }

  
  const existingEvent = db
  .prepare("SELECT * FROM events WHERE event_id = ?")
  .get(eventId);

if (existingEvent) {
  return res.status(200).json({
    message: "Event already received",
    eventId: existingEvent.event_id,
    duplicate: true,
  });
}

const insertEvent = db.prepare(`
  INSERT INTO events (event_id, type, occurred_at, payload)
  VALUES (?, ?, ?, ?)
`);

insertEvent.run(
  eventId,
  type,
  occurredAt,
  JSON.stringify(payload)
);

const insertAttempt = db.prepare(`
  INSERT INTO delivery_attempts
  (event_id, attempt_number, status)
  VALUES (?, ?, ?)
`);

insertAttempt.run(
  eventId,
  1,
  "pending"
);

const updateAttemptCount = db.prepare(`
  UPDATE events
  SET attempt_count = attempt_count + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE event_id = ?
`);

updateAttemptCount.run(eventId);
res.status(201).json({
    message: "Event received",
    event: {
      eventId,
      type,
      occurredAt,
      payload,
    },
  });
});
async function deliverWebhook(event) {
  try {
    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        eventId: event.event_id,
        type: event.type,
        occurredAt: event.occurred_at,
        payload: JSON.parse(event.payload),
      }),
    });

    const success = response.status >= 200 && response.status < 300;

    return {
      status: success ? "success" : "failed",
      httpStatus: response.status,
      errorMessage: success
        ? null
        : `Webhook returned HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      status: "failed",
      httpStatus: null,
      errorMessage: error.message,
    };
  }
}
app.post("/events/:eventId/retry", async (req, res) => {
  const { eventId } = req.params;

  const event = db
    .prepare("SELECT * FROM events WHERE event_id = ?")
    .get(eventId);

  if (!event) {
    return res.status(404).json({
      error: "Event not found",
    });
  }
if (event.attempt_count >= MAX_ATTEMPTS) {
  return res.status(409).json({
    error: "Maximum delivery attempts reached",
    eventId,
    maxAttempts: MAX_ATTEMPTS,
  });
}
  const nextAttemptNumber = event.attempt_count + 1;
  const retryDelay = getRetryDelay(nextAttemptNumber);

const nextRetryAt = new Date(
  Date.now() + retryDelay
).toISOString();

 const insertAttempt = db.prepare(`
  INSERT INTO delivery_attempts
  (event_id, attempt_number, status, next_retry_at)
  VALUES (?, ?, ?, ?)
`);

insertAttempt.run(
  eventId,
  nextAttemptNumber,
  "pending",
  nextRetryAt
);
await wait(retryDelay);
const delivery = await deliverWebhook(event);

const retryable =
  delivery.status === "failed" &&
  isRetryableFailure(delivery.httpStatus);

const attemptStatus = delivery.status;
const httpStatus = delivery.httpStatus;
const errorMessage = delivery.errorMessage;


const updateAttempt = db.prepare(`
  UPDATE delivery_attempts
  SET status = ?,
      http_status = ?,
      error_message = ?
  WHERE event_id = ? AND attempt_number = ?
`);

updateAttempt.run(
  attemptStatus,
  httpStatus,
  errorMessage,
  eventId,
  nextAttemptNumber
);
  const updateAttemptCount = db.prepare(`
    UPDATE events
    SET attempt_count = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE event_id = ?
  `);

  updateAttemptCount.run(
    nextAttemptNumber,
    eventId
  );

 res.status(201).json({
  message: "Retry created",
  eventId,
  attemptNumber: nextAttemptNumber,
  status: attemptStatus,
  httpStatus,
  retryable,
});
});
app.get("/events/:eventId", (req, res) => {
  const { eventId } = req.params;

  const event = db
    .prepare("SELECT * FROM events WHERE event_id = ?")
    .get(eventId);

  if (!event) {
    return res.status(404).json({
      error: "Event not found",
    });
  }

const attempts = db
  .prepare(`
    SELECT attempt_number, status, http_status, error_message
    FROM delivery_attempts
    WHERE event_id = ?
    ORDER BY attempt_number
  `)
  .all(eventId);
  res.json({
    event,
    attempts,
  });
});

async function processScheduledRetries() {
  const now = new Date().toISOString();

  const scheduledAttempts = db
    .prepare(`
      SELECT DISTINCT event_id
      FROM delivery_attempts
      WHERE status = 'pending'
        AND next_retry_at IS NOT NULL
        AND next_retry_at <= ?
    `)
    .all(now);

  for (const attempt of scheduledAttempts) {
    console.log(`Retry ready for event: ${attempt.event_id}`);
  }
}
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  setInterval(() => {
    processScheduledRetries().catch((error) => {
      console.error("Scheduled retry processor error:", error);
    });
  }, 1000);
}

module.exports = app;