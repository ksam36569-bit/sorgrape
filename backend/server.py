from fastapi import FastAPI, APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional, Any, Dict
import uuid
from datetime import datetime, timezone


ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="Sogrape Balanced Scorecard API")
api_router = APIRouter(prefix="/api")

PROJECTS = db.projects


# ---------- Models ----------

PERSPECTIVES = [
    {"id": "financial", "name": "Financial"},
    {"id": "customer", "name": "Customer"},
    {"id": "internal", "name": "Internal Business Processes"},
    {"id": "learning", "name": "Learning & Growth"},
]


def _now():
    return datetime.now(timezone.utc).isoformat()


def new_id():
    return str(uuid.uuid4())


class ProjectCreate(BaseModel):
    company_name: str
    industry: Optional[str] = ""
    fiscal_year: Optional[str] = ""
    business_unit: Optional[str] = ""
    vision: Optional[str] = ""
    mission: Optional[str] = ""
    strategic_themes: Optional[str] = ""
    prepared_by: Optional[str] = ""
    prepared_date: Optional[str] = ""
    departments: Optional[List[str]] = None


class ProjectUpdate(BaseModel):
    company_name: Optional[str] = None
    industry: Optional[str] = None
    fiscal_year: Optional[str] = None
    business_unit: Optional[str] = None
    vision: Optional[str] = None
    mission: Optional[str] = None
    strategic_themes: Optional[str] = None
    prepared_by: Optional[str] = None
    prepared_date: Optional[str] = None
    perspective_weights: Optional[Dict[str, float]] = None
    performance_thresholds: Optional[Dict[str, float]] = None


class DepartmentIn(BaseModel):
    name: str


class ObjectiveIn(BaseModel):
    name: str
    description: Optional[str] = ""
    priority: Optional[str] = "Medium"
    owner: Optional[str] = ""
    timeline: Optional[str] = ""
    status: Optional[str] = "On Track"
    color: Optional[str] = "#721B29"
    department_id: Optional[str] = None
    perspective_id: str
    weight: Optional[float] = 0


class MeasureIn(BaseModel):
    name: str
    description: Optional[str] = ""
    unit: Optional[str] = "%"
    weight: Optional[float] = 0
    baseline: Optional[float] = 0
    stretch_target: Optional[float] = 0
    time_period: Optional[str] = "Annual"  # Annual | Quarterly
    owner: Optional[str] = ""
    data_source: Optional[str] = ""
    comments: Optional[str] = ""
    objective_id: str


class TargetIn(BaseModel):
    measure_id: str
    period: str
    target_value: Optional[float] = 0
    actual_value: Optional[float] = 0


class InitiativeIn(BaseModel):
    name: str
    description: Optional[str] = ""
    budget: Optional[float] = 0
    owner: Optional[str] = ""
    start_date: Optional[str] = ""
    end_date: Optional[str] = ""
    progress: Optional[float] = 0
    status: Optional[str] = "Planned"
    risk_level: Optional[str] = "Low"
    expected_impact: Optional[str] = ""
    dependencies: Optional[str] = ""
    measure_ids: Optional[List[str]] = None


DEFAULT_PROJECT_EXTRAS = {
    "perspective_weights": {"financial": 25, "customer": 25, "internal": 25, "learning": 25},
    "performance_thresholds": {"red_max": 70, "amber_max": 90},
}


def _empty_project(payload: ProjectCreate) -> dict:
    departments = [{"id": new_id(), "name": d} for d in (payload.departments or [])]
    return {
        "id": new_id(),
        "company_name": payload.company_name,
        "industry": payload.industry or "",
        "fiscal_year": payload.fiscal_year or "",
        "business_unit": payload.business_unit or "",
        "vision": payload.vision or "",
        "mission": payload.mission or "",
        "strategic_themes": payload.strategic_themes or "",
        "prepared_by": payload.prepared_by or "",
        "prepared_date": payload.prepared_date or "",
        "perspectives": PERSPECTIVES,
        "perspective_weights": DEFAULT_PROJECT_EXTRAS["perspective_weights"].copy(),
        "performance_thresholds": DEFAULT_PROJECT_EXTRAS["performance_thresholds"].copy(),
        "departments": departments,
        "objectives": [],
        "measures": [],
        "targets": [],
        "initiatives": [],
        "strategy_edges": [],
        "created_at": _now(),
        "updated_at": _now(),
    }


