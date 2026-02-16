Feature: Vertical slices VS-0 to VS-5 bootstrap

  Scenario: VS-0 source create/read and assistant status
    Given the API is running
    When a user creates a valid source config
    Then list sources returns the source
    And assistant source status reflects source count

  Scenario: VS-1 ingestion and job search
    Given an existing source config
    When ingestion run is triggered for the source
    Then dedup-safe jobs are available in catalog
    And searching jobs by keyword returns relevant records

  Scenario: VS-2 candidate intake and grading
    Given a candidate resume payload
    When candidate is created and graded
    Then structured grade fields are persisted with valid score bounds

  Scenario: VS-3 applications and matching
    Given a graded candidate and ingested job
    When an application is created and matched
    Then match payload includes knockout and weighted score
    And stage transition updates persist

  Scenario: VS-4 operations and audit
    Given mutating actions were executed
    When ops and audit endpoints are requested
    Then run history and audit events are returned

  Scenario: VS-5 release readiness baseline
    Given tests, typecheck, and harness pass
    Then the bootstrap is ready for iterative hardening and rollout tasks
