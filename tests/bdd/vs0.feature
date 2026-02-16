Feature: VS-0 walking skeleton
  Scenario: Admin creates source and sees it in UI and agent response
    Given the API is running
    When the user creates a valid source config
    Then listing sources returns the created source
    And assistant source status includes the new source count
    And list-capabilities includes create_source and list_sources
