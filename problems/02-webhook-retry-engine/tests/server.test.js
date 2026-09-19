const request = require("supertest");
const app = require("../server");

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
      .get("/events/evt_902");

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
    .get("/events/evt_902");

  const attemptsBefore = before.body.attempts.length;

  const retryResponse = await request(app)
    .post("/events/evt_902/retry");



expect(retryResponse.statusCode).toBe(201);
  expect(retryResponse.body.message).toBe("Retry created");
  expect(retryResponse.body.eventId).toBe("evt_902");
  expect(retryResponse.body).toHaveProperty("attemptNumber");

  const after = await request(app)
    .get("/events/evt_902");

  expect(after.body.attempts.length).toBe(attemptsBefore + 1);
});
});