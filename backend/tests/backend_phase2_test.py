"""
Sogrape Balanced Scorecard - Phase 2-5 Backend API tests

Covers new endpoints:
- Strategy edges (POST/DELETE, 400 on self-loop)
- Initiatives CRUD (with measure_ids)
- update-actuals (updated + created + returned project)
- AI summary SSE endpoint (Content-Type + [DONE] terminator + non-empty stream)
- JSON project import (roundtrip creates new project with new id/timestamps)
"""
import os
import time
import json
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://strategy-dashboard-16.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def project_id(api):
    """Fresh project for the module. Cleanup after all tests."""
    r = api.post(f"{API}/projects", json={
        "company_name": "TEST_Phase2_Backend",
        "industry": "Beverages",
        "fiscal_year": "FY26",
        "departments": ["Sales", "Ops"],
    })
    assert r.status_code == 200, r.text
    pid = r.json()["id"]
    # seed objectives across perspectives
    obj_ids = {}
    for persp, name in [
        ("financial", "Grow Revenue"),
        ("customer", "Delight Customers"),
        ("internal", "Improve Processes"),
        ("learning", "Upskill Team"),
    ]:
        o = api.post(f"{API}/projects/{pid}/objectives", json={
            "name": f"TEST_{name}",
            "perspective_id": persp,
            "weight": 25,
        }).json()
        obj_ids[persp] = o["id"]
    # seed a couple of measures
    m1 = api.post(f"{API}/projects/{pid}/measures", json={
        "name": "TEST_Revenue", "objective_id": obj_ids["financial"], "weight": 100,
    }).json()
    m2 = api.post(f"{API}/projects/{pid}/measures", json={
        "name": "TEST_NPS", "objective_id": obj_ids["customer"], "weight": 100,
    }).json()
    ctx = {"pid": pid, "obj_ids": obj_ids, "m_ids": [m1["id"], m2["id"]]}
    yield ctx
    api.delete(f"{API}/projects/{pid}")


# ------------------- Strategy edges -------------------
class TestStrategyEdges:
    def test_add_edge(self, api, project_id):
        pid = project_id["pid"]
        src = project_id["obj_ids"]["learning"]
        tgt = project_id["obj_ids"]["internal"]
        r = api.post(f"{API}/projects/{pid}/strategy-edges", json={
            "source": src, "target": tgt, "label": "supports",
        })
        assert r.status_code == 200, r.text
        edge = r.json()
        assert "id" in edge and edge["id"]
        assert edge["source"] == src
        assert edge["target"] == tgt
        assert edge["label"] == "supports"
        # persistence
        doc = api.get(f"{API}/projects/{pid}").json()
        assert any(e["id"] == edge["id"] for e in doc.get("strategy_edges", []))
        project_id.setdefault("edge_ids", []).append(edge["id"])

    def test_self_loop_returns_400(self, api, project_id):
        pid = project_id["pid"]
        src = project_id["obj_ids"]["financial"]
        r = api.post(f"{API}/projects/{pid}/strategy-edges", json={
            "source": src, "target": src, "label": "loop",
        })
        assert r.status_code == 400
        data = r.json()
        assert "differ" in (data.get("detail", "") or "").lower() or data.get("detail")

    def test_delete_edge(self, api, project_id):
        pid = project_id["pid"]
        # add then delete
        src = project_id["obj_ids"]["internal"]
        tgt = project_id["obj_ids"]["customer"]
        edge = api.post(f"{API}/projects/{pid}/strategy-edges", json={
            "source": src, "target": tgt, "label": "flows",
        }).json()
        eid = edge["id"]
        r = api.delete(f"{API}/projects/{pid}/strategy-edges/{eid}")
        assert r.status_code == 200
        assert r.json().get("ok") is True
        doc = api.get(f"{API}/projects/{pid}").json()
        assert not any(e["id"] == eid for e in doc.get("strategy_edges", []))


# ------------------- Initiatives CRUD -------------------
class TestInitiativesCRUD:
    def test_create_with_measure_ids(self, api, project_id):
        pid = project_id["pid"]
        m_ids = project_id["m_ids"]
        r = api.post(f"{API}/projects/{pid}/initiatives", json={
            "name": "TEST_InitCRUD",
            "budget": 25000,
            "owner": "QA",
            "progress": 40,
            "risk_level": "Medium",
            "status": "In Progress",
            "measure_ids": m_ids,
        })
        assert r.status_code == 200, r.text
        i = r.json()
        assert i["name"] == "TEST_InitCRUD"
        assert i["measure_ids"] == m_ids
        assert i["budget"] == 25000
        assert "id" in i
        # verify persistence
        doc = api.get(f"{API}/projects/{pid}").json()
        stored = [x for x in doc["initiatives"] if x["id"] == i["id"]][0]
        assert stored["measure_ids"] == m_ids
        project_id["init_id"] = i["id"]

    def test_update_initiative(self, api, project_id):
        pid = project_id["pid"]
        iid = project_id["init_id"]
        m_ids = project_id["m_ids"]
        r = api.put(f"{API}/projects/{pid}/initiatives/{iid}", json={
            "name": "TEST_InitCRUD_Renamed",
            "budget": 30000,
            "owner": "QA-2",
            "progress": 55,
            "risk_level": "High",
            "status": "In Progress",
            "measure_ids": m_ids[:1],
        })
        assert r.status_code == 200
        doc = api.get(f"{API}/projects/{pid}").json()
        stored = [x for x in doc["initiatives"] if x["id"] == iid][0]
        assert stored["name"] == "TEST_InitCRUD_Renamed"
        assert stored["progress"] == 55
        assert stored["risk_level"] == "High"
        assert stored["measure_ids"] == m_ids[:1]

    def test_delete_initiative(self, api, project_id):
        pid = project_id["pid"]
        iid = project_id["init_id"]
        r = api.delete(f"{API}/projects/{pid}/initiatives/{iid}")
        assert r.status_code == 200
        doc = api.get(f"{API}/projects/{pid}").json()
        assert not any(x["id"] == iid for x in doc["initiatives"])


