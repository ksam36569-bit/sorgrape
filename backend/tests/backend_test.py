"""
Sogrape Balanced Scorecard - Backend API tests (Phase 1)
Covers: health, project CRUD + duplicate, departments, objectives (cascade),
        measures (cascade), targets, bulk-import (add/update/replace + name resolution),
        update-actuals (update + create).
"""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://strategy-dashboard-16.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session")
def project_id(api):
    """Create a fresh project for the whole test session and delete it at the end."""
    r = api.post(f"{API}/projects", json={
        "company_name": "TEST_Sogrape_Phase1",
        "industry": "Beverages",
        "fiscal_year": "2026",
        "business_unit": "Wine",
        "vision": "Vision",
        "mission": "Mission",
        "strategic_themes": "Growth, Quality",
        "prepared_by": "QA",
        "prepared_date": "2026-01-15",
        "departments": ["Sales & Distribution", "Marketing"],
    })
    assert r.status_code == 200, r.text
    doc = r.json()
    pid = doc["id"]
    yield pid
    api.delete(f"{API}/projects/{pid}")


# ---------- Health ----------
class TestHealth:
    def test_root(self, api):
        r = api.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("status") == "ok"
        assert "Sogrape" in data.get("message", "")


# ---------- Project CRUD ----------
class TestProjects:
    def test_created_project_shape(self, api, project_id):
        r = api.get(f"{API}/projects/{project_id}")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] == project_id
        assert d["company_name"] == "TEST_Sogrape_Phase1"
        # Fixed 4 perspectives seeded
        assert len(d["perspectives"]) == 4
        ids = {p["id"] for p in d["perspectives"]}
        assert ids == {"financial", "customer", "internal", "learning"}
        # Empty arrays
        for k in ("objectives", "measures", "targets", "initiatives"):
            assert d[k] == []
        # Departments seeded from payload
        assert len(d["departments"]) == 2
        assert {dep["name"] for dep in d["departments"]} == {"Sales & Distribution", "Marketing"}
        # Defaults
        assert d["perspective_weights"] == {"financial": 25, "customer": 25, "internal": 25, "learning": 25}
        assert d["performance_thresholds"] == {"red_max": 70, "amber_max": 90}

    def test_list_contains_project(self, api, project_id):
        r = api.get(f"{API}/projects")
        assert r.status_code == 200
        items = r.json()
        assert any(p["id"] == project_id for p in items)

    def test_update_project(self, api, project_id):
        r = api.put(f"{API}/projects/{project_id}", json={
            "industry": "Wine & Spirits",
            "perspective_weights": {"financial": 40, "customer": 20, "internal": 20, "learning": 20},
            "performance_thresholds": {"red_max": 65, "amber_max": 85},
        })
        assert r.status_code == 200
        d = r.json()
        assert d["industry"] == "Wine & Spirits"
        assert d["perspective_weights"]["financial"] == 40
        assert d["performance_thresholds"]["red_max"] == 65
        # Verify persistence
        r2 = api.get(f"{API}/projects/{project_id}")
        assert r2.json()["industry"] == "Wine & Spirits"

    def test_duplicate_project(self, api, project_id):
        r = api.post(f"{API}/projects/{project_id}/duplicate")
        assert r.status_code == 200
        d = r.json()
        assert d["id"] != project_id
        assert d["company_name"].endswith("(Copy)")
        # cleanup
        api.delete(f"{API}/projects/{d['id']}")

    def test_delete_missing_returns_404(self, api):
        r = api.delete(f"{API}/projects/nonexistent-id-xyz")
        assert r.status_code == 404


