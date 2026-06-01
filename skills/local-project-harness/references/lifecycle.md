# Lifecycle Reference

Use this when real or simulated sub-agents are involved.

## States

```text
spawned
  -> assigned
  -> running
  -> report_received
  -> consumed
  -> close_pending
  -> closed
```

Terminal failure states:

- `blocked`
- `validation_failed`
- `security_failed`
- `budget_exceeded`
- `consensus_failed`

## Tracking Table

```markdown
| agent_id | role | task_id | status | owner | close_condition | close_deferred_reason |
| --- | --- | --- | --- | --- | --- | --- |
```

## Close Rules

Close or mark complete when:

- goal contract has been consumed by planning
- goal review report has been consumed by breakdown, rework, or user-input decision
- worker report has been consumed by integration or review
- verification report has been consumed by review or final decision
- review report has been consumed by rework or completion decision
- summary report has been consumed by the final user response
- the agent is blocked and no immediate follow-up input will be sent
- final response is about to be sent

Defer close only when the same agent will immediately receive follow-up input and preserving context materially improves the next step. Record:

- reason
- next input expected
- revisit condition

Before final response, no agent should remain in `spawned`, `assigned`, `running`, `report_received`, `consumed`, or `close_pending`.
