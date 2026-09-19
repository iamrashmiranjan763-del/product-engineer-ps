const express = require("express");
const db = require("./src/database");

const app = express();
const PORT = 3000;

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
app.post("/events/:eventId/retry", (req, res) => {
  const { eventId } = req.params;

  const event = db
    .prepare("SELECT * FROM events WHERE event_id = ?")
    .get(eventId);

  if (!event) {
    return res.status(404).json({
      error: "Event not found",
    });
  }

  const nextAttemptNumber = event.attempt_count + 1;

  const insertAttempt = db.prepare(`
    INSERT INTO delivery_attempts
    (event_id, attempt_number, status)
    VALUES (?, ?, ?)
  `);

  insertAttempt.run(
    eventId,
    nextAttemptNumber,
    "pending"
  );
const deliverySucceeded = Math.random() < 0.7;

const attemptStatus = deliverySucceeded ? "success" : "failed";
const httpStatus = deliverySucceeded ? 200 : 500;
const errorMessage = deliverySucceeded
  ? null
  : "Simulated webhook delivery failure";

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

  res.json({
    message: "Retry created",
    eventId,
    attemptNumber: nextAttemptNumber,
  });
});
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});