# ---------- Departments ----------
class TestDepartments:
    def test_add_and_rename_department(self, api, project_id):
        r = api.post(f"{API}/projects/{project_id}/departments", json={"name": "Finance"})
        assert r.status_code == 200
        d = r.json()
        did = d["id"]
        assert d["name"] == "Finance"
        # rename
        r2 = api.put(f"{API}/projects/{project_id}/departments/{did}", json={"name": "Finance & Accounts"})
        assert r2.status_code == 200
        assert r2.json()["name"] == "Finance & Accounts"
        # verify
        proj = api.get(f"{API}/projects/{project_id}").json()
        assert any(x["id"] == did and x["name"] == "Finance & Accounts" for x in proj["departments"])
        # cleanup
        api.delete(f"{API}/projects/{project_id}/departments/{did}")

    def test_delete_department_unassigns_from_objectives(self, api, project_id):
        # Add dept
        d = api.post(f"{API}/projects/{project_id}/departments", json={"name": "TEST_TempDept"}).json()
        did = d["id"]
        # Add objective referencing dept
        obj = api.post(f"{API}/projects/{project_id}/objectives", json={
            "name": "TEST_Obj_DeptUnassign",
            "perspective_id": "financial",
            "department_id": did,
            "weight": 10,
        }).json()
        # Delete dept
        r = api.delete(f"{API}/projects/{project_id}/departments/{did}")
        assert r.status_code == 200
        proj = api.get(f"{API}/projects/{project_id}").json()
        found = [o for o in proj["objectives"] if o["id"] == obj["id"]]
        assert found and found[0]["department_id"] is None
        # cleanup
        api.delete(f"{API}/projects/{project_id}/objectives/{obj['id']}")


# ---------- Objective + cascade ----------
class TestObjectiveCascade:
    def test_delete_objective_cascades_measures_and_targets(self, api, project_id):
        obj = api.post(f"{API}/projects/{project_id}/objectives", json={
            "name": "TEST_ObjCascade", "perspective_id": "customer", "weight": 25,
        }).json()
        m = api.post(f"{API}/projects/{project_id}/measures", json={
            "name": "TEST_MeasureCascade", "objective_id": obj["id"], "weight": 100, "time_period": "Quarterly",
        }).json()
        t = api.post(f"{API}/projects/{project_id}/targets", json={
            "measure_id": m["id"], "period": "Q1", "target_value": 100, "actual_value": 80,
        }).json()
        # Sanity
        proj = api.get(f"{API}/projects/{project_id}").json()
        assert any(o["id"] == obj["id"] for o in proj["objectives"])
        assert any(x["id"] == m["id"] for x in proj["measures"])
        assert any(x["id"] == t["id"] for x in proj["targets"])
        # Delete objective -> cascade
        r = api.delete(f"{API}/projects/{project_id}/objectives/{obj['id']}")
        assert r.status_code == 200
        proj = api.get(f"{API}/projects/{project_id}").json()
        assert not any(o["id"] == obj["id"] for o in proj["objectives"])
        assert not any(x["id"] == m["id"] for x in proj["measures"])
        assert not any(x["id"] == t["id"] for x in proj["targets"])

    def test_objective_edit(self, api, project_id):
        obj = api.post(f"{API}/projects/{project_id}/objectives", json={
            "name": "TEST_ObjEdit", "perspective_id": "financial", "weight": 30,
        }).json()
        r = api.put(f"{API}/projects/{project_id}/objectives/{obj['id']}", json={
            "name": "TEST_ObjEditRenamed", "perspective_id": "financial", "weight": 50,
        })
        assert r.status_code == 200
        proj = api.get(f"{API}/projects/{project_id}").json()
        got = [o for o in proj["objectives"] if o["id"] == obj["id"]][0]
        assert got["name"] == "TEST_ObjEditRenamed"
        assert got["weight"] == 50
        api.delete(f"{API}/projects/{project_id}/objectives/{obj['id']}")


