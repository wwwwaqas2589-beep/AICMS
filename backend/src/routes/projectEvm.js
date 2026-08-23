const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// HELPERS
// =====================================================

function num(value) {
return Number(value || 0);
}

function round(value) {
return Number(num(value).toFixed(2));
}

// =====================================================
// GET PROJECT EVM
// GET /api/project-evm/:project_id
// =====================================================

router.get("/:project_id", async (req, res) => {
try {
const { project_id } = req.params;

```
// -------------------------------------------------
// PROJECT
// -------------------------------------------------

const {
  data: project,
  error: projectError
} = await supabase
  .from("projects")
  .select("*")
  .eq("id", project_id)
  .maybeSingle();

if (projectError) {
  return res.status(500).json({
    success: false,
    message: "Failed to fetch project",
    error: projectError.message
  });
}

if (!project) {
  return res.status(404).json({
    success: false,
    message: "Project not found"
  });
}

// -------------------------------------------------
// WORK ACTIVITIES
// -------------------------------------------------

const {
  data: activities,
  error: activityError
} = await supabase
  .from("work_activities")
  .select("*")
  .eq("project_id", project_id);

if (activityError) {
  return res.status(500).json({
    success: false,
    message: "Failed to fetch work activities",
    error: activityError.message
  });
}

// -------------------------------------------------
// COST RECORDS
// -------------------------------------------------

const {
  data: manpower,
  error: manpowerError
} = await supabase
  .from("manpower_records")
  .select("*")
  .eq("project_id", project_id);

if (manpowerError) {
  return res.status(500).json({
    success: false,
    message: "Failed to fetch manpower records",
    error: manpowerError.message
  });
}

const {
  data: equipment,
  error: equipmentError
} = await supabase
  .from("equipment_records")
  .select("*")
  .eq("project_id", project_id);

if (equipmentError) {
  return res.status(500).json({
    success: false,
    message: "Failed to fetch equipment records",
    error: equipmentError.message
  });
}

const {
  data: materials,
  error: materialError
} = await supabase
  .from("material_transactions")
  .select("*")
  .eq("project_id", project_id);

if (materialError) {
  return res.status(500).json({
    success: false,
    message: "Failed to fetch material transactions",
    error: materialError.message
  });
}

// -------------------------------------------------
// ACTUAL COST BY ACTIVITY
// -------------------------------------------------

const actualCosts = {};

function ensureActivity(activityId) {
  if (!actualCosts[activityId]) {
    actualCosts[activityId] = {
      manpower: 0,
      equipment: 0,
      material: 0,
      actual_cost: 0
    };
  }
}

manpower.forEach((item) => {
  if (!item.activity_id) return;

  const id = item.activity_id;

  ensureActivity(id);

  actualCosts[id].manpower += num(
    item.total_cost || item.totalCost
  );
});

equipment.forEach((item) => {
  if (!item.activity_id) return;

  const id = item.activity_id;

  ensureActivity(id);

  actualCosts[id].equipment += num(
    item.total_cost || item.totalCost
  );
});

materials.forEach((item) => {
  if (!item.activity_id) return;

  if (
    item.transaction_type !== "receipt" &&
    item.transaction_type !== "consumption"
  ) {
    return;
  }

  const id = item.activity_id;

  ensureActivity(id);

  actualCosts[id].material += num(
    item.total_cost
  );
});

// -------------------------------------------------
// PROJECT EVM TOTALS
// -------------------------------------------------

let BAC = 0;
let PV = 0;
let EV = 0;
let AC = 0;

const activityEvm = [];

activities.forEach((activity) => {

  const plannedQuantity =
    num(activity.planned_quantity);

  const completedQuantity =
    Math.min(
      Math.max(
        num(activity.completed_quantity),
        0
      ),
      plannedQuantity
    );

  const unitRate =
    num(activity.planned_unit_rate);

  let activityBAC =
    num(activity.planned_total_cost);

  if (
    activityBAC === 0 &&
    plannedQuantity > 0 &&
    unitRate > 0
  ) {
    activityBAC =
      plannedQuantity * unitRate;
  }

  const progress =
    plannedQuantity > 0
      ? completedQuantity / plannedQuantity
      : 0;

  // Current implementation:
  // EV is based on physical progress.
  const activityEV =
    activityBAC * progress;

  // No schedule baseline table is currently
  // assumed, therefore PV is not fabricated.
  const activityPV = 0;

  const cost =
    actualCosts[activity.id] || {
      manpower: 0,
      equipment: 0,
      material: 0,
      actual_cost: 0
    };

  const activityAC =
    cost.manpower +
    cost.equipment +
    cost.material;

  BAC += activityBAC;
  PV += activityPV;
  EV += activityEV;
  AC += activityAC;

  activityEvm.push({
    activity_id: activity.id,
    activity_code: activity.activity_code,
    activity_name: activity.activity_name,

    planned_quantity:
      round(plannedQuantity),

    completed_quantity:
      round(completedQuantity),

    progress_percent:
      round(progress * 100),

    budget_at_completion:
      round(activityBAC),

    planned_value:
      round(activityPV),

    earned_value:
      round(activityEV),

    actual_cost:
      round(activityAC),

    cost_variance:
      round(activityEV - activityAC),

    cost_performance_index:
      activityAC > 0
        ? round(activityEV / activityAC)
        : 0
  });
});

// -------------------------------------------------
// PROJECT PERFORMANCE
// -------------------------------------------------

const CV =
  EV - AC;

const CPI =
  AC > 0
    ? EV / AC
    : 0;

const SPI =
  PV > 0
    ? EV / PV
    : 0;

const SV =
  PV > 0
    ? EV - PV
    : 0;

// -------------------------------------------------
// EAC
// -------------------------------------------------

let EAC = 0;

if (CPI > 0) {
  EAC = BAC / CPI;
} else {
  EAC = BAC;
}

// -------------------------------------------------
// ETC
// -------------------------------------------------

const ETC =
  Math.max(
    EAC - AC,
    0
  );

// -------------------------------------------------
// VAC
// -------------------------------------------------

const VAC =
  BAC - EAC;

// -------------------------------------------------
// TCPI
// -------------------------------------------------

let TCPI = 0;

const remainingBudget =
  BAC - AC;

const remainingWork =
  BAC - EV;

if (remainingBudget > 0) {
  TCPI =
    remainingWork /
    remainingBudget;
}

// -------------------------------------------------
// STATUS
// -------------------------------------------------

let costStatus = "NO_COST_DATA";

if (CPI > 1.05) {
  costStatus = "UNDER_COST";
} else if (CPI < 0.95 && CPI > 0) {
  costStatus = "OVER_COST";
} else if (CPI > 0) {
  costStatus = "ON_COST";
}

let scheduleStatus =
  "NO_BASELINE";

if (PV > 0) {
  if (SPI > 1.05) {
    scheduleStatus = "AHEAD";
  } else if (SPI < 0.95) {
    scheduleStatus = "BEHIND";
  } else {
    scheduleStatus = "ON_SCHEDULE";
  }
}

// -------------------------------------------------
// RESPONSE
// -------------------------------------------------

return res.json({

  success: true,

  project: {
    id: project.id,
    project_code: project.project_code,
    project_name:
      project.project_name ||
      project.name,
    status: project.status
  },

  budget: {
    budget_at_completion:
      round(BAC)
  },

  earned_value: {
    planned_value:
      round(PV),

    earned_value:
      round(EV),

    actual_cost:
      round(AC)
  },

  performance: {

    cost_variance:
      round(CV),

    cost_performance_index:
      round(CPI),

    schedule_variance:
      round(SV),

    schedule_performance_index:
      round(SPI),

    estimate_at_completion:
      round(EAC),

    estimate_to_complete:
      round(ETC),

    variance_at_completion:
      round(VAC),

    to_complete_performance_index:
      round(TCPI)
  },

  status: {
    cost_status:
      costStatus,

    schedule_status:
      scheduleStatus
  },

  activities:
    activityEvm
});
```

} catch (error) {

```
console.error(
  "Project EVM error:",
  error
);

return res.status(500).json({
  success: false,
  message: "Server error",
  error: error.message
});
```

}
});

// =====================================================
// EXPORT
// =====================================================

module.exports = router;
