const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");


// =====================================================
// HELPER FUNCTIONS
// =====================================================

const round2 = (value) => {
  return Number(Number(value || 0).toFixed(2));
};

const round3 = (value) => {
  return Number(Number(value || 0).toFixed(3));
};


// =====================================================
// CALCULATE SUMMARY
// =====================================================

const calculateSummary = (records) => {

  const plannedCost = records.reduce(
    (sum, row) => sum + Number(row.planned_cost || 0),
    0
  );

  const actualCost = records.reduce(
    (sum, row) => sum + Number(row.actual_cost || 0),
    0
  );

  const plannedHours = records.reduce(
    (sum, row) => sum + Number(row.planned_hours || 0),
    0
  );

  const actualHours = records.reduce(
    (sum, row) => sum + Number(row.actual_hours || 0),
    0
  );


  // ===================================================
  // COST VARIANCE
  //
  // Positive = Saving
  // Negative = Over Budget
  // ===================================================

  const costVariance =
    plannedCost - actualCost;


  const costVariancePercentage =
    plannedCost > 0
      ? (costVariance / plannedCost) * 100
      : 0;


  // ===================================================
  // COST EFFICIENCY
  //
  // Planned / Actual × 100
  // ===================================================

  const costEfficiency =
    actualCost > 0
      ? (plannedCost / actualCost) * 100
      : 0;


  // ===================================================
  // EFFICIENCY STATUS
  // ===================================================

  let efficiencyStatus = "WARNING";

  if (costEfficiency >= 105) {
    efficiencyStatus = "EFFICIENT";
  }
  else if (costEfficiency >= 95) {
    efficiencyStatus = "NORMAL";
  }
  else {
    efficiencyStatus = "INEFFICIENT";
  }


  // ===================================================
  // HOURS VARIANCE
  // ===================================================

  const hoursVariance =
    plannedHours - actualHours;


  const hoursVariancePercentage =
    plannedHours > 0
      ? (hoursVariance / plannedHours) * 100
      : 0;


  return {

    total_records:
      records.length,

    planned_cost:
      round2(plannedCost),

    actual_cost:
      round2(actualCost),

    cost_variance:
      round2(costVariance),

    cost_variance_percentage:
      round3(costVariancePercentage),

    planned_hours:
      round2(plannedHours),

    actual_hours:
      round2(actualHours),

    hours_variance:
      round2(hoursVariance),

    hours_variance_percentage:
      round3(hoursVariancePercentage),

    cost_efficiency:
      round3(costEfficiency),

    efficiency_status:
      efficiencyStatus
  };
};


// =====================================================
// GET ALL RESOURCE COST SUMMARY
// =====================================================

router.get("/", async (req, res) => {

  try {

    const { data, error } = await supabase
      .from("resource_cost_performance")
      .select("*")
      .order("cost_date", {
        ascending: false
      });


    if (error) {

      return res.status(500).json({

        success: false,

        message:
          "Failed to fetch resource cost performance summary",

        error:
          error.message

      });

    }


    const records =
      data || [];


    const summary =
      calculateSummary(records);


    return res.json({

      success: true,

      summary,

      records

    });

  }
  catch (error) {

    return res.status(500).json({

      success: false,

      message:
        "Internal server error",

      error:
        error.message

    });

  }

});


// =====================================================
// GET RESOURCE COST SUMMARY BY PROJECT
// =====================================================

router.get("/project/:projectId", async (req, res) => {

  try {

    const projectId =
      Number(req.params.projectId);


    if (!Number.isInteger(projectId)) {

      return res.status(400).json({

        success: false,

        message:
          "Invalid project ID"

      });

    }


    const { data, error } = await supabase
      .from("resource_cost_performance")
      .select("*")
      .eq("project_id", projectId)
      .order("cost_date", {
        ascending: false
      });


    if (error) {

      return res.status(500).json({

        success: false,

        message:
          "Failed to fetch project resource cost summary",

        error:
          error.message

      });

    }


    const records =
      data || [];


    const summary =
      calculateSummary(records);


    return res.json({

      success: true,

      project_id:
        projectId,

      summary,

      records

    });

  }
  catch (error) {

    return res.status(500).json({

      success: false,

      message:
        "Internal server error",

      error:
        error.message

    });

  }

});


// =====================================================
// GET RESOURCE COST SUMMARY BY ACTIVITY
// =====================================================

router.get("/activity/:activityId", async (req, res) => {

  try {

    const activityId =
      Number(req.params.activityId);


    if (!Number.isInteger(activityId)) {

      return res.status(400).json({

        success: false,

        message:
          "Invalid activity ID"

      });

    }


    const { data, error } = await supabase
      .from("resource_cost_performance")
      .select("*")
      .eq("activity_id", activityId)
      .order("cost_date", {
        ascending: false
      });


    if (error) {

      return res.status(500).json({

        success: false,

        message:
          "Failed to fetch activity resource cost summary",

        error:
          error.message

      });

    }


    const records =
      data || [];


    const summary =
      calculateSummary(records);


    return res.json({

      success: true,

      activity_id:
        activityId,

      summary,

      records

    });

  }
  catch (error) {

    return res.status(500).json({

      success: false,

      message:
        "Internal server error",

      error:
        error.message

    });

  }

});


// =====================================================
// EXPORT ROUTER
// =====================================================

module.exports = router;