async def _get_project(pid: str) -> dict:
    doc = await PROJECTS.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return doc


async def _touch(pid: str):
    await PROJECTS.update_one({"id": pid}, {"$set": {"updated_at": _now()}})


# ---------- Project routes ----------

@api_router.get("/")
async def root():
    return {"message": "Sogrape Balanced Scorecard API", "status": "ok"}


@api_router.get("/projects")
async def list_projects():
    docs = await PROJECTS.find({}, {"_id": 0}).to_list(1000)
    # summary
    return [
        {
            "id": d["id"],
            "company_name": d["company_name"],
            "industry": d.get("industry", ""),
            "fiscal_year": d.get("fiscal_year", ""),
            "business_unit": d.get("business_unit", ""),
            "updated_at": d.get("updated_at"),
            "created_at": d.get("created_at"),
            "objectives_count": len(d.get("objectives", [])),
            "measures_count": len(d.get("measures", [])),
        }
        for d in docs
    ]


@api_router.post("/projects")
async def create_project(payload: ProjectCreate):
    doc = _empty_project(payload)
    await PROJECTS.insert_one(doc.copy())
    return doc


@api_router.get("/projects/{pid}")
async def get_project(pid: str):
    return await _get_project(pid)


@api_router.put("/projects/{pid}")
async def update_project(pid: str, payload: ProjectUpdate):
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    updates["updated_at"] = _now()
    result = await PROJECTS.update_one({"id": pid}, {"$set": updates})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return await _get_project(pid)


