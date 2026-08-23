const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");

// =====================================================
// GET RESOURCE COST SUMMARY - ALL
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
        message: "Failed to fetch resource cost summary",
        error: error.message
      });
    }

    const records = data || [];

    const summary = {
      total_records: records.length,

      planned_cost: records.reduce(
        (sum, row) => sum + Number(row.planned_cost || 0),
        0
      ),

      actual_cost: records.reduce(
        (sum, row) => sum + Number(row.actual_cost || 0),
        0
      ),

      cost_variance: records.reduce(
        (sum, row) => sum + Number(row.cost_variance || 0),
        0
      ),

      planned_hours: records.reduce(
        (sum, row) => sum + Number(row.planned_hours || 0),
        0
      ),

      actual_hours: records.reduce(
        (sum, row) => sum + Number(row.actual_hours || 0),
        0
      )
    };

    if (summary.planned_cost > 0) {
      summary.cost_variance_percentage =
        (summary.cost_variance / summary.planned_cost) * 100;
    } else {
      summary.cost_variance_percentage = 0;
    }

    if (summary.actual_cost > 0) {
      summary.cost_efficiency =
        (summary.planned_cost / summary.actual_cost) * 100;
    } else {
      summary.cost_efficiency = 0;
    }

    return res.json({
      success: true,
      summary: {
        total_records: summary.total_records,

        planned_cost: Number(
          summary.planned_cost.toFixed(2)
        ),

        actual_cost: Number(
          summary.actual_cost.toFixed(2)
        ),

        cost_variance: Number(
          summary.cost_variance.toFixed(2)
        ),

        cost_variance_percentage: Number(
          summary.cost_variance_percentage.toFixed(3)
        ),

        planned_hours: Number(
          summary.planned_hours.toFixed(2)
        ),

        actual_hours: Number(
          summary.actual_hours.toFixed(2)
        ),

        cost_efficiency: Number(
          summary.cost_efficiency.toFixed(3)
        )
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
// GET RESOURCE COST SUMMARY BY PROJECT
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
        message: "Failed to fetch project resource cost summary",
        error: error.message
      });
    }

    const records = data || [];

    const plannedCost = records.reduce(
      (sum, row) => sum + Number(row.planned_cost || 0),
      0
    );

    const actualCost = records.reduce(
      (sum, row) => sum + Number(row.actual_cost || 0),
      0
    );

    const costVariance = plannedCost - actualCost;

    const plannedHours = records.reduce(
      (sum, row) => sum + Number(row.planned_hours || 0),
      0
    );

    const actualHours = records.reduce(
      (sum, row) => sum + Number(row.actual_hours || 0),
      0
    );

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

      summary: {
        total_records: records.length,

        planned_cost: Number(
          plannedCost.toFixed(2)
        ),

        actual_cost: Number(
          actualCost.toFixed(2)
        ),

        cost_variance: Number(
          costVariance.toFixed(2)
        ),

        cost_variance_percentage: Number(
          costVariancePercentage.toFixed(3)
        ),

        planned_hours: Number(
          plannedHours.toFixed(2)
        ),

        actual_hours: Number(
          actualHours.toFixed(2)
        ),

        cost_efficiency: Number(
          costEfficiency.toFixed(3)
        )
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
// GET RESOURCE COST SUMMARY BY ACTIVITY
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
        message: "Failed to fetch activity resource cost summary",
        error: error.message
      });
    }

    const records = data || [];

    const plannedCost = records.reduce(
      (sum, row) => sum + Number(row.planned_cost || 0),
      0
    );

    const actualCost = records.reduce(
      (sum, row) => sum + Number(row.actual_cost || 0),
      0
    );

    const costVariance = plannedCost - actualCost;

    const plannedHours = records.reduce(
      (sum, row) => sum + Number(row.planned_hours || 0),
      0
    );

    const actualHours = records.reduce(
      (sum, row) => sum + Number(row.actual_hours || 0),
      0
    );

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

      summary: {
        total_records: records.length,

        planned_cost: Number(
          plannedCost.toFixed(2)
        ),

        actual_cost: Number(
          actualCost.toFixed(2)
        ),

        cost_variance: Number(
          costVariance.toFixed(2)
        ),

        cost_variance_percentage: Number(
          costVariancePercentage.toFixed(3)
        ),

        planned_hours: Number(
          plannedHours.toFixed(2)
        ),

        actual_hours: Number(
          actualHours.toFixed(2)
        ),

        cost_efficiency: Number(
          costEfficiency.toFixed(3)
        )
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