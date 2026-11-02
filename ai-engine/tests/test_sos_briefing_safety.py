
from app.services.sos_briefing_service import build_confirmed_facts
from app.schemas.sos_briefing import (
    AuthoritySOSBriefing,
    UserSOSBriefing,
)

from app.services.sos_briefing_service import (
    validate_authority_briefing,
    validate_user_briefing,
)

from app.rag.vector_store import close_vector_store


def test_rejects_dispatch_instruction():

    briefing = AuthoritySOSBriefing(
        title="Medical emergency",
        incident_summary="One unconscious person.",
        priority="critical",
        confirmed_facts=["One person is unconscious."],
        potential_risks=["Possible airway compromise."],
        responder_priorities=[
            "Dispatch emergency medical services immediately."
        ],
        missing_information=[],
        operational_notes=[]
    )

    try:
        validate_authority_briefing(briefing)
        assert False, "Unsafe dispatch instruction was accepted."
    except ValueError as exc:
        assert "Unsafe AI output" in str(exc)


def test_rejects_dispatch_claim_in_operational_notes():

    briefing = AuthoritySOSBriefing(
        title="Medical emergency",
        incident_summary="One unconscious person.",
        priority="critical",
        confirmed_facts=["One person is unconscious."],
        potential_risks=["Possible airway compromise."],
        responder_priorities=[
            "Assess breathing upon arrival."
        ],
        missing_information=[],
        operational_notes=[
            "Dispatch emergency medical services immediately."
        ]
    )

    try:
        validate_authority_briefing(briefing)
        assert False, "Unsafe operational note was accepted."
    except ValueError as exc:
        assert "Unsafe AI output" in str(exc)


def test_allows_dispatch_status_verification():

    briefing = AuthoritySOSBriefing(
        title="Medical emergency",
        incident_summary="One unconscious person.",
        priority="critical",
        confirmed_facts=["One person is unconscious."],
        potential_risks=["Possible airway compromise."],
        responder_priorities=[
            "Verify emergency dispatch status through the backend.",
            "Assess breathing status upon responder arrival."
        ],
        missing_information=["Current dispatch status."],
        operational_notes=["Location requires verification."]
    )

    validate_authority_briefing(briefing)


def test_rejects_false_dispatch_claim_to_user():

    briefing = UserSOSBriefing(
        title="Medical emergency",
        situation_summary="An unconscious person needs assistance.",
        immediate_actions=[
            "Emergency services have been dispatched."
        ],
        missing_information=[],
        safety_message="Stay calm."
    )

    try:
        validate_user_briefing(briefing)
        assert False, "False dispatch claim was accepted."
    except ValueError as exc:
        assert "Unsafe AI output" in str(exc)


def test_allows_safe_user_guidance():

    briefing = UserSOSBriefing(
        title="Medical emergency",
        situation_summary="A person has collapsed.",
        immediate_actions=[
            "Call emergency services immediately.",
            "Check whether the person is breathing normally."
        ],
        missing_information=["Current breathing status."],
        safety_message="Stay calm and follow dispatcher instructions."
    )

    validate_user_briefing(briefing)
    
    
def test_confirmed_facts_come_from_backend():

    incident_data = {
        "incident_id": "TEST-001",
        "incident_type": "medical",
        "severity": "critical",
        "description": "A person has collapsed and is unconscious.",
        "people_affected": 1,
        "location": {
            "latitude": 12.9716,
            "longitude": 77.5946,
            "address": "Bengaluru"
        },
        "additional_information": {
            "breathing_status": "unknown"
        }
    }

    facts = build_confirmed_facts(incident_data)

    assert "Severity: critical" in facts
    assert "People affected: 1" in facts
    assert "Incident ID: TEST-001" in facts
    assert "Reported breathing status: unknown" in facts


def test_confirmed_facts_do_not_include_ai_generated_facts():

    incident_data = {
        "incident_id": "TEST-002",
        "incident_type": "medical",
        "severity": "high",
        "description": "A person has collapsed.",
        "people_affected": 1,
        "location": None,
        "additional_information": {}
    }

    facts = build_confirmed_facts(incident_data)

    assert "The patient has cardiac arrest." not in facts
    assert "Severity: high" in facts


def test_confirmed_facts_handle_missing_location():

    incident_data = {
        "incident_id": None,
        "incident_type": "fire",
        "severity": "high",
        "description": "Smoke reported in a building.",
        "people_affected": 2,
        "location": None,
        "additional_information": {}
    }

    facts = build_confirmed_facts(incident_data)

    assert not any("latitude" in fact.lower() for fact in facts)
    assert not any("longitude" in fact.lower() for fact in facts)
    assert "Severity: high" in facts



if __name__ == "__main__":
    try:
        test_rejects_dispatch_instruction()
        test_rejects_dispatch_claim_in_operational_notes()
        test_allows_dispatch_status_verification()
        test_rejects_false_dispatch_claim_to_user()
        test_allows_safe_user_guidance()
        test_confirmed_facts_come_from_backend()
        test_confirmed_facts_do_not_include_ai_generated_facts()
        test_confirmed_facts_handle_missing_location()

        print("All 8 SOS safety tests passed!")

    finally:
        close_vector_store()