# ---------- Measure cascade ----------
class TestMeasureCascade:
    def test_delete_measure_cascades_targets(self, api, project_id):
        obj = api.post(f"{API}/projects/{project_id}/objectives", json={
            "name": "TEST_ObjForMeasureCascade", "perspective_id": "internal", "weight": 10,
        }).json()
        m = api.post(f"{API}/projects/{project_id}/measures", json={
            "name": "TEST_MeasureDel", "objective_id": obj["id"], "weight": 50,
        }).json()
        t = api.post(f"{API}/projects/{project_id}/targets", json={
            "measure_id": m["id"], "period": "FY", "target_value": 200, "actual_value": 150,
        }).json()
        api.delete(f"{API}/projects/{project_id}/measures/{m['id']}")
        proj = api.get(f"{API}/projects/{project_id}").json()
        assert not any(x["id"] == m["id"] for x in proj["measures"])
        assert not any(x["id"] == t["id"] for x in proj["targets"])
        api.delete(f"{API}/projects/{project_id}/objectives/{obj['id']}")


# ---------- Target CRUD ----------
class TestTargets:
    def test_target_crud(self, api, project_id):
        obj = api.post(f"{API}/projects/{project_id}/objectives", json={
            "name": "TEST_ObjTarget", "perspective_id": "learning", "weight": 20,
        }).json()
        m = api.post(f"{API}/projects/{project_id}/measures", json={
            "name": "TEST_MeasureTarget", "objective_id": obj["id"], "weight": 100,
        }).json()
        t = api.post(f"{API}/projects/{project_id}/targets", json={
            "measure_id": m["id"], "period": "FY", "target_value": 100, "actual_value": 85,
        }).json()
        assert t["actual_value"] == 85
        r = api.put(f"{API}/projects/{project_id}/targets/{t['id']}", json={
            "measure_id": m["id"], "period": "FY", "target_value": 100, "actual_value": 95,
        })
        assert r.status_code == 200
        assert r.json()["actual_value"] == 95
        api.delete(f"{API}/projects/{project_id}/targets/{t['id']}")
        proj = api.get(f"{API}/projects/{project_id}").json()
        assert not any(x["id"] == t["id"] for x in proj["targets"])
        api.delete(f"{API}/projects/{project_id}/objectives/{obj['id']}")


