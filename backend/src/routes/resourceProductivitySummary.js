const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET ALL RESOURCE PRODUCTIVITY SUMMARY
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("resource_productivity")
      .select("*")
      .order("productivity_date", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch resource productivity summary",
        error: error.message
      });
    }

    const summary = calculateSummary(data);

    return res.json({
      success: true,
      count: data.length,
      summary: summary
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});


// =====================================================
// GET RESOURCE PRODUCTIVITY SUMMARY BY ACTIVITY
// =====================================================

router.get("/activity/:activityId", async (req, res) => {
  try {
    const activityId = Number(req.params.activityId);

    if (!Number.isInteger(activityId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid activity ID"
      });
    }

    const { data, error } = await supabase
      .from("resource_productivity")
      .select("*")
      .eq("activity_id", activityId)
      .order("productivity_date", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity productivity summary",
        error: error.message
      });
    }

    const summary = calculateSummary(data);

    return res.json({
      success: true,
      activity_id: activityId,
      count: data.length,
      summary: summary,
      records: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});


// =====================================================
// GET RESOURCE PRODUCTIVITY SUMMARY BY PROJECT
// =====================================================

router.get("/project/:projectId", async (req, res) => {
  try {
    const projectId = Number(req.params.projectId);

    if (!Number.isInteger(projectId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid project ID"
      });
    }

    const { data, error } = await supabase
      .from("resource_productivity")
      .select("*")
      .eq("project_id", projectId)
      .order("productivity_date", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project productivity summary",
        error: error.message
      });
    }

    const summary = calculateSummary(data);

    return res.json({
      success: true,
      project_id: projectId,
      count: data.length,
      summary: summary,
      records: data
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  }
});


// =====================================================
// SUMMARY CALCULATION
// =====================================================

function calculateSummary(data) {

  const records = Array.isArray(data) ? data : [];

  let plannedQuantity = 0;
  let actualQuantity = 0;

  let plannedHours = 0;
  let actualHours = 0;

  let plannedCost = 0;
  let actualCost = 0;

  let productivityTarget = 0;
  let actualProductivity = 0;

  let costVariance = 0;

  let efficient = 0;
  let warning = 0;
  let inefficient = 0;
  let normal = 0;

  records.forEach((row) => {

    plannedQuantity += Number(row.planned_quantity || 0);
    actualQuantity += Number(row.actual_quantity || 0);

    plannedHours += Number(row.planned_hours || 0);
    actualHours += Number(row.actual_hours || 0);

    plannedCost += Number(row.planned_cost || 0);
    actualCost += Number(row.actual_cost || 0);

    productivityTarget += Number(
      row.productivity_target || 0
    );

    actualProductivity += Number(
      row.actual_productivity || 0
    );

    costVariance += Number(
      row.cost_variance || 0
    );

    const status = String(
      row.efficiency_status || ""
    ).toUpperCase();

    if (status === "EFFICIENT") {
      efficient++;
    } else if (status === "WARNING") {
      warning++;
    } else if (status === "INEFFICIENT") {
      inefficient++;
    } else {
      normal++;
    }

  });


  const quantityVariance =
    actualQuantity - plannedQuantity;

  const hoursVariance =
    plannedHours - actualHours;

  const costVariancePercentage =
    plannedCost > 0
      ? (costVariance / plannedCost) * 100
      : 0;

  const productivityPercentage =
    productivityTarget > 0
      ? (actualProductivity / productivityTarget) * 100
      : 0;


  return {

    total_records: records.length,

    planned_quantity:
      Number(plannedQuantity.toFixed(3)),

    actual_quantity:
      Number(actualQuantity.toFixed(3)),

    quantity_variance:
      Number(quantityVariance.toFixed(3)),

    planned_hours:
      Number(plannedHours.toFixed(3)),

    actual_hours:
      Number(actualHours.toFixed(3)),

    hours_variance:
      Number(hoursVariance.toFixed(3)),

    planned_cost:
      Number(plannedCost.toFixed(2)),

    actual_cost:
      Number(actualCost.toFixed(2)),

    cost_variance:
      Number(costVariance.toFixed(2)),

    cost_variance_percentage:
      Number(costVariancePercentage.toFixed(3)),

    productivity_target:
      Number(productivityTarget.toFixed(3)),

    actual_productivity:
      Number(actualProductivity.toFixed(3)),

    productivity_percentage:
      Number(productivityPercentage.toFixed(3)),

    efficiency: {
      efficient,
      warning,
      inefficient,
      normal
    }

  };
}


module.exports = router;