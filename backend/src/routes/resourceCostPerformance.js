const express = require("express");
const router = express.Router();

const supabase = require("../config/supabase");


// =====================================================
// GET ALL RESOURCE COST PERFORMANCE
// =====================================================

router.get("/", async (req, res) => {
  try {

    const { data, error } = await supabase
      .from("resource_cost_performance")
      .select("*")
      .order("cost_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch resource cost performance",
        error: error.message
      });
    }

    return res.json({
      success: true,
      count: data.length,
      resource_cost_performance: data
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
// GET COST PERFORMANCE BY ACTIVITY
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
      .from("resource_cost_performance")
      .select("*")
      .eq("activity_id", activityId)
      .order("cost_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch activity cost performance",
        error: error.message
      });
    }

    return res.json({
      success: true,
      activity_id: activityId,
      count: data.length,
      resource_cost_performance: data
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
// GET COST PERFORMANCE BY PROJECT
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
      .from("resource_cost_performance")
      .select("*")
      .eq("project_id", projectId)
      .order("cost_date", { ascending: false })
      .order("id", { ascending: false });

    if (error) {
      return res.status(500).json({
        success: false,
        message: "Failed to fetch project cost performance",
        error: error.message
      });
    }

    return res.json({
      success: true,
      project_id: projectId,
      count: data.length,
      resource_cost_performance: data
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
// CREATE RESOURCE COST PERFORMANCE
// =====================================================

router.post("/", async (req, res) => {
  try {

    const {
      company_id,
      project_id,
      activity_id,
      resource_planning_id,
      resource_performance_id,
      resource_productivity_id,

      resource_type,
      resource_code,
      resource_name,

      cost_date,

      planned_quantity,
      actual_quantity,

      planned_hours,
      actual_hours,

      planned_rate,
      actual_rate,

      productivity_target,

      remarks
    } = req.body;


    // =================================================
    // VALIDATION
    // =================================================

    if (
      !project_id ||
      !activity_id ||
      !resource_type ||
      !cost_date
    ) {
      return res.status(400).json({
        success: false,
        message:
          "project_id, activity_id, resource_type and cost_date are required"
      });
    }


    // =================================================
    // NUMERIC VALUES
    // =================================================

    const plannedQty = Number(planned_quantity || 0);
    const actualQty = Number(actual_quantity || 0);

    const plannedHours = Number(planned_hours || 0);
    const actualHours = Number(actual_hours || 0);

    const plannedRate = Number(planned_rate || 0);
    const actualRate = Number(actual_rate || 0);

    const productivityTarget =
      Number(productivity_target || 0);


    // =================================================
    // COST CALCULATION
    // =================================================

    const plannedCost =
      plannedHours * plannedRate;

    const actualCost =
      actualHours * actualRate;


    // =================================================
    // COST VARIANCE
    // =================================================

    const costVariance =
      plannedCost - actualCost;


    let costVariancePercentage = 0;

    if (plannedCost > 0) {
      costVariancePercentage =
        (costVariance / plannedCost) * 100;
    }


    // =================================================
    // PRODUCTIVITY
    // =================================================

    let actualProductivity = 0;

    if (actualHours > 0) {
      actualProductivity =
        actualQty / actualHours;
    }


    let productivityPercentage = 0;

    if (productivityTarget > 0) {
      productivityPercentage =
        (actualProductivity / productivityTarget) * 100;
    }


    // =================================================
    // COST EFFICIENCY
    // =================================================

    let costEfficiency = 0;

    if (actualCost > 0) {
      costEfficiency =
        plannedCost / actualCost;
    }


    // =================================================
    // EFFICIENCY STATUS
    // =================================================

    let efficiencyStatus = "NORMAL";

    if (
      productivityPercentage >= 100 &&
      costVariance >= 0
    ) {

      efficiencyStatus = "EFFICIENT";

    } else if (
      productivityPercentage < 80 ||
      costVariancePercentage < -20
    ) {

      efficiencyStatus = "INEFFICIENT";

    } else if (
      productivityPercentage < 100 ||
      costVariance < 0
    ) {

      efficiencyStatus = "WARNING";
    }


    // =================================================
    // INSERT
    // =================================================

    const { data, error } = await supabase
      .from("resource_cost_performance")
      .insert([
        {
          company_id:
            company_id || null,

          project_id,
          activity_id,

          resource_planning_id:
            resource_planning_id || null,

          resource_performance_id:
            resource_performance_id || null,

          resource_productivity_id:
            resource_productivity_id || null,

          resource_type,

          resource_code:
            resource_code || null,

          resource_name:
            resource_name || null,

          cost_date,

          planned_quantity:
            plannedQty,

          actual_quantity:
            actualQty,

          planned_hours:
            plannedHours,

          actual_hours:
            actualHours,

          planned_rate:
            plannedRate,

          actual_rate:
            actualRate,

          planned_cost:
            Number(plannedCost.toFixed(2)),

          actual_cost:
            Number(actualCost.toFixed(2)),

          cost_variance:
            Number(costVariance.toFixed(2)),

          cost_variance_percentage:
            Number(
              costVariancePercentage.toFixed(3)
            ),

          productivity_target:
            productivityTarget,

          actual_productivity:
            Number(
              actualProductivity.toFixed(3)
            ),

          productivity_percentage:
            Number(
              productivityPercentage.toFixed(3)
            ),

          cost_efficiency:
            Number(
              costEfficiency.toFixed(3)
            ),

          efficiency_status:
            efficiencyStatus,

          remarks:
            remarks || null
        }
      ])
      .select()
      .single();


    if (error) {
      return res.status(500).json({
        success: false,
        message:
          "Failed to create resource cost performance",
        error: error.message
      });
    }


    return res.status(201).json({
      success: true,
      message:
        "Resource cost performance created successfully",
      resource_cost_performance: data
    });


  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });

  }
});


module.exports = router;