# ---------- Bulk import ----------
class TestBulkImport:
    def test_bulk_import_add_with_name_resolution(self, api):
        # Fresh project
        proj = api.post(f"{API}/projects", json={"company_name": "TEST_BulkImportAdd"}).json()
        pid = proj["id"]
        payload = {
            "mode": "add",
            "departments": [{"name": "Sales & Distribution"}, {"name": "Ops"}],
            "objectives": [
                {"name": "Increase Revenue", "perspective": "Financial", "department": "Sales & Distribution", "weight": 60},
                {"name": "Delight Customers", "perspective": "Customer", "weight": 40},
            ],
            "measures": [
                {"name": "Annual Revenue", "objective": "Increase Revenue", "unit": "€", "weight": 100},
                {"name": "NPS", "objective": "Delight Customers", "weight": 100},
            ],
            "targets": [
                {"measure": "Annual Revenue", "period": "FY", "target_value": 1000000, "actual_value": 850000},
                {"measure": "NPS", "period": "FY", "target_value": 70, "actual_value": 65},
            ],
            "initiatives": [
                {"name": "Sales Uplift Campaign", "measures": "Annual Revenue", "budget": 50000},
            ],
        }
        r = api.post(f"{API}/projects/{pid}/bulk-import", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert data["stats"]["created"] >= 6
        doc = data["project"]
        # Resolve checks
        objs = {o["name"]: o for o in doc["objectives"]}
        assert objs["Increase Revenue"]["perspective_id"] == "financial"
        sd = [d for d in doc["departments"] if d["name"] == "Sales & Distribution"][0]
        assert objs["Increase Revenue"]["department_id"] == sd["id"]
        assert objs["Delight Customers"]["perspective_id"] == "customer"
        # Measure linked
        rev_m = [m for m in doc["measures"] if m["name"] == "Annual Revenue"][0]
        assert rev_m["objective_id"] == objs["Increase Revenue"]["id"]
        # Target linked
        rev_t = [t for t in doc["targets"] if t["measure_id"] == rev_m["id"]][0]
        assert rev_t["target_value"] == 1000000 and rev_t["actual_value"] == 850000
        # Initiative measure_ids resolved
        init = [i for i in doc["initiatives"] if i["name"] == "Sales Uplift Campaign"][0]
        assert rev_m["id"] in init["measure_ids"]
        api.delete(f"{API}/projects/{pid}")

    def test_bulk_import_update_mode(self, api):
        proj = api.post(f"{API}/projects", json={"company_name": "TEST_BulkImportUpdate"}).json()
        pid = proj["id"]
        # Seed
        api.post(f"{API}/projects/{pid}/bulk-import", json={
            "mode": "add",
            "objectives": [{"name": "GrowMe", "perspective": "Financial", "weight": 50}],
        })
        # Update weight via update mode
        r = api.post(f"{API}/projects/{pid}/bulk-import", json={
            "mode": "update",
            "objectives": [{"name": "GrowMe", "perspective": "Financial", "weight": 80}],
        })
        assert r.status_code == 200
        assert r.json()["stats"]["updated"] >= 1
        doc = api.get(f"{API}/projects/{pid}").json()
        got = [o for o in doc["objectives"] if o["name"] == "GrowMe"][0]
        assert got["weight"] == 80
        api.delete(f"{API}/projects/{pid}")

    def test_bulk_import_replace_mode_clears(self, api):
        proj = api.post(f"{API}/projects", json={"company_name": "TEST_BulkImportReplace"}).json()
        pid = proj["id"]
        api.post(f"{API}/projects/{pid}/bulk-import", json={
            "mode": "add",
            "objectives": [{"name": "OldObj", "perspective": "Financial", "weight": 10}],
            "departments": [{"name": "OldDept"}],
        })
        # Replace should clear and only keep NewObj
        r = api.post(f"{API}/projects/{pid}/bulk-import", json={
            "mode": "replace",
            "objectives": [{"name": "NewObj", "perspective": "Customer", "weight": 20}],
        })
        assert r.status_code == 200
        doc = r.json()["project"]
        names = [o["name"] for o in doc["objectives"]]
        assert "OldObj" not in names
        assert "NewObj" in names
        assert doc["departments"] == []
        api.delete(f"{API}/projects/{pid}")


# ---------- Update Actuals ----------
class TestUpdateActuals:
    def test_update_actuals_updates_and_creates(self, api):
        proj = api.post(f"{API}/projects", json={"company_name": "TEST_UpdateActuals"}).json()
        pid = proj["id"]
        # Seed via bulk
        api.post(f"{API}/projects/{pid}/bulk-import", json={
            "mode": "add",
            "objectives": [{"name": "ObjA", "perspective": "Financial", "weight": 100}],
            "measures": [{"name": "MeasureA", "objective": "ObjA", "weight": 100}],
            "targets": [{"measure": "MeasureA", "period": "Q1", "target_value": 100, "actual_value": 50}],
        })
        # Post update-actuals: one updates Q1, one creates Q2
        r = api.post(f"{API}/projects/{pid}/update-actuals", json={
            "rows": [
                {"measure": "MeasureA", "period": "Q1", "actual_value": 88},
                {"measure": "MeasureA", "period": "Q2", "actual_value": 42},
            ]
        })
        assert r.status_code == 200
        data = r.json()
        assert data["updated"] == 1
        assert data["created"] == 1
        doc = data["project"]
        q1 = [t for t in doc["targets"] if t["period"] == "Q1"][0]
        q2 = [t for t in doc["targets"] if t["period"] == "Q2"][0]
        assert q1["actual_value"] == 88
        assert q2["actual_value"] == 42
        api.delete(f"{API}/projects/{pid}")
