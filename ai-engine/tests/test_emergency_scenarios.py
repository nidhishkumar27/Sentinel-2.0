from app.rag.vector_store import close_vector_store
from app.schemas.incident import (
    IncidentContext,
    IncidentType,
    IncidentSeverity
)

from app.services.emergency_analysis_service import analyze_emergency


SCENARIOS = [
    {
        "name": "Medical Emergency",
        "incident": {
            "incident_type": IncidentType.MEDICAL,
            "severity": IncidentSeverity.CRITICAL,
            "description": (
                "A person has collapsed and is unconscious. "
                "Breathing status is currently unknown."
            ),
            "people_affected": 1,
            "additional_information": {
                "condition": "Unconscious",
                "breathing": "Unknown"
            }
        },
        "query": "What immediate steps should be taken?"
    },
    {
        "name": "Road Accident",
        "incident": {
            "incident_type": IncidentType.ROAD_ACCIDENT,
            "severity": IncidentSeverity.HIGH,
            "description": (
                "A motorcyclist has been injured in a collision "
                "and is experiencing severe bleeding."
            ),
            "people_affected": 1,
            "additional_information": {
                "condition": "Conscious",
                "injury": "Severe bleeding"
            }
        },
        "query": "What immediate first aid is required?"
    },
    {
        "name": "Fire Emergency",
        "incident": {
            "incident_type": IncidentType.FIRE,
            "severity": IncidentSeverity.CRITICAL,
            "description": (
                "A fire has started inside a residential building. "
                "Smoke is spreading through the building."
            ),
            "people_affected": 3,
            "additional_information": {
                "building": "Residential",
                "smoke": "Present"
            }
        },
        "query": "What should occupants do immediately?"
    },
    {
        "name": "Personal Safety Threat",
        "incident": {
            "incident_type": IncidentType.PERSONAL_SAFETY,
            "severity": IncidentSeverity.HIGH,
            "description": (
                "A person reports being followed by an unknown "
                "individual while walking alone at night."
            ),
            "people_affected": 1,
            "additional_information": {
                "environment": "Public street",
                "threat": "Unknown individual"
            }
        },
        "query": "What safety steps should the person take?"
    },
    {
        "name": "Natural Disaster",
        "incident": {
            "incident_type": IncidentType.NATURAL_DISASTER,
            "severity": IncidentSeverity.CRITICAL,
            "description": (
                "Heavy flooding has affected a residential area. "
                "Water levels are rising and residents are stranded."
            ),
            "people_affected": 10,
            "additional_information": {
                "hazard": "Flooding",
                "water_level": "Rising"
            }
        },
        "query": "What immediate safety measures are necessary?"
    },
    {
        "name": "Lost Person",
        "incident": {
            "incident_type": IncidentType.LOST_PERSON,
            "severity": IncidentSeverity.MEDIUM,
            "description": (
                "A tourist is lost in an unfamiliar city, "
                "cannot recognize nearby streets and needs "
                "help finding a safe public location."
            ),
            "people_affected": 1,
            "additional_information": {
                "user_status": "Safe but confused",
                "alone": "Yes",
                "gps_available": "Yes",
                "phone_battery": "15%"
            }
        },
        "query": (
            "I am lost in an unfamiliar city. "
            "How can I safely find my way?"
        )
    }

]


def run_scenario(scenario):

    print("\n" + "=" * 65)
    print("SCENARIO:", scenario["name"])
    print("=" * 65)

    try:
        incident = IncidentContext(**scenario["incident"])

        result = analyze_emergency(
            incident=incident,
            user_query=scenario["query"]
        )

        # Validate the returned structure.
        response = result.model_dump()

        assert response["status"] == "success"
        assert response["emergency_summary"]
        assert len(response["immediate_actions"]) > 0
        assert response["disclaimer"]

        print("STATUS: PASSED")
        print("INCIDENT TYPE:", response["incident_type"])
        print("SEVERITY:", response["severity"])
        print("\nSUMMARY:")
        print(response["emergency_summary"])

        print("\nIMMEDIATE ACTIONS:")
        for index, action in enumerate(
            response["immediate_actions"], start=1
        ):
            print(f"{index}. {action}")

        print("\nMISSING INFORMATION:")
        for item in response["missing_information"]:
            print("-", item)

        print("\nRETRIEVED SOURCES:", len(response["sources"]))

        return True

    except Exception as error:
        print("STATUS: FAILED")
        print("ERROR:", str(error))
        return False



if __name__ == "__main__":

    passed = 0
    failed = 0

    print("\nSENTINEL EMERGENCY SCENARIO TESTING")
    print("Total scenarios:", len(SCENARIOS))

    try:
        for scenario in SCENARIOS:
            if run_scenario(scenario):
                passed += 1
            else:
                failed += 1

    finally:
        close_vector_store()

    print("\n" + "=" * 65)
    print("FINAL TEST SUMMARY")
    print("=" * 65)
    print("Total:", len(SCENARIOS))
    print("Passed:", passed)
    print("Failed:", failed)

