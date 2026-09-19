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
});