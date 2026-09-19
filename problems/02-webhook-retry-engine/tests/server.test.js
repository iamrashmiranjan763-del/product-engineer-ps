const request = require("supertest");
const app = require("../server");
const db = require("../src/database");

const TEST_EVENT_ID = `evt_test_${Date.now()}`;

beforeAll(() => {
  db.prepare(`
    INSERT OR IGNORE INTO events (
      event_id,
      type,
      occurred_at,
      payload,
      status,
      attempt_count
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    TEST_EVENT_ID,
    "test.event",
    new Date().toISOString(),
    JSON.stringify({ test: true }),
    "pending",
    0
  );
});

describe("Webhook Retry Engine API", () => {
  test("GET unknown event returns 404", async () => {
    const response = await request(app)
      .get("/events/evt_DOES_NOT_EXIST");

    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({
      error: "Event not found",
    });
  });

  test("GET existing event returns 200", async () => {
    const response = await request(app)
     .get(`/events/${TEST_EVENT_ID}`);

    expect(response.statusCode).toBe(200);
    expect(response.body).toHaveProperty("event");
    expect(response.body).toHaveProperty("attempts");
    expect(Array.isArray(response.body.attempts)).toBe(true);
  });

  test("POST retry for unknown event returns 404", async () => {
  const response = await request(app)
    .post("/events/evt_DOES_NOT_EXIST/retry");

  expect(response.statusCode).toBe(404);
  expect(response.body).toEqual({
    error: "Event not found",
  });
});

test("POST retry for existing event creates new attempt", async () => {
  const before = await request(app)
   .get(`/events/${TEST_EVENT_ID}`);

  const attemptsBefore = before.body.attempts.length;

  const retryResponse = await request(app)
    .post(`/events/${TEST_EVENT_ID}/retry`);



expect(retryResponse.statusCode).toBe(201);
  expect(retryResponse.body.message).toBe("Retry created");
 expect(retryResponse.body.eventId).toBe(TEST_EVENT_ID);
  expect(retryResponse.body).toHaveProperty("attemptNumber");

  const after = await request(app)
    .get(`/events/${TEST_EVENT_ID}`);

  expect(after.body.attempts.length).toBe(attemptsBefore + 1);
});

test("retry stops after maximum delivery attempts", async () => {
  db.prepare(`
    UPDATE events
    SET attempt_count = 3
    WHERE event_id = ?
  `).run(TEST_EVENT_ID);

  const response = await request(app)
    .post(`/events/${TEST_EVENT_ID}/retry`);

  expect(response.statusCode).toBe(409);
  expect(response.body).toEqual({
    error: "Maximum delivery attempts reached",
    eventId: TEST_EVENT_ID,
    maxAttempts: 3,
  });

  const after = await request(app)
    .get(`/events/${TEST_EVENT_ID}`);

 expect(after.body.event.attempt_count).toBe(3);
});
test("retry uses exponential backoff delay", async () => {
  // Make the next retry attempt number 2.
  db.prepare(`
    UPDATE events
    SET attempt_count = 1
    WHERE event_id = ?
  `).run(TEST_EVENT_ID);

  const start = Date.now();

  const response = await request(app)
    .post(`/events/${TEST_EVENT_ID}/retry`);

  const elapsed = Date.now() - start;

  expect(response.statusCode).toBe(201);

  // Attempt 2 should wait about 2000 ms.
  expect(elapsed).toBeGreaterThanOrEqual(1900);
});
});