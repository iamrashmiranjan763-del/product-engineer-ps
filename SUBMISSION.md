# Product Engineering Challenge Submission

## Candidate

- **Name:** Rashmi Ranjan Sahoo
- **Email:** iamrashmiranjan763@gmail.com
- **GitHub:** https://github.com/iamrashmiranjan763-del
- **Selected problem:** Problem 02 — Webhook Retry Engine
- **Demo video:** TO_BE_ADDED
## Run the project

### Prerequisites

- Node.js 18 or later
- npm

### Setup and start

```text
cd problems/02-webhook-retry-engine
npm install
node receiver.js

```
Open a second terminal and run:

```text
cd problems/02-webhook-retry-engine
node server.js
```

The webhook retry engine runs on `http://localhost:3000` and the local test webhook receiver runs on `http://localhost:4000`.

The application uses the following optional environment variable:

```text
WEBHOOK_URL
```

If `WEBHOOK_URL` is not provided, the application uses `http://localhost:4000/webhook` for local testing.

## Run the tests

From the `problems/02-webhook-retry-engine` directory, run:

```text
npm test
```

The automated test suite verifies event ingestion, event lookup, retry creation, maximum retry limits, exponential backoff, retry timestamps, scheduled retry processing, and idempotent handling of repeated event IDs.

## Architecture and data flow

The solution has four main components:

1. **Express API (`server.js`)** — receives events, exposes event-status and retry endpoints, and controls webhook delivery.
2. **SQLite database (`src/database.js`)** — persists events and delivery attempts so retry state is not kept only in memory.
3. **Webhook receiver (`receiver.js`)** — provides a local webhook endpoint used to test successful delivery.
4. **Retry processor** — finds pending retries whose `next_retry_at` time has arrived and attempts delivery again.

Data flow:

`Client -> Express API -> SQLite -> Webhook delivery -> Receiver`

When an event is received, it is stored in SQLite and a delivery attempt is made. Failed retryable deliveries can be retried with exponential backoff. Each delivery attempt is recorded with its attempt number, status, HTTP status, error information, and next retry time. Repeated ingestion of the same `eventId` is handled idempotently to avoid creating duplicate events.

## Technology choices

I used Node.js with Express because it provides a simple and lightweight way to build the required HTTP API and webhook delivery logic.

SQLite with `better-sqlite3` was chosen because the challenge needs persistent storage while remaining easy to run locally without requiring an external database server.

Jest and Supertest are used for automated testing of the API behavior and retry logic.

For a larger production system, PostgreSQL could replace SQLite and a dedicated job queue such as BullMQ or a managed queue service could handle retry scheduling. For this prototype, SQLite keeps the setup simple while still providing persistent retry state.

The main trade-off is that this design is optimized for simplicity and local execution rather than distributed or high-volume processing.

## Important decisions

1. **Persistent retry state:** Events and delivery attempts are stored in SQLite instead of only in memory. This allows retry information and delivery history to survive application restarts.

2. **Exponential backoff:** Failed retryable deliveries use increasing retry delays instead of retrying continuously. This reduces unnecessary requests to an unavailable webhook endpoint.

3. **Idempotent event ingestion:** The `event_id` is unique. If the same event is submitted more than once, the system avoids creating duplicate events and duplicate initial deliveries.

## Assumptions and limitations

- The prototype assumes a single webhook destination configured through `WEBHOOK_URL`.
- Retry attempts are limited to a maximum of three delivery attempts.
- SQLite is suitable for this local prototype but is not intended for high-volume distributed processing.
- The retry processor runs within the application process rather than through a separate background worker or queue.
- Authentication and authorization are not implemented because they are outside the scope of this prototype.
- The local `receiver.js` is included only to demonstrate and test webhook delivery.

## Production and scale

For production, I would first move the retry work out of the API process into a dedicated background worker and persistent job queue. This would make retry processing more reliable and allow multiple workers to process deliveries independently.

I would replace SQLite with PostgreSQL for better concurrency, reliability, and scalability.

I would also add authentication, structured logging, monitoring and metrics, configurable retry policies, webhook signing, rate limiting, and a dead-letter queue for events that continue to fail after the maximum number of attempts.

For horizontal scaling, multiple API and worker instances could run behind a load balancer while sharing the database and queue.

## AI usage

I used ChatGPT during development as a learning and development assistant. It helped me understand the problem requirements, plan the implementation, debug issues in the retry processor, improve the automated tests, and prepare the documentation.

I reviewed the suggested changes, ran the application and test suite locally, investigated failures, and verified the final behavior before submission.

AI was used as an assistance tool rather than as a substitute for testing and verification of the implementation.

## Credibility note

One project I previously built is **SpendWise**, a personal expense tracking application.

- **Problem it solved:** It provides a simple way for users to record and organize their expenses and understand their spending.

- **My personal contribution:** I built the project, implemented its core functionality, organized the project structure, tested the application locally, and documented it for GitHub.

- **Scale or operational complexity:** This was a portfolio-scale project designed for individual use rather than a production system with large numbers of users. The main focus was building a complete working application and maintaining a clear project structure.

- **One difficult engineering or product decision:** One important decision was keeping the application simple enough to use while organizing the expense data and functionality in a way that could be extended with additional features later.

- **Public link or other evidence:**https://github.com/iamrashmiranjan763-del/SpendWise