@api_router.delete("/projects/{pid}")
async def delete_project(pid: str):
    result = await PROJECTS.delete_one({"id": pid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"ok": True}


@api_router.post("/projects/{pid}/duplicate")
async def duplicate_project(pid: str):
    doc = await _get_project(pid)
    doc["id"] = new_id()
    doc["company_name"] = f"{doc['company_name']} (Copy)"
    doc["created_at"] = _now()
    doc["updated_at"] = _now()
    await PROJECTS.insert_one(doc.copy())
    return doc


@api_router.post("/projects/import")
async def import_project(payload: Dict[str, Any]):
    # Ensures ids etc exist; assumes JSON export from this app
    doc = payload.copy()
    doc["id"] = new_id()
    doc["created_at"] = _now()
    doc["updated_at"] = _now()
    # Sanity defaults
    doc.setdefault("perspectives", PERSPECTIVES)
    doc.setdefault("perspective_weights", DEFAULT_PROJECT_EXTRAS["perspective_weights"].copy())
    doc.setdefault("performance_thresholds", DEFAULT_PROJECT_EXTRAS["performance_thresholds"].copy())
    for k in ("departments", "objectives", "measures", "targets", "initiatives", "strategy_edges"):
        doc.setdefault(k, [])
    await PROJECTS.insert_one(doc.copy())
    return doc


# ---------- Departments ----------

@api_router.post("/projects/{pid}/departments")
async def add_department(pid: str, payload: DepartmentIn):
    dept = {"id": new_id(), "name": payload.name}
    await PROJECTS.update_one({"id": pid}, {"$push": {"departments": dept}})
    await _touch(pid)
    return dept


@api_router.put("/projects/{pid}/departments/{did}")
async def update_department(pid: str, did: str, payload: DepartmentIn):
    result = await PROJECTS.update_one(
        {"id": pid, "departments.id": did},
        {"$set": {"departments.$.name": payload.name}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await _touch(pid)
    return {"id": did, "name": payload.name}


@api_router.delete("/projects/{pid}/departments/{did}")
async def delete_department(pid: str, did: str):
    await PROJECTS.update_one({"id": pid}, {"$pull": {"departments": {"id": did}}})
    # unassign from objectives
    doc = await _get_project(pid)
    for o in doc.get("objectives", []):
        if o.get("department_id") == did:
            await PROJECTS.update_one(
                {"id": pid, "objectives.id": o["id"]},
                {"$set": {"objectives.$.department_id": None}},
            )
    await _touch(pid)
    return {"ok": True}


# ---------- Objectives ----------

@api_router.post("/projects/{pid}/objectives")
async def add_objective(pid: str, payload: ObjectiveIn):
    obj = {"id": new_id(), **payload.model_dump()}
    await PROJECTS.update_one({"id": pid}, {"$push": {"objectives": obj}})
    await _touch(pid)
    return obj


@api_router.put("/projects/{pid}/objectives/{oid}")
async def update_objective(pid: str, oid: str, payload: ObjectiveIn):
    set_doc = {f"objectives.$.{k}": v for k, v in payload.model_dump().items()}
    result = await PROJECTS.update_one(
        {"id": pid, "objectives.id": oid}, {"$set": set_doc}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await _touch(pid)
    return {"id": oid, **payload.model_dump()}


@api_router.delete("/projects/{pid}/objectives/{oid}")
async def delete_objective(pid: str, oid: str):
    doc = await _get_project(pid)
    measure_ids = [m["id"] for m in doc.get("measures", []) if m.get("objective_id") == oid]
    await PROJECTS.update_one(
        {"id": pid},
        {
            "$pull": {
                "objectives": {"id": oid},
                "measures": {"objective_id": oid},
                "targets": {"measure_id": {"$in": measure_ids}},
            }
        },
    )
    await _touch(pid)
    return {"ok": True}


# ---------- Measures ----------

@api_router.post("/projects/{pid}/measures")
async def add_measure(pid: str, payload: MeasureIn):
    m = {"id": new_id(), **payload.model_dump()}
    await PROJECTS.update_one({"id": pid}, {"$push": {"measures": m}})
    await _touch(pid)
    return m


@api_router.put("/projects/{pid}/measures/{mid}")
async def update_measure(pid: str, mid: str, payload: MeasureIn):
    set_doc = {f"measures.$.{k}": v for k, v in payload.model_dump().items()}
    result = await PROJECTS.update_one(
        {"id": pid, "measures.id": mid}, {"$set": set_doc}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await _touch(pid)
    return {"id": mid, **payload.model_dump()}


@api_router.delete("/projects/{pid}/measures/{mid}")
async def delete_measure(pid: str, mid: str):
    await PROJECTS.update_one(
        {"id": pid},
        {"$pull": {"measures": {"id": mid}, "targets": {"measure_id": mid}}},
    )
    await _touch(pid)
    return {"ok": True}


# ---------- Targets ----------

@api_router.post("/projects/{pid}/targets")
async def add_target(pid: str, payload: TargetIn):
    t = {"id": new_id(), **payload.model_dump()}
    await PROJECTS.update_one({"id": pid}, {"$push": {"targets": t}})
    await _touch(pid)
    return t


@api_router.put("/projects/{pid}/targets/{tid}")
async def update_target(pid: str, tid: str, payload: TargetIn):
    set_doc = {f"targets.$.{k}": v for k, v in payload.model_dump().items()}
    result = await PROJECTS.update_one(
        {"id": pid, "targets.id": tid}, {"$set": set_doc}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await _touch(pid)
    return {"id": tid, **payload.model_dump()}


@api_router.delete("/projects/{pid}/targets/{tid}")
async def delete_target(pid: str, tid: str):
    await PROJECTS.update_one({"id": pid}, {"$pull": {"targets": {"id": tid}}})
    await _touch(pid)
    return {"ok": True}


# ---------- Initiatives ----------

@api_router.post("/projects/{pid}/initiatives")
async def add_initiative(pid: str, payload: InitiativeIn):
    i = {"id": new_id(), **payload.model_dump()}
    await PROJECTS.update_one({"id": pid}, {"$push": {"initiatives": i}})
    await _touch(pid)
    return i


@api_router.put("/projects/{pid}/initiatives/{iid}")
async def update_initiative(pid: str, iid: str, payload: InitiativeIn):
    set_doc = {f"initiatives.$.{k}": v for k, v in payload.model_dump().items()}
    result = await PROJECTS.update_one(
        {"id": pid, "initiatives.id": iid}, {"$set": set_doc}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Not found")
    await _touch(pid)
    return {"id": iid, **payload.model_dump()}


@api_router.delete("/projects/{pid}/initiatives/{iid}")
async def delete_initiative(pid: str, iid: str):
    await PROJECTS.update_one({"id": pid}, {"$pull": {"initiatives": {"id": iid}}})
    await _touch(pid)
    return {"ok": True}


# ---------- Bulk import ----------

class BulkImportPayload(BaseModel):
    mode: str = "add"  # add | update | replace
    departments: Optional[List[Dict[str, Any]]] = None
    objectives: Optional[List[Dict[str, Any]]] = None
    measures: Optional[List[Dict[str, Any]]] = None
    targets: Optional[List[Dict[str, Any]]] = None
    initiatives: Optional[List[Dict[str, Any]]] = None


@api_router.post("/projects/{pid}/bulk-import")
async def bulk_import(pid: str, payload: BulkImportPayload):
    """Rows arrive already validated & linked (frontend resolves parent names to IDs)."""
    doc = await _get_project(pid)
    mode = payload.mode

    def find_by_name(items, name):
        name_lc = (name or "").strip().lower()
        for it in items:
            if it.get("name", "").strip().lower() == name_lc:
                return it
        return None

    stats = {"created": 0, "updated": 0}

    if mode == "replace":
        doc["departments"] = []
        doc["objectives"] = []
        doc["measures"] = []
        doc["targets"] = []
        doc["initiatives"] = []

    # Departments
    for row in payload.departments or []:
        name = row.get("name")
        if not name:
            continue
        existing = find_by_name(doc["departments"], name)
        if existing and mode == "update":
            existing.update({k: v for k, v in row.items() if k != "id"})
            stats["updated"] += 1
        elif not existing or mode == "replace" or mode == "add":
            if not existing:
                doc["departments"].append({"id": new_id(), "name": name})
                stats["created"] += 1

    # Objectives
    for row in payload.objectives or []:
        name = row.get("name")
        if not name:
            continue
        pid_persp = row.get("perspective_id")
        # allow perspective name lookup
        if pid_persp is None and row.get("perspective"):
            for p in PERSPECTIVES:
                if p["name"].lower() == str(row["perspective"]).lower() or p["id"].lower() == str(row["perspective"]).lower():
                    pid_persp = p["id"]
                    break
        dept_id = row.get("department_id")
        if not dept_id and row.get("department"):
            dept = find_by_name(doc["departments"], row["department"])
            dept_id = dept["id"] if dept else None
        payload_row = {
            "name": name,
            "description": row.get("description", ""),
            "priority": row.get("priority", "Medium"),
            "owner": row.get("owner", ""),
            "timeline": row.get("timeline", ""),
            "status": row.get("status", "On Track"),
            "color": row.get("color", "#721B29"),
            "department_id": dept_id,
            "perspective_id": pid_persp or "financial",
            "weight": float(row.get("weight", 0) or 0),
        }
        existing = find_by_name(doc["objectives"], name)
        if existing and mode in ("update", "replace"):
            existing.update(payload_row)
            stats["updated"] += 1
        else:
            doc["objectives"].append({"id": new_id(), **payload_row})
            stats["created"] += 1

    # Measures
    for row in payload.measures or []:
        name = row.get("name")
        if not name:
            continue
        obj_id = row.get("objective_id")
        if not obj_id and row.get("objective"):
            obj = find_by_name(doc["objectives"], row["objective"])
            obj_id = obj["id"] if obj else None
        payload_row = {
            "name": name,
            "description": row.get("description", ""),
            "unit": row.get("unit", "%"),
            "weight": float(row.get("weight", 0) or 0),
            "baseline": float(row.get("baseline", 0) or 0),
            "stretch_target": float(row.get("stretch_target", 0) or 0),
            "time_period": row.get("time_period", "Annual"),
            "owner": row.get("owner", ""),
            "data_source": row.get("data_source", ""),
            "comments": row.get("comments", ""),
            "objective_id": obj_id,
        }
        existing = find_by_name(doc["measures"], name)
        if existing and mode in ("update", "replace"):
            existing.update(payload_row)
            stats["updated"] += 1
        else:
            doc["measures"].append({"id": new_id(), **payload_row})
            stats["created"] += 1

    # Targets
    for row in payload.targets or []:
        m_id = row.get("measure_id")
        if not m_id and row.get("measure"):
            m = find_by_name(doc["measures"], row["measure"])
            m_id = m["id"] if m else None
        if not m_id:
            continue
        period = row.get("period", "")
        payload_row = {
            "measure_id": m_id,
            "period": period,
            "target_value": float(row.get("target_value", 0) or 0),
            "actual_value": float(row.get("actual_value", 0) or 0),
        }
        # match existing by measure+period
        existing = None
        for t in doc["targets"]:
            if t["measure_id"] == m_id and t.get("period") == period:
                existing = t
                break
        if existing and mode in ("update", "replace"):
            existing.update(payload_row)
            stats["updated"] += 1
        else:
            doc["targets"].append({"id": new_id(), **payload_row})
            stats["created"] += 1

    # Initiatives
    for row in payload.initiatives or []:
        name = row.get("name")
        if not name:
            continue
        m_ids = row.get("measure_ids") or []
        if not m_ids and row.get("measures"):
            names = [s.strip() for s in str(row["measures"]).split(",") if s.strip()]
            for nm in names:
                m = find_by_name(doc["measures"], nm)
                if m:
                    m_ids.append(m["id"])
        payload_row = {
            "name": name,
            "description": row.get("description", ""),
            "budget": float(row.get("budget", 0) or 0),
            "owner": row.get("owner", ""),
            "start_date": row.get("start_date", ""),
            "end_date": row.get("end_date", ""),
            "progress": float(row.get("progress", 0) or 0),
            "status": row.get("status", "Planned"),
            "risk_level": row.get("risk_level", "Low"),
            "expected_impact": row.get("expected_impact", ""),
            "dependencies": row.get("dependencies", ""),
            "measure_ids": m_ids,
        }
        existing = find_by_name(doc["initiatives"], name)
        if existing and mode in ("update", "replace"):
            existing.update(payload_row)
            stats["updated"] += 1
        else:
            doc["initiatives"].append({"id": new_id(), **payload_row})
            stats["created"] += 1

    doc["updated_at"] = _now()
    await PROJECTS.replace_one({"id": pid}, doc)
    return {"stats": stats, "project": doc}


# ---------- Update actuals mode ----------

class UpdateActualsPayload(BaseModel):
    rows: List[Dict[str, Any]]  # measure, period, actual_value


@api_router.post("/projects/{pid}/update-actuals")
async def update_actuals(pid: str, payload: UpdateActualsPayload):
    doc = await _get_project(pid)
    updated = 0
    created = 0
    for row in payload.rows:
        m_id = row.get("measure_id")
        if not m_id and row.get("measure"):
            for m in doc["measures"]:
                if m["name"].strip().lower() == str(row["measure"]).strip().lower():
                    m_id = m["id"]
                    break
        if not m_id:
            continue
        period = row.get("period", "")
        actual = float(row.get("actual_value", 0) or 0)
        found = False
        for t in doc["targets"]:
            if t["measure_id"] == m_id and t.get("period") == period:
                t["actual_value"] = actual
                updated += 1
                found = True
                break
        if not found:
            doc["targets"].append(
                {
                    "id": new_id(),
                    "measure_id": m_id,
                    "period": period,
                    "target_value": 0,
                    "actual_value": actual,
                }
            )
            created += 1
    doc["updated_at"] = _now()
    await PROJECTS.replace_one({"id": pid}, doc)
    return {"updated": updated, "created": created, "project": doc}


# ---------- Strategy Map edges ----------

class StrategyEdgeIn(BaseModel):
    source: str  # objective id
    target: str  # objective id
    label: Optional[str] = ""


@api_router.post("/projects/{pid}/strategy-edges")
async def add_strategy_edge(pid: str, payload: StrategyEdgeIn):
    if payload.source == payload.target:
        raise HTTPException(status_code=400, detail="Source and target must differ")
    edge = {"id": new_id(), **payload.model_dump()}
    await PROJECTS.update_one({"id": pid}, {"$push": {"strategy_edges": edge}})
    await _touch(pid)
    return edge


@api_router.delete("/projects/{pid}/strategy-edges/{eid}")
async def delete_strategy_edge(pid: str, eid: str):
    await PROJECTS.update_one({"id": pid}, {"$pull": {"strategy_edges": {"id": eid}}})
    await _touch(pid)
    return {"ok": True}


# ---------- AI Summary (Claude Sonnet via Emergent LLM key, streaming SSE) ----------

def _build_summary_prompt(project: dict) -> str:
    # Compute scores server-side so the LLM gets numbers, not raw records
    persp_map = {p["id"]: p["name"] for p in PERSPECTIVES}
    p_weights = project.get("perspective_weights", {})
    objs = project.get("objectives", [])
    meas = project.get("measures", [])
    tgts = project.get("targets", [])

    def measure_pct(m):
        rel = [t for t in tgts if t["measure_id"] == m["id"]]
        if not rel:
            return 0.0
        return sum(
            ((float(t.get("actual_value") or 0)) / (float(t.get("target_value") or 0) or 1)) * 100
            for t in rel
        ) / len(rel)

    def objective_score(o):
        oms = [m for m in meas if m["objective_id"] == o["id"]]
        if not oms:
            return 0.0
        return sum(measure_pct(m) * (float(m.get("weight") or 0) / 100) for m in oms)

    def perspective_score(pid):
        oss = [o for o in objs if o["perspective_id"] == pid]
        if not oss:
            return 0.0
        return sum(objective_score(o) * (float(o.get("weight") or 0) / 100) for o in oss)

    lines = [
        f"Company: {project.get('company_name')}",
        f"Industry: {project.get('industry')}",
        f"Fiscal Year: {project.get('fiscal_year')}",
        f"Vision: {project.get('vision','') or 'n/a'}",
        f"Mission: {project.get('mission','') or 'n/a'}",
        "",
        "Perspective scores (weight):",
    ]
    for pid, pname in persp_map.items():
        s = perspective_score(pid)
        w = p_weights.get(pid, 0)
        lines.append(f"- {pname}: {s:.1f}%  (weight {w}%)")

    lines.append("")
    lines.append("Objectives:")
    for o in objs:
        s = objective_score(o)
        lines.append(
            f"- [{persp_map.get(o['perspective_id'],'?')}] {o['name']}  score={s:.1f}%  weight={o.get('weight',0)}%  status={o.get('status')}  priority={o.get('priority')}  owner={o.get('owner') or '—'}"
        )

    lines.append("")
    lines.append("Top measures (up to 20):")
    scored = []
    for m in meas:
        scored.append((m, measure_pct(m)))
    for m, pct in scored[:20]:
        obj = next((o for o in objs if o["id"] == m["objective_id"]), None)
        lines.append(
            f"- {m['name']} · unit={m.get('unit')} · weight={m.get('weight',0)}% · achievement={pct:.1f}% · objective={obj['name'] if obj else '—'}"
        )

    lines.append("")
    lines.append("Initiatives:")
    for i in project.get("initiatives", []):
        lines.append(
            f"- {i['name']}  progress={i.get('progress',0)}%  status={i.get('status')}  risk={i.get('risk_level')}  owner={i.get('owner') or '—'}"
        )

    return "\n".join(lines)


AI_SYSTEM = (
    "You are a seasoned Balanced Scorecard consultant advising Sogrape's executive team. "
    "You'll receive a snapshot of Sogrape's scorecard: perspectives, objectives, measures with "
    "achievement percentages, and initiatives. Produce a crisp executive-briefing narrative in "
    "markdown, structured as: \n\n"
    "## Executive summary\n(2-3 sentences on overall health)\n\n"
    "## Wins (up to 3)\n- ...\n\n"
    "## Areas at risk (up to 3)\n- ...\n\n"
    "## Recommended next actions (up to 5)\n1. ...\n\n"
    "Ground every claim in the numbers provided. Do not invent measures. Keep it concise, executive-tone, "
    "and highlight quick wins vs. structural risks."
)


@api_router.post("/projects/{pid}/ai-summary")
async def ai_summary(pid: str):
    """Streams a Claude Sonnet 4.5 executive summary of the scorecard as SSE."""
    project = await _get_project(pid)

    async def generator():
        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage, TextDelta, StreamDone
        except Exception as e:
            yield f"data: {{\"error\": \"integration unavailable: {e}\"}}\n\n"
            return

        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            yield "data: {\"error\": \"EMERGENT_LLM_KEY missing\"}\n\n"
            return

        chat = LlmChat(
            api_key=api_key,
            session_id=f"scorecard-{pid}-{uuid.uuid4().hex[:8]}",
            system_message=AI_SYSTEM,
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")

        prompt = _build_summary_prompt(project)
        user_message = UserMessage(text=f"Here is the scorecard snapshot:\n\n{prompt}\n\nWrite the briefing now.")

        try:
            async for ev in chat.stream_message(user_message):
                if isinstance(ev, TextDelta):
                    # SSE data lines: replace newlines with \n so multi-line stays one event
                    chunk = ev.content.replace("\n", "\\n")
                    yield f"data: {chunk}\n\n"
                elif isinstance(ev, StreamDone):
                    yield "data: [DONE]\n\n"
                    break
        except Exception as e:
            yield f"data: {{\"error\": \"{str(e)}\"}}\n\n"

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no", "Connection": "keep-alive"},
    )


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