# ------------------- Update actuals shape -------------------
class TestUpdateActualsShape:
    def test_returns_updated_created_and_project(self, api, project_id):
        pid = project_id["pid"]
        # Use existing measures via names
        r = api.post(f"{API}/projects/{pid}/update-actuals", json={
            "rows": [
                {"measure": "TEST_Revenue", "period": "Q1", "actual_value": 42},
                {"measure": "TEST_NPS", "period": "Q1", "actual_value": 71},
            ]
        })
        assert r.status_code == 200
        data = r.json()
        for k in ("updated", "created", "project"):
            assert k in data
        assert isinstance(data["updated"], int)
        assert isinstance(data["created"], int)
        assert data["updated"] + data["created"] == 2
        proj = data["project"]
        # Both targets should now exist
        assert any(t["period"] == "Q1" and t["actual_value"] == 42 for t in proj["targets"])
        assert any(t["period"] == "Q1" and t["actual_value"] == 71 for t in proj["targets"])
        # Second call must UPDATE (not create)
        r2 = api.post(f"{API}/projects/{pid}/update-actuals", json={
            "rows": [
                {"measure": "TEST_Revenue", "period": "Q1", "actual_value": 55},
            ]
        })
        assert r2.status_code == 200
        d2 = r2.json()
        assert d2["updated"] == 1
        assert d2["created"] == 0


# ------------------- JSON project import -------------------
class TestProjectImport:
    def test_roundtrip_creates_new_project(self, api, project_id):
        pid = project_id["pid"]
        # Get the current project JSON (simulating export)
        exported = api.get(f"{API}/projects/{pid}").json()
        orig_id = exported["id"]
        orig_created = exported["created_at"]
        # Import as new project
        r = api.post(f"{API}/projects/import", json=exported)
        assert r.status_code == 200, r.text
        new_doc = r.json()
        assert new_doc["id"] != orig_id
        assert new_doc["created_at"] and new_doc["created_at"] != orig_created
        assert new_doc["updated_at"]
        # Nested arrays kept
        assert len(new_doc["objectives"]) == len(exported["objectives"])
        assert len(new_doc["measures"]) == len(exported["measures"])
        # cleanup
        api.delete(f"{API}/projects/{new_doc['id']}")

    def test_import_missing_fields_defaults_get_added(self, api):
        # Minimal payload — server should backfill arrays + weights + perspectives
        r = api.post(f"{API}/projects/import", json={"company_name": "TEST_ImportMinimal"})
        assert r.status_code == 200, r.text
        d = r.json()
        assert "id" in d
        assert isinstance(d.get("objectives"), list) and d["objectives"] == []
        assert isinstance(d.get("strategy_edges"), list) and d["strategy_edges"] == []
        assert d.get("perspective_weights") == {"financial": 25, "customer": 25, "internal": 25, "learning": 25}
        assert len(d.get("perspectives", [])) == 4
        api.delete(f"{API}/projects/{d['id']}")


# ------------------- AI Summary SSE -------------------
class TestAiSummarySSE:
    def test_streams_events_and_terminates_with_done(self, api):
        # Use the seeded demo project so LLM has real data
        projects = api.get(f"{API}/projects").json()
        demo = next((p for p in projects if p["company_name"] == "Sogrape Demo"), None)
        if not demo:
            pytest.skip("Sogrape Demo project not seeded")
        pid = demo["id"]
        # Streaming request
        url = f"{API}/projects/{pid}/ai-summary"
        with requests.post(url, stream=True, timeout=120) as r:
            assert r.status_code == 200, r.text
            ct = r.headers.get("Content-Type", "")
            assert "text/event-stream" in ct, f"Expected event-stream, got {ct}"
            got_data_lines = 0
            got_done = False
            content_chars = 0
            start = time.time()
            for raw in r.iter_lines(decode_unicode=True):
                if raw is None:
                    continue
                line = raw
                if line.startswith("data:"):
                    payload = line[5:].strip()
                    got_data_lines += 1
                    if payload == "[DONE]":
                        got_done = True
                        break
                    if not payload.startswith('{"error"'):
                        content_chars += len(payload)
                # Safety timeout
                if time.time() - start > 90:
                    break
        assert got_data_lines > 0, "No data: lines received"
        assert got_done, "Stream did not terminate with data: [DONE]"
        assert content_chars > 20, f"Streamed content looks empty ({content_chars} chars)"
