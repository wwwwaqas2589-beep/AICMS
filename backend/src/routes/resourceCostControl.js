const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET RESOURCE COST CONTROL - ALL
// =====================================================

router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("resource_cost")
      .select("*")
      .order("cost_date", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch resource cost control",
        error: error.message
      });
    }

    const records = data || [];

    let plannedCost = 0;
    let actualCost = 0;
    let plannedHours = 0;
    let actualHours = 0;
    let plannedQuantity = 0;
    let actualQuantity = 0;

    records.forEach((row) => {
      plannedCost += Number(row.planned_cost || 0);
      actualCost += Number(row.actual_cost || 0);

      plannedHours += Number(row.planned_hours || 0);
      actualHours += Number(row.actual_hours || 0);

      plannedQuantity += Number(row.planned_quantity || 0);
      actualQuantity += Number(row.actual_quantity || 0);
    });

    const costVariance = plannedCost - actualCost;

    const costVariancePercentage =
      plannedCost > 0
        ? (costVariance / plannedCost) * 100
        : 0;

    const costEfficiency =
      actualCost > 0
        ? (plannedCost / actualCost) * 100
        : 0;

    const actualProductivity =
      actualHours > 0
        ? actualQuantity / actualHours
        : 0;

    return res.json({
      success: true,

      count: records.length,

      summary: {
        planned_quantity: Number(plannedQuantity.toFixed(3)),
        actual_quantity: Number(actualQuantity.toFixed(3)),

        planned_hours: Number(plannedHours.toFixed(3)),
        actual_hours: Number(actualHours.toFixed(3)),

        planned_cost: Number(plannedCost.toFixed(2)),
        actual_cost: Number(actualCost.toFixed(2)),

        cost_variance: Number(costVariance.toFixed(2)),

        cost_variance_percentage:
          Number(costVariancePercentage.toFixed(3)),

        cost_efficiency:
          Number(costEfficiency.toFixed(3)),

        actual_productivity:
          Number(actualProductivity.toFixed(3))
      },

      records
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
// GET RESOURCE COST CONTROL BY PROJECT
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
      .from("resource_cost")
      .select("*")
      .eq("project_id", projectId)
      .order("cost_date", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project resource cost control",
        error: error.message
      });
    }

    const records = data || [];

    let plannedCost = 0;
    let actualCost = 0;
    let plannedHours = 0;
    let actualHours = 0;

    records.forEach((row) => {
      plannedCost += Number(row.planned_cost || 0);
      actualCost += Number(row.actual_cost || 0);

      plannedHours += Number(row.planned_hours || 0);
      actualHours += Number(row.actual_hours || 0);
    });

    const costVariance = plannedCost - actualCost;

    const costVariancePercentage =
      plannedCost > 0
        ? (costVariance / plannedCost) * 100
        : 0;

    const costEfficiency =
      actualCost > 0
        ? (plannedCost / actualCost) * 100
        : 0;

    return res.json({
      success: true,

      project_id: projectId,

      count: records.length,

      summary: {
        planned_cost: Number(plannedCost.toFixed(2)),
        actual_cost: Number(actualCost.toFixed(2)),

        cost_variance: Number(costVariance.toFixed(2)),

        cost_variance_percentage:
          Number(costVariancePercentage.toFixed(3)),

        planned_hours: Number(plannedHours.toFixed(3)),
        actual_hours: Number(actualHours.toFixed(3)),

        cost_efficiency:
          Number(costEfficiency.toFixed(3))
      },

      records
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
// GET RESOURCE COST CONTROL BY ACTIVITY
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
      .from("resource_cost")
      .select("*")
      .eq("activity_id", activityId)
      .order("cost_date", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity resource cost control",
        error: error.message
      });
    }

    const records = data || [];

    let plannedCost = 0;
    let actualCost = 0;
    let plannedHours = 0;
    let actualHours = 0;

    records.forEach((row) => {
      plannedCost += Number(row.planned_cost || 0);
      actualCost += Number(row.actual_cost || 0);

      plannedHours += Number(row.planned_hours || 0);
      actualHours += Number(row.actual_hours || 0);
    });

    const costVariance = plannedCost - actualCost;

    const costVariancePercentage =
      plannedCost > 0
        ? (costVariance / plannedCost) * 100
        : 0;

    const costEfficiency =
      actualCost > 0
        ? (plannedCost / actualCost) * 100
        : 0;

    return res.json({
      success: true,

      activity_id: activityId,

      count: records.length,

      summary: {
        planned_cost: Number(plannedCost.toFixed(2)),
        actual_cost: Number(actualCost.toFixed(2)),

        cost_variance: Number(costVariance.toFixed(2)),

        cost_variance_percentage:
          Number(costVariancePercentage.toFixed(3)),

        planned_hours: Number(plannedHours.toFixed(3)),
        actual_hours: Number(actualHours.toFixed(3)),

        cost_efficiency:
          Number(costEfficiency.toFixed(3))
      },

      records
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
// EXPORT
// =====================================================

module.exports = router;